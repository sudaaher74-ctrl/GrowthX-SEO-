import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

/** How a routed call ended. A call that cost tokens and then failed is still spend. */
export type AiCallStatus = 'OK' | 'REFUSED' | 'ERROR';

export interface AiUsageEntry {
  organizationId?: string;
  projectId?: string;
  /** The router's `AiTask` value, e.g. "CODE_GENERATION". */
  taskType: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Null when the model has no published rate. Never a guess. */
  estimatedCostUsd: number | null;
  latencyMs: number;
  status: AiCallStatus;
  error?: string;
}

export interface AiSpendSummary {
  /** Spend we can actually account for, in USD. */
  costUsd: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /**
   * Calls served by a model with no published rate. Their tokens are counted
   * above but their cost is not, so `costUsd` is a floor, not a total. Callers
   * that show a spend figure must show this alongside it.
   */
  callsWithoutRate: number;
}

/** Provider error text is unbounded; the ledger keeps enough to diagnose with. */
const MAX_ERROR_CHARS = 500;

/**
 * The AI spend ledger.
 *
 * Two jobs: record what every routed call cost, and refuse calls for an
 * organization that has spent past its ceiling. Recording is best-effort by
 * design — a ledger write that fails must not fail the AI call that succeeded,
 * because the customer already has their answer and the provider has already
 * billed us.
 */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records one call. Never throws and never rejects: callers `void` this.
   */
  record(entry: AiUsageEntry): void {
    void this.prisma.aiUsageRecord
      .create({
        data: {
          organizationId: entry.organizationId ?? null,
          projectId: entry.projectId ?? null,
          taskType: entry.taskType,
          provider: entry.provider,
          model: entry.model,
          inputTokens: entry.inputTokens,
          outputTokens: entry.outputTokens,
          estimatedCostUsd: entry.estimatedCostUsd,
          latencyMs: entry.latencyMs,
          status: entry.status,
          error: entry.error ? entry.error.slice(0, MAX_ERROR_CHARS) : null,
        },
      })
      .catch((error: unknown) => {
        // Deliberately swallowed. The alternative — surfacing this — turns a
        // bookkeeping outage into a product outage.
        this.logger.warn(
          `Could not record AI usage (${entry.provider}/${entry.model}): ${
            (error as Error)?.message ?? 'unknown'
          }`,
        );
      });
  }

  /** Spend for an organization since the start of the current UTC month. */
  async monthToDate(organizationId: string): Promise<AiSpendSummary> {
    const since = startOfUtcMonth(new Date());

    const [totals, callsWithoutRate] = await Promise.all([
      this.prisma.aiUsageRecord.aggregate({
        where: { organizationId, createdAt: { gte: since } },
        _sum: { estimatedCostUsd: true, inputTokens: true, outputTokens: true },
        _count: { _all: true },
      }),
      this.prisma.aiUsageRecord.count({
        where: { organizationId, createdAt: { gte: since }, estimatedCostUsd: null },
      }),
    ]);

    return {
      costUsd: totals._sum.estimatedCostUsd ?? 0,
      calls: totals._count._all,
      inputTokens: totals._sum.inputTokens ?? 0,
      outputTokens: totals._sum.outputTokens ?? 0,
      callsWithoutRate,
    };
  }

  /**
   * Throws when the organization has already spent its monthly ceiling.
   *
   * Checked before the call rather than after, so the ceiling stops spend
   * instead of merely reporting it. An organization with no ceiling set, or a
   * request with no organization attached, is never blocked.
   */
  async assertWithinBudget(organizationId?: string): Promise<void> {
    if (!organizationId) return;

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { aiMonthlyBudgetUsd: true },
    });

    const budget = org?.aiMonthlyBudgetUsd;
    if (budget == null) return;

    const spend = await this.monthToDate(organizationId);
    if (spend.costUsd < budget) return;

    throw new ForbiddenException(
      `This organization has reached its monthly AI budget of $${budget.toFixed(2)} ` +
        `(accounted spend $${spend.costUsd.toFixed(2)}). Raise the budget in settings to continue.`,
    );
  }
}

function startOfUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
