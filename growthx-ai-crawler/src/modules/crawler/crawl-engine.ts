import { FetchService, FetchOutcome } from './fetch/fetch.service';
import { DiscoveryService, DiscoverySource, SitemapFinding } from './discovery/discovery.service';
import { HostRateLimiter } from './frontier/rate-limiter';
import { contentFingerprint, findDuplicateClusters, DuplicateCluster } from './frontier/duplicate-clusters';
import { extractPage, ExtractedPage } from './page-extract';
import { computeIndexability, IndexabilityResult } from './indexability';
import { evaluatePage, evaluateSite, Finding } from './issue-rules';
import { normalizeUrl, inferTrailingSlashPolicy, TrailingSlashPolicy, isInternalTargetUrl } from './url/url-normalizer';
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
    let hitPageCeiling = false;

    // Canonical queue state sets
    const discoveredURLs = new Map<string, { url: string; source: DiscoverySource; foundIn?: string }>();
    const queuedURLs = new Set<string>();
    const crawledURLs = new Set<string>();
    const successfulURLs = new Set<string>();
    const failedURLs = new Set<string>();
    const redirectedURLs = new Map<string, string>();
    const blockedURLs = new Set<string>();
    const duplicateURLs = new Set<string>();
    const canonicalizedURLs = new Map<string, string>();
    const discoveredNotCrawled: Array<{ url: string; reason: string }> = [];
    const discoveredNotCrawledSeen = new Set<string>();

    const recordDiscoveredNotCrawled = (url: string, reason: string) => {
      const key = `${url}::${reason}`;
      if (!discoveredNotCrawledSeen.has(key)) {
        discoveredNotCrawledSeen.add(key);
        discoveredNotCrawled.push({ url, reason });
      }
    };

    const enqueue = (url: string, depth: number, source: DiscoverySource, sourceUrl?: string): boolean => {
      const normalized = normalizeUrl(url, { trailingSlash });
      if (!normalized) {
        recordDiscoveredNotCrawled(url, 'invalid URL');
        return false;
      }

      if (!discoveredURLs.has(normalized)) {
        discoveredURLs.set(normalized, { url, source, foundIn: sourceUrl });
      }

      if (!isInternalTargetUrl(normalized, startUrl)) {
        recordDiscoveredNotCrawled(url, 'external');
        return false;
      }

      if (!isCrawlablePage(normalized)) {
        recordDiscoveredNotCrawled(url, 'invalid URL');
        return false;
      }

      if (crawledURLs.has(normalized) || claimed.has(normalized)) {
        duplicateURLs.add(normalized);
        recordDiscoveredNotCrawled(url, 'already crawled');
        return false;
      }

      if (queuedURLs.has(normalized) || queue.some((q) => q.normalizedUrl === normalized)) {
        duplicateURLs.add(normalized);
        recordDiscoveredNotCrawled(url, 'duplicate');
        return false;
      }

      if (depth > this.limits.maxDepth) {
        recordDiscoveredNotCrawled(url, 'max depth');
        return false;
      }

      queuedURLs.add(normalized);
      queue.push({ url, normalizedUrl: normalized, depth, source, sourceUrl });
      return true;
    };

    for (const seed of seeds.urls) {
      const source: DiscoverySource =
        seed.source === 'seed'
          ? (isRoot(seed.url) ? 'homepage' : 'seed')
          : seed.source;
      enqueue(seed.url, seed.source === 'seed' ? 0 : 1, source, seed.foundIn);
    }

    for (const foreign of seeds.foreignSitemapUrls) {
      recordDiscoveredNotCrawled(foreign, 'external');
    }

    const sitemapUrls = new Set(seeds.urls.filter((u) => u.source === 'sitemap').map((u) => u.normalizedUrl));
    const pages: CrawledPage[] = [];
    let renderedPages = 0;
    let stoppedBecause: CrawlReport['stoppedBecause'] = 'FRONTIER_EMPTY';

    while (queue.length > 0) {
      if (pages.length >= this.limits.maxPages) {
        stoppedBecause = 'MAX_PAGES';
        hitPageCeiling = true;
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

      for (const { page, discovered, rendered, externalUrls } of results) {
        if (rendered) renderedPages++;
        pages.push(page);
        crawledURLs.add(page.url);

        if (page.statusCode && page.statusCode >= 200 && page.statusCode < 300) {
          successfulURLs.add(page.url);
        } else if (page.fetchFailed || (page.statusCode && page.statusCode >= 400 && !page.blockedSuspected)) {
          failedURLs.add(page.url);
          recordDiscoveredNotCrawled(page.url, 'error');
        } else if (page.blockedSuspected) {
          blockedURLs.add(page.url);
          recordDiscoveredNotCrawled(page.url, 'blocked');
        }

        if (page.indexability?.reasons?.some((r) => r.code === 'ROBOTS_TXT_DISALLOW')) {
          blockedURLs.add(page.url);
          recordDiscoveredNotCrawled(page.url, 'robots.txt');
        }

        if (page.statusChain && page.statusChain.length > 0) {
          redirectedURLs.set(page.url, page.finalUrl);
        }

        if (page.extracted?.canonicalUrl && normalizeUrl(page.extracted.canonicalUrl) !== normalizeUrl(page.finalUrl)) {
          canonicalizedURLs.set(page.url, page.extracted.canonicalUrl);
        }

        if (page.indexability?.indexability === 'NOT_INDEXABLE') {
          recordDiscoveredNotCrawled(page.url, 'noindex');
        }

        for (const ext of externalUrls) {
          recordDiscoveredNotCrawled(ext, 'external');
        }

        if (!trailingSlash) {
          trailingSlash = inferTrailingSlashPolicy(page.statusChain);
        }
        for (const item of discovered) {
          enqueue(item.url, page.depth + 1, item.source, page.url);
        }
      }
    }

    if (queue.length > 0) {
      for (const remaining of queue) {
        recordDiscoveredNotCrawled(remaining.url, 'crawl limit');
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

    const bySource: Record<string, number> = {
      sitemap: 0,
      homepage: 0,
      internal_links: 0,
      javascript_dom: 0,
      canonical: 0,
      other: 0,
    };
    for (const d of discoveredURLs.values()) {
      let src = d.source;
      if (src === 'seed' || src === 'robots') src = 'sitemap';
      else if (src === 'link' || src === 'bundle') src = 'internal_links';
      bySource[src] = (bySource[src] || 0) + 1;
    }

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
      discoveryMetrics: {
        urlsDiscovered: discoveredURLs.size,
        urlsQueued: queuedURLs.size,
        urlsCrawled: pages.length,
        failed: failedURLs.size,
        duplicates: duplicateURLs.size,
        canonicalized: canonicalizedURLs.size,
        bySource,
        discoveredNotCrawled,
      },
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
  ): Promise<{
    page: CrawledPage;
    discovered: Array<{ url: string; source: DiscoverySource }>;
    rendered: boolean;
    externalUrls: string[];
  }> {
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

    const discovered: Array<{ url: string; source: DiscoverySource }> = [];
    const externalUrls: string[] = [];

    if (extracted && robotsDecision?.allowed !== false) {
      const isOriginRoot = isRoot(entry.url);
      const defaultInternalSource: DiscoverySource = isOriginRoot ? 'homepage' : 'internal_links';
      const sourceForHtml = outcome.tier === 'rendered' ? 'javascript_dom' : defaultInternalSource;

      // 1. Internal links from <a> tags
      for (const link of extracted.internalLinks) {
        discovered.push({ url: link.absoluteUrl, source: sourceForHtml });
      }

      // 2. Canonical URL (if points to internal target)
      if (extracted.canonicalUrl) {
        discovered.push({ url: extracted.canonicalUrl, source: 'canonical' });
      }

      // 3. Hreflang URLs
      for (const h of extracted.hreflang) {
        discovered.push({ url: h.href, source: defaultInternalSource });
      }

      // 4. Pagination URLs
      for (const pUrl of extracted.paginationUrls) {
        discovered.push({ url: pUrl, source: defaultInternalSource });
      }

      // 5. Structured Data URLs
      for (const sUrl of extracted.structuredDataUrls) {
        discovered.push({ url: sUrl, source: defaultInternalSource });
      }

      // 6. Redirect destination
      if (outcome.finalUrl && outcome.finalUrl !== entry.url) {
        discovered.push({ url: outcome.finalUrl, source: defaultInternalSource });
      }

      // External links for tracking
      for (const link of extracted.externalLinks) {
        externalUrls.push(link.absoluteUrl);
      }
    }

    return { page, discovered, rendered: outcome.tier === 'rendered', externalUrls };
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
