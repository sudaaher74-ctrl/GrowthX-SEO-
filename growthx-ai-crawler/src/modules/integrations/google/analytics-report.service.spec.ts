import { BadRequestException } from '@nestjs/common';
import { AnalyticsReportService, parseGa4Range } from './analytics-report.service';

const runReport = jest.fn();
jest.mock('./google-apis', () => ({
  google: { analyticsdata: () => ({ properties: { runReport: (args: any) => runReport(args) } }) },
}));

/**
 * The GA4 report is per workspace. These pin that every read and write is
 * keyed by the project it was asked for, that the property comes from that
 * project's own connection, and that each way of having no data has its own
 * state with a reason rather than an empty result.
 */
describe('AnalyticsReportService', () => {
  const build = (integration: any, snapshot: any = null, lastJob: any = null) => {
    const prisma: any = {
      integration: { findUnique: jest.fn().mockResolvedValue(integration), update: jest.fn().mockReturnValue('int-update') },
      ga4ReportSnapshot: {
        findUnique: jest.fn().mockResolvedValue(snapshot),
        upsert: jest.fn().mockImplementation((args) => args),
        deleteMany: jest.fn().mockReturnValue('deleted'),
      },
      dataSyncJob: { findFirst: jest.fn().mockResolvedValue(lastJob) },
      $transaction: jest.fn().mockResolvedValue([]),
    };
    const oauth: any = {
      clientFor: jest.fn().mockResolvedValue({}),
      markNeedsReauth: jest.fn().mockResolvedValue(undefined),
    };
    return { prisma, oauth, service: new AnalyticsReportService(prisma, oauth) };
  };

  const connected = {
    status: 'CONNECTED',
    statusMessage: null,
    selectedResourceId: 'properties/1',
    selectedResourceName: 'milquufresh',
    googleAccountEmail: 'owner@example.com',
    lastSyncedAt: null,
  };

  describe('parseGa4Range', () => {
    it('defaults to 28d and rejects anything the top bar does not offer', () => {
      expect(parseGa4Range(undefined)).toBe('28d');
      expect(parseGa4Range('7d')).toBe('7d');
      expect(() => parseGa4Range('365d')).toThrow(BadRequestException);
    });
  });

  describe('read', () => {
    it('says GA4 is not connected rather than returning empty figures', async () => {
      const { service } = build(null);
      const result = await service.read('p1', '28d');
      expect(result.state).toBe('NOT_CONNECTED');
      expect(result.data).toBeNull();
      expect(result.message).toMatch(/not connected/i);
    });

    it('asks for the snapshot of this project and its selected property only', async () => {
      const { service, prisma } = build(connected);
      await service.read('p1', '7d');
      expect(prisma.integration.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { projectId_provider: { projectId: 'p1', provider: 'analytics' } } }),
      );
      expect(prisma.ga4ReportSnapshot.findUnique).toHaveBeenCalledWith({
        where: { projectId_propertyId_range: { projectId: 'p1', propertyId: 'properties/1', range: '7d' } },
      });
      expect(prisma.dataSyncJob.findFirst.mock.calls[0][0].where.projectId).toBe('p1');
    });

    it('reports a connection with no property chosen and one needing reauthorization', async () => {
      expect((await build({ ...connected, selectedResourceId: null }).service.read('p1', '28d')).state).toBe('NEEDS_SELECTION');
      const reauth = await build({ ...connected, status: 'NEEDS_REAUTH', statusMessage: 'Google returned 401.' }).service.read(
        'p1',
        '28d',
      );
      expect(reauth.state).toBe('NEEDS_REAUTH');
      expect(reauth.message).toBe('Google returned 401.');
    });

    it('distinguishes never fetched, failed and empty-property', async () => {
      expect((await build(connected).service.read('p1', '28d')).state).toBe('NEVER_SYNCED');

      const failed = await build(connected, null, { errorMessage: 'Google refused access', startedAt: new Date() }).service.read('p1', '28d');
      expect(failed.state).toBe('ERROR');
      expect(failed.message).toBe('Google refused access');

      const empty = await build(connected, {
        syncedAt: new Date(),
        data: { empty: true },
      }).service.read('p1', '28d');
      expect(empty.state).toBe('EMPTY');
      expect(empty.message).toMatch(/milquufresh/);
    });

    it('serves the cached data and flags a newer failure instead of hiding either', async () => {
      const syncedAt = new Date('2026-09-28T04:00:00Z');
      const { service } = build(
        connected,
        { syncedAt, data: { empty: false, totals: { sessions: 5 } } },
        { errorMessage: 'quota', startedAt: new Date('2026-09-29T04:00:00Z') },
      );
      const result = await service.read('p1', '28d');
      expect(result.state).toBe('READY');
      expect(result.data).not.toBeNull();
      expect(result.lastError).toBe('quota');
    });

    it('ignores a failure older than the data on screen', async () => {
      const { service } = build(
        connected,
        { syncedAt: new Date('2026-09-29T04:00:00Z'), data: { empty: false } },
        { errorMessage: 'old', startedAt: new Date('2026-09-27T04:00:00Z') },
      );
      expect((await service.read('p1', '28d')).lastError).toBeNull();
    });
  });

  describe('refresh', () => {
    const answer = (dimensions: string[], metrics: string[]) => {
      const key = `${dimensions.join(',')}|${metrics.join(',')}`;
      const row = (dims: string[], vals: number[]) => ({
        dimensionValues: dims.map((value) => ({ value })),
        metricValues: vals.map((value) => ({ value: String(value) })),
      });
      const metadata = { timeZone: 'Asia/Kolkata' };
      if (key.startsWith('date|')) return { metadata, rows: [row(['20260925'], [10, 4])] };
      if (dimensions.length === 0 && metrics.length === 1) return { metadata, rows: [] }; // keyEvents probe
      if (dimensions.length === 0) return { metadata, rows: [row([], [100, 30, 20, 60, 0.6, 900, 542, 7])] };
      if (dimensions[0] === 'landingPage') return { metadata, rows: [row(['/'], [80, 0.7, 5])] };
      if (dimensions[0] === 'sessionDefaultChannelGroup') {
        return { metadata, rows: [row(['Organic Search'], [40, 12]), row(['Direct'], [60, 18])] };
      }
      return { metadata, rows: [row(['India'], [100, 30])] };
    };

    beforeEach(() => {
      runReport.mockReset();
      runReport.mockImplementation(async ({ requestBody }: any) => ({
        data: answer(
          requestBody.dimensions.map((d: any) => d.name),
          requestBody.metrics.map((m: any) => m.name),
        ),
      }));
    });

    it('stores all three windows for this project and property, in one transaction', async () => {
      const { service, prisma, oauth } = build(connected);
      const result = await service.refresh('p1');

      expect(oauth.clientFor).toHaveBeenCalledWith('p1', 'analytics');
      expect(result.property).toBe('milquufresh');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);

      const upserts = prisma.ga4ReportSnapshot.upsert.mock.calls.map((c: any[]) => c[0]);
      expect(upserts.map((u: any) => u.create.range).sort()).toEqual(['28d', '7d', '90d']);
      for (const u of upserts) {
        expect(u.create.projectId).toBe('p1');
        expect(u.create.propertyId).toBe('properties/1');
        expect(u.where.projectId_propertyId_range.projectId).toBe('p1');
      }
      // Anything stored for a previously selected property is dropped.
      expect(prisma.ga4ReportSnapshot.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'p1', propertyId: { not: 'properties/1' } },
      });
    });

    it('computes the figures the pages show from what Google returned', async () => {
      // The probe answers with no rows, which still means the metric exists.
      const { service, prisma } = build(connected);
      await service.refresh('p1');
      const data = prisma.ga4ReportSnapshot.upsert.mock.calls.map((c: any[]) => c[0]).find((u: any) => u.create.range === '7d').create.data;

      expect(data.totals).toEqual({
        sessions: 100,
        activeUsers: 30,
        newUsers: 20,
        engagedSessions: 60,
        engagementRate: 0.6,
        averageEngagementTimeSec: 30, // 900s over 30 active users
        views: 542,
        keyEvents: 7,
      });
      expect(data.organicSearchSessions).toBe(40);
      expect(data.channels[0]).toMatchObject({ channel: 'Organic Search', organic: true });
      expect(data.countries[0]).toMatchObject({ country: 'India', sessions: 100 });
      expect(data.landingPages[0]).toMatchObject({ page: '/', sessions: 80 });
      expect(data.daily).toHaveLength(7); // every day present, zero where GA4 had no row
      expect(data.empty).toBe(false);
    });

    it('stores key events as unknown, not zero, when the property has none', async () => {
      runReport.mockImplementation(async ({ requestBody }: any) => {
        const metrics = requestBody.metrics.map((m: any) => m.name);
        if (metrics.includes('keyEvents')) throw Object.assign(new Error('Invalid metric'), { response: { status: 400 } });
        return {
          data: answer(
            requestBody.dimensions.map((d: any) => d.name),
            metrics,
          ),
        };
      });
      const { service, prisma } = build(connected);
      await service.refresh('p1');
      const data = prisma.ga4ReportSnapshot.upsert.mock.calls[0][0].create.data;
      expect(data.totals.keyEvents).toBeNull();
      expect(data.landingPages[0].keyEvents).toBeNull();
    });

    it('marks an empty property as empty rather than as zeros', async () => {
      runReport.mockImplementation(async () => ({ data: { metadata: { timeZone: 'UTC' }, rows: [] } }));
      const { service, prisma } = build(connected);
      await service.refresh('p1');
      expect(prisma.ga4ReportSnapshot.upsert.mock.calls[0][0].create.data.empty).toBe(true);
    });

    it('writes nothing and explains itself when Google refuses, keeping the old snapshots', async () => {
      runReport.mockRejectedValue(
        Object.assign(new Error('forbidden'), {
          response: { status: 403, data: { error: { message: 'Google Analytics Data API has not been used in project 1 before or it is disabled.' } } },
        }),
      );
      const { service, prisma, oauth } = build(connected);
      await expect(service.refresh('p1')).rejects.toThrow(/not enabled on this app's Google Cloud project/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      // A disabled API is deployment configuration; it must not make the customer reconnect.
      expect(oauth.markNeedsReauth).not.toHaveBeenCalled();
    });

    it('flags the connection for reauthorization when Google rejects the grant', async () => {
      runReport.mockRejectedValue(Object.assign(new Error('unauthorized'), { response: { status: 401, data: { error: { message: 'Invalid Credentials' } } } }));
      const { service, oauth } = build(connected);
      await expect(service.refresh('p1')).rejects.toThrow();
      expect(oauth.markNeedsReauth).toHaveBeenCalledWith('p1', 'analytics', expect.any(String));
    });

    it('refuses a workspace with no property selected', async () => {
      const { service } = build({ selectedResourceId: null, selectedResourceName: null });
      await expect(service.refresh('p1')).rejects.toThrow(/No Google Analytics property/);
    });
  });
});
