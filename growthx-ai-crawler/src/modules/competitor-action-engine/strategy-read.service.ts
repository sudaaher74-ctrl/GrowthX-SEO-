import { Injectable, NotFoundException } from '@nestjs/common';
import { ActionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

/**
 * Reads for the Competitor Intelligence screens.
 *
 * Kept apart from the engine that writes, because these run on every page view
 * and must stay cheap and side-effect free. Nothing here computes advice; it
 * only shapes what was already decided and stored.
 */
@Injectable()
export class StrategyReadService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The Overview, which exists to answer four questions immediately.
   *
   * Returns `needsData` rather than zeros when nothing has been collected. An
   * overview of an empty database that renders as "0 competitors ahead" reads
   * as good news, which is the opposite of the truth.
   */
  async overview(projectId: string) {
    const [run, findings, competitors] = await Promise.all([
      this.prisma.strategyRun.findFirst({
        where: { projectId, status: 'COMPLETED' },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.competitorFinding.findMany({
        where: { projectId },
        include: { competitor: { select: { id: true, name: true, label: true, domain: true } } },
        orderBy: { observedAt: 'desc' },
      }),
      this.prisma.competitorDomain.count({ where: { projectId } }),
    ]);

    if (!run) {
      return {
        needsData: true,
        reason:
          competitors === 0
            ? 'No competitors are being tracked yet. Add up to five, then generate a plan.'
            : 'No plan has been generated yet. Generate one to see where you stand.',
        competitorsTracked: competitors,
        lastRefreshedAt: null,
      };
    }

    // Who is ahead: competitors named in findings where they lead on a metric.
    const ahead = new Map<string, { name: string; areas: Set<string>; findings: number }>();
    for (const finding of findings) {
      if (!finding.competitor) continue;
      if (finding.metricValue == null || finding.customerValue == null) continue;
      if (finding.metricValue <= finding.customerValue) continue;

      const key = finding.competitor.id;
      const name = finding.competitor.name || finding.competitor.label || finding.competitor.domain;
      const entry = ahead.get(key) ?? { name, areas: new Set<string>(), findings: 0 };
      entry.areas.add(finding.category);
      entry.findings++;
      ahead.set(key, entry);
    }

    const topActions = await this.prisma.strategyAction.findMany({
      where: { runId: run.id, status: { not: 'DONE' } },
      orderBy: [{ opportunityScore: 'desc' }],
      take: 3,
      include: { findings: { select: { id: true, summary: true, sourceUrl: true } } },
    });

    return {
      needsData: false,
      lastRefreshedAt: run.finishedAt ?? run.startedAt,
      competitorsTracked: competitors,
      findingsUsed: run.findingsUsed,
      coverageGaps: run.coverageGaps,
      outperformingYou: [...ahead.values()]
        .sort((a, b) => b.findings - a.findings)
        .map((entry) => ({ name: entry.name, areas: [...entry.areas], findingCount: entry.findings })),
      thisWeek: topActions.map((action) => ({
        id: action.id,
        title: action.title,
        priority: action.priority,
        opportunityScore: action.opportunityScore,
        scoreExplanation: action.scoreExplanation,
        evidence: action.findings,
      })),
    };
  }

  async findings(projectId: string, category?: string) {
    const rows = await this.prisma.competitorFinding.findMany({
      where: {
        projectId,
        ...(category ? { category: category as any } : {}),
      },
      include: { competitor: { select: { name: true, label: true, domain: true } } },
      orderBy: { observedAt: 'desc' },
      take: 200,
    });

    return rows.map((row) => ({
      id: row.id,
      category: row.category,
      summary: row.summary,
      detail: row.detail,
      // Every finding carries where it came from and when, so a reader can
      // check it rather than take it on trust.
      source: {
        competitor: row.competitor
          ? row.competitor.name || row.competitor.label || row.competitor.domain
          : 'Your site',
        platform: row.sourcePlatform,
        url: row.sourceUrl,
        observedAt: row.observedAt,
      },
      metric:
        row.metricName != null
          ? { name: row.metricName, competitor: row.metricValue, you: row.customerValue }
          : null,
      confidence: row.confidence,
    }));
  }

  async currentStrategy(projectId: string) {
    const run = await this.prisma.strategyRun.findFirst({
      where: { projectId, status: 'COMPLETED' },
      orderBy: { startedAt: 'desc' },
      include: {
        actions: {
          orderBy: [{ opportunityScore: 'desc' }],
          include: {
            findings: {
              select: { id: true, summary: true, sourceUrl: true, sourcePlatform: true, observedAt: true },
            },
          },
        },
      },
    });

    if (!run) {
      return { needsData: true, reason: 'No plan has been generated for this project yet.', actions: [] };
    }

    return {
      needsData: false,
      runId: run.id,
      generatedAt: run.finishedAt ?? run.startedAt,
      businessGoal: run.businessGoal,
      findingsUsed: run.findingsUsed,
      // Named so the plan admits what it could not see.
      coverageGaps: run.coverageGaps,
      actions: run.actions.map((action) => ({
        id: action.id,
        category: action.category,
        title: action.title,
        steps: action.steps,
        rationale: action.rationale,
        expectedImpact: action.expectedImpact,
        effortHours: action.effortHours,
        priority: action.priority,
        owner: action.owner,
        opportunityScore: action.opportunityScore,
        scoreExplanation: action.scoreExplanation,
        status: action.status,
        dueDate: action.dueDate,
        evidence: action.findings,
      })),
    };
  }

  /** Moves one action, and stamps completion the first time it is done. */
  async setActionStatus(
    organizationId: string,
    projectId: string,
    actionId: string,
    status: ActionStatus,
  ) {
    const action = await this.prisma.strategyAction.findFirst({
      where: { id: actionId, projectId, organizationId },
      select: { id: true, completedAt: true },
    });
    if (!action) throw new NotFoundException('Action not found for this project.');

    return this.prisma.strategyAction.update({
      where: { id: action.id },
      data: {
        status,
        // Kept from the first completion: re-opening and re-closing an action
        // should not rewrite when the work was actually finished.
        completedAt: status === 'DONE' ? (action.completedAt ?? new Date()) : action.completedAt,
      },
    });
  }

  /** Records what the business is optimising for. Never inferred. */
  async setBusinessGoal(projectId: string, businessGoal: string, targetAudience?: string) {
    const profile = await this.prisma.projectBusinessProfile.findUnique({ where: { projectId } });
    if (!profile) {
      throw new NotFoundException(
        'This project has no detected business profile yet. Run business detection before setting a goal.',
      );
    }

    return this.prisma.projectBusinessProfile.update({
      where: { projectId },
      data: { businessGoal: businessGoal.toUpperCase(), targetAudience: targetAudience ?? profile.targetAudience },
    });
  }
}
