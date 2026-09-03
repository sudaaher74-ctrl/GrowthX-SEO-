import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { EvidenceRetrievalService } from './evidence-retrieval.service';
import { MarketResearchService, ResearchProgressEvent } from './market-research.service';
import { ModelRole, ModelRouterService } from './model-router.service';

const ORG = 'org_a';
const PROJ = 'proj_a';

function usage(step: string) {
  return { step, role: ModelRole.ANALYST, model: 'sarvam-105b', inputTokens: 10, outputTokens: 20 };
}

/**
 * The streaming route is only as truthful as these events. Each assertion here
 * is the thing the UI renders: the stage order it draws, the counts it prints
 * beside each stage, and the sources it puts in the rail before the answer has
 * been written.
 */
describe('MarketResearchService — run progress', () => {
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
      project: { findFirst: jest.fn().mockResolvedValue({ id: PROJ }) },
      marketResearchThread: {
        findFirst: jest.fn().mockResolvedValue({ id: 'thread_1', organizationId: ORG, projectId: PROJ }),
        create: jest.fn().mockResolvedValue({ id: 'thread_1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      marketResearchMessage: { create: jest.fn().mockResolvedValue({}) },
      marketResearchRun: {
        create: jest.fn().mockResolvedValue({ id: 'run_1' }),
        update: jest.fn().mockResolvedValue({}),
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
      modelFor: jest.fn().mockReturnValue('sarvam-105b'),
      isConfigured: jest.fn().mockReturnValue(true),
      supportsEmbeddings: jest.fn().mockReturnValue(true),
    };

    evidence = {
      loadClientContext: jest.fn().mockResolvedValue({
        projectName: 'Northwind',
        domains: ['northwind.com'],
        competitors: [],
        trackedPrompts: [],
        visibility: { citationSharePct: 12, byAssistant: [], shareOfVoice: [], lostPrompts: [] },
      }),
      searchClientPages: jest.fn().mockResolvedValue([{ type: 'CLIENT_WEBSITE', url: 'https://client.com/p', title: 'Our page', excerpt: '', qualityScore: 0.6 }]),
      countClientPages: jest.fn().mockResolvedValue(4),
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
        text: JSON.stringify({ intent: 'MARKET_TREND', searchQueries: ['q1', 'q2'], clientDataQuery: 'jackets' }),
        usage: usage('classify'),
        webSources: [],
      })
      .mockResolvedValueOnce({ text: 'Web notes', usage: usage('web'), webSources: [{ url: 'https://ex.com/a', title: 'Report' }] })
      .mockResolvedValueOnce({ text: JSON.stringify(answer), usage: usage('answer'), webSources: [] });
  }

  const ANSWER = {
    summary: 'Prices rose.',
    confidence: 'high',
    verifiedClaims: [{ claim: 'Prices rose 14%.', citationIds: ['source_1'] }],
    inferences: [],
    citationGaps: [],
    recommendedActions: [],
    evidenceGaps: [],
  };

  it('reports every stage as started then done, in pipeline order', async () => {
    mockPipeline(ANSWER);
    const events: ResearchProgressEvent[] = [];

    await service.ask({
      organizationId: ORG,
      projectId: PROJ,
      question: 'What changed?',
      onProgress: (e) => events.push(e),
    });

    expect(events.map((e) => `${e.stage}:${e.status}`)).toEqual([
      'classify:started',
      'classify:done',
      'client:started',
      'client:done',
      'web:started',
      'web:done',
      'assemble:started',
      'assemble:done',
      'answer:started',
      'answer:done',
      'verify:started',
      'verify:done',
    ]);
  });

  it('sends the citable sources with the assemble stage, before the answer is written', async () => {
    mockPipeline(ANSWER);
    const events: ResearchProgressEvent[] = [];

    await service.ask({
      organizationId: ORG,
      projectId: PROJ,
      question: 'What changed?',
      onProgress: (e) => events.push(e),
    });

    const assembleIndex = events.findIndex((e) => e.stage === 'assemble' && e.status === 'done');
    const answerIndex = events.findIndex((e) => e.stage === 'answer' && e.status === 'started');

    expect(events[assembleIndex].sources).toHaveLength(2);
    // The whole point of streaming: the rail fills before the answer exists.
    expect(assembleIndex).toBeLessThan(answerIndex);
  });

  it('describes what each stage actually found, rather than a fixed caption', async () => {
    mockPipeline(ANSWER);
    const events: ResearchProgressEvent[] = [];

    await service.ask({
      organizationId: ORG,
      projectId: PROJ,
      question: 'What changed?',
      onProgress: (e) => events.push(e),
    });

    const detail = (stage: string) =>
      events.find((e) => e.stage === stage && e.status === 'done')?.detail ?? '';

    expect(detail('classify')).toContain('2 searches planned');
    expect(detail('client')).toContain('1 page from the crawl');
    expect(detail('web')).toContain('1 page read from the web');
    expect(detail('assemble')).toContain('2 citable sources');
    expect(detail('verify')).toContain('Every citation checked');
  });

  it('says so on the web stage when the provider could not search', async () => {
    models.generate
      .mockResolvedValueOnce({
        text: JSON.stringify({ intent: 'MARKET_TREND', searchQueries: ['q'], clientDataQuery: 'x' }),
        usage: usage('classify'),
        webSources: [],
      })
      .mockResolvedValueOnce({
        text: '',
        usage: usage('web'),
        webSources: [],
        webSearchUnavailable: 'sarvam cannot search the live web',
      })
      .mockResolvedValueOnce({ text: JSON.stringify(ANSWER), usage: usage('answer'), webSources: [] });
    evidence.webSources.mockReturnValue([]);

    const events: ResearchProgressEvent[] = [];
    await service.ask({
      organizationId: ORG,
      projectId: PROJ,
      question: 'What changed?',
      onProgress: (e) => events.push(e),
    });

    expect(events.find((e) => e.stage === 'web' && e.status === 'done')?.detail).toContain(
      'Web search unavailable',
    );
  });

  it('reports dropped citations on the verify stage', async () => {
    mockPipeline({
      ...ANSWER,
      verifiedClaims: [
        { claim: 'Real.', citationIds: ['source_1'] },
        { claim: 'Invented.', citationIds: ['source_does_not_exist'] },
      ],
    });

    const events: ResearchProgressEvent[] = [];
    await service.ask({
      organizationId: ORG,
      projectId: PROJ,
      question: 'What changed?',
      onProgress: (e) => events.push(e),
    });

    expect(events.find((e) => e.stage === 'verify' && e.status === 'done')?.detail).toContain(
      'unsupported citation',
    );
  });

  // A run costs the customer model tokens. A browser that navigated away mid
  // stream must not be able to throw that away.
  it('completes the run even when the progress listener throws on every event', async () => {
    mockPipeline(ANSWER);

    const result = await service.ask({
      organizationId: ORG,
      projectId: PROJ,
      question: 'What changed?',
      onProgress: () => {
        throw new Error('client disconnected');
      },
    });

    expect(result.answer.summary).toBe('Prices rose.');
    expect(prisma.marketResearchRun.update).toHaveBeenCalled();
  });

  it('answers identically when no listener is attached', async () => {
    mockPipeline(ANSWER);

    const result = await service.ask({ organizationId: ORG, projectId: PROJ, question: 'What changed?' });

    expect(result.answer.summary).toBe('Prices rose.');
    expect(result.sources).toHaveLength(2);
  });
});
