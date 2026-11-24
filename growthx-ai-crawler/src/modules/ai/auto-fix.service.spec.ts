import { AutoFixService } from './auto-fix.service';

describe('AutoFixService — tenant-scoped content-hash patch caching', () => {
  function makeDeps(issueOverride: Record<string, any> = {}, priorRec: any = null) {
    const prisma: any = {
      issue: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'issue_2',
          projectId: 'proj_a',
          issueType: 'MISSING_META_DESCRIPTION',
          affectedUrl: 'https://example.com/about',
          recommendation: 'Add meta description.',
          page: {
            title: 'About Acme',
            metaDescription: null,
            canonicalUrl: 'https://example.com/about',
            h1: ['About Acme'],
            h2: ['Our Story'],
            wordCount: 350,
            contentHash: 'hash_v1',
          },
          aiRecommendation: null,
          ...issueOverride,
        }),
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
          description: 'Learn about Acme and our story helping businesses scale search visibility with fast technical SEO audits.',
        }),
        usage: { inputTokens: 150, outputTokens: 40, estimatedCostUsd: 0.0001 },
        refused: false,
      }),
    };
    return { service: new AutoFixService(prisma, router), prisma, router };
  }

  it('reuses a prior model-generated patch for the same project, URL, issueType, and contentHash with 0 LLM calls', async () => {
    const cachedPatch = {
      fixType: 'META_DESCRIPTION',
      targetUrl: 'https://example.com/about',
      originalValue: null,
      proposedValue: 'Cached description for About Acme.',
      codeSnippet: '<meta name="description" content="Cached description for About Acme." />',
      source: 'model',
      model: 'gemini-3.1-flash-lite',
    };
    const { service, prisma, router } = makeDeps(
      {},
      {
        recommendedFixPatch: JSON.stringify(cachedPatch),
        generatedByModel: 'gemini-3.1-flash-lite',
      },
    );

    const patch = await service.generateFixPatch('issue_2', 'org_a');

    expect(router.generate).not.toHaveBeenCalled();
    expect(prisma.aIRecommendation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          issue: expect.objectContaining({
            projectId: 'proj_a',
            issueType: 'MISSING_META_DESCRIPTION',
            affectedUrl: 'https://example.com/about',
            page: { contentHash: 'hash_v1' },
          }),
        }),
      }),
    );
    expect(patch.proposedValue).toBe('Cached description for About Acme.');
    expect(patch.source).toBe('model');
  });

  it('bypasses cache when forceRefresh is true and sends cacheable=true + projectId to router', async () => {
    const cachedPatch = {
      fixType: 'META_DESCRIPTION',
      targetUrl: 'https://example.com/about',
      originalValue: null,
      proposedValue: 'Old cached description.',
      codeSnippet: '<meta name="description" content="Old cached description." />',
      source: 'model',
      model: 'gemini-3.1-flash-lite',
    };
    const { service, router } = makeDeps(
      {},
      {
        recommendedFixPatch: JSON.stringify(cachedPatch),
        generatedByModel: 'gemini-3.1-flash-lite',
      },
    );

    const patch = await service.generateFixPatch('issue_2', 'org_a', { forceRefresh: true });

    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_a',
        projectId: 'proj_a',
        cacheable: true,
      }),
    );
    expect(patch.proposedValue).toContain('Learn about Acme');
  });
});
