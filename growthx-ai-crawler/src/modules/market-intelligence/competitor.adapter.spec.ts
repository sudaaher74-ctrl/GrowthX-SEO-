import { CompetitorAdapter } from './competitor.adapter';
import { PrismaService } from '../../database/prisma.service';

describe('CompetitorAdapter', () => {
  let adapter: CompetitorAdapter;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
      },
      competitorFinding: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'finding-1',
            projectId: 'proj-1',
            category: 'TECHNICAL_SEO',
            summary: 'Competitor has 50 Schema types',
            detail: 'Detailed competitor breakdown',
            sourcePlatform: 'WEBSITE',
            sourceUrl: 'https://rival.com',
            confidence: 'HIGH',
            observedAt: new Date('2026-09-15'),
          },
        ]),
      },
      contentGap: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'gap-1',
            projectId: 'proj-1',
            gapType: 'COMPETITOR_WINNING',
            title: 'Best Dental Implants Guide',
            description: 'Competitor ranks top 3 for dental implants',
            competitionLevel: 'LOW',
            opportunityScore: 82,
            confidenceScore: 85,
            effortLevel: 'MEDIUM',
            relatedKeywords: ['dental implants', 'implants cost'],
            recommendedAction: 'Publish pillar guide on dental implants',
            status: 'OPEN',
          },
        ]),
      },
    };

    adapter = new CompetitorAdapter(mockPrisma as unknown as PrismaService);
  });

  it('produces stable fingerprints across two invocations with identical inputs', async () => {
    const run1 = await adapter.collect('proj-1');
    const run2 = await adapter.collect('proj-1');

    expect(run1).toHaveLength(2);
    expect(run2).toHaveLength(2);

    expect(run1[0].fingerprint).toBe(run2[0].fingerprint);
    expect(run1[0].fingerprint).toBe('proj-1::COMPETITOR::TECHNICAL_SEO::competitor-has-50-schema-types');
    expect(run1[0].detailType).toBe('COMPETITOR_FINDING');

    expect(run1[1].fingerprint).toBe(run2[1].fingerprint);
    expect(run1[1].fingerprint).toBe('proj-1::COMPETITOR::CONTENT_GAP::best-dental-implants-guide');
    expect(run1[1].detailType).toBe('CONTENT_GAP');
    expect(run1[1].impact).toBe(82);
  });
});
