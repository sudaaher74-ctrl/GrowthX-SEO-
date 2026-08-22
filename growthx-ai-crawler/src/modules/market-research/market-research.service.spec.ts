import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { EvidenceRetrievalService } from './evidence-retrieval.service';
import { MarketResearchService } from './market-research.service';
import { ModelRole, ModelRouterService } from './model-router.service';

const ORG_A = 'org_a';
const ORG_B = 'org_b';
const PROJ_A = 'proj_a';

function usage(step: string) {
  return { step, role: ModelRole.ANALYST, model: 'gpt-5.6-terra', inputTokens: 10, outputTokens: 20 };
}

describe('MarketResearchService', () => {
  let service: MarketResearchService;
  let prisma: any;
  let models: any;
  let evidence: any;

  const storedSources = [
    { id: 'src1', sourceKey: 'source_1', type: 'PUBLIC_WEB', title: 'Report', url: 'https://ex.com/a', excerpt: 'x', publisher: 'ex.com' },
    { id: 'src2', sourceKey: 'source_2', type: 'CLIENT_WEBSITE', title: 'Our page', url: 'https://client.com/p', excerpt: 'y', publisher: null },
  ];

  beforeEach(async () => {
    prisma = {
      project: { findFirst: jest.fn().mockResolvedValue({ id: PROJ_A }) },
      marketResearchThread: {
        findFirst: jest.fn().mockResolvedValue({ id: 'thread_1', organizationId: ORG_A, projectId: PROJ_A }),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'thread_1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      marketResearchMessage: { create: jest.fn().mockResolvedValue({}) },
      marketResearchRun: {
        create: jest.fn().mockResolvedValue({ id: 'run_1' }),
        update: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue({ id: 'run_1' }),
      },
      researchSource: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue(storedSources),
      },
      researchClaim: { create: jest.fn().mockResolvedValue({}) },
    };

    models = {
      generate: jest.fn(),
      embed: jest.fn().mockResolvedValue({ vectors: [[0.1]], model: 'text-embedding-3-small' }),
      modelFor: jest.fn().mockReturnValue('gpt-5.6-terra'),
      isConfigured: jest.fn().mockReturnValue(true),
      supportsEmbeddings: jest.fn().mockReturnValue(true),
    };

    evidence = {
      loadClientContext: jest.fn().mockResolvedValue({
        projectName: 'Northwind',
        domains: ['northwind.com'],
        competitors: [{ domain: 'rival.com', label: 'Rival' }],
        trackedPrompts: [{ text: 'best winter jacket', cluster: null }],
        visibility: { citationSharePct: 12, byAssistant: [], shareOfVoice: [], lostPrompts: [] },
      }),
      searchClientPages: jest.fn().mockResolvedValue([]),
      visibilitySources: jest.fn().mockReturnValue([]),
      webSources: jest.fn().mockReturnValue([{ type: 'PUBLIC_WEB', url: 'https://ex.com/a', title: 'Report', excerpt: '', qualityScore: 0.6 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MarketResearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: ModelRouterService, useValue: models },
        { provide: EvidenceRetrievalService, useValue: evidence },
      ],
    }).compile();

    service = module.get(MarketResearchService);
  });

  function mockPipeline(answer: unknown) {
    models.generate
      .mockResolvedValueOnce({
        text: JSON.stringify({ intent: 'MARKET_TREND', searchQueries: ['q'], clientDataQuery: 'jackets' }),
        usage: usage('classify'),
        webSources: [],
      })
      .mockResolvedValueOnce({ text: 'Web notes', usage: usage('web'), webSources: [{ url: 'https://ex.com/a', title: 'Report' }] })
      .mockResolvedValueOnce({ text: JSON.stringify(answer), usage: usage('answer'), webSources: [] });
  }

  describe('tenant isolation', () => {
    it('refuses a project that does not belong to the caller organization', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.listThreads(ORG_B, PROJ_A)).rejects.toThrow(NotFoundException);
    });

    it('scopes every project lookup by organization', async () => {
      await service.listThreads(ORG_A, PROJ_A);

      expect(prisma.project.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: PROJ_A, organizationId: ORG_A } }),
      );
    });

    it('filters thread listing by organization and project', async () => {
      await service.listThreads(ORG_A, PROJ_A);

      expect(prisma.marketResearchThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: ORG_A, projectId: PROJ_A } }),
      );
    });

    // A thread id from another tenant must not resolve, even for a caller who
    // is a legitimate member of their own organization.
    it('refuses a thread belonging to another organization', async () => {
      prisma.marketResearchThread.findFirst.mockResolvedValue(null);

      await expect(service.getThread(ORG_A, PROJ_A, 'thread_from_org_b')).rejects.toThrow(NotFoundException);
    });

    it('refuses a run belonging to another organization', async () => {
      prisma.marketResearchRun.findFirst.mockResolvedValue(null);

      await expect(service.getRunSources(ORG_A, PROJ_A, 'run_from_org_b')).rejects.toThrow(NotFoundException);
    });

    it('will not answer a question against a project outside the organization', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        service.ask({ organizationId: ORG_B, projectId: PROJ_A, question: 'What changed?' }),
      ).rejects.toThrow(NotFoundException);
      expect(models.generate).not.toHaveBeenCalled();
    });

    it('stamps both organization and project on every source it writes', async () => {
      mockPipeline({
        summary: 's',
        confidence: 'medium',
        verifiedClaims: [{ claim: 'c', citationIds: ['source_1'] }],
        inferences: [],
        citationGaps: [],
        recommendedActions: [],
        evidenceGaps: [],
      });

      await service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'What changed?' });

      const written = prisma.researchSource.createMany.mock.calls[0][0].data;
      expect(written.length).toBeGreaterThan(0);
      for (const row of written) {
        expect(row.organizationId).toBe(ORG_A);
        expect(row.projectId).toBe(PROJ_A);
      }
    });
  });

  // The production 500: the global ValidationPipe runs with `whitelist: true`,
  // so a DTO with no class-validator decorators arrives as {} and `question`
  // is undefined by the time it reaches here. The customer saw a bare
  // "Internal server error" on every question they asked.
  describe('bad input', () => {
    it.each([undefined, null, '', '   '])('refuses a question of %p as a bad request', async (question) => {
      await expect(
        service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: question as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not open a thread or a run for a missing question', async () => {
      await expect(
        service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: undefined as any }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.marketResearchThread.create).not.toHaveBeenCalled();
      expect(prisma.marketResearchRun.create).not.toHaveBeenCalled();
      expect(models.generate).not.toHaveBeenCalled();
    });

    it('trims the question before using it', async () => {
      mockPipeline({
        summary: 's',
        confidence: 'medium',
        verifiedClaims: [{ claim: 'c', citationIds: ['source_1'] }],
        inferences: [],
        citationGaps: [],
        recommendedActions: [],
        evidenceGaps: [],
      });

      await service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: '  What changed?  ' });

      expect(prisma.marketResearchRun.create.mock.calls[0][0].data.question).toBe('What changed?');
    });
  });

  describe('citation enforcement', () => {
    it('removes claims citing sources that were never retrieved', async () => {
      mockPipeline({
        summary: 's',
        confidence: 'high',
        verifiedClaims: [
          { claim: 'Real, cited.', citationIds: ['source_1'] },
          { claim: 'Invented citation.', citationIds: ['source_77'] },
        ],
        inferences: [],
        citationGaps: [],
        recommendedActions: [],
        evidenceGaps: [],
      });

      const result = await service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' });

      expect(result.answer.verifiedClaims).toHaveLength(1);
      expect(result.answer.verifiedClaims[0].claim).toBe('Real, cited.');
      expect(result.answer.evidenceGaps.join(' ')).toContain('not retrieved');
    });

    it('persists verified and inferred claims under different kinds', async () => {
      mockPipeline({
        summary: 's',
        confidence: 'medium',
        verifiedClaims: [{ claim: 'Fact.', citationIds: ['source_1'] }],
        inferences: [{ statement: 'Guess.', reasoning: 'because', citationIds: ['source_2'] }],
        citationGaps: [],
        recommendedActions: [],
        evidenceGaps: [],
      });

      await service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' });

      const kinds = prisma.researchClaim.create.mock.calls.map(([arg]: any[]) => arg.data.kind);
      expect(kinds).toEqual(['VERIFIED', 'INFERENCE']);
    });

    // Confidence should describe the evidence that survived, not the evidence
    // the model thought it had.
    it('caps confidence at low when every claim was stripped', async () => {
      mockPipeline({
        summary: 's',
        confidence: 'high',
        verifiedClaims: [{ claim: 'Unsupported.', citationIds: ['ghost'] }],
        inferences: [],
        citationGaps: [],
        recommendedActions: [],
        evidenceGaps: [],
      });

      const result = await service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' });

      expect(result.answer.confidence).toBe('low');
    });

    it('downgrades high confidence resting on a single claim', async () => {
      mockPipeline({
        summary: 's',
        confidence: 'high',
        verifiedClaims: [{ claim: 'One fact.', citationIds: ['source_1'] }],
        inferences: [],
        citationGaps: [],
        recommendedActions: [],
        evidenceGaps: [],
      });

      const result = await service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' });

      expect(result.answer.confidence).toBe('medium');
    });
  });

  describe('empty and conflicting evidence', () => {
    it('says no reliable evidence was found rather than answering anyway', async () => {
      prisma.researchSource.findMany.mockResolvedValue([]);
      evidence.webSources.mockReturnValue([]);
      models.generate
        .mockResolvedValueOnce({
          text: JSON.stringify({ intent: 'MARKET_TREND', searchQueries: ['q'], clientDataQuery: 'q' }),
          usage: usage('classify'),
          webSources: [],
        })
        .mockResolvedValueOnce({ text: '', usage: usage('web'), webSources: [] });

      const result = await service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' });

      expect(result.answer.summary).toContain('No reliable evidence found');
      expect(result.answer.verifiedClaims).toEqual([]);
      expect(result.answer.confidence).toBe('low');
      // The answer model is never reached, so nothing can be produced from memory.
      expect(models.generate).toHaveBeenCalledTimes(2);
    });

    it('preserves a conflict the model reported and keeps confidence low', async () => {
      mockPipeline({
        summary: 'Sources disagree: one reports growth, another a decline.',
        confidence: 'low',
        verifiedClaims: [
          { claim: 'Source A reports 12% growth.', citationIds: ['source_1'] },
          { claim: 'Source B reports a 3% decline.', citationIds: ['source_2'] },
        ],
        inferences: [],
        citationGaps: [],
        recommendedActions: [],
        evidenceGaps: ['The two sources conflict and neither is more recent.'],
      });

      const result = await service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' });

      expect(result.answer.confidence).toBe('low');
      expect(result.answer.summary).toContain('disagree');
      expect(result.answer.evidenceGaps).toContain('The two sources conflict and neither is more recent.');
      expect(result.answer.verifiedClaims).toHaveLength(2);
    });
  });

  describe('auditability', () => {
    it('records per-step model usage and token totals on the run', async () => {
      mockPipeline({
        summary: 's',
        confidence: 'medium',
        verifiedClaims: [{ claim: 'c', citationIds: ['source_1'] }],
        inferences: [],
        citationGaps: [],
        recommendedActions: [],
        evidenceGaps: [],
      });

      await service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' });

      const update = prisma.marketResearchRun.update.mock.calls.at(-1)[0].data;
      expect(update.status).toBe('SUCCEEDED');
      expect(update.modelUsage).toHaveLength(3);
      expect(update.inputTokens).toBe(30);
      expect(update.outputTokens).toBe(60);
    });

    it('marks the run failed and re-throws when a step throws', async () => {
      models.generate.mockRejectedValue(new Error('model unreachable'));

      await expect(
        service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' }),
      ).rejects.toThrow('model unreachable');

      const update = prisma.marketResearchRun.update.mock.calls.at(-1)[0].data;
      expect(update.status).toBe('FAILED');
      expect(update.error).toBe('model unreachable');
    });

    // "Internal server error" in the UI tells the customer nothing. Whatever
    // broke, its message has to survive the trip to the browser.
    it('surfaces the cause of an unexpected failure instead of a bare 500', async () => {
      models.generate.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:5432'));

      await expect(
        service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' }),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' }),
      ).rejects.toThrow(/ECONNREFUSED/);
    });

    it('still reports the original failure when the failure bookkeeping also fails', async () => {
      models.generate.mockRejectedValue(new Error('model unreachable'));
      prisma.marketResearchRun.update.mockRejectedValue(new Error('database is down'));

      await expect(
        service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' }),
      ).rejects.toThrow(/model unreachable/);
    });
  });

  describe('model output that does not fit the schema', () => {
    // Reached only after every token is spent, so a Prisma error here throws
    // away a complete answer.
    it('drops a recommended action with no title rather than failing the run', async () => {
      prisma.marketAction = { create: jest.fn().mockResolvedValue({}) };
      prisma.marketOpportunity = { create: jest.fn().mockResolvedValue({}) };
      mockPipeline({
        summary: 's',
        confidence: 'medium',
        verifiedClaims: [{ claim: 'c', citationIds: ['source_1'] }],
        inferences: [],
        citationGaps: [],
        recommendedActions: [
          { type: 'CONTENT_BRIEF', description: 'no title on this one', evidenceCitationIds: ['source_1'], confidence: 'high' },
          { type: 'CONTENT_BRIEF', title: 'Write the comparison page', description: 'd', evidenceCitationIds: ['source_1'], confidence: 'high' },
        ],
        evidenceGaps: [],
      });

      const result = await service.ask({ organizationId: ORG_A, projectId: PROJ_A, question: 'q' });

      expect(result.answer.summary).toBe('s');
      expect(prisma.marketAction.create).toHaveBeenCalledTimes(1);
      expect(prisma.marketAction.create.mock.calls[0][0].data.title).toBe('Write the comparison page');
    });
  });
});
