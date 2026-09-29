import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MIN_DAYS_AFTER, SeoImpactService } from './seo-impact.service';

const DAY = 24 * 60 * 60 * 1000;

function build(record?: any) {
  const stored: any[] = [];
  const prisma: any = {
    project: { findFirst: jest.fn(async ({ where }: any) => (where.organizationId === 'org_1' ? { id: where.id } : null)) },
    gscDailyMetric: {
      findMany: jest.fn(async ({ where }: any) =>
        where.grain === 'TOTAL'
          ? [{ clicks: 500, impressions: 20000, position: 12 }]
          : [
              { page: 'https://milquufresh.in/buffalo-milk', clicks: 100, impressions: 4000, position: 14 },
              { page: 'https://milquufresh.in/buffalo-milk-2', clicks: 999, impressions: 9999, position: 1 }, // a different page that merely contains the path
            ],
      ),
    },
    ga4DailyMetric: {
      findMany: jest.fn(async ({ where }: any) =>
        where.grain === 'TOTAL'
          ? [{ sessions: 3000, engagementRate: 0.5, conversions: null }]
          : [{ landingPage: '/buffalo-milk', sessions: 200, engagementRate: 0.4, conversions: null }],
      ),
    },
    gbpDailyMetric: { groupBy: jest.fn().mockResolvedValue([]) },
    promptCheck: { findMany: jest.fn().mockResolvedValue([]) },
    seoImpactRecord: {
      create: jest.fn(async ({ data }: any) => {
        stored.push({ id: 'r1', ...data });
        return stored[0];
      }),
      findFirst: jest.fn(async () => record ?? null),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(async ({ data }: any) => ({ ...record, ...data })),
    },
  };
  return { service: new SeoImpactService(prisma), prisma, stored };
}

describe('SeoImpactService.plan', () => {
  it('records the figures for the page as they stand now, and only that page', async () => {
    const { service, stored } = build();
    await service.plan('org_1', 'proj_1', 'u1', { url: 'https://milquufresh.in/buffalo-milk', findingType: 'LOW_CTR', action: 'Rewrite title and meta description' });

    const baseline = stored[0].baseline;
    expect(baseline.page.gsc).toMatchObject({ clicks: 100, impressions: 4000 });
    expect(baseline.page.ga4).toMatchObject({ sessions: 200, conversions: null });
    expect(baseline.site.gsc.clicks).toBe(500);
    expect(baseline.site.gbp).toBeNull();
    expect(baseline.site.ai).toBeNull();
    expect(stored[0]).toMatchObject({ projectId: 'proj_1', createdById: 'u1', windowDays: 28 });
  });

  it('records a site-wide change with no page block', async () => {
    const { service, stored } = build();
    await service.plan('org_1', 'proj_1', undefined, { findingType: 'ORGANIC_CLICKS_DECLINE', action: 'Fix sitemap' });
    expect(stored[0].baseline.page).toBeNull();
  });

  it('refuses another organization’s project and empty input', async () => {
    const { service, prisma } = build();
    await expect(service.plan('org_2', 'proj_1', 'u', { findingType: 'X', action: 'y' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.seoImpactRecord.create).not.toHaveBeenCalled();
    await expect(service.plan('org_1', 'proj_1', 'u', { findingType: '', action: '' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('SeoImpactService.measure', () => {
  const baseline = {
    capturedAt: new Date(Date.now() - 40 * DAY).toISOString(),
    range: { start: '2026-07-01', end: '2026-07-28', days: 28 },
    page: { gsc: { clicks: 60, impressions: 4000, ctr: 0.015, position: 14 }, ga4: { sessions: 200, engagementRate: 0.4, conversions: null } },
    site: { gsc: { clicks: 500, impressions: 20000, ctr: 0.025, position: 12 }, ga4: null, gbp: null, ai: null },
  };
  const rec = (over: any = {}) => ({ id: 'r1', projectId: 'proj_1', url: 'https://milquufresh.in/buffalo-milk', findingType: 'LOW_CTR', action: 'Rewrite title', note: null, status: 'IMPLEMENTED', windowDays: 28, baseline, createdAt: new Date(Date.now() - 40 * DAY), implementedAt: new Date(Date.now() - 30 * DAY), ...over });

  it('says what to do first when the change is not marked live', async () => {
    const { service } = build(rec({ status: 'PLANNED', implementedAt: null }));
    const r = await service.measure('org_1', 'proj_1', 'r1');
    expect(r.readiness.state).toBe('NOT_IMPLEMENTED');
    expect(r.changes).toEqual([]);
  });

  it('will not compare before search data has settled', async () => {
    const { service } = build(rec({ implementedAt: new Date(Date.now() - 3 * DAY) }));
    const r = await service.measure('org_1', 'proj_1', 'r1');
    expect(r.readiness.state).toBe('TOO_EARLY');
    expect(r.readiness.message).toMatch(/from \d{4}-\d{2}-\d{2}/);
    expect(r.after).toBeNull();
  });

  it(`compares once ${MIN_DAYS_AFTER}+ days have passed, keeps the causation limit, and names other changes`, async () => {
    const { service, prisma } = build(rec());
    prisma.seoImpactRecord.findMany.mockResolvedValue([{ url: null, action: 'Add FAQ schema', implementedAt: new Date(Date.now() - 20 * DAY) }]);
    const r = await service.measure('org_1', 'proj_1', 'r1');

    expect(r.readiness.state).toBe('READY');
    expect(r.changes.find((c) => c.key === 'page.clicks')!.verdict).toBe('IMPROVED');
    expect(r.explanation!.note).toMatch(/not that the action caused it/);
    expect(r.explanation!.contributors[0]).toMatch(/Add FAQ schema \(site-wide\)/);
    expect(r.explanation!.notComparable.join(' ')).toMatch(/Business Profile/);
  });

  it('is tenant scoped', async () => {
    const { service } = build(rec());
    await expect(service.measure('org_2', 'proj_1', 'r1')).rejects.toBeInstanceOf(NotFoundException);
    const none = build();
    await expect(none.service.measure('org_1', 'proj_1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SeoImpactService.markImplemented', () => {
  it('rejects a future date and an unknown record', async () => {
    const { service } = build({ id: 'r1', projectId: 'proj_1' });
    await expect(service.markImplemented('org_1', 'proj_1', 'r1', new Date(Date.now() + 10 * DAY).toISOString())).rejects.toBeInstanceOf(BadRequestException);
    await expect(build().service.markImplemented('org_1', 'proj_1', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });
});
