import { Test, TestingModule } from '@nestjs/testing';
import { AgentKind, AgentRunStatus, RecommendationHorizon } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AgentRunService } from './agent-run.service';

const run = { id: 'run-1', projectId: 'proj-1', agent: AgentKind.STRATEGY } as never;
const evidence = { id: 'ev-1', projectId: 'proj-1' } as never;

describe('AgentRunService', () => {
  let service: AgentRunService;
  let prisma: {
    agentRun: { create: jest.Mock; update: jest.Mock; findFirst: jest.Mock };
    evidence: { create: jest.Mock };
    recommendation: { create: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      agentRun: {
        create: jest.fn().mockResolvedValue(run),
        update: jest.fn().mockResolvedValue(run),
        findFirst: jest.fn().mockResolvedValue(run),
      },
      evidence: { create: jest.fn().mockResolvedValue(evidence) },
      recommendation: { create: jest.fn().mockResolvedValue({ id: 'rec-1' }), findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentRunService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AgentRunService);
  });

  it('scopes evidence to the run and its project', async () => {
    await service.recordEvidence(run, {
      source: 'CRAWL_ISSUE',
      reference: 'issue:123',
      observedAt: new Date('2026-01-01'),
      summary: '12 pages missing an H1',
    });

    expect(prisma.evidence.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: 'proj-1', runId: 'run-1', reference: 'issue:123' }),
      }),
    );
  });

  it('links every recommendation to the evidence behind it', async () => {
    await service.recommend(run, {
      title: 'Add H1s',
      rationale: '12 pages lack one',
      horizon: RecommendationHorizon.DAYS_30,
      effort: 'LOW',
      impact: 'HIGH',
      owner: 'Developer',
      primaryEvidence: evidence,
    });

    expect(prisma.recommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ primaryEvidenceId: 'ev-1', owner: 'Developer' }),
      }),
    );
  });

  it('closes the run as succeeded when the work completes', async () => {
    const result = await service.withRun('proj-1', AgentKind.STRATEGY, async () => ({
      result: 'done',
      model: 'claude-opus-5',
    }));

    expect(result).toBe('done');
    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: AgentRunStatus.SUCCEEDED, generatedByModel: 'claude-opus-5' }),
      }),
    );
  });

  // A run left RUNNING after a crash shows the customer a spinner that never
  // resolves, so failure has to close the run as firmly as success does.
  it('closes the run as failed and re-throws when the work throws', async () => {
    await expect(
      service.withRun('proj-1', AgentKind.STRATEGY, async () => {
        throw new Error('model unreachable');
      }),
    ).rejects.toThrow('model unreachable');

    expect(prisma.agentRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: AgentRunStatus.FAILED, error: 'model unreachable' }),
      }),
    );
  });

  it('groups the plan into 30/60/90 buckets and drops dismissed items', async () => {
    prisma.recommendation.findMany.mockResolvedValue([
      { id: 'a', horizon: RecommendationHorizon.DAYS_30 },
      { id: 'b', horizon: RecommendationHorizon.DAYS_90 },
      { id: 'c', horizon: RecommendationHorizon.DAYS_30 },
    ]);

    const plan = await service.plan('proj-1');

    expect(plan.days30.map((r) => r.id)).toEqual(['a', 'c']);
    expect(plan.days60).toEqual([]);
    expect(plan.days90.map((r) => r.id)).toEqual(['b']);
    expect(prisma.recommendation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'proj-1', status: { not: 'DISMISSED' } } }),
    );
  });
});
