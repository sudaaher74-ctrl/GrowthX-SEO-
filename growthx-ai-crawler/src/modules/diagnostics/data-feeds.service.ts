import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WebSearchService } from '../market-research/web-search.service';
import { TRACKED_COMPETITOR_STATUSES } from '../content-intelligence/competitor-status';

/** One input the product depends on, and whether it is actually arriving. */
export interface FeedStatus {
  /** Stable key, so the UI can match a feed without string-matching a label. */
  key: 'web_search' | 'search_console' | 'competitor_crawl' | 'competitor_content';
  name: string;
  /** `live` — data is arriving. `empty` — wired but nothing has come through
   *  yet. `off` — a switch or key is missing, so nothing ever will. */
  state: 'live' | 'empty' | 'off';
  /** What is measurably there, in plain numbers. */
  detail: string;
  /** What the customer loses while this is not live. */
  affects: string;
  /** The single next action that would change the state. */
  fix?: string;
  lastDataAt?: string | null;
}

/**
 * Whether the data behind each tab is actually arriving.
 *
 * Every fabricator has now been removed, which was right, but it changed how
 * failure looks: a broken feed and a quiet one both render as an empty panel.
 * "Is this tab wrong, or do I just have no data yet?" became unanswerable
 * without a database session, and the honest empty states this product now
 * shows are only honest if that question has an answer.
 *
 * Counts and timestamps, read live. Nothing here reports a key's value — only
 * whether one is present.
 */
@Injectable()
export class DataFeedsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly webSearch?: WebSearchService,
  ) {}

  async check(projectId: string): Promise<{ projectId: string; checkedAt: string; feeds: FeedStatus[] }> {
    const [webSearch, searchConsole, crawl, content] = await Promise.all([
      this.webSearchFeed(),
      this.searchConsoleFeed(projectId),
      this.competitorCrawlFeed(projectId),
      this.competitorContentFeed(projectId),
    ]);

    return {
      projectId,
      checkedAt: new Date().toISOString(),
      feeds: [webSearch, searchConsole, crawl, content],
    };
  }

  private webSearchFeed(): FeedStatus {
    const configured = Boolean(this.webSearch?.isConfigured());
    return {
      key: 'web_search',
      name: 'Live web search',
      state: configured ? 'live' : 'off',
      detail: configured
        ? 'A search provider is configured, so competitors can be found from live results.'
        : 'No search provider is configured.',
      affects:
        'Finding competitors outside the curated industries, and the competitor columns of the keyword gap matrix.',
      fix: configured ? undefined : 'Set TAVILY_API_KEY on the API service.',
    };
  }

  private async searchConsoleFeed(projectId: string): Promise<FeedStatus> {
    const since = new Date();
    since.setDate(since.getDate() - 28);

    const [queryRows, latest] = await Promise.all([
      this.prisma.gscDailyMetric.count({ where: { projectId, grain: 'QUERY', date: { gte: since } } }),
      this.prisma.gscDailyMetric.findFirst({
        where: { projectId },
        orderBy: { date: 'desc' },
        select: { date: true },
      }),
    ]);

    return {
      key: 'search_console',
      name: 'Google Search Console',
      state: queryRows > 0 ? 'live' : latest ? 'empty' : 'off',
      detail:
        queryRows > 0
          ? `${queryRows.toLocaleString()} query rows in the last 28 days.`
          : latest
            ? 'Connected, but no query rows in the last 28 days.'
            : 'No Search Console data has ever been synced for this project.',
      affects: 'The search terms and impression counts in the keyword gap matrix.',
      fix: queryRows > 0 ? undefined : 'Connect Google Search Console for this project and run a sync.',
      lastDataAt: latest?.date?.toISOString() ?? null,
    };
  }

  private async competitorCrawlFeed(projectId: string): Promise<FeedStatus> {
    const [tracked, crawled, mostRecent] = await Promise.all([
      this.prisma.competitorDomain.count({
        where: { projectId, status: { in: TRACKED_COMPETITOR_STATUSES } },
      }),
      this.prisma.competitorDomain.count({ where: { projectId, lastAnalyzedAt: { not: null } } }),
      this.prisma.competitorDomain.findFirst({
        where: { projectId, lastAnalyzedAt: { not: null } },
        orderBy: { lastAnalyzedAt: 'desc' },
        select: { lastAnalyzedAt: true },
      }),
    ]);

    // The kill switch silences the recurring sweeps entirely, so it outranks
    // any count: with it off, nothing below will ever change on its own.
    if (process.env.COMPETITOR_CRON_ENABLED === 'false') {
      return {
        key: 'competitor_crawl',
        name: 'Competitor site crawls',
        state: 'off',
        detail: `${tracked} competitor(s) tracked, but the recurring crawl is switched off.`,
        affects: 'Competitor pages, change alerts and everything downstream of them.',
        fix: 'Unset COMPETITOR_CRON_ENABLED (or set it to anything but "false").',
        lastDataAt: mostRecent?.lastAnalyzedAt?.toISOString() ?? null,
      };
    }

    return {
      key: 'competitor_crawl',
      name: 'Competitor site crawls',
      state: crawled > 0 ? 'live' : tracked > 0 ? 'empty' : 'off',
      detail:
        tracked === 0
          ? 'No competitors are being tracked yet.'
          : `${crawled} of ${tracked} tracked competitor(s) have been crawled at least once.`,
      affects: 'Competitor pages and the change alerts built from them.',
      fix:
        tracked === 0
          ? 'Add competitors from the Competitors tab.'
          : crawled === 0
            ? 'A crawl starts when a competitor is added, and the sweep re-runs at 02:00 UTC.'
            : undefined,
      lastDataAt: mostRecent?.lastAnalyzedAt?.toISOString() ?? null,
    };
  }

  private async competitorContentFeed(projectId: string): Promise<FeedStatus> {
    const [accounts, items, mostRecent] = await Promise.all([
      this.prisma.competitorAccount.count({ where: { projectId, isActive: true } }),
      this.prisma.competitorContent.count({ where: { projectId } }),
      this.prisma.competitorContent.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    // Automated ingestion is YouTube-only; without that key content has to be
    // entered by hand, which is a very different answer to "why is this empty".
    const youtube = (process.env.YOUTUBE_API_KEY || '').trim().length > 20;

    return {
      key: 'competitor_content',
      name: 'Competitor content',
      state: items > 0 ? 'live' : 'empty',
      detail:
        items > 0
          ? `${items.toLocaleString()} item(s) collected across ${accounts} account(s).`
          : accounts > 0
            ? `${accounts} social account(s) tracked, but no content collected yet.`
            : 'No competitor social accounts are being tracked yet.',
      affects: 'The cross-competitor matrix, video intelligence and content pattern detection.',
      fix:
        items > 0
          ? undefined
          : youtube
            ? 'Uploads are collected by the 03:00 UTC sweep; an account can also be synced on demand.'
            : 'Set YOUTUBE_API_KEY for automatic collection, or add competitor content by hand.',
      lastDataAt: mostRecent?.createdAt?.toISOString() ?? null,
    };
  }
}
