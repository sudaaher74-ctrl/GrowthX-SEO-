import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as zlib from 'zlib';
import * as cheerio from 'cheerio';
import { parseRobotsTxt, ParsedRobots, isAllowedByRobots, selectGroup } from './robots-txt';
import { parseSitemapXml, SitemapEntry } from './sitemap-parser';
import { normalizeUrl } from '../url/url-normalizer';
import { registrableDomain, sameRegistrableDomain } from '../url/registrable-domain';
import { DEFAULT_CHROME_UA } from '../fetch/browser-pool.service';
import { deadlineSignal } from '../fetch/http-deadline';
import { extractUrlsFromJsonLd } from '../page-extract';

export type DiscoverySource =
  | 'seed'
  | 'sitemap'
  | 'homepage'
  | 'internal_links'
  | 'javascript_dom'
  | 'canonical'
  | 'other'
  | 'link'
  | 'bundle'
  | 'robots';

export interface DiscoveredUrl {
  url: string;
  normalizedUrl: string;
  source: DiscoverySource;
  /** The sitemap or page this URL was found in. */
  foundIn?: string;
}

export interface SitemapFinding {
  kind: 'WRONG_DOMAIN' | 'UNREACHABLE' | 'NOT_A_SITEMAP' | 'EMPTY';
  sitemapUrl: string;
  evidence: string;
  /** Sample of the offending URLs, for the issue's evidence. */
  sampleUrls?: string[];
  foreignDomain?: string;
}

export interface DiscoveryResult {
  urls: DiscoveredUrl[];
  robots?: ParsedRobots;
  robotsFetched: boolean;
  crawlDelayMs?: number;
  sitemapsFetched: string[];
  sitemapEntries: SitemapEntry[];
  /** Sitemap URLs that are not on the crawl target's registrable domain. */
  foreignSitemapUrls: string[];
  findings: SitemapFinding[];
}

/** Tried in order when robots.txt declares no sitemap. */
const FALLBACK_SITEMAP_PATHS = [
  '/sitemap.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/wp-sitemap.xml',
  '/sitemap/sitemap.xml',
  '/sitemap/index.xml',
];

const DEFAULT_MAX_INDEX_DEPTH = 3;

/**
 * Seeds the frontier from every source a site offers, not just its links.
 *
 * The previous crawler did parse the sitemap, but nothing compared the URLs it
 * returned to the site being crawled. On dronaarchery.com the sitemap lists
 * five URLs on `deonaarcheryacademy.com`, which does not resolve; all five were
 * enqueued, all five failed DNS, and the crawl reported "sitemap found" and
 * finished with one page. The union here exists so that no single broken source
 * can end a crawl, and the findings exist so that a broken one is reported
 * rather than absorbed.
 */
@Injectable()
export class DiscoveryService {
  private readonly logger = new Logger(DiscoveryService.name);

  get userAgentToken(): string {
    return process.env.CRAWLER_UA_TOKEN || 'GrowthXBot';
  }

  private get httpHeaders(): Record<string, string> {
    return {
      'User-Agent': process.env.CRAWLER_USER_AGENT || DEFAULT_CHROME_UA,
      Accept: 'application/xml, text/xml, text/plain, */*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
    };
  }

  /** Reads and parses robots.txt. Returns undefined when it could not be read. */
  async fetchRobots(origin: string): Promise<ParsedRobots | undefined> {
    const robotsUrl = new URL('/robots.txt', origin).toString();
    const robotsTimeout = Number(process.env.ROBOTS_TIMEOUT_MS || 10000);
    try {
      const response = await axios.get(robotsUrl, {
        headers: this.httpHeaders,
        timeout: robotsTimeout,
        signal: deadlineSignal(robotsTimeout),
        validateStatus: () => true,
        responseType: 'text',
        transitional: { silentJSONParsing: false, forcedJSONParsing: false, clarifyTimeoutError: true },
      });
      if (response.status !== 200 || typeof response.data !== 'string') {
        // An absent robots.txt is an allow-all, and saying so explicitly is
        // different from failing to read one.
        this.logger.debug(`No robots.txt at ${robotsUrl} (HTTP ${response.status}).`);
        return { groups: [], sitemaps: [], raw: '' };
      }
      return parseRobotsTxt(response.data);
    } catch (err) {
      this.logger.warn(`robots.txt at ${robotsUrl} could not be read: ${(err as Error).message}`);
      return undefined;
    }
  }

  isAllowed(robots: ParsedRobots | undefined, targetUrl: string): { allowed: boolean; evidence: string } | undefined {
    if (!robots) return undefined;
    return isAllowedByRobots(robots, this.userAgentToken, targetUrl);
  }

