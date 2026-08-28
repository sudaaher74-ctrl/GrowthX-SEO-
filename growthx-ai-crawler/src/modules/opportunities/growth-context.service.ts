import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { AnalyticsInsightsService } from '../integrations/google/analytics-insights.service';

/**
 * The brief the AI consultant reasons over.
 *
 * Assembled here rather than by letting the model query freely, for two
 * reasons the spec is explicit about. Privacy: only aggregated figures leave
 * this process — never raw Search Console rows, never a customer's full
 * analytics export, and under no circumstances an OAuth token. And accuracy:
 * a model handed a table of numbers with no provenance will happily invent the
 * provenance, so every line here states where it came from and every gap says
 * it is a gap.
 *
 * That second point is the whole design. The failure mode of an AI answering
 * "why did my traffic drop" is a confident causal story: it will blame a
 * competitor's new pages because they are in the context window, not because
 * anything links the two. Absent data is therefore written into the brief as
 * "not connected" or "not measured" rather than omitted, because a model
 * cannot distinguish an absent line from a zero.
 */
@Injectable()
export class GrowthContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchConsoleInsightsService,
    private readonly analytics: AnalyticsInsightsService,
  ) {}

  /**
   * A compact, sourced summary of everything known about a project.
   *
   * Kept small deliberately. Every extra thousand tokens of context is another
   * thousand tokens the model can pattern-match a story out of, and the useful
   * signal here is a few dozen numbers.
   */
  async brief(organizationId: string, projectId: string, days = 28): Promise<string> {
    const [project, connections, searchSummary, declining, analyticsSummary, crawl, competitors, opportunities] =
      await Promise.all([
        this.prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { name: true } }),
        this.connections(projectId),
        this.search.summary(projectId, days).catch(() => null),
        this.search.declining(projectId, { days, limit: 5 }).catch(() => []),
        this.analytics.summary(projectId, days).catch(() => null),
        this.latestCrawl(projectId),
        this.competitorCoverage(projectId),
        this.topOpportunities(organizationId, projectId),
      ]);

    const lines: string[] = [];
    const section = (title: string) => lines.push('', `## ${title}`);

    lines.push(`# Evidence for ${project?.name ?? 'this project'} — last ${days} days`);

    section('Search (Google Search Console)');
    if (!connections.searchConsole) {
      // Written in, not left out. A model that sees no search section will
      // reason as though search performance is flat, not unknown.
      lines.push('NOT CONNECTED. No search data is available. Do not draw conclusions about search performance.');
    } else if (!searchSummary) {
      lines.push('Connected, but nothing has been synced yet. No search data is available.');
    } else {
      lines.push(
        `Clicks: ${searchSummary.clicks.current}${change(searchSummary.clicks.changePct)}`,
        `Impressions: ${searchSummary.impressions.current}${change(searchSummary.impressions.changePct)}`,
        `CTR: ${(searchSummary.ctr.current * 100).toFixed(2)}%${change(searchSummary.ctr.changePct)}`,
        `Average position: ${searchSummary.position.current.toFixed(1)}${change(searchSummary.position.changePct)} (lower is better)`,
      );
      if (searchSummary.comparisonRange === null) {
        lines.push('No earlier period exists to compare against, so no trend can be stated.');
      }
      if (declining.length > 0) {
        lines.push('', 'Queries that lost ranking between the two periods:');
        for (const row of declining) {
          lines.push(
            `- "${row.query}": position ${row.previousPosition.toFixed(1)} to ${row.currentPosition.toFixed(1)}, clicks ${row.previousClicks} to ${row.currentClicks}`,
          );
        }
      }
    }

    section('Behaviour and outcome (Google Analytics)');
    if (!connections.analytics) {
      lines.push('NOT CONNECTED. No behaviour or conversion data is available.');
    } else if (!analyticsSummary) {
      lines.push('Connected, but nothing has been synced yet.');
    } else {
      lines.push(
        `Users: ${analyticsSummary.users.current}${change(analyticsSummary.users.changePct)}`,
        `Sessions: ${analyticsSummary.sessions.current}${change(analyticsSummary.sessions.changePct)}`,
        `Engagement rate: ${(analyticsSummary.engagementRate.current * 100).toFixed(1)}%`,
      );
      lines.push(
        analyticsSummary.conversionTrackingConfigured
          ? `Conversions: ${analyticsSummary.conversions!.current}${change(analyticsSummary.conversions!.changePct)}`
          : 'Conversions: NOT MEASURED — this Analytics property has no key events configured. This is not zero conversions; it is an absence of measurement.',
      );
    }

    section('The site itself');
    lines.push(
      crawl
        ? `Last crawled ${crawl.crawledAt?.toISOString().slice(0, 10) ?? 'unknown'}: ${crawl.pagesCrawled} pages, ${crawl.criticalIssues} critical issues, ${crawl.totalIssues} issues in total.`
        : 'This site has not been crawled yet.',
    );

    section('Competitors');
    if (competitors.length === 0) {
      lines.push('No competitor has been crawled. Nothing can be said about what competitors are doing.');
    } else {
      for (const competitor of competitors) {
        lines.push(
          `- ${competitor.domain}: ${competitor.pages} pages crawled${competitor.crawledAt ? ` on ${competitor.crawledAt.toISOString().slice(0, 10)}` : ''}.`,
        );
      }
      lines.push(
        'Competitor page counts are from a crawl of their public site. Nothing here records when they published a page, so competitor activity cannot be dated and cannot be linked in time to any change above.',
      );
    }

    section('Open opportunities already detected');
    if (opportunities.length === 0) {
      lines.push('None detected yet.');
    } else {
      for (const item of opportunities) {
        lines.push(`- [${item.potential}] ${item.title}`);
      }
    }

    section('Rules for answering');
    lines.push(
      'Use only the figures above. Do not estimate, extrapolate, or supply a number that is not here.',
      'Where something is marked NOT CONNECTED or NOT MEASURED, say so plainly rather than treating it as zero or ignoring it.',
      'Correlation is not cause. Nothing above establishes why anything changed; a competitor publishing pages and a ranking falling in the same period is not evidence that one caused the other. If asked why something happened, say what changed and what would need to be checked to find out why.',
      'Give a short answer with the specific numbers that support it.',
    );

    return lines.join('\n');
  }

  private async connections(projectId: string) {
    const rows = await this.prisma.integration.findMany({
      // Only the provider name is selected. Tokens live on this table and must
      // never reach a prompt.
      where: { projectId, status: 'CONNECTED', selectedResourceId: { not: null } },
      select: { provider: true },
    });
    const set = new Set(rows.map((row) => row.provider));
    return { searchConsole: set.has('search_console'), analytics: set.has('analytics') };
  }

  private async latestCrawl(projectId: string) {
    const job = await this.prisma.crawlJob.findFirst({
      where: { status: 'COMPLETED', website: { projectId } },
      orderBy: { finishedAt: 'desc' },
      select: { id: true, pagesCrawled: true, finishedAt: true },
    });
    if (!job) return null;
    const [criticalIssues, totalIssues] = await Promise.all([
      this.prisma.issue.count({ where: { crawlJobId: job.id, severity: 'CRITICAL' } }),
      this.prisma.issue.count({ where: { crawlJobId: job.id } }),
    ]);
    return { pagesCrawled: job.pagesCrawled, crawledAt: job.finishedAt, criticalIssues, totalIssues };
  }

  private async competitorCoverage(projectId: string) {
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId, websiteId: { not: null } },
      select: { domain: true, websiteId: true },
    });

    const result: { domain: string; pages: number; crawledAt: Date | null }[] = [];
    for (const competitor of competitors) {
      const job = await this.prisma.crawlJob.findFirst({
        where: { websiteId: competitor.websiteId!, status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' },
        select: { pagesCrawled: true, finishedAt: true },
      });
      if (job) result.push({ domain: competitor.domain, pages: job.pagesCrawled, crawledAt: job.finishedAt });
    }
    return result;
  }

  private async topOpportunities(organizationId: string, projectId: string) {
    return this.prisma.growthOpportunity.findMany({
      where: { organizationId, projectId, status: 'OPEN' },
      orderBy: { priority: 'desc' },
      take: 8,
      select: { title: true, potential: true },
    });
  }
}

function change(pct: number | null): string {
  if (pct === null) return ' (no comparable earlier period)';
  return ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs the period before)`;
}
