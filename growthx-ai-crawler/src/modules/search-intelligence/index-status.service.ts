import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { canonicalUrl } from '../crawler/canonical-url';
import { google } from '../integrations/google/google-apis';
import { googleApiClientError } from '../integrations/google/google-api-error';
import { GoogleOAuthService } from '../integrations/google/google-oauth.service';
import { onDomain, ownSite } from './own-site';

/** Google's URL Inspection quota: 2,000 a day and 600 a minute, per property. */
export const INSPECTIONS_PER_DAY = 2000;
const PAUSE_BETWEEN_MS = 120;
const DEFAULT_BATCH = 100;
const MAX_BATCH = 500;
/** An answer younger than this is not asked again unless a URL is named explicitly. */
const REFRESH_DAYS = 7;

export interface CoverageExplanation {
  /** What it means, for someone who has never opened Search Console. */
  meaning: string;
  /** What to do about it. Null when nothing needs doing. */
  action: string | null;
}

/**
 * Google's coverage states in plain words. Keyed on the start of Google's
 * text, which is stable where the punctuation (curly quotes, dashes) is not.
 */
const COVERAGE: Array<[RegExp, CoverageExplanation]> = [
  [/^submitted and indexed/i, { meaning: 'In Google and listed in your sitemap.', action: null }],
  [/^indexed, not submitted/i, { meaning: 'In Google, but missing from your sitemap.', action: 'Add it to your sitemap so Google keeps revisiting it.' }],
  [/^indexed/i, { meaning: 'In Google.', action: null }],
  [
    /^crawled - currently not indexed/i,
    {
      meaning: 'Google read this page and chose not to show it in search.',
      action: 'Usually a quality signal: make the page more useful and different from your other pages, and link to it from related pages.',
    },
  ],
  [
    /^discovered - currently not indexed/i,
    {
      meaning: 'Google knows this page exists but has not read it yet.',
      action: 'Link to it from pages Google already visits often, such as your homepage or menu, so it gets read sooner.',
    },
  ],
  [/^url is unknown to google/i, { meaning: 'Google has never heard of this page.', action: 'Add it to your sitemap and link to it from other pages.' }],
  [
    /^duplicate, google chose different canonical/i,
    {
      meaning: 'Google treats this page as a copy of another page and shows that one instead of the one you chose.',
      action: 'Make this page clearly different, or point it at the page Google picked.',
    },
  ],
  [/^duplicate without user-selected canonical/i, { meaning: 'Google treats this page as a copy of another page.', action: 'Say which version is the main one, or make the pages different.' }],
  [/^alternate page with proper canonical/i, { meaning: 'A deliberate copy that points at its main version. Nothing wrong.', action: null }],
  [/^excluded by .noindex./i, { meaning: 'The page itself tells Google not to show it.', action: 'If it should appear in search, remove the "noindex" setting.' }],
  [/^blocked by robots\.txt/i, { meaning: 'Your robots.txt file tells Google not to read this page.', action: 'If it should appear in search, allow it in robots.txt.' }],
  [/^page with redirect/i, { meaning: 'This address forwards to another page, so the other page is the one shown.', action: 'Update links and your sitemap to use the final address.' }],
  [/^not found \(404\)/i, { meaning: 'Google got "not found" for this page.', action: 'Restore it, or redirect it to its replacement.' }],
  [/^soft 404/i, { meaning: 'The page loads, but Google thinks it is a "not found" page.', action: 'Return a real "not found", redirect it, or give it real content.' }],
  [/^server error/i, { meaning: 'Your server failed when Google tried to read this page.', action: 'Check your hosting; Google retries, but repeated failures drop the page.' }],
  [/^blocked due to/i, { meaning: 'Google was refused access to this page.', action: 'Check login walls, firewalls and bot protection for this address.' }],
];

export function explainCoverage(state: string | null | undefined): CoverageExplanation {
  if (!state) return { meaning: 'Google gave no status for this page.', action: null };
  const hit = COVERAGE.find(([pattern]) => pattern.test(state.trim()));
  return hit ? hit[1] : { meaning: state, action: null };
}

