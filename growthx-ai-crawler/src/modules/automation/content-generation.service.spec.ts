import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ContentPieceStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { StrategyService } from '../strategy/strategy.service';
import { ContentGenerationService } from './content-generation.service';

const PLAN_STRATEGY = {
  id: 'strat_1',
  content: {
    contentPlan: [
      { title: 'Best Insulated Jackets', format: 'Guide', targetQuery: 'best insulated jacket', why: 'Lost to Trailhead' },
      { title: 'Best Insulated Jackets', format: 'Guide', targetQuery: 'dup', why: 'duplicate title, should collapse' },
      { title: '', format: 'Guide' }, // no title — must be skipped
    ],
  },
};

describe('ContentGenerationService', () => {
  let service: ContentGenerationService;
  let prisma: any;
  let router: { generate: jest.Mock };
  let strategy: { gatherEvidence: jest.Mock };

  beforeEach(async () => {
    prisma = {
      strategyReport: { findFirst: jest.fn().mockResolvedValue(PLAN_STRATEGY) },
      contentPiece: {
        upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'piece_1', ...create })),
        findUnique: jest.fn(),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'piece_1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    router = {
      generate: jest.fn().mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: JSON.stringify({
          title: 'Best Insulated Jackets for Winter Hiking',
          metaDescription: 'A complete guide.',
          slug: 'best-insulated-jackets',
          body: '## Why insulation matters\n\nContent here.',
        }),
        usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
        refused: false,
      }),
    };

    strategy = {
      gatherEvidence: jest.fn().mockResolvedValue({
        business: { projectName: 'Northwind Outdoors', domains: ['northwindoutdoors.com'] },
        site: { samplePages: [{ url: 'https://northwindoutdoors.com/x', title: 'X', wordCount: 500 }] },
        aiVisibility: { lostPrompts: [{ prompt: 'best insulated jacket', competitors: ['trailheadco.com'] }] },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentGenerationService,
        { provide: PrismaService, useValue: prisma },
        { provide: MultiAiRouterService, useValue: router },
        { provide: StrategyService, useValue: strategy },
      ],
    }).compile();

    service = module.get(ContentGenerationService);
  });

  describe('planFromStrategy', () => {
    it('creates one piece per titled plan entry, deduplicated by slug', async () => {
      const created = await service.planFromStrategy('proj_1');
      // Two entries share a slug (same title) and the third has no title.
      expect(prisma.contentPiece.upsert).toHaveBeenCalledTimes(2);
      expect(created).toHaveLength(2);
    });

    it('sets every new piece to PLANNED', async () => {
      await service.planFromStrategy('proj_1');
      expect(prisma.contentPiece.upsert.mock.calls[0][0].create.status).toBe(ContentPieceStatus.PLANNED);
    });

    it('refuses when no strategy exists yet', async () => {
      prisma.strategyReport.findFirst.mockResolvedValue(null);
      await expect(service.planFromStrategy('proj_1')).rejects.toThrow(BadRequestException);
    });

    it('refuses when the strategy has no content plan', async () => {
      prisma.strategyReport.findFirst.mockResolvedValue({ id: 's', content: {} });
      await expect(service.planFromStrategy('proj_1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('draft', () => {
    beforeEach(() => {
      prisma.contentPiece.findUnique.mockResolvedValue({
        id: 'piece_1',
        projectId: 'proj_1',
        title: 'Best Insulated Jackets',
        slug: 'best-insulated-jackets',
        format: 'Guide',
        targetQuery: 'best insulated jacket',
        rationale: 'Lost to Trailhead',
      });
    });

    it('writes the brief from the same evidence the strategy used', async () => {
      await service.draft('piece_1', 'org_1');
      const prompt = router.generate.mock.calls[0][0].prompt;
      expect(prompt).toContain('Northwind Outdoors');
      expect(prompt).toContain('best insulated jacket');
      expect(prompt).toContain('trailheadco.com');
    });

    it('marks the piece DRAFTED with the generated body', async () => {
      const result = await service.draft('piece_1', 'org_1');
      expect(result.status).toBe(ContentPieceStatus.DRAFTED);
      expect(result.body).toContain('Why insulation matters');
      expect(result.generatedByModel).toBe('claude-opus-5');
    });

    it('refuses for an unknown piece', async () => {
      prisma.contentPiece.findUnique.mockResolvedValue(null);
      await expect(service.draft('missing', 'org_1')).rejects.toThrow(BadRequestException);
    });

    it('does not write a piece when the model refuses', async () => {
      router.generate.mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: '',
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: null },
        refused: true,
      });
      await expect(service.draft('piece_1', 'org_1')).rejects.toThrow(ServiceUnavailableException);
      expect(prisma.contentPiece.update).not.toHaveBeenCalled();
    });

    it('rejects a response missing a body', async () => {
      router.generate.mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: JSON.stringify({ title: 'x' }),
        usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
        refused: false,
      });
      await expect(service.draft('piece_1', 'org_1')).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('toMarkdownFile', () => {
    it('renders front matter and body as a publishable file', () => {
      const file = service.toMarkdownFile({
        title: 'Best Jackets',
        metaDescription: 'A guide',
        body: '## Intro\n\nText.',
        targetQuery: 'best jackets',
      });

      expect(file).toContain('title: "Best Jackets"');
      expect(file).toContain('description: "A guide"');
      expect(file).toContain('## Intro');
    });

    it('never breaks the front matter when the title contains quotes', () => {
      const file = service.toMarkdownFile({
        title: 'The "Best" Jackets',
        metaDescription: null,
        body: 'Text.',
        targetQuery: null,
      });
      expect(() => file.split('---')[1]).not.toThrow();
      expect(file).toContain('\\"Best\\"');
    });
  });
});
