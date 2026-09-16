import { FetchService, FetchOutcome } from './fetch/fetch.service';
import { DiscoveryService, DiscoverySource, SitemapFinding } from './discovery/discovery.service';
import { HostRateLimiter } from './frontier/rate-limiter';
import { contentFingerprint, findDuplicateClusters, DuplicateCluster } from './frontier/duplicate-clusters';
import { extractPage, ExtractedPage } from './page-extract';
import { computeIndexability, IndexabilityResult } from './indexability';
import { evaluatePage, evaluateSite, Finding } from './issue-rules';
import { normalizeUrl, inferTrailingSlashPolicy, TrailingSlashPolicy } from './url/url-normalizer';
import { sameRegistrableDomain } from './url/registrable-domain';
import { computeCrawlSummary, CrawlSummary } from './crawl-summary';
import { isCrawlablePage } from './crawlable';

export interface CrawlLimits {
  maxPages: number;
  maxDepth: number;
  maxDurationMs: number;
  maxRenderedPages: number;
  concurrency: number;
}

export const DEFAULT_CRAWL_LIMITS: CrawlLimits = {
  maxPages: Number(process.env.CRAWL_MAX_PAGES || 500),
  maxDepth: Number(process.env.CRAWL_MAX_DEPTH || 10),
  maxDurationMs: Number(process.env.CRAWL_MAX_DURATION_MS || 30 * 60 * 1000),
  maxRenderedPages: Number(process.env.CRAWL_MAX_RENDERED_PAGES || 100),
  concurrency: Number(process.env.CRAWL_CONCURRENCY || 5),
};

export interface CrawledPage {
  url: string;
  finalUrl: string;
  statusCode?: number;
  statusChain: FetchOutcome['statusChain'];
  rawHtml: string;
  renderedHtml?: string;
  jsRequired: boolean;
  discoverySource: DiscoverySource;
  depth: number;
  blockedSuspected: boolean;
  contentHash?: string;
  indexability: IndexabilityResult;
  extracted?: ExtractedPage;
  fetchFailed: boolean;
  fetchErrorKind?: string;
  responseTimeMs: number;
  headers: Record<string, string>;
}

export interface CrawlReport {
  startUrl: string;
  pages: CrawledPage[];
  findings: Finding[];
  summary: CrawlSummary;
  sitemapFindings: SitemapFinding[];
  sitemapUrlCount: number;
  duplicateClusters: DuplicateCluster[];
  stoppedBecause: 'FRONTIER_EMPTY' | 'MAX_PAGES' | 'MAX_DURATION';
  renderedPages: number;
  robotsFetched: boolean;
}

interface QueueEntry {
  url: string;
  normalizedUrl: string;
  depth: number;
  source: DiscoverySource;
  sourceUrl?: string;
}

/**
 * Runs one crawl end to end, in memory.
 *
 * Deliberately free of Prisma, BullMQ and Redis so the whole pipeline — fetch,
 * discovery, extraction, indexability, issues, summary — can be exercised
 * against a real HTTP origin in a test. Persistence and distribution are the
 * caller's business; the crawl itself is not where those belong.
 */
export class CrawlEngine {
  private readonly limiter = new HostRateLimiter();

  constructor(
    private readonly fetcher: FetchService,
    private readonly discovery: DiscoveryService,
    private readonly limits: CrawlLimits = DEFAULT_CRAWL_LIMITS,
  ) {}