/** Whether a URL can be inspected under a Search Console property. */
export function urlBelongsToProperty(url: string, propertyId: string): boolean {
  if (propertyId.startsWith('sc-domain:')) return onDomain(url, propertyId.slice('sc-domain:'.length));
  return url.startsWith(propertyId);
}

/**
 * Asks Google, one URL at a time, whether each page is in its index — the
 * question no crawl of our own can answer, because the answer lives in Google.
 *
 * Uses the Search Console access the customer already granted: URL Inspection
 * accepts the read-only scope. The quota is small (2,000 a day per property),
 * so pages are asked about in batches, oldest answer first, and the remaining
 * allowance is reported rather than run into.
 */
@Injectable()
export class IndexStatusService {
  private readonly logger = new Logger(IndexStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GoogleOAuthService,
  ) {}

  private async propertyFor(projectId: string): Promise<string> {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'search_console' } },
      select: { selectedResourceId: true },
    });
    if (!integration?.selectedResourceId) {
      throw new BadRequestException('Connect Google Search Console and choose your website there first. Index status comes from Google itself.');
    }
    return integration.selectedResourceId;
  }

  private async usedToday(propertyId: string): Promise<number> {
    return this.prisma.urlIndexInspection.count({
      where: { propertyId, inspectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    });
  }

  /**
   * The next pages to ask about: crawled pages that answered, never inspected
   * first, then the oldest answers, skipping any answered in the last week.
   */
  async urlsToInspect(projectId: string, propertyId: string, limit: number): Promise<string[]> {
    const site = await ownSite(this.prisma, projectId);
    if (!site?.crawl) return [];

    const pages = await this.prisma.page.findMany({
      where: { crawlJobId: site.crawl.id, statusCode: 200, blockedSuspected: false },
      select: { url: true },
    });
    const candidates = [...new Set(pages.map((p) => p.url))].filter((u) => urlBelongsToProperty(u, propertyId));
    if (candidates.length === 0) return [];

    const latest = await this.prisma.urlIndexInspection.findMany({
      where: { projectId, url: { in: candidates } },
      orderBy: [{ url: 'asc' }, { inspectedAt: 'desc' }],
      distinct: ['url'],
      select: { url: true, inspectedAt: true },
    });
    const askedAt = new Map(latest.map((r) => [r.url, r.inspectedAt.getTime()]));
    const staleBefore = Date.now() - REFRESH_DAYS * 24 * 60 * 60 * 1000;

    return candidates
      .filter((u) => (askedAt.get(u) ?? 0) < staleBefore)
      .sort((a, b) => (askedAt.get(a) ?? 0) - (askedAt.get(b) ?? 0))
      .slice(0, limit);
  }

  async inspect(projectId: string, options: { urls?: string[]; limit?: number } = {}) {
    const propertyId = await this.propertyFor(projectId);
    const quotaLeft = Math.max(0, INSPECTIONS_PER_DAY - (await this.usedToday(propertyId)));
    const limit = Math.min(Math.max(1, options.limit ?? DEFAULT_BATCH), MAX_BATCH, quotaLeft);

    if (limit <= 0 || quotaLeft === 0) {
      return { inspected: 0, failed: 0, quotaLeft, note: "Google's daily allowance of 2,000 checks for this website is used up. Try again tomorrow." };
    }

    const requested = options.urls?.map((u) => u.trim()).filter(Boolean);
    const outside = (requested ?? []).filter((u) => !urlBelongsToProperty(u, propertyId));
    const urls = requested
      ? requested.filter((u) => urlBelongsToProperty(u, propertyId)).slice(0, limit)
      : await this.urlsToInspect(projectId, propertyId, limit);

    if (urls.length === 0) {
      return {
        inspected: 0,
        failed: 0,
        quotaLeft,
        skippedOutsideProperty: outside,
        note: requested
          ? `None of these addresses belong to the Search Console property ${propertyId}.`
          : 'Every crawled page was checked with Google in the last 7 days, or the site has not been crawled yet.',
      };
    }

    const auth = await this.oauth.clientFor(projectId, 'search_console');
    const api = google.searchconsole({ version: 'v1', auth });

    let inspected = 0;
    let failed = 0;
    let note: string | undefined;

    for (const url of urls) {
      try {
        const { data } = await api.urlInspection.index.inspect({ requestBody: { inspectionUrl: url, siteUrl: propertyId } });
        const result = data.inspectionResult;
        const status = result?.indexStatusResult;
        await this.prisma.urlIndexInspection.create({
          data: {
            projectId,
            propertyId,
            url,
            verdict: status?.verdict ?? null,
            coverageState: status?.coverageState ?? null,
            indexingState: status?.indexingState ?? null,
            pageFetchState: status?.pageFetchState ?? null,
            robotsTxtState: status?.robotsTxtState ?? null,
            googleCanonical: status?.googleCanonical ?? null,
            userCanonical: status?.userCanonical ?? null,
            lastCrawlTime: status?.lastCrawlTime ? new Date(status.lastCrawlTime) : null,
            crawledAs: status?.crawledAs ?? null,
            sitemaps: status?.sitemap ?? [],
            referringUrls: (status?.referringUrls ?? []).slice(0, 20),
            inspectionLink: result?.inspectionResultLink ?? null,
          },
        });
        inspected++;
      } catch (error: any) {
        const code = error?.response?.status ?? error?.code;
        if (code === 401 || code === 403) {
          // The whole connection is refused, not this URL: every further call
          // would fail the same way.
          throw googleApiClientError('Google Search Console URL Inspection', error);
        }
        if (code === 429) {
          note = 'Google asked us to slow down, so the rest will be checked on the next run.';
          break;
        }
        failed++;
        await this.prisma.urlIndexInspection.create({
          data: { projectId, propertyId, url, error: String(error?.response?.data?.error?.message ?? error?.message ?? 'Unknown error').slice(0, 500) },
        });
      }
      await new Promise((resolve) => setTimeout(resolve, PAUSE_BETWEEN_MS));
    }

    this.logger.log(`[${projectId}] URL Inspection: ${inspected} answered, ${failed} failed, ${quotaLeft - inspected - failed} left today.`);
    return { inspected, failed, quotaLeft: Math.max(0, quotaLeft - inspected - failed), skippedOutsideProperty: outside, note };
  }

  /**
   * Google's answer for every page asked about, grouped the way Search
   * Console groups them, set against what our own crawl found — including the
   * pages we consider indexable that Google has not indexed.
   */
  async report(projectId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'search_console' } },
      select: { selectedResourceId: true },
    });
    const propertyId = integration?.selectedResourceId ?? null;

    const latest = await this.prisma.urlIndexInspection.findMany({
      where: { projectId },
      orderBy: [{ url: 'asc' }, { inspectedAt: 'desc' }],
      distinct: ['url'],
    });

    const site = await ownSite(this.prisma, projectId);
    const crawled = site?.crawl
      ? await this.prisma.page.findMany({
          where: { crawlJobId: site.crawl.id },
          select: { url: true, statusCode: true, indexability: true, canonicalUrl: true, blockedSuspected: true },
        })
      : [];
    const crawledByKey = new Map(crawled.map((p) => [canonicalUrl(p.url), p]));

    const answered = latest.filter((r) => !r.error);
    const groups = new Map<string, { coverageState: string; verdict: string | null; urls: string[] }>();
    for (const row of answered) {
      const state = row.coverageState ?? 'No status from Google';
      const group = groups.get(state) ?? { coverageState: state, verdict: row.verdict, urls: [] };
      group.urls.push(row.url);
      groups.set(state, group);
    }

    const indexed = answered.filter((r) => r.verdict === 'PASS');
    const notIndexed = answered.filter((r) => r.verdict !== 'PASS');

    // Pages our crawl says Google may index, which Google has not.
    const indexableButNotIndexed = notIndexed
      .filter((r) => crawledByKey.get(canonicalUrl(r.url))?.indexability === 'INDEXABLE')
      .map((r) => ({ url: r.url, coverageState: r.coverageState, ...explainCoverage(r.coverageState) }));

    // Pages where Google ignored the canonical the page declares.
    const canonicalOverridden = answered
      .filter((r) => r.googleCanonical && r.userCanonical && canonicalUrl(r.googleCanonical) !== canonicalUrl(r.userCanonical))
      .map((r) => ({ url: r.url, declared: r.userCanonical, googleChose: r.googleCanonical }));

    const inspectedKeys = new Set(latest.map((r) => canonicalUrl(r.url)));
    const notYetAsked = crawled.filter((p) => p.statusCode === 200 && !p.blockedSuspected && !inspectedKeys.has(canonicalUrl(p.url))).length;

    return {
      connected: Boolean(propertyId),
      propertyId,
      quota: propertyId ? { usedToday: await this.usedToday(propertyId), perDay: INSPECTIONS_PER_DAY } : null,
      lastInspectedAt: latest.reduce<Date | null>((max, r) => (!max || r.inspectedAt > max ? r.inspectedAt : max), null),
      totals: {
        asked: latest.length,
        indexed: indexed.length,
        notIndexed: notIndexed.length,
        couldNotCheck: latest.length - answered.length,
        notYetAsked,
      },
      groups: [...groups.values()]
        .map((g) => ({ ...g, count: g.urls.length, ...explainCoverage(g.coverageState), urls: g.urls.slice(0, 50) }))
        .sort((a, b) => Number(a.verdict === 'PASS') - Number(b.verdict === 'PASS') || b.count - a.count),
      indexableButNotIndexed,
      canonicalOverridden,
      urlSets: await this.urlSets(projectId, site?.crawl?.id ?? null, indexed.length),
      pages: latest.map((r) => ({
        url: r.url,
        inspectedAt: r.inspectedAt,
        verdict: r.verdict,
        coverageState: r.coverageState,
        ...explainCoverage(r.coverageState),
        googleCanonical: r.googleCanonical,
        userCanonical: r.userCanonical,
        lastCrawlTime: r.lastCrawlTime,
        inSitemapPerGoogle: r.sitemaps.length > 0,
        inspectionLink: r.inspectionLink,
        error: r.error,
        ourCrawl: (() => {
          const p = crawledByKey.get(canonicalUrl(r.url));
          return p ? { statusCode: p.statusCode, indexability: p.indexability } : null;
        })(),
      })),
    };
  }

  /**
   * The same site counted five ways, so the gaps between them are visible:
   * found, read, allowed in search, listed in the sitemap, and actually
   * indexed or seen in Google.
   */
  private async urlSets(projectId: string, crawlJobId: string | null, googleIndexed: number) {
    const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const [discovered, inSitemap, crawled, indexable, gscPages] = await Promise.all([
      crawlJobId ? this.prisma.crawlFrontier.count({ where: { crawlJobId } }) : 0,
      crawlJobId ? this.prisma.crawlFrontier.count({ where: { crawlJobId, sources: { has: 'sitemap' } } }) : 0,
      crawlJobId ? this.prisma.page.count({ where: { crawlJobId, statusCode: 200, blockedSuspected: false } }) : 0,
      crawlJobId ? this.prisma.page.count({ where: { crawlJobId, indexability: 'INDEXABLE' } }) : 0,
      this.prisma.gscDailyMetric.groupBy({ by: ['page'], where: { projectId, grain: 'PAGE', date: { gte: since }, impressions: { gt: 0 } } }),
    ]);
    return {
      discovered,
      inSitemap,
      crawled,
      indexableByOurCheck: indexable,
      indexedByGoogle: googleIndexed,
      seenInGoogleSearchLast28Days: gscPages.length,
    };
  }
}