  /**
   * Fetches one sitemap document, transparently ungzipping a `.xml.gz`.
   *
   * Read as bytes rather than text because that is the only way to tell a
   * gzipped body from one that merely claims to be: plenty of hosts serve
   * `.xml.gz` with `content-type: application/xml` and no `content-encoding`,
   * and plenty serve a plain `.xml` under a `.gz` name. The magic number
   * decides.
   */
  private async fetchSitemapDocument(sitemapUrl: string): Promise<{ status: number; xml?: string; error?: string }> {
    const sitemapTimeout = Number(process.env.SITEMAP_TIMEOUT_MS || 15000);
    try {
      const response = await axios.get(sitemapUrl, {
        headers: this.httpHeaders,
        timeout: sitemapTimeout,
        signal: deadlineSignal(sitemapTimeout),
        validateStatus: () => true,
        responseType: 'arraybuffer',
        decompress: true,
        maxContentLength: Number(process.env.MAX_SITEMAP_BYTES || 50 * 1024 * 1024),
      });
      if (response.status !== 200) return { status: response.status };

      let buffer = Buffer.from(response.data as ArrayBuffer);
      if (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
        try {
          buffer = zlib.gunzipSync(buffer);
        } catch (err) {
          return { status: response.status, error: `gzip could not be decoded: ${(err as Error).message}` };
        }
      }
      return { status: response.status, xml: buffer.toString('utf8') };
    } catch (err) {
      return { status: 0, error: (err as Error).message };
    }
  }

  /**
   * Walks a sitemap tree, following index files up to `maxDepth` levels.
   *
   * Every document fetched is recorded whether or not it yielded URLs, and a
   * sitemap that is unreachable or is not XML becomes a finding. Silence about
   * a broken sitemap is what let a crawl end at one page while reporting that
   * a sitemap had been found.
   */
  private async walkSitemap(
    sitemapUrl: string,
    crawlOrigin: string,
    visited: Set<string>,
    result: DiscoveryResult,
    depth: number,
    maxDepth: number,
  ): Promise<void> {
    if (depth > maxDepth || visited.has(sitemapUrl)) return;
    visited.add(sitemapUrl);

    const doc = await this.fetchSitemapDocument(sitemapUrl);
    if (doc.status !== 200 || !doc.xml) {
      result.findings.push({
        kind: 'UNREACHABLE',
        sitemapUrl,
        evidence: doc.error ? `${sitemapUrl} could not be fetched: ${doc.error}` : `${sitemapUrl} returned HTTP ${doc.status}`,
      });
      return;
    }

    const parsed = parseSitemapXml(doc.xml);
    if (parsed.kind === 'unknown') {
      result.findings.push({
        kind: 'NOT_A_SITEMAP',
        sitemapUrl,
        evidence: `${sitemapUrl} returned 200 but is neither a <urlset> nor a <sitemapindex>. First 120 bytes: ${doc.xml.slice(0, 120).replace(/\s+/g, ' ')}`,
      });
      return;
    }

    result.sitemapsFetched.push(sitemapUrl);

    if (parsed.kind === 'index') {
      if (parsed.children.length === 0) {
        result.findings.push({ kind: 'EMPTY', sitemapUrl, evidence: `${sitemapUrl} is a sitemap index containing no <sitemap> entries.` });
      }
      for (const child of parsed.children) {
        await this.walkSitemap(child, crawlOrigin, visited, result, depth + 1, maxDepth);
      }
      return;
    }

    if (parsed.entries.length === 0) {
      result.findings.push({ kind: 'EMPTY', sitemapUrl, evidence: `${sitemapUrl} is a <urlset> containing no <url> entries.` });
      return;
    }

    const foreign: string[] = [];
    for (const entry of parsed.entries) {
      result.sitemapEntries.push(entry);

      // hreflang alternates are real, crawlable URLs and belong in the frontier.
      const candidates = [entry.loc, ...(entry.alternates || []).map((a) => a.href)];
      for (const candidate of candidates) {
        if (!sameRegistrableDomain(candidate, crawlOrigin)) {
          foreign.push(candidate);
          continue;
        }
        const normalized = normalizeUrl(candidate);
        if (normalized) {
          result.urls.push({ url: candidate, normalizedUrl: normalized, source: 'sitemap', foundIn: sitemapUrl });
        }
      }
    }

    if (foreign.length > 0) {
      result.foreignSitemapUrls.push(...foreign);
      result.findings.push({
        kind: 'WRONG_DOMAIN',
        sitemapUrl,
        foreignDomain: registrableDomain(foreign[0]),
        sampleUrls: foreign.slice(0, 5),
        evidence:
          `${foreign.length} of ${parsed.entries.length} URLs in ${sitemapUrl} are on ${registrableDomain(foreign[0])}, ` +
          `not ${registrableDomain(crawlOrigin)}. For example: ${foreign.slice(0, 3).join(', ')}`,
      });
    }
  }

