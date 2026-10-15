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
        findUnique: jest.fn().mockResolvedValue({ id: 'repo_1', defaultBranch: 'main', framework: 'nextjs' }),
      },
      page: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProofOfImpactService,
        { provide: PrismaService, useValue: prisma },
        { provide: GitService, useValue: { cloneOrUpdate: jest.fn(), getCommitLog: jest.fn() } },
        { provide: SecurityService, useValue: { decrypt: jest.fn().mockReturnValue('decrypted_token') } },
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
        { id: 's1', snapshotType: 'VERIFIED_LIVE', url: 'https://acme.com/page-1', capturedAt: new Date() },
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
        { automationRunId: 'run_1', snapshotType: 'VERIFIED_LIVE', url: 'https://acme.com/pricing' },
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
    it('verifies deployment and emits ledger event when live page matches proposed fix', async () => {
      prisma.automationRun.findUnique.mockResolvedValue({
        id: 'run_1',
        projectId: 'proj_1',
        status: 'MERGED',
        pullRequestUrl: 'https://github.com/acme/repo/pull/42',
        steps: [
          {
            name: 'patch',
            status: 'COMPLETED',
            change: {
              url: 'https://acme.com/pricing',
              field: 'title',
              proposed: 'Fresh Pricing Title',
            },
          },
        ],
      });

      prisma.page.findFirst.mockResolvedValue({
        id: 'page_1',
        url: 'https://acme.com/pricing',
        title: 'Fresh Pricing Title',
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
  });
});
