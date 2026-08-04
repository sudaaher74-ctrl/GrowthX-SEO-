import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma.service';
import { AeoAnalysisService } from './aeo-analysis.service';

describe('AeoAnalysisService', () => {
  let service: AeoAnalysisService;
  let prisma: { aeoMetrics: { findMany: jest.Mock }; page: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { aeoMetrics: { findMany: jest.fn() }, page: { findMany: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AeoAnalysisService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AeoAnalysisService);
  });

  it('returns null when the project has never been evaluated', async () => {
    prisma.aeoMetrics.findMany.mockResolvedValue([]);
    await expect(service.analyzeWebsiteAeo('proj_1')).resolves.toBeNull();
  });

  it('averages citation probability across pages', async () => {
    prisma.aeoMetrics.findMany.mockResolvedValue([
      { citationProbability: 0.2, llmCrawlerHits: 3 },
      { citationProbability: 0.6, llmCrawlerHits: 7 },
    ]);
    prisma.page.findMany.mockResolvedValue([{ url: 'https://a.com/x' }]);

    const report = await service.analyzeWebsiteAeo('proj_1');

    expect(report?.overallCitationScore).toBeCloseTo(0.4, 5);
    expect(report?.missingStructuredDataUrls).toEqual(['https://a.com/x']);
  });

  it('lists pages missing structured data', async () => {
    prisma.aeoMetrics.findMany.mockResolvedValue([{ citationProbability: 0.5, llmCrawlerHits: 1 }]);
    prisma.page.findMany.mockResolvedValue([{ url: 'https://a.com/no-schema' }]);

    await service.analyzeWebsiteAeo('proj_1');

    expect(prisma.page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ aeoMetrics: { hasStructuredJsonLd: false } }),
      }),
    );
  });
});
