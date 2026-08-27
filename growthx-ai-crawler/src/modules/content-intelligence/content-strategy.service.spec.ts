import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { ContentStrategyService } from './content-strategy.service';

const ORG = 'org_1';
const PROJ = 'proj_1';

/**
 * Walks a JSON Schema looking for an object declared with neither `properties`
 * nor `additionalProperties`. Such a node is unconstrained, and the strict
 * structured-output modes (Gemini's responseSchema, Anthropic's json_schema
 * format) reject the whole request rather than ignoring the node — which took
 * out every provider in the chain and left the strategy page empty.
 */
function unconstrainedObjects(node: any, path = '$'): string[] {
  if (!node || typeof node !== 'object') return [];

  const found: string[] = [];
  if (node.type === 'object' && !node.properties && node.additionalProperties === undefined) {
    found.push(path);
  }
  if (node.properties) {
    for (const [key, child] of Object.entries(node.properties)) {
      found.push(...unconstrainedObjects(child, `${path}.${key}`));
    }
  }
  if (node.items) found.push(...unconstrainedObjects(node.items, `${path}[]`));
  return found;
}

describe('ContentStrategyService', () => {
  let service: ContentStrategyService;
  let prisma: any;
  let router: { generate: jest.Mock };
  let created: any;

  const modelAnswer = {
    executiveSummary: 'Own the freshness story.',
    contentPillars: [{ pillar: 'PRODUCT', percentage: 100, rationale: 'Core range.' }],
    platformFrequency: [
      { platform: 'INSTAGRAM', postsPerWeek: 5 },
      { platform: 'youtube', postsPerWeek: 1 },
    ],
    campaignIdeas: [{ name: 'Farm to door', objective: 'Awareness', concept: 'Daily route film.' }],
  };

  beforeEach(async () => {
    created = null;
    prisma = {
      creativePattern: { findMany: jest.fn().mockResolvedValue([]) },
      contentGap: { findMany: jest.fn().mockResolvedValue([]) },
      contentIntelligenceConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      project: {
        findUnique: jest.fn().mockResolvedValue({ name: 'milquufresh', websites: [{ domain: 'milquufresh.in' }] }),
      },
      socialPost: { findMany: jest.fn().mockResolvedValue([]) },
      page: { findMany: jest.fn().mockResolvedValue([]) },
      contentStrategy: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          created = data;
          return Promise.resolve({ id: 'strat_1', ...data });
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    router = { generate: jest.fn().mockResolvedValue({ text: JSON.stringify(modelAnswer), model: 'test-model' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentStrategyService,
        { provide: PrismaService, useValue: prisma },
        { provide: MultiAiRouterService, useValue: router },
      ],
    }).compile();

    service = module.get(ContentStrategyService);
  });

  it('sends a schema every provider can accept', async () => {
    await service.generateStrategy(PROJ, ORG);

    const schema = router.generate.mock.calls[0][0].jsonSchema;
    expect(unconstrainedObjects(schema)).toEqual([]);
  });

  it('stores the posting cadence as the platform → per-week map the UI reads', async () => {
    await service.generateStrategy(PROJ, ORG);

    expect(created.platformFrequency).toEqual({ INSTAGRAM: 5, YOUTUBE: 1 });
  });

  it('still generates when no patterns, gaps, or posts have been collected', async () => {
    await service.generateStrategy(PROJ, ORG);

    const { prompt } = router.generate.mock.calls[0][0];
    // The empty sections have to be said out loud, or the model answers in
    // prose about the missing data and the JSON parse fails.
    expect(prompt).toContain('None recorded yet.');
    expect(prompt).toContain('No competitor patterns, gaps, or social posts have been collected');
    expect(created.title).toContain('Foundational');
    expect(created.content.dataBasis).toEqual({ patterns: 0, gaps: 0, ownedPosts: 0, competitorPosts: 0, crawledPages: 0 });
  });

  it('asks for a gap-driven strategy once there is evidence to work from', async () => {
    prisma.contentGap.findMany.mockResolvedValue([
      { gapType: 'MARKET_GAP', title: 'No morning routine content', description: 'Nobody owns it.', opportunityScore: 88 },
    ]);

    await service.generateStrategy(PROJ, ORG);

    const { prompt } = router.generate.mock.calls[0][0];
    expect(prompt).toContain('No morning routine content');
    expect(prompt).not.toContain('No competitor patterns, gaps, or social posts have been collected');
    expect(created.title).not.toContain('Foundational');
    expect(created.content.dataBasis.gaps).toBe(1);
  });

  it('returns the strategy document so the detail view has something to render', async () => {
    await service.listStrategies(ORG, PROJ);

    const { select } = prisma.contentStrategy.findMany.mock.calls[0][0];
    expect(select.content).toBe(true);
    expect(select.creatorStrategy).toBe(true);
  });
  it('does not lose the strategy when the first provider answers with prose', async () => {
    // The real chain on this deployment is SARVAM -> GROQ -> OPENROUTER, and
    // none of the three has the schema enforced for it. The router has to treat
    // unreadable output as a failed attempt, or the providers behind the first
    // one never get asked.
    const chain = ['SARVAM', 'GROQ', 'OPENROUTER'];
    const answers: Record<string, string> = {
      SARVAM: 'I cannot ground a strategy without competitive data.',
      GROQ: JSON.stringify(modelAnswer),
      OPENROUTER: JSON.stringify(modelAnswer),
    };

    const { MultiAiRouterService: RealRouter, AiTask: RealTask } = jest.requireActual(
      '../ai-search/multi-ai-router/multi-ai-router.service',
    );
    const realRouter = Object.create(RealRouter.prototype);
    realRouter.logger = { warn: jest.fn(), log: jest.fn() };
    realRouter.configuredProviders = () => chain;
    realRouter.invoke = (provider: string) =>
      Promise.resolve({ provider, model: `${provider}-model`, text: answers[provider], refused: false });

    const completion = await realRouter.generate({
      prompt: 'p',
      jsonSchema: { type: 'object' },
      task: RealTask.REASONING,
    });

    expect(completion.provider).toBe('GROQ');
    expect(JSON.parse(completion.text).executiveSummary).toBe('Own the freshness story.');
  });

  it('reports failure when no provider returns readable JSON', async () => {
    const { MultiAiRouterService: RealRouter, AiTask: RealTask } = jest.requireActual(
      '../ai-search/multi-ai-router/multi-ai-router.service',
    );
    const realRouter = Object.create(RealRouter.prototype);
    realRouter.logger = { warn: jest.fn(), log: jest.fn() };
    realRouter.configuredProviders = () => ['SARVAM', 'GROQ'];
    realRouter.invoke = (provider: string) =>
      Promise.resolve({ provider, model: 'm', text: 'sorry, no.', refused: false });

    await expect(
      realRouter.generate({ prompt: 'p', jsonSchema: { type: 'object' }, task: RealTask.REASONING }),
    ).rejects.toThrow(/unparseable JSON/);
  });
  it('rescues a pillar whose percentage came back as its rationale', async () => {
    // The exact shape sarvam-105b returned in production: PROMOTIONAL carried
    // the rationale text in `percentage` and null in `rationale`, which reached
    // the donut as a string and rendered as "<paragraph>%".
    const promotionalRationale =
      'Promotional content is intentionally kept low to avoid appearing sales-heavy at launch.';
    router.generate.mockResolvedValue({
      model: 'sarvam-105b',
      text: JSON.stringify({
        ...modelAnswer,
        contentPillars: [
          { pillar: 'PRODUCT', percentage: 25, rationale: 'Core range.' },
          { pillar: 'EDUCATIONAL', percentage: 35, rationale: 'Teach first.' },
          { pillar: 'LIFESTYLE', percentage: 20, rationale: 'Show the day.' },
          { pillar: 'PROMOTIONAL', percentage: promotionalRationale, rationale: null },
          { pillar: 'CREATOR', percentage: 5, rationale: 'Borrow trust.' },
        ],
      }),
    });

    await service.generateStrategy(PROJ, ORG);

    const pillars = created.contentPillars;
    // Every percentage must be a number, or the chart cannot plot it.
    pillars.forEach((p: any) => expect(typeof p.percentage).toBe('number'));

    const promotional = pillars.find((p: any) => p.pillar === 'PROMOTIONAL');
    // The stray text is the sentence the model meant as the rationale.
    expect(promotional.rationale).toBe(promotionalRationale);
    // 25+35+20+5 = 85 claimed, so the one pillar without a figure takes 15.
    expect(promotional.percentage).toBe(15);
    expect(pillars.reduce((a: number, p: any) => a + p.percentage, 0)).toBe(100);
  });

  it('keeps well-formed pillars exactly as the model wrote them', async () => {
    await service.generateStrategy(PROJ, ORG);
    expect(created.contentPillars).toEqual([
      { pillar: 'PRODUCT', percentage: 100, rationale: 'Core range.', topics: undefined },
    ]);
  });
  it('tells the model what the business is, from its own crawled pages', async () => {
    // Without this the prompt carries a name and a domain, and the model infers
    // the sector: a probe against a fresh-milk brand produced a strategy for a
    // food delivery app.
    prisma.page.findMany.mockResolvedValue([
      {
        url: 'https://aivaenterprises.com/',
        title: 'Premium Fruit Pulp Exporter India | AIVA Enterprises',
        metaDescription: 'AIVA Enterprises exports premium aseptic fruit pulps and purees.',
        h1: ['Aseptic Fruit Pulp Export'],
      },
    ]);

    await service.generateStrategy(PROJ, ORG);

    const { prompt } = router.generate.mock.calls[0][0];
    expect(prompt).toContain('Premium Fruit Pulp Exporter India');
    expect(prompt).toContain('aseptic fruit pulps');
    expect(prompt).toContain('H1: Aseptic Fruit Pulp Export');
    expect(prompt).toContain('Do not infer the sector from the brand name');
    expect(created.content.dataBasis.crawledPages).toBe(1);
  });

  it('collapses repeated titles so one shared tag cannot crowd out the rest', async () => {
    const shared = { title: 'AIVA Enterprises', metaDescription: 'Exporter.', h1: [], url: 'https://x/1' };
    prisma.page.findMany.mockResolvedValue([
      shared,
      { ...shared, url: 'https://x/2' },
      { ...shared, url: 'https://x/3' },
      { title: 'Alphonso Mango Pulp', metaDescription: 'Product page.', h1: [], url: 'https://x/4' },
    ]);

    await service.generateStrategy(PROJ, ORG);

    const { prompt } = router.generate.mock.calls[0][0];
    expect(prompt.match(/- AIVA Enterprises/g) ?? []).toHaveLength(1);
    expect(prompt).toContain('Alphonso Mango Pulp');
    expect(created.content.dataBasis.crawledPages).toBe(2);
  });

  it('still treats a crawled site with no competitor data as a foundational strategy', async () => {
    // Crawled pages say what the brand is; they say nothing about its market.
    prisma.page.findMany.mockResolvedValue([
      { title: 'Fruit Pulp Exporter', metaDescription: null, h1: [], url: 'https://x/1' },
    ]);

    await service.generateStrategy(PROJ, ORG);

    expect(created.title).toContain('Foundational');
    const { prompt } = router.generate.mock.calls[0][0];
    expect(prompt).toContain('No competitor patterns, gaps, or social posts have been collected');
  });
});
