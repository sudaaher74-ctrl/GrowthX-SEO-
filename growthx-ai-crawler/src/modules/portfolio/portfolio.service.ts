import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';
import { calculateHealthScore } from '../issues/health-score.util';
import { IssueCountService } from '../issues/issue-count.service';
import { MonthlyReportsService } from '../monthly-reports/monthly-reports.service';

export interface PortfolioClient {
  projectId: string;
  name: string;
  domain: string | null;
  initials: string;
  tier: string | null;
  /** Minor units (paise/cents). Null when the agency has not recorded one. */
  retainerMonthlyMinor: number | null;
  retainerCurrency: string;
  /** Null when no prompts are tracked — distinct from 0%. */
  aiCitationSharePct: number | null;
  aiDeltaPt: number | null;
  /** 0-100, weighted by issue severity. Null when never crawled. */
  health: number | null;
  trackedPrompts: number;
  averagePosition: number | null;
  criticalIssues: number;
  /** Unresolved regressions caught by Regression Guard (30d / open records). */
  openRegressions: number;
  /** Live pipeline status when an AutopilotRun is currently active. */
  activePipelineStatus: string | null;
  /** Current month snapshot lock & zero-login client portal share status. */
  monthlyReport: {
    month: string;
    isLocked: boolean;
    shareToken: string | null;
    lockedAt: string | null;
  };
  /** Weekly citation share, oldest first, for the sparkline. */
  trend: number[];
  lastCrawledAt: string | null;
}

export interface PortfolioSummary {
  /** Blended across clients that have visibility data. */
  portfolioAiSharePct: number | null;
  portfolioAiDeltaPt: number | null;
  promptsTracked: number;
  clientsImproving: number;
  clientsDeclining: number;
  clientCount: number;
  openCriticals: number;
  openRegressions: number;
  lockedReportsCount: number;
  /** Sum of recorded retainers only; clients without one are excluded. */
  mrrMinor: number;
  mrrCurrency: string;
  /** How many clients have no retainer recorded, so the UI can caveat MRR. */
  clientsWithoutRetainer: number;
}

export interface PortfolioAlert {
  projectId: string;
  title: string;
  detail: string;
  tag: 'AI' | 'CRAWL' | 'SETUP' | 'REGRESSION';
  severity: 'critical' | 'warning' | 'info';
}

function currentMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * The agency portfolio view: every client in one organization, side by side.
 *
 * Anything we cannot measure is returned as `null`, never as a zero.
 */
