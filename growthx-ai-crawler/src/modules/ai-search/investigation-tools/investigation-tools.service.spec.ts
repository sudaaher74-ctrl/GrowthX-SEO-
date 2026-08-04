import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { InvestigationToolsService } from './investigation-tools.service';

describe('InvestigationToolsService', () => {
  let service: InvestigationToolsService;
  let prisma: { issue: { findMany: jest.Mock }; competitorDomain: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      issue: { findMany: jest.fn().mockResolvedValue([]) },
      competitorDomain: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvestigationToolsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(InvestigationToolsService);
  });

  describe('queryKnowledgeGraph', () => {
    it('reports a healthy site when there are no open issues', async () => {
      const result = JSON.parse(await service.queryKnowledgeGraph('proj_1'));
      expect(result).toEqual({ status: 'healthy', issues_found: 0 });
    });

    it('summarises open issues for the model', async () => {
      prisma.issue.findMany.mockResolvedValue([
        {
          affectedUrl: 'https://a.com/x',
          issueType: 'MISSING_TITLE',
          severity: 'CRITICAL',
          recommendation: 'Add a title',
        },
      ]);

      const result = JSON.parse(await service.queryKnowledgeGraph('proj_1'));
      expect(result).toEqual([
        { url: 'https://a.com/x', type: 'MISSING_TITLE', severity: 'CRITICAL', recommendation: 'Add a title' },
      ]);
    });

    it('excludes resolved issues', async () => {
      await service.queryKnowledgeGraph('proj_1');
      expect(prisma.issue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { not: 'RESOLVED' } }),
        }),
      );
    });
  });

  // These used to throw NotImplementedException, which took down every AI chat
  // request before it reached a model. They must degrade, not fail.
  describe('unconnected integrations', () => {
    it('reports Search Console as unavailable instead of throwing', async () => {
      const result = JSON.parse(await service.getTrafficMetrics('proj_1'));
      expect(result.available).toBe(false);
      expect(result.reason).toMatch(/Search Console/i);
    });

    it('reports no competitors as unavailable instead of throwing', async () => {
      const result = JSON.parse(await service.getCompetitorData('proj_1'));
      expect(result.available).toBe(false);
    });

    it('returns tracked competitors when some exist', async () => {
      prisma.competitorDomain.findMany.mockResolvedValue([{ domain: 'rival.com', label: 'Rival' }]);
      const result = JSON.parse(await service.getCompetitorData('proj_1'));
      expect(result).toEqual({ available: true, competitors: [{ domain: 'rival.com', label: 'Rival' }] });
    });
  });
});
