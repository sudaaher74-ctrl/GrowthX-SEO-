import { PromptEngineService } from './prompt-engine.service';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('PromptEngineService', () => {
  let service: PromptEngineService;
  let prisma: any;
  let aiRouter: any;
  let quotaService: any;

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn(),
      },
      projectBusinessProfile: {
        findUnique: jest.fn(),
      },
      aiVisibilityPrompt: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      aiVisibilityPromptVersion: {
        create: jest.fn(),
      },
      gscDailyMetric: {
        groupBy: jest.fn(),
      },
    };

    aiRouter = {
      generate: jest.fn(),
    };

    quotaService = {
      getLimits: jest.fn().mockReturnValue({
        websites: 1,
        crawlPages: 5000,
        aiCyclesMonthly: 2,
        competitors: 5,
        promptsQuota: 10,
      }),
      assertPromptQuota: jest.fn().mockImplementation(async (projectId, tier, count) => {
        if (count > 5) {
          throw new HttpException(
            { error: 'QUOTA_EXCEEDED', message: 'Tracked prompt limit reached' },
            HttpStatus.PAYMENT_REQUIRED,
          );
        }
      }),
    };

    service = new PromptEngineService(prisma, aiRouter, quotaService);
  });

  describe('suggestPromptsFromGsc', () => {
    it('returns connected: false with NO_GSC_DATA when project has no GSC queries', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Reigel Dental',
        organizationId: 'org-1',
        websites: [{ domain: 'reigeldental.in' }],
        competitors: [],
      });
      prisma.aiVisibilityPrompt.findMany.mockResolvedValue([]);
      prisma.gscDailyMetric.groupBy.mockResolvedValue([]);

      const result = await service.suggestPromptsFromGsc('proj-1', 'starter');

      expect(result.connected).toBe(false);
      expect(result.reason).toBe('NO_GSC_DATA');
      expect(result.suggestions).toEqual([]);
      expect(result.quota.limit).toBe(10);
      expect(result.quota.remaining).toBe(10);
    });

    it('converts real GSC queries into natural buyer prompts with impressions and sets alreadyTracked flag', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'proj-1',
        name: 'Reigel Dental',
        organizationId: 'org-1',
        websites: [{ domain: 'reigeldental.in' }],
        competitors: [{ label: 'SmileCare', domain: 'smilecare.in' }],
      });
      prisma.aiVisibilityPrompt.findMany.mockResolvedValue([
        { id: 'prompt-existing', text: 'Which dental clinic in Bandra is best?', sourceQuery: 'best dental clinic bandra' },
      ]);
      prisma.gscDailyMetric.groupBy.mockResolvedValue([
        {
          query: 'best dental clinic bandra',
          _sum: { impressions: 1420, clicks: 85 },
          _avg: { position: 3.2 },
        },
        {
          query: 'root canal treatment cost mumbai',
          _sum: { impressions: 980, clicks: 42 },
          _avg: { position: 4.8 },
        },
      ]);

      aiRouter.generate.mockResolvedValue({
        text: JSON.stringify({
          items: [
            {
              sourceQuery: 'best dental clinic bandra',
              suggestedPrompt: 'Which dental clinic in Bandra is best?',
              category: 'Local Search Intent',
              journeyStage: 'CONSIDERATION',
            },
            {
              sourceQuery: 'root canal treatment cost mumbai',
              suggestedPrompt: 'How much does root canal treatment cost in Mumbai on average?',
              category: 'Product/Service Discovery',
              journeyStage: 'DISCOVERY',
            },
          ],
        }),
      });

      const result = await service.suggestPromptsFromGsc('proj-1', 'starter');

      expect(result.connected).toBe(true);
      expect(result.queryCount).toBe(2);
      expect(result.totalImpressions).toBe(2400);
      expect(result.totalClicks).toBe(127);
      expect(result.suggestions).toHaveLength(2);

      // First prompt is already tracked
      const first = result.suggestions.find((s) => s.sourceQuery === 'best dental clinic bandra');
      expect(first?.isAlreadyTracked).toBe(true);
      expect(first?.impressions).toBe(1420);

      // Second prompt is not yet tracked
      const second = result.suggestions.find((s) => s.sourceQuery === 'root canal treatment cost mumbai');
      expect(second?.isAlreadyTracked).toBe(false);
      expect(second?.impressions).toBe(980);
      expect(second?.clicks).toBe(42);
      expect(second?.avgPosition).toBe(4.8);
    });
  });

  describe('addPromptsFromSuggestions', () => {
    it('creates active prompts with sourceQuery and version', async () => {
      prisma.aiVisibilityPrompt.findFirst.mockResolvedValue(null);
      prisma.aiVisibilityPrompt.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'new-p1', ...args.data }),
      );
      prisma.aiVisibilityPromptVersion.create.mockResolvedValue({ id: 'v1' });

      const result = await service.addPromptsFromSuggestions(
        'proj-1',
        [
          {
            text: 'How much does root canal treatment cost in Mumbai?',
            category: 'Product/Service Discovery',
            journeyStage: 'DISCOVERY',
            sourceQuery: 'root canal cost mumbai',
          },
        ],
        'starter',
      );

      expect(quotaService.assertPromptQuota).toHaveBeenCalledWith('proj-1', 'starter', 1);
      expect(result.added).toBe(1);
      expect(prisma.aiVisibilityPrompt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: 'proj-1',
          text: 'How much does root canal treatment cost in Mumbai?',
          sourceQuery: 'root canal cost mumbai',
          isActive: true,
        }),
      });
      expect(prisma.aiVisibilityPromptVersion.create).toHaveBeenCalledWith({
        data: {
          promptId: 'new-p1',
          text: 'How much does root canal treatment cost in Mumbai?',
          version: 1,
        },
      });
    });

    it('rejects adding prompts when quota is exceeded', async () => {
      await expect(
        service.addPromptsFromSuggestions(
          'proj-1',
          [
            { text: 'Q1' },
            { text: 'Q2' },
            { text: 'Q3' },
            { text: 'Q4' },
            { text: 'Q5' },
            { text: 'Q6' },
          ],
          'starter',
        ),
      ).rejects.toThrow('Tracked prompt limit reached');
    });
  });
});
