import { Injectable, Logger } from '@nestjs/common';
import { AiAssistant, InterventionArm } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface RateResult {
  rate: number;
  sampleSize: number;
}

export const SAMPLE_FLOOR = 5;

@Injectable()
export class OutcomeMeasurementService {
  private readonly logger = new Logger(OutcomeMeasurementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes difference-in-differences lift.
   * lift = (post - pre) - (controlPost - controlPre)
   * Returns null if control is missing or any sample size is below the floor.
   */
  calculateLift(
    treat: { pre: RateResult; post: RateResult },
    control: { pre: RateResult; post: RateResult } | null,
    floor = SAMPLE_FLOOR,
  ): number | null {
    if (!control) return null;

    if (
      treat.pre.sampleSize < floor ||
      treat.post.sampleSize < floor ||
      control.pre.sampleSize < floor ||
      control.post.sampleSize < floor
    ) {
      return null;
    }

    const treatDelta = treat.post.rate - treat.pre.rate;
    const controlDelta = control.post.rate - control.pre.rate;
    return Number((treatDelta - controlDelta).toFixed(4));
  }

  /**
   * Measures all interventions that are due for evaluation for a given window (7, 30, 60, 90).
   * Also promotes expired HOLD interventions whose measurement window has closed.
   */
  async measureDue(windowDays: 7 | 30 | 60 | 90): Promise<number> {
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - windowMs);

    // 1. Find shipped TREAT interventions that reached the window cutoff
    const dueInterventions = await this.prisma.fixIntervention.findMany({
      where: {
        arm: InterventionArm.TREAT,
        shippedAt: { lte: cutoffDate },
      },
    });

    let recordedCount = 0;
    const assistants: Array<AiAssistant | null> = [
      null,
      AiAssistant.CHATGPT,
      AiAssistant.CLAUDE,
      AiAssistant.PERPLEXITY,
      AiAssistant.GEMINI,
      AiAssistant.SARVAM,
    ];

    for (const intervention of dueInterventions) {
      const shippedAt = intervention.shippedAt!;
      const preFrom = new Date(shippedAt.getTime() - windowMs);
      const postTo = new Date(shippedAt.getTime() + windowMs);

      for (const assistant of assistants) {
        // Guard against duplicate insertion
        const existing = await this.prisma.interventionOutcome.findFirst({
          where: {
            interventionId: intervention.id,
            windowDays,
            assistant: assistant ?? undefined,
          },
        });

        // Compute rates for TREAT arm
        const [preTreat, postTreat] = await Promise.all([
          this.getCitationRate(intervention.projectId, assistant, preFrom, shippedAt),
          this.getCitationRate(intervention.projectId, assistant, shippedAt, postTo),
        ]);

        // Compute rates for matching HOLD arm in the same project & changeClass
        const controlRates = await this.getControlRates(
          intervention.projectId,
          intervention.changeClass,
          assistant,
          preFrom,
          shippedAt,
          postTo,
        );

        const lift = this.calculateLift(
          { pre: preTreat, post: postTreat },
          controlRates,
          SAMPLE_FLOOR,
        );

        if (existing) {
          await this.prisma.interventionOutcome.update({
            where: { id: existing.id },
            data: {
              preCitationRate: preTreat.rate,
              postCitationRate: postTreat.rate,
              preSampleSize: preTreat.sampleSize,
              postSampleSize: postTreat.sampleSize,
              controlPreRate: controlRates?.pre.rate ?? null,
              controlPostRate: controlRates?.post.rate ?? null,
              controlSampleSize: controlRates ? controlRates.pre.sampleSize + controlRates.post.sampleSize : null,
              lift,
              measuredAt: now,
            },
          });
        } else {
          await this.prisma.interventionOutcome.create({
            data: {
              interventionId: intervention.id,
              assistant: assistant ?? null,
              windowDays,
              preCitationRate: preTreat.rate,
              postCitationRate: postTreat.rate,
              preSampleSize: preTreat.sampleSize,
              postSampleSize: postTreat.sampleSize,
              controlPreRate: controlRates?.pre.rate ?? null,
              controlPostRate: controlRates?.post.rate ?? null,
              controlSampleSize: controlRates ? controlRates.pre.sampleSize + controlRates.post.sampleSize : null,
              lift,
              measuredAt: now,
            },
          });
          recordedCount++;
        }
      }
    }

    // 2. Promote expired HOLD items: automatic apply at the end of the window
    await this.promoteExpiredHolds(cutoffDate);

    return recordedCount;
  }

  /**
   * Promotes HOLD interventions older than the cutoff date to shipped.
   */
  async promoteExpiredHolds(cutoffDate: Date): Promise<number> {
    const expiredHolds = await this.prisma.fixIntervention.updateMany({
      where: {
        arm: InterventionArm.HOLD,
        shippedAt: null,
        createdAt: { lte: cutoffDate },
      },
      data: {
        shippedAt: new Date(),
      },
    });
    return expiredHolds.count;
  }

  private async getCitationRate(
    projectId: string,
    assistant: AiAssistant | null,
    from: Date,
    to: Date,
  ): Promise<RateResult> {
    const where: any = {
      trackedPrompt: { projectId },
      checkedAt: { gte: from, lt: to },
    };
    if (assistant) where.assistant = assistant;

    const [total, cited] = await Promise.all([
      this.prisma.promptCheck.count({ where }),
      this.prisma.promptCheck.count({ where: { ...where, brandCited: true } }),
    ]);

    return {
      rate: total === 0 ? 0 : Number((cited / total).toFixed(4)),
      sampleSize: total,
    };
  }

  private async getControlRates(
    projectId: string,
    changeClass: any,
    assistant: AiAssistant | null,
    preFrom: Date,
    shippedAt: Date,
    postTo: Date,
  ): Promise<{ pre: RateResult; post: RateResult } | null> {
    const holds = await this.prisma.fixIntervention.findMany({
      where: {
        projectId,
        changeClass,
        arm: InterventionArm.HOLD,
      },
      select: { id: true },
    });

    if (holds.length === 0) return null;

    const [pre, post] = await Promise.all([
      this.getCitationRate(projectId, assistant, preFrom, shippedAt),
      this.getCitationRate(projectId, assistant, shippedAt, postTo),
    ]);

    return { pre, post };
  }
}
