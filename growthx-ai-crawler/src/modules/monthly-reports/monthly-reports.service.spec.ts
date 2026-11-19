import { BadRequestException, GoneException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MonthlyReportsService } from './monthly-reports.service';
import { renderMonthlyReportHtml } from './monthly-report-pdf';

describe('MonthlyReportsService', () => {
  let mockPrisma: any;
  let service: MonthlyReportsService;

  const fakeProject = {
    id: 'proj-1',
    name: 'Acme Tea',
    organizationId: 'org-1',
    websites: [{ id: 'site-1', domain: 'acmetea.in' }],
    organization: {
      whiteLabelEnabled: true,
      agencyName: 'Zenith SEO Partners',
      logoUrl: 'https://zenith.example/logo.png',
      brandColor: '#2563eb',
      contactLine: 'team@zenith.example',
      footerText: 'Prepared by Zenith SEO Partners',
    },
  };

  beforeEach(() => {
    mockPrisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue(fakeProject),
        findMany: jest.fn().mockResolvedValue([{ id: 'proj-1', organizationId: 'org-1' }]),
      },
      crawlJob: {
        findFirst: jest.fn().mockResolvedValue({ healthScore: 88, pagesCrawled: 42, finishedAt: new Date('2026-10-20T00:00:00Z') }),
      },
      fixImpactLedgerEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            eventType: 'DEPLOYMENT_VERIFIED',
            title: 'Updated Homepage Title',
            affectedUrl: 'https://acmetea.in/',
            verificationStatus: 'VERIFIED',
            pullRequestUrl: 'https://github.com/acme/site/pull/9',
            evidenceData: { field: 'META_TITLE' },
            createdAt: new Date('2026-10-12T00:00:00Z'),
          },
          {
            eventType: 'REGRESSION_DETECTED',
            title: 'Regression detected: Missing H1',
            affectedUrl: 'https://acmetea.in/shop',
            verificationStatus: 'REGRESSED',
            pullRequestUrl: null,
            evidenceData: {},
            createdAt: new Date('2026-10-22T00:00:00Z'),
          },
          {
            eventType: 'FIX_ROLLED_BACK',
            title: 'Revert PR opened for #7',
            affectedUrl: 'https://acmetea.in/about',
            verificationStatus: 'ROLLED_BACK',
            pullRequestUrl: 'https://github.com/acme/site/pull/10',
            evidenceData: {},
            createdAt: new Date('2026-10-24T00:00:00Z'),
          },
        ]),
      },
      growthOpportunity: {
        findMany: jest.fn().mockResolvedValue([
          {
            title: 'Add FAQ Schema to top product pages',
            source: 'WEBSITE',
            potential: 'HIGH',
            effort: 'LOW',
            evidence: [{ label: 'Site historical ROI', value: '3/3 measured SEO fixes observed positive change (+19% avg clicks)' }],
          },
        ]),
      },
      backlinkSource: {
        findMany: jest.fn().mockResolvedValue([
          { sourceUrl: 'https://teablog.in/best-tea', status: 'LIVE', createdAt: new Date('2026-10-10T00:00:00Z') },
          { sourceUrl: 'https://olddir.in/acme', status: 'LOST', createdAt: new Date('2026-08-01T00:00:00Z') },
        ]),
      },
      competitorReportSnapshot: {
        findFirst: jest.fn().mockResolvedValue({ report: { analysis: { executiveSummary: 'Rivals publish more guides.' } } }),
      },
      monthlyReportSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(({ data }) => Promise.resolve({ id: 'snap-1', ...data, createdAt: new Date(), updatedAt: new Date() })),
        update: jest.fn(({ data }) => Promise.resolve({ id: 'snap-1', projectId: 'proj-1', month: '2026-10', isLocked: true, lockedAt: new Date(), updatedAt: new Date(), ...data })),
        upsert: jest.fn(({ create }) => Promise.resolve({ id: 'snap-1', ...create, createdAt: new Date(), updatedAt: new Date() })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new MonthlyReportsService(mockPrisma as unknown as PrismaService);
  });

  it('rejects invalid month formats', async () => {
    await expect(service.getSnapshot('org-1', 'proj-1', '2026-13')).rejects.toThrow(BadRequestException);
    await expect(service.getSnapshot('org-1', 'proj-1', 'october')).rejects.toThrow(BadRequestException);
  });

  it('locks a snapshot with server telemetry, backlinks, accountability events, ROI priorities, and authoritative white-label branding', async () => {
    const locked = await service.lockSnapshot('org-1', 'proj-1', '2026-10', {
      agencyNotes: 'Strong month for organic clicks.',
    });

    expect(locked.isLocked).toBe(true);
    expect(locked.agencyNotes).toBe('Strong month for organic clicks.');
    expect(locked.payload.whiteLabel).toMatchObject({
      enabled: true,
      agencyName: 'Zenith SEO Partners',
      brandColor: '#2563eb',
    });
    expect(locked.payload.backlinks).toMatchObject({
      totalVerified: 1,
      referringDomains: 1,
      newCount: 1,
      lostCount: 1,
    });
    expect(locked.payload.kpis).toMatchObject({
      healthScore: 88,
      verifiedFixes: 1,
      regressions: 1,
      rollbacks: 1,
    });
    expect(locked.payload.nextMonthPriorities?.[0]).toMatchObject({
      title: 'Add FAQ Schema to top product pages',
      roiNote: expect.stringContaining('+19% avg clicks'),
    });
  });

  it('generates and validates public share tokens, and rejects expired or revoked tokens', async () => {
    const shared = await service.createShareLink('org-1', 'proj-1', '2026-10', { expiresInDays: 30 });
    expect(shared.shareToken.length).toBeGreaterThanOrEqual(24);
    expect(shared.shareExpiresAt).toBeTruthy();

    mockPrisma.monthlyReportSnapshot.findUnique.mockResolvedValueOnce({
      month: '2026-10',
      lockedAt: new Date('2026-10-31T00:00:00Z'),
      updatedAt: new Date('2026-10-31T00:00:00Z'),
      agencyNotes: 'Client note',
      shareToken: shared.shareToken,
      shareExpiresAt: new Date(Date.now() + 86400000),
      payload: { domain: 'acmetea.in', month: '2026-10', monthLabel: 'October 2026' },
    });
    const pub = await service.getPublicSharedReport(shared.shareToken);
    expect(pub.month).toBe('2026-10');
    expect(pub.agencyNotes).toBe('Client note');

    // Expired link returns 410 Gone
    mockPrisma.monthlyReportSnapshot.findUnique.mockResolvedValueOnce({
      month: '2026-10',
      shareToken: shared.shareToken,
      shareExpiresAt: new Date(Date.now() - 1000),
      payload: {},
    });
    await expect(service.getPublicSharedReport(shared.shareToken)).rejects.toThrow(GoneException);

    // Unknown/short token returns 404
    await expect(service.getPublicSharedReport('short')).rejects.toThrow(NotFoundException);

    const rev = await service.revokeShareLink('org-1', 'proj-1', '2026-10');
    expect(rev).toEqual({ revoked: true, month: '2026-10' });
  });

  it('escapes HTML cleanly in PDF template to prevent script injection', () => {
    const html = renderMonthlyReportHtml(
      {
        domain: 'acmetea.in',
        month: '2026-10',
        monthLabel: 'October 2026',
        generatedAt: '2026-10-31T00:00:00Z',
        whiteLabel: {
          enabled: true,
          agencyName: '<script>alert(1)</script>Agency',
          logoUrl: 'javascript:alert(1)',
          brandColor: 'red;background:url(x)',
          contactLine: null,
          footerText: null,
        },
        kpis: { clicks: 1200 },
      },
      '<b>Note</b> & <script>bad()</script>',
    );

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('javascript:alert');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;Agency');
    expect(html).toContain('&lt;b&gt;Note&lt;/b&gt; &amp; &lt;script&gt;bad()&lt;/script&gt;');
    expect(html).toContain('#111827');
  });
});
