import { PrismaService } from '../../database/prisma.service';
import { RoiLearningService, inferCategoryFromField } from './roi-learning.service';

describe('RoiLearningService', () => {
  let mockPrisma: any;
  let service: RoiLearningService;

  beforeEach(() => {
    mockPrisma = {
      fixImpactLedgerEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new RoiLearningService(mockPrisma as unknown as PrismaService);
  });

  it('returns neutral weights with no evidence chip when a project has no measured outcomes', async () => {
    const weights = await service.computeCategoryWeights('proj-1');
    expect(weights.size).toBe(0);

    const scored = service.applyRoiWeight(
      { category: 'SEO', impact: 70, confidence: 80, evidence: [{ label: 'Pages', value: '5', source: 'CRAWLER' }] },
      weights,
    );
    expect(scored.impact).toBe(70);
    expect(scored.priority).toBe(56);
    expect(scored.evidence).toHaveLength(1);
  });

  it('boosts categories with verified positive lift and penalizes repeatedly flat/regressed categories', async () => {
    mockPrisma.fixImpactLedgerEvent.findMany.mockResolvedValue([
      { eventType: 'IMPACT_CONFIRMED', evidenceData: { field: 'META_TITLE', clicksDelta: 24, aiChangePt: 5 }, automationRunId: null },
      { eventType: 'IMPACT_CONFIRMED', evidenceData: { field: 'META_DESCRIPTION', clicksDelta: 16 }, automationRunId: null },
      { eventType: 'IMPACT_CONFIRMED', evidenceData: { field: 'H1_TAG', clicksDelta: 20 }, automationRunId: null },
      { eventType: 'IMPACT_CONFIRMED', evidenceData: { field: 'META_TITLE', clicksDelta: 12 }, automationRunId: null },
      { eventType: 'NO_IMPROVEMENT_DIAGNOSED', evidenceData: { field: 'FAQ_SCHEMA', clicksDelta: -10 }, automationRunId: null },
      { eventType: 'REGRESSION_DETECTED', evidenceData: { category: 'TECHNICAL', clicksDelta: -15 }, automationRunId: null },
    ]);

    const weights = await service.computeCategoryWeights('proj-1');
    const seoWeight = weights.get('SEO')!;
    const techWeight = weights.get('TECHNICAL')!;

    expect(seoWeight.sampleSize).toBe(4);
    expect(seoWeight.improvedCount).toBe(4);
    expect(seoWeight.avgClicksDeltaPct).toBe(18);
    expect(seoWeight.multiplier).toBeGreaterThan(1.2);
    expect(seoWeight.multiplier).toBeLessThanOrEqual(1.35);

    expect(techWeight.sampleSize).toBe(2);
    expect(techWeight.improvedCount).toBe(0);
    expect(techWeight.multiplier).toBeLessThan(1.0);
    expect(techWeight.multiplier).toBeGreaterThanOrEqual(0.85);

    const seoScored = service.applyRoiWeight(
      { category: 'SEO', impact: 70, confidence: 90, evidence: [] },
      weights,
    );
    const techScored = service.applyRoiWeight(
      { category: 'TECHNICAL', impact: 70, confidence: 90, evidence: [] },
      weights,
    );

    expect(seoScored.impact).toBeGreaterThan(techScored.impact);
    expect(seoScored.priority).toBeGreaterThan(techScored.priority);
    expect(seoScored.evidence).toEqual([
      expect.objectContaining({
        label: 'Site historical ROI',
        source: 'Proof of Impact',
        value: expect.stringContaining('4/4 measured SEO fixes observed positive change (+18% avg clicks'),
      }),
    ]);
  });

  it('infers categories accurately from fix fields', () => {
    expect(inferCategoryFromField('META_TITLE')).toBe('SEO');
    expect(inferCategoryFromField('FAQ_SCHEMA')).toBe('TECHNICAL');
    expect(inferCategoryFromField('LOCAL_BUSINESS_SCHEMA')).toBe('LOCAL');
    expect(inferCategoryFromField('BLOG_CONTENT')).toBe('CONTENT');
    expect(inferCategoryFromField('LLMS_TXT')).toBe('AI_VISIBILITY');
  });
});
