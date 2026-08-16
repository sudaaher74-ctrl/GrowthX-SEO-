import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MarketActionStatus, MarketWatchKind, OutcomeStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface WeeklyDeltaContent {
  visibility: {
    citationSharePct: number | null;
    previousCitationSharePct: number | null;
    deltaPt: number | null;
    measured: boolean;
    note: string | null;
  };
  competitors: { domain: string; label: string; sharePct: number }[];
  newOpportunities: { id: string; topic: string; gap: string; impact: string }[];
  actions: {
    proposed: number;
    approved: number;
    converted: number;
  };
  /** How last week's approved work is doing, if any of it has been measured. */
  lastWeekOutcomes: {
    actionId: string;
    title: string;
    status: OutcomeStatus;
    deltaPt: number | null;
    note: string | null;
  }[];
  watches: { kind: MarketWatchKind; value: string }[];
  /** Stated plainly when a section had nothing real behind it. */
  gaps: string[];
}

/**
 * The weekly client delta.
 *
 * Assembled from stored records rather than generated prose: what moved comes
 * from the visibility report, what competitors did comes from share of voice,
 * and the status of last week's work comes from the outcome table. Nothing is
 * summarised by a model here, so there is nothing for a model to invent.
 */
@Injectable()
export class WeeklyDeltaService {
  private readonly logger = new Logger(WeeklyDeltaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: AiVisibilityService,
  ) {}

  async list(organizationId: string, projectId: string) {
    return this.prisma.weeklyDelta.findMany({
      where: { organizationId, projectId },
      orderBy: { periodEnd: 'desc' },
      take: 12,
    });
  }

  async generate(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found in this organization.');

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - WEEK_MS);
    const gaps: string[] = [];

    // ── what moved
    let visibility: WeeklyDeltaContent['visibility'] = {
      citationSharePct: null,
      previousCitationSharePct: null,
      deltaPt: null,
      measured: false,
      note: 'No prompts are being tracked, so AI visibility is unmeasured for this client.',
    };

    const trackedPrompts = await this.prisma.trackedPrompt.count({
      where: { projectId, isActive: true },
    });

    let competitors: WeeklyDeltaContent['competitors'] = [];

    if (trackedPrompts > 0) {
      try {
        const report = await this.visibility.getReport(projectId, 7);
        visibility = {
          citationSharePct: report.summary.citationSharePct,
          previousCitationSharePct: report.summary.previousCitationSharePct,
          deltaPt: report.summary.deltaPt,
          measured: true,
          note: null,
        };
        competitors = report.shareOfVoice
          .filter((s) => s.domain)
          .map((s) => ({ domain: s.domain!, label: s.label, sharePct: s.sharePct }));
      } catch (error) {
        this.logger.warn(`Weekly visibility unavailable for ${projectId}: ${String(error)}`);
        gaps.push('The AI visibility report could not be generated for this period.');
      }
    } else {
      gaps.push('No tracked prompts, so citation share and share of voice are unmeasured.');
    }

    if (competitors.length === 0 && trackedPrompts > 0) {
      gaps.push('No competitor domains were cited in this period.');
    }

    // ── what research surfaced
    const newOpportunities = await this.prisma.marketOpportunity.findMany({
      where: { organizationId, projectId, createdAt: { gte: periodStart } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, topic: true, gap: true, impact: true },
    });

    const [proposed, approved, converted] = await Promise.all([
      this.prisma.marketAction.count({
        where: { organizationId, projectId, status: MarketActionStatus.PROPOSED },
      }),
      this.prisma.marketAction.count({
        where: { organizationId, projectId, status: MarketActionStatus.APPROVED },
      }),
      this.prisma.marketAction.count({
        where: { organizationId, projectId, status: MarketActionStatus.CONVERTED, updatedAt: { gte: periodStart } },
      }),
    ]);

    // ── how previously approved work is doing
    const outcomes = await this.prisma.marketActionOutcome.findMany({
      where: { organizationId, projectId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      include: { action: { select: { id: true, title: true } } },
    });

    const lastWeekOutcomes = outcomes.map((o) => ({
      actionId: o.action.id,
      title: o.action.title,
      status: o.status,
      deltaPt: o.deltaPt,
      note: o.note,
    }));

    if (lastWeekOutcomes.length === 0) {
      gaps.push('No converted work has been measured yet, so there is no before/after to report.');
    }

    const watches = await this.prisma.marketWatch.findMany({
      where: { organizationId, projectId, isActive: true },
      select: { kind: true, value: true },
    });

    const content: WeeklyDeltaContent = {
      visibility,
      competitors,
      newOpportunities: newOpportunities.map((o) => ({ ...o, impact: String(o.impact) })),
      actions: { proposed, approved, converted },
      lastWeekOutcomes,
      watches,
      gaps,
    };

    // One delta per project per period; regenerating replaces it.
    return this.prisma.weeklyDelta.upsert({
      where: { projectId_periodStart: { projectId, periodStart } },
      create: {
        organizationId,
        projectId,
        periodStart,
        periodEnd,
        content: content as unknown as object,
      },
      update: { periodEnd, content: content as unknown as object },
    });
  }

  // ── watches ───────────────────────────────────────────────────────────────

  async listWatches(organizationId: string, projectId: string) {
    return this.prisma.marketWatch.findMany({
      where: { organizationId, projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createWatch(organizationId: string, projectId: string, kind: MarketWatchKind, value: string) {
    const cleaned = value?.trim();
    if (!cleaned) throw new BadRequestException('A watch needs a domain or topic.');

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found in this organization.');

    return this.prisma.marketWatch.upsert({
      where: { projectId_kind_value: { projectId, kind, value: cleaned } },
      create: { organizationId, projectId, kind, value: cleaned },
      update: { isActive: true },
    });
  }

  async deactivateWatch(organizationId: string, projectId: string, watchId: string) {
    const watch = await this.prisma.marketWatch.findFirst({
      where: { id: watchId, organizationId, projectId },
    });
    if (!watch) throw new NotFoundException('Watch not found for this project.');

    return this.prisma.marketWatch.update({
      where: { id: watchId },
      data: { isActive: false },
    });
  }

  /** Generates a delta for every project that has research activity. */
  async generateForAllProjects(): Promise<number> {
    const projects = await this.prisma.marketResearchThread.findMany({
      distinct: ['projectId'],
      select: { organizationId: true, projectId: true },
      take: 500,
    });

    let generated = 0;
    for (const { organizationId, projectId } of projects) {
      try {
        await this.generate(organizationId, projectId);
        generated++;
      } catch (error) {
        this.logger.warn(`Weekly delta failed for project ${projectId}: ${String(error)}`);
      }
    }
    return generated;
  }
}
