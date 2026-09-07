import { ForbiddenException } from '@nestjs/common';
import { AiUsageService } from './ai-usage.service';
import { PrismaService } from '../../../database/prisma.service';

function build(overrides: {
  create?: jest.Mock;
  aggregate?: jest.Mock;
  count?: jest.Mock;
  budget?: number | null;
} = {}) {
  const create = overrides.create ?? jest.fn().mockResolvedValue({});
  const aggregate =
    overrides.aggregate ??
    jest.fn().mockResolvedValue({
      _sum: { estimatedCostUsd: 0, inputTokens: 0, outputTokens: 0 },
      _count: { _all: 0 },
    });
  const count = overrides.count ?? jest.fn().mockResolvedValue(0);
  const findUnique = jest.fn().mockResolvedValue(
    'budget' in overrides ? { aiMonthlyBudgetUsd: overrides.budget } : { aiMonthlyBudgetUsd: null },
  );

  const prisma = {
    aiUsageRecord: { create, aggregate, count },
    organization: { findUnique },
  } as unknown as PrismaService;

  return { service: new AiUsageService(prisma), create, aggregate, count, findUnique };
}

const entry = {
  organizationId: 'org-1',
  projectId: 'proj-1',
  taskType: 'CODE_GENERATION',
  provider: 'ANTHROPIC',
  model: 'claude-opus-5',
  inputTokens: 1000,
  outputTokens: 500,
  estimatedCostUsd: 0.0175,
  latencyMs: 1200,
  status: 'OK' as const,
};

describe('AiUsageService', () => {
  describe('record', () => {
    it('writes the call to the ledger', async () => {
      const { service, create } = build();
      service.record(entry);
      await Promise.resolve();

      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          projectId: 'proj-1',
          taskType: 'CODE_GENERATION',
          provider: 'ANTHROPIC',
          inputTokens: 1000,
          estimatedCostUsd: 0.0175,
          status: 'OK',
          error: null,
        }),
      });
    });

    it('swallows a ledger failure rather than failing the AI call', async () => {
      const create = jest.fn().mockRejectedValue(new Error('database is down'));
      const { service } = build({ create });

      expect(() => service.record(entry)).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));
    });

    it('truncates a long provider error instead of storing it whole', async () => {
      const { service, create } = build();
      service.record({ ...entry, status: 'ERROR', error: 'x'.repeat(2000) });
      await Promise.resolve();

      expect(create.mock.calls[0][0].data.error).toHaveLength(500);
    });

    it('stores an absent organization as null rather than undefined', async () => {
      const { service, create } = build();
      service.record({ ...entry, organizationId: undefined, projectId: undefined });
      await Promise.resolve();

      expect(create.mock.calls[0][0].data.organizationId).toBeNull();
      expect(create.mock.calls[0][0].data.projectId).toBeNull();
    });
  });

  describe('monthToDate', () => {
    it('reports accounted spend and how much of it could not be priced', async () => {
      const { service } = build({
        aggregate: jest.fn().mockResolvedValue({
          _sum: { estimatedCostUsd: 12.5, inputTokens: 900, outputTokens: 300 },
          _count: { _all: 40 },
        }),
        count: jest.fn().mockResolvedValue(7),
      });

      await expect(service.monthToDate('org-1')).resolves.toEqual({
        costUsd: 12.5,
        calls: 40,
        inputTokens: 900,
        outputTokens: 300,
        callsWithoutRate: 7,
      });
    });

    it('reports zero rather than null when nothing has been spent', async () => {
      const { service } = build({
        aggregate: jest.fn().mockResolvedValue({
          _sum: { estimatedCostUsd: null, inputTokens: null, outputTokens: null },
          _count: { _all: 0 },
        }),
      });

      await expect(service.monthToDate('org-1')).resolves.toMatchObject({
        costUsd: 0,
        inputTokens: 0,
      });
    });
  });

  describe('assertWithinBudget', () => {
    it('allows a request with no organization attached', async () => {
      const { service, findUnique } = build();
      await expect(service.assertWithinBudget(undefined)).resolves.toBeUndefined();
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('allows an organization that has set no ceiling', async () => {
      const { service, aggregate } = build({ budget: null });
      await expect(service.assertWithinBudget('org-1')).resolves.toBeUndefined();
      expect(aggregate).not.toHaveBeenCalled();
    });

    it('allows spend below the ceiling', async () => {
      const { service } = build({
        budget: 100,
        aggregate: jest.fn().mockResolvedValue({
          _sum: { estimatedCostUsd: 40, inputTokens: 0, outputTokens: 0 },
          _count: { _all: 3 },
        }),
      });

      await expect(service.assertWithinBudget('org-1')).resolves.toBeUndefined();
    });

    it('refuses once spend reaches the ceiling', async () => {
      const { service } = build({
        budget: 100,
        aggregate: jest.fn().mockResolvedValue({
          _sum: { estimatedCostUsd: 100, inputTokens: 0, outputTokens: 0 },
          _count: { _all: 9 },
        }),
      });

      await expect(service.assertWithinBudget('org-1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
