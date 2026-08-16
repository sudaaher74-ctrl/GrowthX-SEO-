import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OutcomeStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';

/** How long after conversion a follow-up measurement is worth taking. */
const MIN_DAYS_BEFORE_REMEASURE = 14;

@Injectable()
export class OutcomeMeasurementService {
  private readonly logger = new Logger(OutcomeMeasurementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: AiVisibilityService,
  ) {}

  /**
   * Records where the client stood when an action became real work.
   *
   * Taken at conversion rather than at approval, because approval alone changes
   * nothing about the site. Without a baseline written at this moment there is
   * nothing honest to compare against later.
   */
  async captureBaseline(organizationId: string, projectId: string, actionId: string) {
    const snapshot = await this.snapshot(projectId);

    return this.prisma.marketActionOutcome.upsert({
      where: { actionId },
      create: {
        actionId,
        organizationId,
        projectId,
        status: OutcomeStatus.PENDING,
        baselineAt: new Date(),
        baselineCitationSharePct: snapshot.citationSharePct,
        baselineAveragePosition: snapshot.averagePosition,
        baselineTrackedPrompts: snapshot.trackedPrompts,
        note: snapshot.note,
      },
      update: {},
    });
  }

  /**
   * Re-measures one action and records what moved.
   *
   * The delta is movement over the period, not proof the action caused it —
   * competitors publish, assistants change their retrieval, and other work
   * ships in the same window. The stored note says so, and the UI repeats it,
   * because a number labelled "impact of this action" would be a claim the
   * evidence does not support.
   */
  async measure(organizationId: string, projectId: string, actionId: string) {
    const outcome = await this.prisma.marketActionOutcome.findFirst({
      where: { actionId, organizationId, projectId },
    });
    if (!outcome) throw new NotFoundException('No baseline recorded for this action.');

    const snapshot = await this.snapshot(projectId);

    // Nothing to compare against: the project has no measurable visibility in
    // either window, so we say that rather than reporting a delta of zero.
    if (snapshot.citationSharePct === null || outcome.baselineCitationSharePct === null) {
      return this.prisma.marketActionOutcome.update({
        where: { id: outcome.id },
        data: {
          status: OutcomeStatus.INCONCLUSIVE,
          measuredAt: new Date(),
          citationSharePct: snapshot.citationSharePct,
          averagePosition: snapshot.averagePosition,
          deltaPt: null,
          note:
            'Not comparable: this project had no measurable AI citation share in one of the two periods. ' +
            'Track prompts and run a visibility sweep to make future measurement possible.',
        },
      });
    }

    const deltaPt = Number((snapshot.citationSharePct - outcome.baselineCitationSharePct).toFixed(2));

    return this.prisma.marketActionOutcome.update({
      where: { id: outcome.id },
      data: {
        status: OutcomeStatus.MEASURED,
        measuredAt: new Date(),
        citationSharePct: snapshot.citationSharePct,
        averagePosition: snapshot.averagePosition,
        deltaPt,
        note:
          'Movement in AI citation share since this work was created. This is what changed over the ' +
          'period, not proof that this action caused it — other work and competitor activity overlap.',
      },
    });
  }

  /** Outcomes for a project, newest first. */
  async list(organizationId: string, projectId: string) {
    return this.prisma.marketActionOutcome.findMany({
      where: { organizationId, projectId },
      orderBy: { createdAt: 'desc' },
      include: { action: { select: { id: true, title: true, type: true, status: true } } },
    });
  }

  /**
   * Re-measures every outcome old enough to have moved.
   *
   * Measuring the day after conversion would report noise as a result, so
   * anything younger than the window is left alone.
   */
  async measureDueOutcomes(): Promise<number> {
    const cutoff = new Date(Date.now() - MIN_DAYS_BEFORE_REMEASURE * 24 * 60 * 60 * 1000);
    const due = await this.prisma.marketActionOutcome.findMany({
      where: { status: OutcomeStatus.PENDING, baselineAt: { lte: cutoff } },
      select: { actionId: true, organizationId: true, projectId: true },
      take: 200,
    });

    let measured = 0;
    for (const outcome of due) {
      try {
        await this.measure(outcome.organizationId, outcome.projectId, outcome.actionId);
        measured++;
      } catch (error) {
        this.logger.warn(`Could not measure action ${outcome.actionId}: ${String(error)}`);
      }
    }
    if (measured > 0) this.logger.log(`Measured ${measured} converted action(s).`);
    return measured;
  }

  /**
   * The project's current AI-visibility position.
   *
   * Returns nulls rather than zeros when nothing is tracked — a zero would read
   * as "measured at zero" instead of "not measured".
   */
  private async snapshot(projectId: string): Promise<{
    citationSharePct: number | null;
    averagePosition: number | null;
    trackedPrompts: number;
    note: string | null;
  }> {
    const trackedPrompts = await this.prisma.trackedPrompt.count({
      where: { projectId, isActive: true },
    });

    if (trackedPrompts === 0) {
      return {
        citationSharePct: null,
        averagePosition: null,
        trackedPrompts: 0,
        note: 'No prompts were being tracked, so AI citation share is unmeasured for this period.',
      };
    }

    try {
      const report = await this.visibility.getReport(projectId, 28);
      return {
        citationSharePct: report.summary.citationSharePct,
        averagePosition: report.summary.averagePosition,
        trackedPrompts,
        note: null,
      };
    } catch (error) {
      this.logger.warn(`Visibility snapshot failed for project ${projectId}: ${String(error)}`);
      return {
        citationSharePct: null,
        averagePosition: null,
        trackedPrompts,
        note: 'The AI visibility report was unavailable when this snapshot was taken.',
      };
    }
  }
}
