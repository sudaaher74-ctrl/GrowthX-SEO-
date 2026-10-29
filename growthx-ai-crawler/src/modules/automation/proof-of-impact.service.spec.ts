jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('simple-git', () => ({ simpleGit: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProofOfImpactService } from './proof-of-impact.service';
import { PrismaService } from '../../database/prisma.service';
import { GitService } from '../autonomous-engineer/agents/git/git.service';
import { SecurityService } from '../security/security.service';

describe('ProofOfImpactService', () => {
  let service: ProofOfImpactService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      fixSnapshot: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'snap_1', ...args.data })),
      },
      fixRegressionRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'reg_1', ...args.data })),
      },
      fixImpactLedgerEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'evt_1', ...args.data })),
      },
      automationRun: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      growthOpportunity: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      gscDailyMetric: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { clicks: 0, impressions: 0 } }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      ga4DailyMetric: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { sessions: 0, engagedSessions: 0, conversions: 0, totalRevenue: 0 } }),
      },
      aiVisibilityMetrics: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      aiVisibilityResponse: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      aiVisibilityPrompt: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue({ id: 'proj_1', name: 'Acme SEO', websites: [{ id: 'w1', domain: 'acme.com' }] }),
      },
      siteRepository: {
        findUnique: jest.fn().mockResolvedValue({ id: 'repo_1', owner: 'acme', name: 'repo', accessTokenEncrypted: 'encrypted', defaultBranch: 'main', framework: 'nextjs' }),
      },
      page: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProofOfImpactService,
        { provide: PrismaService, useValue: prisma },
        { provide: GitService, useValue: { cloneOrUpdate: jest.fn(), getCommitLog: jest.fn(), readPullRequestEvidence: jest.fn().mockResolvedValue({ state: 'MERGED', mergedAt: '2026-10-28T12:00:00Z' }) } },
        { provide: SecurityService, useValue: { decryptCredentials: jest.fn().mockReturnValue('decrypted_token') } },
      ],
    }).compile();

    service = module.get<ProofOfImpactService>(ProofOfImpactService);
  });

  describe('getOverview', () => {
    it('returns truthful default metrics when no runs exist', async () => {
      const overview = await service.getOverview('proj_1');
      expect(overview.kpis.verifiedFixes).toBe(0);
      expect(overview.kpis.pagesImproved).toBe(0);
      expect(overview.kpis.activeFixes).toBe(0);
      expect(overview.kpis.regressionsDetected).toBe(0);
      expect(overview.statusBreakdown.verified).toBe(0);
      expect(overview.recentFixes).toEqual([]);
    });

    it('aggregates verified fixes and regression counts correctly', async () => {
      prisma.fixSnapshot.findMany.mockResolvedValue([
        { id: 's1', automationRunId: 'run_1', pageId: 'measured-page', snapshotType: 'VERIFIED_LIVE', url: 'https://acme.com/page-1', capturedAt: new Date() },
        { id: 's2', snapshotType: 'BEFORE', url: 'https://acme.com/page-1', capturedAt: new Date() },
      ]);
      prisma.fixRegressionRecord.findMany.mockResolvedValue([
        { id: 'r1', url: 'https://acme.com/page-1', severity: 'HIGH', title: 'H1 missing', description: 'desc', detectedAt: new Date() },
      ]);
      prisma.automationRun.findMany.mockResolvedValue([
        { id: 'run_1', status: 'MERGED', steps: [], createdAt: new Date(), startedAt: new Date() },
      ]);

      const overview = await service.getOverview('proj_1');
      expect(overview.kpis.verifiedFixes).toBe(1);
      expect(overview.kpis.pagesImproved).toBe(1);
      expect(overview.kpis.regressionsDetected).toBe(1);
      expect(overview.statusBreakdown.verified).toBe(1);
      expect(overview.regressionAlerts.length).toBe(1);
    });
  });

  describe('getFixHistory', () => {
    it('formats runs and maps snapshot statuses accurately', async () => {
      prisma.automationRun.findMany.mockResolvedValue([
        {
          id: 'run_1',
          status: 'MERGED',
          createdAt: new Date('2026-03-01T10:00:00Z'),
          startedAt: new Date('2026-03-01T10:00:00Z'),
          pullRequestUrl: 'https://github.com/acme/repo/pull/42',
          steps: [
            {
              name: 'patch',
              status: 'COMPLETED',
              change: { url: 'https://acme.com/pricing', field: 'title', why: 'Optimized title' },
            },
          ],
        },
      ]);
      prisma.fixSnapshot.findMany.mockResolvedValue([
        { automationRunId: 'run_1', pageId: 'measured-page', snapshotType: 'VERIFIED_LIVE', url: 'https://acme.com/pricing' },
      ]);

      const history = await service.getFixHistory('proj_1');
      expect(history.length).toBe(1);
      expect(history[0].id).toBe('run_1');
      expect(history[0].affectedPage).toBe('https://acme.com/pricing');
      expect(history[0].deploymentStatus).toBe('DEPLOYED');
      expect(history[0].verificationStatus).toBe('VERIFIED');
    });
  });

  describe('getFixDetail', () => {
    it('throws NotFoundException if run does not exist', async () => {
      prisma.automationRun.findUnique.mockResolvedValue(null);
      await expect(service.getFixDetail('proj_1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns 4-tab comparisons and attribution for existing run', async () => {
      prisma.automationRun.findUnique.mockResolvedValue({
        id: 'run_1',
        projectId: 'proj_1',
        status: 'MERGED',
        finishedAt: new Date('2026-10-28T10:00:00Z'),
        startedAt: new Date('2026-03-01T10:00:00Z'),
        createdAt: new Date('2026-03-01T10:00:00Z'),
        pullRequestUrl: 'https://github.com/acme/repo/pull/42',
        branch: 'fix/meta-title',
        steps: [
          {
            name: 'patch',
            status: 'COMPLETED',
            change: {
              url: 'https://acme.com/pricing',
              field: 'title',
              original: 'Old Title',
              proposed: 'New Title',
              diff: '- Old Title\n+ New Title',
              file: 'src/pages/pricing.tsx',
            },
          },
        ],
      });

      prisma.fixSnapshot.findMany.mockResolvedValue([
        {
          id: 'snap_a',
          pageId: 'baseline-page',
          automationRunId: 'run_1',
          snapshotType: 'BEFORE',
          url: 'https://acme.com/pricing',
          title: 'Old Title',
          metaDescription: 'Old Desc',
          h1: 'Old H1',
          issuesCount: 4,
          capturedAt: new Date('2026-03-01T09:00:00Z'),
        },
        {
          id: 'snap_c',
          pageId: 'measured-page',
          automationRunId: 'run_1',
          snapshotType: 'VERIFIED_LIVE',
          url: 'https://acme.com/pricing',
          title: 'New Title',
          metaDescription: 'Old Desc',
          h1: 'Old H1',
          issuesCount: 1,
          capturedAt: new Date('2026-03-01T12:00:00Z'),
        },
      ]);

      const detail = await service.getFixDetail('proj_1', 'run_1');
      expect(detail.run.id).toBe('run_1');
      expect(detail.run.affectedUrl).toBe('https://acme.com/pricing');
      const titleItem = detail.content.find((c) => c.field === 'title');
      expect(titleItem?.before).toBe('Old Title');
      expect(titleItem?.after).toBe('New Title');
      expect(titleItem?.status).toBe('MODIFIED');
      expect(detail.technical.length).toBeGreaterThan(0);
      expect(detail.code.diffSummary).toContain('title updated');
      expect(detail.attribution.level1.status).toBe('VERIFIED');
    });
  });

  describe('verifyDeployment', () => {
    it('does not infer technical or causal improvements when measurements are missing', async () => {
      prisma.automationRun.findUnique.mockResolvedValue({ id: 'empty', projectId: 'proj_1', status: 'FAILED', startedAt: new Date(), finishedAt: new Date(), steps: [], filesChanged: [] });
      const detail = await service.getFixDetail('proj_1', 'empty');
      expect(detail.technical.every(m => m.before === null && m.after === null && m.status === 'NOT_MEASURED')).toBe(true);
      expect(detail.aiImpact.models).toEqual([]);
      expect(detail.businessImpact.available).toBe(false);
      expect(detail.attribution.level3.status).toBe('INCONCLUSIVE');
      expect(detail.aiSummary).not.toContain('verified against');
    });

    it('never makes up engaged sessions from a fixed percentage', async () => {
      prisma.ga4DailyMetric.aggregate.mockResolvedValue({ _sum: { sessions: 100, conversions: null, revenue: null } });
      const result = await (service as any).getFixGa4Impact('proj_1', 'https://acme.com/pricing', new Date());
      expect(result.engagedSessions).toBeNull();
      expect(result.sessions).toBe(100);
      expect(prisma.ga4DailyMetric.aggregate.mock.calls[0][0].where.landingPage).toEqual({ in: ['https://acme.com/pricing', '/pricing'] });
    });

    it('groups actual AI models and derives citation rates from actual citation records', async () => {
      prisma.aiVisibilityResponse.findMany.mockResolvedValueOnce([{ model: 'actual-model-a', provider: 'OPENROUTER', analysis: { brandMentioned: true }, citations: [], promptId: 'p' }]).mockResolvedValueOnce([{ model: 'actual-model-b', provider: 'OPENROUTER', analysis: { brandMentioned: false }, citations: [{ brandMentioned: true }], promptId: 'p' }]);
      const result = await (service as any).getFixAiImpact('proj_1', 'https://acme.com/', new Date());
      expect(result.models).toHaveLength(2);
      expect(result.models[0]).toMatchObject({ model: 'actual-model-a', beforeMentionRate: 100, beforeCitationRate: 0, afterMentionRate: null, changePt: null });
      expect(result.models[1]).toMatchObject({ model: 'actual-model-b', beforeMentionRate: null, afterMentionRate: 0, afterCitationRate: 100 });
    });

    it('verifies deployment and emits ledger event when live page matches proposed fix', async () => {
      prisma.automationRun.findUnique.mockResolvedValue({
        id: 'run_1',
        projectId: 'proj_1',
        finishedAt: new Date('2026-10-28T10:00:00Z'),
        status: 'MERGED',
        pullRequestUrl: 'https://github.com/acme/repo/pull/42',
        steps: [
          {
            name: 'patch',
            status: 'COMPLETED',
            change: {
              url: 'https://acme.com/pricing',
              field: 'META_TITLE',
              after: 'Fresh Pricing Title',
            },
          },
        ],
      });

      prisma.page.findFirst.mockResolvedValue({
        id: 'page_1',
        url: 'https://acme.com/pricing',
        title: 'Fresh Pricing Title',
        crawledAt: new Date('2026-10-29T10:00:00Z'),
        metaDescription: 'Updated pricing description',
        h1: ['Pricing'],
        canonicalUrl: 'https://acme.com/pricing',
        robotsMeta: 'index,follow',
        issues: [],
      });

      const result = await service.verifyDeployment('proj_1', 'run_1');
      expect(result.success).toBe(true);
      expect(result.verificationStatus).toBe('VERIFIED');
      expect(prisma.fixSnapshot.create).toHaveBeenCalled();
      expect(prisma.fixImpactLedgerEvent.create).toHaveBeenCalled();
    });

    it.each(['NEW_FILE_CREATED', 'CODE_AND_SEO_UPDATE'])('does not verify a generic %s change just because a page exists', async (field) => {
      prisma.automationRun.findUnique.mockResolvedValue({
        id: 'run_1', projectId: 'proj_1', finishedAt: new Date('2026-10-28T10:00:00Z'),
        steps: [{ change: { url: 'https://acme.com/', field, after: 'export const message = "fixed";' } }],
      });
      prisma.page.findFirst.mockResolvedValue({ id: 'page_1', title: 'Home', crawledAt: new Date() });
      const result = await service.verifyDeployment('proj_1', 'run_1');
      expect(result.success).toBe(false);
      expect(prisma.fixSnapshot.create).not.toHaveBeenCalled();
      expect(prisma.fixImpactLedgerEvent.create).not.toHaveBeenCalled();
    });

    it('rejects a matching value from an audit taken before the fix', async () => {
      prisma.automationRun.findUnique.mockResolvedValue({
        id: 'run_1', projectId: 'proj_1', finishedAt: new Date('2026-10-29T10:00:00Z'),
        steps: [{ change: { url: 'https://acme.com/', field: 'META_TITLE', after: 'Home' } }],
      });
      prisma.page.findFirst.mockResolvedValue({ title: 'Home', crawledAt: new Date('2026-10-28T10:00:00Z') });
      expect((await service.verifyDeployment('proj_1', 'run_1')).success).toBe(false);
      expect(prisma.fixSnapshot.create).not.toHaveBeenCalled();
    });

    it('does not verify a whole run from its first change', async () => {
      prisma.automationRun.findUnique.mockResolvedValue({
        id: 'run_1', projectId: 'proj_1',
        steps: [{ change: { url: 'https://acme.com/' } }, { change: { url: 'https://acme.com/pricing' } }],
      });
      expect((await service.verifyDeployment('proj_1', 'run_1')).success).toBe(false);
      expect(prisma.fixSnapshot.create).not.toHaveBeenCalled();
    });
  });
});
