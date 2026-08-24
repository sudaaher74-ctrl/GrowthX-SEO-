import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AiAssistant, } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiProvider, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AiVisibilityService, SUPPORTED_ASSISTANTS } from './ai-visibility.service';

const PROJECT = {
  id: 'proj_1',
  name: 'Northwind Outdoors',
  organizationId: 'org_1',
  websites: [{ domain: 'northwindoutdoors.com' }],
  competitors: [{ domain: 'trailheadco.com', label: 'Trailhead Co' }],
};

describe('AiVisibilityService', () => {
  let service: AiVisibilityService;
  let prisma: any;
  let router: { generate: jest.Mock };
  let entitlements: any;

  beforeEach(async () => {
    prisma = {
      project: { findUnique: jest.fn().mockResolvedValue(PROJECT) },
      trackedPrompt: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', text: 'best insulated jacket' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', text: 'best insulated jacket' }]),
        upsert: jest.fn(),
      },
      promptCheck: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      competitorDomain: { upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve(create)) },
      $transaction: jest.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
    };

    router = {
      generate: jest.fn().mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: 'I would recommend northwindoutdoors.com, though trailheadco.com is also good.',
        usage: { inputTokens: 100, outputTokens: 50, estimatedCostUsd: 0.001 },
        refused: false,
      }),
    };

    entitlements = {
      assertFeature: jest.fn().mockResolvedValue(undefined),
      assertQuota: jest.fn().mockResolvedValue(undefined),
      recordUsage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiVisibilityService,
        { provide: PrismaService, useValue: prisma },
        { provide: MultiAiRouterService, useValue: router },
],
    }).compile();

    service = module.get(AiVisibilityService);
  });

  describe('project context', () => {
    it('refuses to track a project with no website', async () => {
      prisma.project.findUnique.mockResolvedValue({ ...PROJECT, websites: [] });
      await expect(service.sweepProject('proj_1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('runCheck', () => {
    const context = {
      organizationId: 'org_1',
      ownDomains: ['northwindoutdoors.com'],
      ownBrandNames: ['Northwind Outdoors'],
      competitors: [{ domain: 'trailheadco.com', names: ['Trailhead Co'] }],
      competitorLabels: { 'trailheadco.com': 'Trailhead Co' },
    };

    it('records a citation with position and competitors', async () => {
      const check = await service.runCheck('p1', AiAssistant.CLAUDE, context as any);

      expect(check).toMatchObject({
        assistant: AiAssistant.CLAUDE,
        model: 'claude-opus-5',
        cited: true,
        position: 1,
        competitorsCited: ['trailheadco.com'],
      });
    });

    it('asks the assistant that the check is named for', async () => {
      await service.runCheck('p1', AiAssistant.CHATGPT, context as any);
      expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ provider: AiProvider.OPENAI }));

      await service.runCheck('p1', AiAssistant.GEMINI, context as any);
      expect(router.generate).toHaveBeenLastCalledWith(expect.objectContaining({ provider: AiProvider.GEMINI }));
    });

    it('records an explicit error for an assistant with no API, without calling a model', async () => {
      const check = await service.runCheck('p1', AiAssistant.AI_OVERVIEWS, context as any);

      expect(router.generate).not.toHaveBeenCalled();
      expect(check.error).toMatch(/No public API/);
      // Critically, this must not read as "you were not cited".
      expect(check.cited).toBeUndefined();
    });

    it('records a provider failure as an error rather than a miss', async () => {
      router.generate.mockRejectedValue(new Error('529 overloaded'));
      const check = await service.runCheck('p1', AiAssistant.CLAUDE, context as any);
      expect(check.error).toContain('529 overloaded');
      expect(check.cited).toBeUndefined();
    });

    it('records a refusal as an error', async () => {
      router.generate.mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: '',
        usage: { inputTokens: 0, outputTokens: 0, estimatedCostUsd: null },
        refused: true,
      });
      const check = await service.runCheck('p1', AiAssistant.CLAUDE, context as any);
      expect(check.error).toMatch(/declined/i);
    });

    it('stores the answer as evidence, truncated', async () => {
      router.generate.mockResolvedValue({
        provider: AiProvider.ANTHROPIC,
        model: 'claude-opus-5',
        text: 'northwindoutdoors.com '.repeat(500),
        usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
        refused: false,
      });
      const check = await service.runCheck('p1', AiAssistant.CLAUDE, context as any);
      expect(check.answerExcerpt?.length).toBe(2000);
    });
  });

  describe('sweepProject', () => {
    it('runs every active prompt against every measurable assistant', async () => {
      prisma.trackedPrompt.findMany.mockResolvedValue([
        { id: 'p1', text: 'a' },
        { id: 'p2', text: 'b' },
      ]);
      prisma.trackedPrompt.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve({ id: where.id, text: 'a' }),
      );

      const result = await service.sweepProject('proj_1');

      expect(result.checksRun).toBe(2 * SUPPORTED_ASSISTANTS.length);
      expect(result.citations).toBe(2 * SUPPORTED_ASSISTANTS.length);
      expect(result.checksFailed).toBe(0);
    });

    it('checks the plan allowance for the whole batch before spending anything', async () => {
      prisma.trackedPrompt.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]);

      await service.sweepProject('proj_1');

    });

    it('does not run when the plan lacks AI visibility', async () => {
      entitlements.assertFeature.mockRejectedValue(new ForbiddenException());
      await expect(service.sweepProject('proj_1')).rejects.toThrow(ForbiddenException);
      expect(router.generate).not.toHaveBeenCalled();
    });

    it('bills only the checks that succeeded', async () => {
      router.generate
        .mockResolvedValueOnce({
          provider: AiProvider.ANTHROPIC,
          model: 'm',
          text: 'northwindoutdoors.com',
          usage: { inputTokens: 1, outputTokens: 1, estimatedCostUsd: null },
          refused: false,
        })
        .mockRejectedValue(new Error('outage'));

      const result = await service.sweepProject('proj_1');

      expect(result.checksRun).toBe(1);
      expect(result.checksFailed).toBe(SUPPORTED_ASSISTANTS.length - 1);
    });

    it('records nothing when every check failed', async () => {
      router.generate.mockRejectedValue(new Error('outage'));
      const result = await service.sweepProject('proj_1');

      expect(result.checksRun).toBe(0);
      expect(entitlements.recordUsage).not.toHaveBeenCalled();
    });

    it('reports assistants it cannot measure instead of silently dropping them', async () => {
      const result = await service.sweepProject('proj_1', {
        assistants: [AiAssistant.CLAUDE, AiAssistant.AI_OVERVIEWS, AiAssistant.COPILOT],
      });

      expect(result.skippedAssistants).toEqual([AiAssistant.AI_OVERVIEWS, AiAssistant.COPILOT]);
      expect(result.checksRun).toBe(1);
    });

    it('skips the allowance check for the scheduled path that already verified it', async () => {
      await service.sweepProject('proj_1', { skipEntitlementCheck: true });
      expect(entitlements.assertFeature).not.toHaveBeenCalled();
      expect(entitlements.assertQuota).not.toHaveBeenCalled();
    });
  });

  describe('addCompetitor', () => {
    it('normalizes the domain before storing it', async () => {
      await service.addCompetitor('proj_1', 'https://WWW.TrailheadCo.com/shop', 'Trailhead Co');
      expect(prisma.competitorDomain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: { projectId: 'proj_1', domain: 'trailheadco.com', label: 'Trailhead Co' },
        }),
      );
    });

    it('rejects an empty domain', async () => {
      await expect(service.addCompetitor('proj_1', '   ')).rejects.toThrow(BadRequestException);
    });
  });

  describe('addPrompts', () => {
    it('rejects a request with no usable prompt text', async () => {
      await expect(service.addPrompts('proj_1', [{ text: '  ' }])).rejects.toThrow(BadRequestException);
    });

    it('trims and upserts so re-adding a prompt does not duplicate it', async () => {
      await service.addPrompts('proj_1', [{ text: '  best jacket  ', cluster: 'guides' }]);
      expect(prisma.trackedPrompt.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId_text: { projectId: 'proj_1', text: 'best jacket' } },
        }),
      );
    });
  });
});
