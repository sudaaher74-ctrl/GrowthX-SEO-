import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AiAssistant, ChangeClass, InterventionArm, IssueStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/** The windows the product reports on. */
export const MEASUREMENT_WINDOWS = [7, 30, 60, 90] as const;
export type MeasurementWindow = (typeof MEASUREMENT_WINDOWS)[number];

export interface CitationRate {
  rate: number;
  sampleSize: number;
}

export interface InterventionMeasurement {
  interventionId: string;
  assistant: AiAssistant | null;
  windowDays: number;
  pre: CitationRate;
  post: CitationRate;
  control: { pre: CitationRate; post: CitationRate } | null;
  /**
   * Difference-in-differences against the hold arm, in percentage points.
   * Null when there were no holds to compare against.
   */
  lift: number | null;
  /**
   * What can honestly be said about this number. The product is explicitly not
   * allowed to claim causation without the evidence for it, and this is where
   * that rule is enforced rather than left to whoever writes the report.
   */
  interpretation: 'CAUSAL_ESTIMATE' | 'OBSERVED_CHANGE' | 'INSUFFICIENT_DATA';
}

/**
 * Below this many observations on either side, a rate is noise. Ten weekly
 * checks of a handful of prompts can swing twenty points on one engine
 * changing its mind, and reporting that as an effect is how a vendor ends up
 * defending a number it cannot support.
 */
const MIN_SAMPLE = 10;

/**
 * Measures what happened to AI citation after a change shipped.
 *
 * The distinction this service exists to preserve: a before-and-after
 * difference is not an effect. Citation moves on its own — engines re-rank,
 * competitors publish, models get retrained — so a page that gained citation
 * after a fix may have gained it anyway. The only way to tell is to compare
 * against pages that needed the same fix and deliberately did not get it.
 *
 * That is why `lift` is difference-in-differences and why it is null, rather
 * than falling back to the raw delta, when no holds exist.
 */