  /**
   * Every URL the site tells us about, before a single page is fetched.
   *
   * The start URL is always included, so a site whose robots.txt and sitemap
   * are both broken still gets crawled from its homepage.
   */
  async discoverSeeds(startUrl: string, options: { useSitemap?: boolean; maxIndexDepth?: number } = {}): Promise<DiscoveryResult> {
    const origin = new URL(startUrl).origin;
    const result: DiscoveryResult = {
      urls: [],
      robotsFetched: false,
      sitemapsFetched: [],
      sitemapEntries: [],
      foreignSitemapUrls: [],
      findings: [],
    };

    const startNormalized = normalizeUrl(startUrl);
    if (startNormalized) {
      result.urls.push({ url: startUrl, normalizedUrl: startNormalized, source: 'seed' });
    }

    const robots = await this.fetchRobots(origin);
    result.robots = robots;
    result.robotsFetched = robots !== undefined;
    if (robots) {
      result.crawlDelayMs = selectGroup(robots, this.userAgentToken)?.crawlDelayMs;
    }

    if (options.useSitemap === false) return result;

    // Declared sitemaps first, then the conventional paths. Both are tried:
    // a declared sitemap on the wrong domain is precisely the case where the
    // fallbacks are the only thing that saves the crawl.
    const candidates: string[] = [];
    for (const declared of robots?.sitemaps || []) {
      // Raised from the declaration itself, before a request is made. A
      // sitemap declared on a domain that does not resolve cannot be fetched,
      // so waiting for the fetch to fail would report it as merely unreachable
      // and lose the actual finding: robots.txt is pointing somewhere else.
      if (!sameRegistrableDomain(declared, origin)) {
        result.findings.push({
          kind: 'WRONG_DOMAIN',
          sitemapUrl: declared,
          foreignDomain: registrableDomain(declared),
          sampleUrls: [declared],
          evidence:
            `robots.txt at ${origin}/robots.txt declares "Sitemap: ${declared}", which is on ` +
            `${registrableDomain(declared)} rather than ${registrableDomain(origin)}.`,
        });
      }
      candidates.push(declared);
    }
    for (const path of FALLBACK_SITEMAP_PATHS) {
      const candidate = new URL(path, origin).toString();
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }

    const visited = new Set<string>();
    const maxDepth = options.maxIndexDepth ?? Number(process.env.MAX_SITEMAP_INDEX_DEPTH || DEFAULT_MAX_INDEX_DEPTH);
    for (const candidate of candidates) {
      await this.walkSitemap(candidate, origin, visited, result, 0, maxDepth);
    }

    // A fallback path that simply is not there is not a finding; only a
    // declared sitemap that fails is. Otherwise every site without a
    // /wp-sitemap.xml collects four spurious issues.
    const declared = new Set(robots?.sitemaps || []);
    result.findings = result.findings.filter((f) => f.kind !== 'UNREACHABLE' || declared.has(f.sitemapUrl) || result.sitemapsFetched.length === 0);

    return result;
  }