@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: AiVisibilityService,
    private readonly issueCounts: IssueCountService,
    @Optional() private readonly monthlyReports?: MonthlyReportsService,
  ) {}

  async getPortfolio(organizationId: string, days = 28) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        projects: {
          include: { websites: { select: { id: true, domain: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const month = currentMonthKey();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const projectIds = organization.projects.map((p) => p.id);

    const [snapshots, activePipelines] = await Promise.all([
      projectIds.length && this.prisma.monthlyReportSnapshot?.findMany
        ? this.prisma.monthlyReportSnapshot.findMany({
            where: { projectId: { in: projectIds }, month },
            select: { projectId: true, isLocked: true, shareToken: true, lockedAt: true },
          })
        : Promise.resolve([]),
      projectIds.length && this.prisma.autopilotRun?.findMany
        ? this.prisma.autopilotRun.findMany({
            where: {
              projectId: { in: projectIds },
              status: { in: ['RUNNING', 'WAITING_CONFIRMATION'] },
            },
            orderBy: { startedAt: 'desc' },
            select: { projectId: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const snapshotByProject = new Map(snapshots.map((s) => [s.projectId, s]));
    const pipelineByProject = new Map<string, string>();
    for (const run of activePipelines) {
      if (!pipelineByProject.has(run.projectId)) {
        pipelineByProject.set(run.projectId, run.status);
      }
    }

    const clients: PortfolioClient[] = [];

    for (const project of organization.projects) {
      const websiteIds = project.websites.map((w) => w.id);

      const latestCrawl = websiteIds.length
        ? await this.prisma.crawlJob.findFirst({
            where: { websiteId: { in: websiteIds }, status: 'COMPLETED' },
            orderBy: { finishedAt: 'desc' },
            select: { id: true, finishedAt: true, pagesCrawled: true, healthScore: true },
          })
        : null;

      let criticalIssues = 0;
      let health: number | null = null;

      if (latestCrawl) {
        criticalIssues = (await this.issueCounts.countsForProject(project.id)).bySeverity.CRITICAL;
        if (latestCrawl.healthScore != null) {
          health = latestCrawl.healthScore;
        } else {
          const issues = await this.prisma.issue.findMany({
            where: { crawlJobId: latestCrawl.id, status: 'OPEN' },
            select: { severity: true, confidence: true, affectedUrl: true, dedupKey: true },
          });
          health = this.healthScore(issues, latestCrawl.pagesCrawled);
        }
      }

      const [trackedPrompts, openRegRecords, recentRegEvents] = await Promise.all([
        this.prisma.trackedPrompt.count({
          where: { projectId: project.id, isActive: true },
        }),
        this.prisma.fixRegressionRecord?.count
          ? this.prisma.fixRegressionRecord.count({
              where: { projectId: project.id, resolvedAt: null },
            })
          : Promise.resolve(0),
        this.prisma.fixImpactLedgerEvent?.count
          ? this.prisma.fixImpactLedgerEvent.count({
              where: {
                projectId: project.id,
                eventType: 'REGRESSION_DETECTED',
                createdAt: { gte: thirtyDaysAgo },
              },
            })
          : Promise.resolve(0),
      ]);

      const openRegressions = Math.max(openRegRecords, recentRegEvents);

      let aiCitationSharePct: number | null = null;
      let aiDeltaPt: number | null = null;
      let averagePosition: number | null = null;
      let trend: number[] = [];

      if (trackedPrompts > 0) {
        const report = await this.visibility.getReport(project.id, days);
        if (report.summary.checked > 0) {
          aiCitationSharePct = report.summary.citationSharePct;
          aiDeltaPt = report.summary.deltaPt;
          averagePosition = report.summary.averagePosition;
          trend = report.trend.map((t) => t.citationSharePct);
        }
      }

      const snap = snapshotByProject.get(project.id);

      clients.push({
        projectId: project.id,
        name: project.name,
        domain: project.websites[0]?.domain ?? null,
        initials: this.initials(project.name),
        tier: project.tier,
        retainerMonthlyMinor: project.retainerMonthlyMinor,
        retainerCurrency: project.retainerCurrency,
        aiCitationSharePct,
        aiDeltaPt,
        health,
        trackedPrompts,
        averagePosition,
        criticalIssues,
        openRegressions,
        activePipelineStatus: pipelineByProject.get(project.id) ?? null,
        monthlyReport: {
          month,
          isLocked: Boolean(snap?.isLocked),
          shareToken: snap?.shareToken ?? null,
          lockedAt: snap?.lockedAt?.toISOString() ?? null,
        },
        trend,
        lastCrawledAt: latestCrawl?.finishedAt?.toISOString() ?? null,
      });
    }

    return {
      clients,
      summary: this.summarise(clients),
      alerts: this.buildAlerts(clients),
    };
  }

  /**
   * Month-end Agency Bulk Deliverable: freezes the monthly snapshot and mints
   * a zero-login white-labeled client portal share link for every client in
   * the organization.
   */
  async bulkDeliverMonthlyReports(
    organizationId: string,
    month?: string,
    expiresInDays = 30,
  ) {
    if (!this.monthlyReports) {
      throw new NotFoundException('Monthly reporting service is unavailable.');
    }

    const targetMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : currentMonthKey();
    const projects = await this.prisma.project.findMany({
      where: { organizationId },
      include: { websites: { select: { domain: true }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    });

    const results: Array<{
      projectId: string;
      name: string;
      domain: string | null;
      shareToken: string | null;
      lockedAt: string | null;
      error?: string;
    }> = [];

    for (const project of projects) {
      try {
        const locked = await this.monthlyReports.lockSnapshot(
          organizationId,
          project.id,
          targetMonth,
        );
        const shared = await this.monthlyReports.createShareLink(
          organizationId,
          project.id,
          targetMonth,
          { expiresInDays },
        );
        results.push({
          projectId: project.id,
          name: project.name,
          domain: project.websites[0]?.domain ?? null,
          shareToken: shared.shareToken,
          lockedAt: locked.lockedAt,
        });
      } catch (err) {
        results.push({
          projectId: project.id,
          name: project.name,
          domain: project.websites[0]?.domain ?? null,
          shareToken: null,
          lockedAt: null,
          error: (err as Error)?.message ?? 'Failed to lock/share snapshot',
        });
      }
    }

    return {
      month: targetMonth,
      deliveredCount: results.filter((r) => Boolean(r.shareToken)).length,
      totalClients: results.length,
      clients: results,
    };
  }

  private healthScore(
    issues: Array<{ severity: string; confidence?: string | null; affectedUrl?: string; dedupKey?: string | null }>,
    pages: number,
  ): number {
    return calculateHealthScore({
      pagesCrawled: pages,
      issues: issues.map((i) => ({
        severity: i.severity,
        confidence: i.confidence || 'CONFIRMED',
        affectedUrl: i.affectedUrl,
      })),
    }).healthScore;
  }

  private initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  private summarise(clients: PortfolioClient[]): PortfolioSummary {
    const measured = clients.filter((c) => c.aiCitationSharePct !== null);

    const portfolioAiSharePct = measured.length
      ? Number((measured.reduce((sum, c) => sum + c.aiCitationSharePct!, 0) / measured.length).toFixed(1))
      : null;

    const withDelta = measured.filter((c) => c.aiDeltaPt !== null);
    const portfolioAiDeltaPt = withDelta.length
      ? Number((withDelta.reduce((sum, c) => sum + c.aiDeltaPt!, 0) / withDelta.length).toFixed(1))
      : null;

    const withRetainer = clients.filter((c) => c.retainerMonthlyMinor !== null);

    return {
      portfolioAiSharePct,
      portfolioAiDeltaPt,
      promptsTracked: clients.reduce((sum, c) => sum + c.trackedPrompts, 0),
      clientsImproving: withDelta.filter((c) => c.aiDeltaPt! > 0).length,
      clientsDeclining: withDelta.filter((c) => c.aiDeltaPt! < 0).length,
      clientCount: clients.length,
      openCriticals: clients.reduce((sum, c) => sum + c.criticalIssues, 0),
      openRegressions: clients.reduce((sum, c) => sum + c.openRegressions, 0),
      lockedReportsCount: clients.filter((c) => c.monthlyReport.isLocked).length,
      mrrMinor: withRetainer.reduce((sum, c) => sum + c.retainerMonthlyMinor!, 0),
      mrrCurrency: withRetainer[0]?.retainerCurrency ?? 'INR',
      clientsWithoutRetainer: clients.length - withRetainer.length,
    };
  }

  /** The "needs your attention" feed: what an agency owner should act on. */
  private buildAlerts(clients: PortfolioClient[]): PortfolioAlert[] {
    const alerts: PortfolioAlert[] = [];

    for (const client of clients) {
      if (client.openRegressions > 0) {
        alerts.push({
          projectId: client.projectId,
          title: `${client.name} has ${client.openRegressions} regression${client.openRegressions === 1 ? '' : 's'} caught by Regression Guard`,
          detail: 'Previously fixed SEO defects reappeared in a subsequent crawl and were automatically reopened.',
          tag: 'REGRESSION',
          severity: 'critical',
        });
      }

      if (client.aiDeltaPt !== null && client.aiDeltaPt <= -2) {
        alerts.push({
          projectId: client.projectId,
          title: `${client.name} lost ${Math.abs(client.aiDeltaPt)}pt of AI citation share`,
          detail: 'Citation share fell versus the previous period.',
          tag: 'AI',
          severity: 'critical',
        });
      }

      if (client.criticalIssues >= 5) {
        alerts.push({
          projectId: client.projectId,
          title: `${client.name} has ${client.criticalIssues} critical issues open`,
          detail: 'Unresolved critical issues from the latest crawl.',
          tag: 'CRAWL',
          severity: 'warning',
        });
      }

      if (client.trackedPrompts === 0) {
        alerts.push({
          projectId: client.projectId,
          title: `${client.name} has no prompts tracked`,
          detail: 'AI visibility cannot be reported until prompts are added.',
          tag: 'SETUP',
          severity: 'info',
        });
      }

      if (client.lastCrawledAt === null) {
        alerts.push({
          projectId: client.projectId,
          title: `${client.name} has never been crawled`,
          detail: 'Run an audit to populate health and issue counts.',
          tag: 'SETUP',
          severity: 'info',
        });
      }
    }

    const rank = { critical: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }

  /** Lets an agency record what a client pays, so MRR is real rather than mocked. */
  async setRetainer(
    organizationId: string,
    projectId: string,
    data: { tier?: string | null; retainerMonthlyMinor?: number | null; retainerCurrency?: string },
  ) {
    const owned = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!owned) throw new NotFoundException('Project not found in this organization.');
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        tier: data.tier,
        retainerMonthlyMinor: data.retainerMonthlyMinor,
        ...(data.retainerCurrency ? { retainerCurrency: data.retainerCurrency } : {}),
      },
    });
  }
}