  async crawl(startUrl: string, options: { useSitemap?: boolean } = {}): Promise<CrawlReport> {
    const startedAt = Date.now();
    const seeds = await this.discovery.discoverSeeds(startUrl, { useSitemap: options.useSitemap });

    // The site's own Crawl-delay always wins if it is slower than ours.
    const host = new URL(startUrl).host;
    if (seeds.crawlDelayMs) this.limiter.setHostCrawlDelay(host, seeds.crawlDelayMs);

    const queue: QueueEntry[] = [];
    const claimed = new Set<string>();
    let trailingSlash: TrailingSlashPolicy | undefined;
    // Set when the page ceiling, rather than exhaustion, is what stopped URLs
    // entering the frontier. Without it a capped crawl reports itself as having
    // seen the whole site.
    let hitPageCeiling = false;

    const enqueue = (url: string, depth: number, source: DiscoverySource, sourceUrl?: string): boolean => {
      if (depth > this.limits.maxDepth) return false;
      if (claimed.size + queue.length >= this.limits.maxPages) {
        hitPageCeiling = true;
        return false;
      }
      const normalized = normalizeUrl(url, { trailingSlash });
      if (!normalized || claimed.has(normalized)) return false;
      if (!sameRegistrableDomain(normalized, startUrl)) return false;
      if (!isCrawlablePage(normalized)) return false;
      if (queue.some((q) => q.normalizedUrl === normalized)) return false;
      queue.push({ url, normalizedUrl: normalized, depth, source, sourceUrl });
      return true;
    };

    for (const seed of seeds.urls) enqueue(seed.url, seed.source === 'seed' ? 0 : 1, seed.source, seed.foundIn);

    const sitemapUrls = new Set(seeds.urls.filter((u) => u.source === 'sitemap').map((u) => u.normalizedUrl));
    const pages: CrawledPage[] = [];
    let renderedPages = 0;
    let stoppedBecause: CrawlReport['stoppedBecause'] = 'FRONTIER_EMPTY';

    while (queue.length > 0) {
      if (pages.length >= this.limits.maxPages) {
        stoppedBecause = 'MAX_PAGES';
        break;
      }
      if (Date.now() - startedAt > this.limits.maxDurationMs) {
        stoppedBecause = 'MAX_DURATION';
        break;
      }

      // Shallowest first: on a site with a calendar trap, depth-first spends
      // the entire page budget inside the trap.
      queue.sort((a, b) => a.depth - b.depth);
      const batch = queue.splice(0, Math.max(1, this.limits.concurrency)).filter((entry) => {
        if (claimed.has(entry.normalizedUrl)) return false;
        claimed.add(entry.normalizedUrl);
        return true;
      });

      const results = await Promise.all(batch.map((entry) => this.crawlOne(entry, seeds, renderedPages, sitemapUrls)));

      for (const { page, discovered, rendered } of results) {
        if (rendered) renderedPages++;
        pages.push(page);

        if (!trailingSlash) {
          trailingSlash = inferTrailingSlashPolicy(page.statusChain);
        }
        for (const link of discovered) {
          enqueue(link, page.depth + 1, 'link', page.url);
        }
      }
    }

    // Sitemap URLs that turned out not to exist are a finding about the
    // sitemap, so they are read back off the crawl rather than guessed at.
    if (stoppedBecause === 'FRONTIER_EMPTY' && hitPageCeiling) stoppedBecause = 'MAX_PAGES';

    const deadSitemapUrls = pages
      .filter((p) => sitemapUrls.has(normalizeUrl(p.url, { trailingSlash })) && (p.fetchFailed || (p.statusCode ?? 0) >= 400))
      .map((p) => ({
        url: p.url,
        status: p.statusCode,
        reason: p.fetchFailed ? `${p.fetchErrorKind}: could not be fetched` : `HTTP ${p.statusCode}`,
      }));

    const duplicateClusters = findDuplicateClusters(pages.map((p) => ({ url: p.url, contentHash: p.contentHash })));
    const clusterByUrl = new Map<string, DuplicateCluster>();
    for (const cluster of duplicateClusters) for (const url of cluster.urls) clusterByUrl.set(url, cluster);

    const findings: Finding[] = [];
    for (const page of pages) {
      findings.push(
        ...evaluatePage({
          url: page.url,
          fetch: this.asOutcome(page),
          extracted: page.extracted,
          indexability: page.indexability,
          isHomepage: isRoot(page.url),
          inSitemap: sitemapUrls.has(normalizeUrl(page.url, { trailingSlash })),
          duplicateCluster: clusterByUrl.get(page.url),
        }),
      );
    }
    findings.push(
      ...evaluateSite({
        siteUrl: startUrl,
        sitemapFindings: seeds.findings,
        duplicateClusters,
        deadSitemapUrls,
      }),
    );

    const summary = computeCrawlSummary({
      pages: pages.map((p) => ({
        url: p.url,
        statusCode: p.statusCode ?? null,
        indexability: p.indexability.indexability,
        blockedSuspected: p.blockedSuspected,
        jsRequired: p.jsRequired,
        discoverySource: p.discoverySource,
        fetchFailed: p.fetchFailed,
      })),
      issues: findings.map((f) => ({
        issueType: f.id,
        severity: f.severity,
        confidence: f.confidence,
        affectedUrl: f.affectedUrl,
      })),
    });

    return {
      startUrl,
      pages,
      findings,
      summary,
      sitemapFindings: seeds.findings,
      sitemapUrlCount: sitemapUrls.size,
      duplicateClusters,
      stoppedBecause,
      renderedPages,
      robotsFetched: seeds.robotsFetched,
    };
  }

