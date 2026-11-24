import { AiService } from './ai.service';

describe('AiService — tenant-scoped content-hash caching', () => {
  function makeDeps(issueOverride: Record<string, any> = {}, priorRec: any = null) {
    const prisma: any = {
      issue: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'issue_new',
          projectId: 'proj_1',
          issueType: 'MISSING_META_DESCRIPTION',
          severity: 'HIGH',
          affectedUrl: 'https://example.com/pricing',
          description: 'Meta description is missing.',
          page: { contentHash: 'sha256_abc' },
          aiRecommendation: null,
          ...issueOverride,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      aIRecommendation: {
        findFirst: jest.fn().mockResolvedValue(priorRec),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const router: any = {
      generate: jest.fn().mockResolvedValue({
        provider: 'GEMINI',
        model: 'gemini-3.1-flash-lite',
        text: JSON.stringify({
          whyItMatters: 'Fresh why',
          seoImpact: 'Fresh impact',
          businessImpact: 'Fresh business',
          priorityScore: 82,
          recommendedFix: 'Add a 150-char meta description.',
          expectedOutcome: 'Higher CTR',
        }),
        usage: { inputTokens: 120, outputTokens: 80, estimatedCostUsd: 0.0001 },
        refused: false,
      }),
    };
    return { service: new AiService(prisma, router), prisma, router };
  }

  it('reuses a prior model-generated analysis for the same project, URL, issueType, and contentHash with 0 LLM calls', async () => {
    const prior = {
      whyItMatters: 'Cached why',
      seoImpact: 'Cached seo',
      businessImpact: 'Cached biz',
      priorityScore: 79,
      recommendedFixPatch: 'Write a crisp meta description.',
      expectedOutcome: 'Better SERP CTR',
      generatedByModel: 'gemini-3.1-flash-lite',
    };
    const { service, prisma, router } = makeDeps({}, prior);

    const res = await service.analyzeIssue('issue_new', 'org_1');

    expect(router.generate).not.toHaveBeenCalled();
    expect(prisma.aIRecommendation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          issue: expect.objectContaining({
            projectId: 'proj_1',
            issueType: 'MISSING_META_DESCRIPTION',
            affectedUrl: 'https://example.com/pricing',
            page: { contentHash: 'sha256_abc' },
          }),
        }),
      }),
    );
    expect(res.whyItMatters).toBe('Cached why');
    expect(res.recommendedFix).toBe('Write a crisp meta description.');
    expect(prisma.aIRecommendation.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.issue.update).toHaveBeenCalledWith({
      where: { id: 'issue_new' },
      data: { aiFixAvailable: true },
    });
  });

  it('reuses existing model-generated analysis already saved on the same issueId', async () => {
    const { service, router } = makeDeps({
      aiRecommendation: {
        whyItMatters: 'Already analyzed',
        seoImpact: 'High',
        businessImpact: 'Revenue',
        priorityScore: 88,
        recommendedFixPatch: 'Fix it now',
        expectedOutcome: 'Lift',
        generatedByModel: 'claude-opus-5',
      },
    });

    const res = await service.analyzeIssue('issue_new', 'org_1');

    expect(router.generate).not.toHaveBeenCalled();
    expect(res.whyItMatters).toBe('Already analyzed');
  });

  it('calls the router with cacheable=true when no prior content-hash match exists or when forceRefresh is set', async () => {
    const prior = {
      whyItMatters: 'Cached why',
      seoImpact: 'Cached seo',
      businessImpact: 'Cached biz',
      priorityScore: 79,
      recommendedFixPatch: 'Write a crisp meta description.',
      expectedOutcome: 'Better SERP CTR',
      generatedByModel: 'gemini-3.1-flash-lite',
    };
    const { service, router } = makeDeps({}, prior);

    const fresh = await service.analyzeIssue('issue_new', 'org_1', { forceRefresh: true });

    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        projectId: 'proj_1',
        cacheable: true,
      }),
    );
    expect(fresh.whyItMatters).toBe('Fresh why');
  });

  it('ignores JSON auto-fix patches stored in recommendedFixPatch when checking analysis reuse', async () => {
    const priorAutoFixOnly = {
      whyItMatters: 'Improves technical SEO health.',
      seoImpact: 'Positive ranking signal.',
      businessImpact: 'Higher traffic retention.',
      priorityScore: 75,
      recommendedFixPatch: JSON.stringify({ fixType: 'META_DESCRIPTION', proposedValue: 'x' }),
      expectedOutcome: 'Resolved audit issue.',
      generatedByModel: 'gemini-3.1-flash-lite',
    };
    const { service, router } = makeDeps({}, priorAutoFixOnly);

    const res = await service.analyzeIssue('issue_new', 'org_1');

    expect(router.generate).toHaveBeenCalledTimes(1);
    expect(res.whyItMatters).toBe('Fresh why');
  });
});