  /**
   * Links from a rendered page: anchors, rel=next/prev/canonical/alternate,
   * JSON-LD structured data, and hrefs embedded in inline scripts/JSON.
   */
  extractLinks(html: string, pageUrl: string, defaultSource?: DiscoverySource): DiscoveredUrl[] {
    const $ = cheerio.load(html || '');
    const found = new Map<string, DiscoveredUrl>();

    const isHomepage = (() => {
      try {
        const u = new URL(pageUrl);
        return u.pathname === '/' || u.pathname === '';
      } catch {
        return false;
      }
    })();

    const linkSource: DiscoverySource = defaultSource || (isHomepage ? 'homepage' : 'internal_links');

    const add = (href: string | undefined, source: DiscoverySource) => {
      if (!href) return;
      const normalized = normalizeUrl(href, { base: pageUrl });
      if (!normalized || !sameRegistrableDomain(normalized, pageUrl)) return;
      if (!found.has(normalized)) {
        found.set(normalized, { url: normalized, normalizedUrl: normalized, source, foundIn: pageUrl });
      }
    };

    $('a[href]').each((_, el) => add($(el).attr('href'), linkSource));
    $('link[rel]').each((_, el) => {
      const rel = ($(el).attr('rel') || '').toLowerCase();
      if (['next', 'prev', 'previous', 'alternate'].includes(rel)) {
        add($(el).attr('href'), linkSource);
      } else if (rel === 'canonical') {
        add($(el).attr('href'), 'canonical');
      }
    });

    // Next.js ships its route data in a JSON island; a route named there is a
    // page, and on an app that renders its navigation client-side it may be the
    // only place the route appears at all.
    $('script[type="application/json"], script#__NEXT_DATA__').each((_, el) => {
      const raw = $(el).html();
      if (!raw || raw.length > 2_000_000) return;
      for (const match of raw.matchAll(/"(\/(?!\/)[A-Za-z0-9._~\-/]*)"/g)) {
        add(match[1], linkSource);
      }
    });

    // Extract URLs from JSON-LD structured data
    const jsonLd: unknown[] = [];
    $('script[type="application/ld+json" i]').each((_, el) => {
      const raw = $(el).html();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw.trim());
        if (Array.isArray(parsed)) jsonLd.push(...parsed);
        else jsonLd.push(parsed);
      } catch {}
    });
    for (const jsonUrl of extractUrlsFromJsonLd(jsonLd, pageUrl)) {
      add(jsonUrl, linkSource);
    }

    return [...found.values()];
  }

  /**
   * Routes read out of a JavaScript bundle, for an app that renders its own
   * navigation.
   *
   * Best-effort by nature, and marked `bundle` so nothing downstream mistakes a
   * guess for a fact. Every candidate must be verified with a real fetch before
   * it is trusted — a minifier's string table contains a great many things that
   * look like paths and are not.
   */
  async discoverBundleRoutes(origin: string, html: string): Promise<DiscoveredUrl[]> {
    const $ = cheerio.load(html || '');
    const scripts: string[] = [];
    $('script[src]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) scripts.push(new URL(src, origin).toString());
    });

    const candidates = new Set<string>();

    // Next.js publishes its route table verbatim.
    const buildManifest = scripts.find((s) => /_buildManifest\.js$/.test(s));
    if (buildManifest) {
      const body = await this.fetchText(buildManifest);
      if (body) {
        for (const match of body.matchAll(/"(\/[A-Za-z0-9._~\-/[\]]*)"\s*:/g)) {
          const route = match[1];
          // Dynamic segments cannot be fetched as written.
          if (!route.includes('[')) candidates.add(route);
        }
      }
    }

    // React Router and friends: path string literals in the main bundle.
    for (const script of scripts.filter((s) => !/_buildManifest\.js$/.test(s)).slice(0, 3)) {
      const body = await this.fetchText(script);
      if (!body) continue;
      for (const match of body.matchAll(/path\s*:\s*["'](\/[A-Za-z0-9._~\-/]*)["']/g)) {
        candidates.add(match[1]);
      }
      for (const match of body.matchAll(/(?:to|href)\s*:\s*["'](\/[A-Za-z0-9._~\-/]{2,})["']/g)) {
        candidates.add(match[1]);
      }
    }

    const verified: DiscoveredUrl[] = [];
    for (const route of [...candidates].slice(0, Number(process.env.MAX_BUNDLE_ROUTES || 50))) {
      if (/\.(js|css|map|png|jpe?g|svg|webp|ico|woff2?|json)$/i.test(route)) continue;
      const absolute = new URL(route, origin).toString();
      const normalized = normalizeUrl(absolute);
      if (!normalized) continue;
      if (await this.urlResponds(absolute)) {
        verified.push({ url: absolute, normalizedUrl: normalized, source: 'bundle', foundIn: 'javascript bundle' });
      }
    }
    return verified;
  }

  private async fetchText(url: string): Promise<string | undefined> {
    try {
      const response = await axios.get(url, {
        headers: this.httpHeaders,
        timeout: 15000,
        signal: deadlineSignal(15000),
        validateStatus: () => true,
        responseType: 'text',
        transitional: { silentJSONParsing: false, forcedJSONParsing: false, clarifyTimeoutError: true },
        maxContentLength: Number(process.env.MAX_BUNDLE_BYTES || 8 * 1024 * 1024),
      });
      return response.status === 200 && typeof response.data === 'string' ? response.data : undefined;
    } catch {
      return undefined;
    }
  }

  /** A HEAD, falling back to a GET for hosts that refuse HEAD. */
  private async urlResponds(url: string): Promise<boolean> {
    for (const method of ['head', 'get'] as const) {
      try {
        const response = await axios.request({
          url,
          method,
          headers: this.httpHeaders,
          timeout: 10000,
          signal: deadlineSignal(10000),
          validateStatus: () => true,
          maxRedirects: 3,
          responseType: 'text',
        });
        if (response.status >= 200 && response.status < 300) return true;
        if (response.status === 405 || response.status === 501) continue;
        return false;
      } catch {
        continue;
      }
    }
    return false;
  }
}