  private async crawlOne(
    entry: QueueEntry,
    seeds: Awaited<ReturnType<DiscoveryService['discoverSeeds']>>,
    renderedSoFar: number,
    _sitemapUrls: Set<string>,
  ): Promise<{ page: CrawledPage; discovered: string[]; rendered: boolean }> {
    const host = new URL(entry.normalizedUrl).host;
    await this.limiter.acquire(host);

    const robotsDecision = this.discovery.isAllowed(seeds.robots, entry.normalizedUrl);

    // Rendering is budgeted, because a browser page is the expensive resource.
    const renderAllowed = renderedSoFar < this.limits.maxRenderedPages;
    const outcome = await this.fetcher.fetch(entry.url, { renderAllowed });

    if ((outcome.statusCode === 429 || outcome.statusCode === 503) && outcome.headers['retry-after']) {
      this.limiter.backOff(host, 1, Number(outcome.headers['retry-after']));
    }

    const isHtml = !outcome.contentType || /html|xhtml/i.test(outcome.contentType);
    const extracted = !outcome.error && isHtml && outcome.html ? extractPage(outcome.html, outcome.finalUrl) : undefined;

    const indexability = computeIndexability({
      statusCode: outcome.statusCode,
      robotsTxtAllows: robotsDecision?.allowed,
      robotsTxtEvidence: robotsDecision?.evidence,
      metaRobots: extracted?.metaRobots,
      xRobotsTag: outcome.headers['x-robots-tag'],
      canonicalUrl: extracted?.canonicalUrl,
      pageUrl: outcome.finalUrl,
      fetchFailed: Boolean(outcome.error),
    });

    const page: CrawledPage = {
      url: entry.normalizedUrl,
      finalUrl: outcome.finalUrl,
      statusCode: outcome.statusCode,
      statusChain: outcome.statusChain,
      rawHtml: outcome.rawHtml,
      renderedHtml: outcome.renderedHtml,
      jsRequired: outcome.jsRequired,
      discoverySource: entry.source,
      depth: entry.depth,
      blockedSuspected: outcome.blockedSuspected,
      contentHash: extracted?.mainText ? contentFingerprint(extracted.mainText) : undefined,
      indexability,
      extracted,
      fetchFailed: Boolean(outcome.error),
      fetchErrorKind: outcome.error?.kind,
      responseTimeMs: outcome.totalMs,
      headers: outcome.headers,
    };

    // `undefined` means there was no robots.txt to judge by, which is not a
    // refusal. Written as `!robotsDecision?.allowed === false` this read as
    // `(!undefined) === false`, so a site whose robots.txt could not be fetched
    // had every link on every page discarded and the crawl ended at its
    // homepage — the one case where following links is all a crawler has left.
    const robotsRefused = robotsDecision?.allowed === false;
    const discovered = extracted && !robotsRefused ? extracted.internalLinks.map((l) => l.absoluteUrl) : [];

    return { page, discovered, rendered: outcome.tier === 'rendered' };
  }

  /** Re-forms the fetch outcome the rules need from what was stored. */
  private asOutcome(page: CrawledPage): FetchOutcome {
    return {
      url: page.url,
      finalUrl: page.finalUrl,
      statusCode: page.statusCode,
      statusChain: page.statusChain,
      headers: page.headers,
      rawHtml: page.rawHtml,
      renderedHtml: page.renderedHtml,
      html: page.renderedHtml || page.rawHtml,
      jsRequired: page.jsRequired,
      escalationReasons: [],
      blockedSuspected: page.blockedSuspected,
      totalMs: page.responseTimeMs,
      tier: page.renderedHtml ? 'rendered' : page.fetchFailed ? 'failed' : 'static',
      error: page.fetchFailed ? ({ kind: page.fetchErrorKind, label: page.fetchErrorKind, message: page.fetchErrorKind } as never) : undefined,
      renderDiff: page.jsRequired
        ? {
            rawWordCount: wordCount(stripTags(page.rawHtml)),
            renderedWordCount: page.extracted?.wordCount ?? 0,
            rawLinkCount: (page.rawHtml.match(/<a\s[^>]*href=/gi) || []).length,
            renderedLinkCount: (page.extracted?.internalLinks.length ?? 0) + (page.extracted?.externalLinks.length ?? 0),
            rawTitle: /<title[^>]*>([^<]*)<\/title>/i.exec(page.rawHtml)?.[1]?.trim(),
            renderedTitle: page.extracted?.title,
            fingerprints: [],
          }
        : undefined,
    };
  }
}

function isRoot(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.pathname === '/' || parsed.pathname === '';
  } catch {
    return false;
  }
}

function stripTags(html: string): string {
  return (html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

function wordCount(text: string): number {
  return (text || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;
}
