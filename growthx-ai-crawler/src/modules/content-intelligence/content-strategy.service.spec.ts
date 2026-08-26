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
    expect(created.content.dataBasis).toEqual({ patterns: 0, gaps: 0, ownedPosts: 0, competitorPosts: 0 });
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
});
