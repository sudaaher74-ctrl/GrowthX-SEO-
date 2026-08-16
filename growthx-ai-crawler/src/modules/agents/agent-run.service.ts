import { Injectable, Logger } from '@nestjs/common';
import {
  AgentKind,
  AgentRun,
  AgentRunStatus,
  Evidence,
  EvidenceSource,
  Prisma,
  RecommendationEffort,
  RecommendationHorizon,
  RecommendationImpact,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface RecordEvidenceInput {
  source: EvidenceSource;
  /** URL, Prisma row id, or API query that this came from. */
  reference: string;
  /** When the observation was true, not when the row is written. */
  observedAt: Date;
  /** One line a human can read without opening the payload. */
  summary: string;
  payload?: Prisma.InputJsonValue;
}

export interface RecommendInput {
  title: string;
  rationale: string;
  horizon: RecommendationHorizon;
  effort: RecommendationEffort;
  impact: RecommendationImpact;
  /** Role or team expected to act, e.g. "Developer", "Content", "Client". */
  owner: string;
  /**
   * The observation this conclusion rests on.
   *
   * Deliberately an `Evidence` row rather than an id: you cannot reach for a
   * recommendation before you have recorded something that justifies it, and
   * an id typed as `string` would let a plausible-looking literal through.
   */
  primaryEvidence: Evidence;
  supportingEvidence?: Evidence[];
}

/**
 * The shared runtime every agent runs inside.
 *
 * The contract is: open a run, record what you observed, then draw conclusions
 * from those observations. The database enforces the last step — a
 * Recommendation has a NOT NULL foreign key to its primary Evidence — so an
 * agent physically cannot persist a conclusion it has no basis for.
 */
@Injectable()
export class AgentRunService {
  private readonly logger = new Logger(AgentRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  async start(projectId: string, agent: AgentKind, inputSummary?: Prisma.InputJsonValue): Promise<AgentRun> {
    return this.prisma.agentRun.create({
      data: { projectId, agent, status: AgentRunStatus.RUNNING, inputSummary },
    });
  }

  async recordEvidence(run: AgentRun, input: RecordEvidenceInput): Promise<Evidence> {
    return this.prisma.evidence.create({
      data: {
        projectId: run.projectId,
        runId: run.id,
        source: input.source,
        reference: input.reference,
        observedAt: input.observedAt,
        summary: input.summary,
        payload: input.payload,
      },
    });
  }

  /** Records many observations in one round trip, preserving order. */
  async recordEvidenceBatch(run: AgentRun, inputs: RecordEvidenceInput[]): Promise<Evidence[]> {
    return this.prisma.$transaction(inputs.map((input) =>
      this.prisma.evidence.create({
        data: {
          projectId: run.projectId,
          runId: run.id,
          source: input.source,
          reference: input.reference,
          observedAt: input.observedAt,
          summary: input.summary,
          payload: input.payload,
        },
      }),
    ));
  }

  async recommend(run: AgentRun, input: RecommendInput) {
    return this.prisma.recommendation.create({
      data: {
        projectId: run.projectId,
        runId: run.id,
        agent: run.agent,
        title: input.title,
        rationale: input.rationale,
        horizon: input.horizon,
        effort: input.effort,
        impact: input.impact,
        owner: input.owner,
        primaryEvidenceId: input.primaryEvidence.id,
        supportingEvidence: input.supportingEvidence?.length
          ? { connect: input.supportingEvidence.map((e) => ({ id: e.id })) }
          : undefined,
      },
      include: { primaryEvidence: true, supportingEvidence: true },
    });
  }

  async succeed(runId: string, generatedByModel?: string): Promise<AgentRun> {
    return this.prisma.agentRun.update({
      where: { id: runId },
      data: { status: AgentRunStatus.SUCCEEDED, finishedAt: new Date(), generatedByModel },
    });
  }

  async fail(runId: string, error: string): Promise<AgentRun> {
    return this.prisma.agentRun.update({
      where: { id: runId },
      data: { status: AgentRunStatus.FAILED, finishedAt: new Date(), error },
    });
  }

  /**
   * Runs `work` inside a run that is always closed out.
   *
   * Without this, a throw part-way leaves a run RUNNING forever and the UI
   * shows a spinner that never resolves. The error is re-thrown so the caller
   * still surfaces it to the customer.
   */
  async withRun<T>(
    projectId: string,
    agent: AgentKind,
    work: (run: AgentRun) => Promise<{ result: T; model?: string }>,
    inputSummary?: Prisma.InputJsonValue,
  ): Promise<T> {
    const run = await this.start(projectId, agent, inputSummary);
    try {
      const { result, model } = await work(run);
      await this.succeed(run.id, model);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.fail(run.id, message);
      this.logger.warn(`${agent} run ${run.id} failed for project ${projectId}: ${message}`);
      throw error;
    }
  }

  /** The plan: current recommendations for a project, grouped by horizon. */
  async plan(projectId: string) {
    const recommendations = await this.prisma.recommendation.findMany({
      where: { projectId, status: { not: 'DISMISSED' } },
      include: { primaryEvidence: true, supportingEvidence: true },
      orderBy: [{ horizon: 'asc' }, { impact: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      days30: recommendations.filter((r) => r.horizon === RecommendationHorizon.DAYS_30),
      days60: recommendations.filter((r) => r.horizon === RecommendationHorizon.DAYS_60),
      days90: recommendations.filter((r) => r.horizon === RecommendationHorizon.DAYS_90),
    };
  }

  async latestRun(projectId: string, agent: AgentKind) {
    return this.prisma.agentRun.findFirst({
      where: { projectId, agent },
      orderBy: { startedAt: 'desc' },
    });
  }
}