@Injectable()
export class ImpactService {
  private readonly logger = new Logger(ImpactService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records a change — shipped or deliberately withheld.
   *
   * A HOLD is recorded at the moment the fix was decided against, not
   * retrospectively. Holds chosen after the outcome is known are not a control
   * group, they are a selection of whatever makes the result look better.
   */
  async recordIntervention(input: {
    projectId: string;
    url: string;
    changeClass: ChangeClass;
    arm?: InterventionArm;
    summary?: string;
    beforePageId?: string;
    automationRunId?: string;
    pullRequestUrl?: string;
  }) {
    const arm = input.arm ?? InterventionArm.TREAT;
    return this.prisma.fixIntervention.create({
      data: {
        projectId: input.projectId,
        url: input.url,
        changeClass: input.changeClass,
        arm,
        summary: input.summary ?? null,
        beforePageId: input.beforePageId ?? null,
        automationRunId: input.automationRunId ?? null,
        pullRequestUrl: input.pullRequestUrl ?? null,
      },
    });
  }

  /**
   * Records a page that needed a fix and deliberately did not get one.
   *
   * The holds are what separate a measurement from an anecdote, and they are
   * the part nobody wants to create: it means looking at twenty pages that need
   * the same fix, shipping fifteen and leaving five alone. Without them every
   * later citation gain is a coincidence with good timing, which is exactly
   * what the rest of the category reports.
   *
   * Marking the issue IGNORED and recording the hold happen together, in one
   * transaction, so an issue cannot be quietly dismissed without the control
   * group learning about it.
   */
  async holdIssue(input: {
    projectId: string;
    issueId: string;
    changeClass: ChangeClass;
    summary?: string;
  }) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: input.issueId },
      select: { id: true, affectedUrl: true, issueType: true, status: true },
    });
    if (!issue) throw new NotFoundException(`Issue ${input.issueId} not found.`);
    if (!issue.affectedUrl) {
      throw new BadRequestException(
        'This issue has no affected URL, so it cannot be held as a control — there is no page to measure.',
      );
    }

    const [, intervention] = await this.prisma.$transaction([
      this.prisma.issue.update({
        where: { id: input.issueId },
        data: { status: IssueStatus.IGNORED },
      }),
      this.prisma.fixIntervention.create({
        data: {
          projectId: input.projectId,
          url: issue.affectedUrl,
          changeClass: input.changeClass,
          arm: InterventionArm.HOLD,
          summary: input.summary ?? `Held as control: ${issue.issueType}`,
        },
      }),
    ]);

    return intervention;
  }

  /** Marks a recorded change as live, which starts its measurement clock. */
  async markShipped(interventionId: string, mergedSha?: string, afterPageId?: string) {
    const intervention = await this.prisma.fixIntervention.findUnique({ where: { id: interventionId } });
    if (!intervention) throw new NotFoundException(`Intervention ${interventionId} not found.`);
    if (intervention.arm === InterventionArm.HOLD) {
      throw new BadRequestException(
        'This page is in the hold arm and was deliberately not changed. Shipping it would remove it ' +
          'from the control group and invalidate the comparison it exists to support.',
      );
    }

    return this.prisma.fixIntervention.update({
      where: { id: interventionId },
      data: {
        shippedAt: intervention.shippedAt ?? new Date(),
        mergedSha: mergedSha ?? intervention.mergedSha,
        afterPageId: afterPageId ?? intervention.afterPageId,
      },
    });
  }

  /**
   * Measures one intervention over one window, and stores the result.
   *
   * `assistant` null measures across every engine at once; a specific engine
   * measures only that one, because the engines disagree and an average across
   * them hides the disagreement that is usually the actionable part.
   */
  async measure(
    interventionId: string,
    windowDays: MeasurementWindow,
    assistant: AiAssistant | null = null,
  ): Promise<InterventionMeasurement> {
    const intervention = await this.prisma.fixIntervention.findUnique({ where: { id: interventionId } });
    if (!intervention) throw new NotFoundException(`Intervention ${interventionId} not found.`);
    if (!intervention.shippedAt) {
      throw new BadRequestException(
        'This change has not shipped yet, so there is no "after" to measure. Mark it shipped first.',
      );
    }

    const shippedAt = intervention.shippedAt;
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const preFrom = new Date(shippedAt.getTime() - windowMs);
    const postTo = new Date(shippedAt.getTime() + windowMs);

    const [pre, post] = await Promise.all([
      this.citationRate(intervention.projectId, assistant, preFrom, shippedAt),
      this.citationRate(intervention.projectId, assistant, shippedAt, postTo),
    ]);

    const control = await this.controlRates(intervention, assistant, windowDays);

    const lift =
      control && control.pre.sampleSize >= MIN_SAMPLE && control.post.sampleSize >= MIN_SAMPLE
        ? Number(
            ((post.rate - pre.rate) - (control.post.rate - control.pre.rate)).toFixed(4),
          )
        : null;

    const interpretation: InterventionMeasurement['interpretation'] =
      pre.sampleSize < MIN_SAMPLE || post.sampleSize < MIN_SAMPLE
        ? 'INSUFFICIENT_DATA'
        : lift != null
        ? 'CAUSAL_ESTIMATE'
        : 'OBSERVED_CHANGE';

    const figures = {
      preCitationRate: pre.rate,
      postCitationRate: post.rate,
      preSampleSize: pre.sampleSize,
      postSampleSize: post.sampleSize,
      controlPreRate: control?.pre.rate ?? null,
      controlPostRate: control?.post.rate ?? null,
      controlSampleSize: control ? control.pre.sampleSize + control.post.sampleSize : null,
      lift,
    };

    // Not an upsert: `assistant` is nullable to mean "all engines", and a
    // Prisma compound unique cannot target a nullable column (nor would
    // Postgres enforce it, since it treats NULLs as distinct).
    const existing = await this.prisma.interventionOutcome.findFirst({
      where: { interventionId, assistant, windowDays },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.interventionOutcome.update({
        where: { id: existing.id },
        data: { ...figures, measuredAt: new Date() },
      });
    } else {
      await this.prisma.interventionOutcome.create({
        data: { interventionId, assistant, windowDays, ...figures },
      });
    }

    return { interventionId, assistant, windowDays, pre, post, control, lift, interpretation };
  }

  /**
   * The measured effect of a change class across every intervention that used
   * it — the row of the ledger that gets more trustworthy with each customer.
   *
   * Reports the number of interventions behind each estimate, because a lift
   * computed from four changes and one from four hundred are different claims
   * and should not print identically.
   */
  async changeClassSummary(projectId?: string, windowDays: MeasurementWindow = 30) {
    const outcomes = await this.prisma.interventionOutcome.findMany({
      where: {
        windowDays,
        assistant: null,
        lift: { not: null },
        intervention: {
          arm: InterventionArm.TREAT,
          rolledBackAt: null,
          ...(projectId ? { projectId } : {}),
        },
      },
      select: { lift: true, intervention: { select: { changeClass: true } } },
    });

    const byClass = new Map<ChangeClass, number[]>();
    for (const outcome of outcomes) {
      const key = outcome.intervention.changeClass;
      const lifts = byClass.get(key) ?? [];
      lifts.push(outcome.lift as number);
      byClass.set(key, lifts);
    }

    return [...byClass.entries()]
      .map(([changeClass, lifts]) => ({
        changeClass,
        interventions: lifts.length,
        meanLift: Number((lifts.reduce((a, b) => a + b, 0) / lifts.length).toFixed(4)),
        // Named so a reader cannot mistake a four-sample estimate for a finding.
        confidence: lifts.length >= 100 ? 'ESTABLISHED' : lifts.length >= 30 ? 'EMERGING' : 'ANECDOTAL',
      }))
      .sort((a, b) => b.meanLift - a.meanLift);
  }

  /** Share of checks in a period where the project's own site was cited. */
  private async citationRate(
    projectId: string,
    assistant: AiAssistant | null,
    from: Date,
    to: Date,
  ): Promise<CitationRate> {
    const where = {
      trackedPrompt: { projectId },
      checkedAt: { gte: from, lt: to },
      // A check that errored asked nothing, so it is not evidence either way.
      error: null,
      ...(assistant ? { assistant } : {}),
    };

    const [total, cited] = await Promise.all([
      this.prisma.promptCheck.count({ where }),
      this.prisma.promptCheck.count({ where: { ...where, cited: true } }),
    ]);

    return { rate: total === 0 ? 0 : Number((cited / total).toFixed(4)), sampleSize: total };
  }

  /**
   * The same two windows, measured over the project's hold arm.
   *
   * Returns null when the project has no holds — the honest state for a project
   * where every identified fix was shipped. A measurement without a control is
   * still worth reporting; it just is not an effect, and the caller is told so
   * through `interpretation` rather than through a number that looks the same.
   */
  private async controlRates(
    intervention: { projectId: string; shippedAt: Date | null },
    assistant: AiAssistant | null,
    windowDays: number,
  ) {
    const holds = await this.prisma.fixIntervention.count({
      where: { projectId: intervention.projectId, arm: InterventionArm.HOLD },
    });
    if (holds === 0 || !intervention.shippedAt) return null;

    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const shippedAt = intervention.shippedAt;

    const [pre, post] = await Promise.all([
      this.holdCitationRate(intervention.projectId, assistant, new Date(shippedAt.getTime() - windowMs), shippedAt),
      this.holdCitationRate(intervention.projectId, assistant, shippedAt, new Date(shippedAt.getTime() + windowMs)),
    ]);

    return { pre, post };
  }

  /** Citation rate restricted to prompts whose cited URL is a held page. */
  private async holdCitationRate(
    projectId: string,
    assistant: AiAssistant | null,
    from: Date,
    to: Date,
  ): Promise<CitationRate> {
    const holdUrls = (
      await this.prisma.fixIntervention.findMany({
        where: { projectId, arm: InterventionArm.HOLD },
        select: { url: true },
      })
    ).map((h) => h.url);

    if (holdUrls.length === 0) return { rate: 0, sampleSize: 0 };

    const where = {
      trackedPrompt: { projectId },
      checkedAt: { gte: from, lt: to },
      error: null,
      ...(assistant ? { assistant } : {}),
    };

    const checks = await this.prisma.promptCheck.findMany({
      where,
      select: { cited: true, citedUrl: true },
    });

    // A check counts toward the control only when the answer it produced was
    // about a held page — otherwise the "control" is just the whole project
    // again and the comparison measures nothing.
    const relevant = checks.filter((c) => c.citedUrl && holdUrls.some((u) => c.citedUrl?.startsWith(u)));
    const cited = relevant.filter((c) => c.cited).length;

    return {
      rate: relevant.length === 0 ? 0 : Number((cited / relevant.length).toFixed(4)),
      sampleSize: relevant.length,
    };
  }
}
