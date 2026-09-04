import { Injectable, NotFoundException } from '@nestjs/common';
import { IssueSeverity } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';
import { calculateHealthScore } from '../issues/health-score.util';

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
  tag: 'AI' | 'CRAWL' | 'SETUP';
  severity: 'critical' | 'warning' | 'info';
}

/**
 * The agency portfolio view: every client in one organization, side by side.
 *
 * Anything we cannot measure is returned as `null`, never as a zero. A client
 * with no tracked prompts has unknown AI share, not 0% — showing 0 would tell
 * an agency they are losing when they simply have not started measuring.
 */
@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly visibility: AiVisibilityService,
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
        criticalIssues = await this.countIssues(latestCrawl.id, IssueSeverity.CRITICAL);
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

      const trackedPrompts = await this.prisma.trackedPrompt.count({
        where: { projectId: project.id, isActive: true },
      });

      let aiCitationSharePct: number | null = null;
      let aiDeltaPt: number | null = null;
      let averagePosition: number | null = null;
      let trend: number[] = [];

      if (trackedPrompts > 0) {
        const report = await this.visibility.getReport(project.id, days);
        // A report with zero completed checks is still "unmeasured".
        if (report.summary.checked > 0) {
          aiCitationSharePct = report.summary.citationSharePct;
          aiDeltaPt = report.summary.deltaPt;
          averagePosition = report.summary.averagePosition;
          trend = report.trend.map((t) => t.citationSharePct);
        }
      }

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

  private countIssues(crawlJobId: string, severity: IssueSeverity) {
    return this.prisma.issue.count({ where: { crawlJobId, severity, status: 'OPEN' } });
  }

  /**
   * Health score calculated using authoritative bounded weights, confidence, and page normalization.
   */
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
      mrrMinor: withRetainer.reduce((sum, c) => sum + c.retainerMonthlyMinor!, 0),
      mrrCurrency: withRetainer[0]?.retainerCurrency ?? 'INR',
      clientsWithoutRetainer: clients.length - withRetainer.length,
    };
  }

  /** The "needs your attention" feed: what an agency owner should act on. */
  private buildAlerts(clients: PortfolioClient[]): PortfolioAlert[] {
    const alerts: PortfolioAlert[] = [];

    for (const client of clients) {
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
    projectId: string,
    data: { tier?: string | null; retainerMonthlyMinor?: number | null; retainerCurrency?: string },
  ) {
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
