import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { canonicalUrl } from '../crawler/canonical-url';
import { FetcherService } from '../crawler/fetcher.service';
import { NOT_CONFIGURED_MESSAGE, DataForSeoService, OrganicResult } from './dataforseo.service';
import { diagnose, DiagnosisInput, ReadPage } from './diagnosis-rules';
import { onDomain, OwnSite, ownSite } from './own-site';
import { readPage } from './page-reader';
import { RankTrackingService } from './rank-tracking.service';
import { keywordInSearchConsole } from './search-console-facts';
import { classifyPage, containsKeyword, dominantFormat, featureLabel, FORMAT_LABEL, intentFromResults, median } from './serp-analysis';

/** Top-ranking pages read for the comparison. Each is a live fetch. */
const COMPETITOR_PAGES = 5;
const FETCH_TIMEOUT_MS = 25_000;

/**
 * Why a page does or does not rank for a keyword, from evidence.
 *
 * The answer is assembled from what can be observed right now: Google's live
 * results for the keyword, the customer's page and the pages that outrank it
 * (all read the same way, at the same moment), what Search Console recorded
 * for the search, and whether Google has the page indexed. Each reason names
 * the observations it rests on; the confidence says which of these were
 * available and which were not.
 */
@Injectable()
export class KeywordDiagnosisService {
  private readonly logger = new Logger(KeywordDiagnosisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataforseo: DataForSeoService,
    private readonly ranks: RankTrackingService,
    private readonly fetcher: FetcherService,
  ) {}

  async list(projectId: string) {
    const rows = await this.prisma.keywordDiagnosis.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, keyword: true, pageUrl: true, createdAt: true, result: true },
    });
    return rows.map((r) => {
      const result = r.result as any;
      return {
        id: r.id,
        keyword: r.keyword,
        pageUrl: r.pageUrl,
        createdAt: r.createdAt,
        verdictText: result?.verdictText ?? null,
        reasons: Array.isArray(result?.reasons) ? result.reasons.length : 0,
      };
    });
  }

  async get(projectId: string, id: string) {
    const row = await this.prisma.keywordDiagnosis.findFirst({ where: { id, projectId } });
    if (!row) throw new NotFoundException('Diagnosis not found.');
    return { id: row.id, createdAt: row.createdAt, ...(row.result as object) };
  }

  async run(projectId: string, input: { keyword: string; pageUrl?: string }) {
    const keyword = (input.keyword ?? '').trim().replace(/\s+/g, ' ');
    if (keyword.length < 2 || keyword.length > 120) throw new BadRequestException('Type the search you want to rank for (2 to 120 characters).');
    if (!this.dataforseo.isConfigured()) throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);

    const site = await ownSite(this.prisma, projectId);
    if (!site) throw new NotFoundException('Add your website to this project first.');

    const { snapshot, results, market } = await this.ranks.checkKeyword(projectId, keyword);
    const searchConsole = await keywordInSearchConsole(this.prisma, projectId, keyword);

    // The page to diagnose: the one named, else the one Google already
    // associates with the search, else the one ranking for it.
    const pageUrl = input.pageUrl?.trim() || searchConsole?.pages[0]?.url || snapshot.ownUrl || null;
    if (!pageUrl) {
      throw new BadRequestException(
        `None of your pages shows up for "${keyword}" yet, so there is no page to diagnose. Choose the page that should rank for it.`,
      );
    }
    if (!onDomain(pageUrl, site.website.domain)) {
      throw new BadRequestException(`${pageUrl} is not on ${site.website.domain}. Choose one of your own pages.`);
    }

    const top = results.organic.slice(0, 10).map((r) => ({ ...r, format: classifyPage(r.url, r.title) }));
    const rivals = results.organic.filter((r) => !onDomain(r.url, site.website.domain)).slice(0, COMPETITOR_PAGES);

    const [page, competitors, crawlFacts, indexStatus] = await Promise.all([
      this.readOne(pageUrl, keyword, null),
      Promise.all(rivals.map((r) => this.readOne(r.url, keyword, r))),
      this.crawlFacts(site, pageUrl),
      this.prisma.urlIndexInspection.findFirst({
        where: { projectId, url: { in: urlSpellings(pageUrl) }, error: null },
        orderBy: { inspectedAt: 'desc' },
        select: { verdict: true, coverageState: true, inspectedAt: true },
      }),
    ]);

    // Our crawl typed the page more reliably than a URL pattern can.
    if (crawlFacts.pageType) page.format = classifyPage(pageUrl, page.facts?.title ?? null, crawlFacts.pageType);

    const intent = intentFromResults(results.features, top);
    const dominant = dominantFormat(top);
    const ownUrlIsThisPage = Boolean(snapshot.ownUrl && canonicalUrl(snapshot.ownUrl) === canonicalUrl(pageUrl));

    const diagnosisInput: DiagnosisInput = {
      keyword,
      page: { ...page, ...crawlFacts },
      competitors,
      serp: { ownPosition: snapshot.ownPosition, ownUrl: snapshot.ownUrl, features: results.features, top },
      intent,
      dominant,
      searchConsole,
      indexStatus,
      ownUrlIsThisPage,
    };
    const outcome = diagnose(diagnosisInput);

    const read = competitors.filter((c) => c.facts);
    const result = {
      keyword,
      pageUrl,
      market,
      checkedAt: snapshot.checkedAt,
      ...outcome,
      results: {
        position: ownUrlIsThisPage ? snapshot.ownPosition : null,
        otherPageOfYours: !ownUrlIsThisPage && snapshot.ownUrl ? { url: snapshot.ownUrl, position: snapshot.ownPosition } : null,
        intent,
        dominantFormat: dominant,
        features: results.features.map((f) => ({ type: f, label: featureLabel(f) })),
        questions: results.questions,
        top: top.map((r) => ({ position: r.position, url: r.url, domain: r.domain, title: r.title, format: r.format, formatLabel: FORMAT_LABEL[r.format], yours: onDomain(r.url, site.website.domain) })),
      },
      comparison: {
        yours: summarise(page),
        competitors: competitors.map(summarise),
        typical: {
          wordCount: median(read.map((c) => c.facts!.wordCount)),
          keywordInTitle: `${read.filter((c) => c.keywordInTitle).length} of ${read.length}`,
          keywordInHeading: `${read.filter((c) => c.keywordInH1).length} of ${read.length}`,
        },
      },
      searchConsole,
      indexStatus,
      crawl: crawlFacts,
    };

    const saved = await this.prisma.keywordDiagnosis.create({
      data: { projectId, keyword, pageUrl, serpSnapshotId: snapshot.id, result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue },
    });
    this.logger.log(`[${projectId}] Diagnosed "${keyword}" for ${pageUrl}: ${outcome.reasons.length} reason(s), ${outcome.confidence.level} confidence.`);
    return { id: saved.id, createdAt: saved.createdAt, ...result };
  }

  /** Reads one page live, the same way for ours and theirs. */
  private async readOne(url: string, keyword: string, result: OrganicResult | null): Promise<ReadPage> {
    const base: ReadPage = {
      url,
      domain: result?.domain ?? '',
      position: result?.position ?? null,
      statusCode: null,
      error: null,
      facts: null,
      format: classifyPage(url, result?.title ?? null),
      keywordInTitle: false,
      keywordInH1: false,
      keywordInUrl: containsKeyword(pathWords(url), keyword),
      keywordEarly: false,
    };
    try {
      const fetched = await withTimeout(this.fetcher.fetchPage(url), FETCH_TIMEOUT_MS);
      base.statusCode = fetched.statusCode || null;
      if (fetched.errorMessage || !fetched.html) {
        base.error = fetched.errorMessage ?? `HTTP ${fetched.statusCode}, no content`;
        return base;
      }
      if (fetched.statusCode >= 400) {
        base.error = `HTTP ${fetched.statusCode}`;
        return base;
      }
      const facts = readPage(fetched.html);
      base.facts = facts;
      base.format = classifyPage(url, facts.title ?? result?.title ?? null);
      base.keywordInTitle = containsKeyword(facts.title, keyword);
      base.keywordInH1 = facts.h1.some((h) => containsKeyword(h, keyword));
      base.keywordEarly = containsKeyword(facts.opening, keyword);
    } catch (error: any) {
      base.error = error?.message ?? 'Could not read the page';
    }
    return base;
  }

  /** What our last crawl knows about the page and the links pointing to it. */
  private async crawlFacts(site: OwnSite, pageUrl: string) {
    const empty = { inlinks: null, siteMedianInlinks: null, crawledIndexability: null, jsRequired: null, pageType: null as string | null, crawledAt: null as Date | null };
    if (!site.crawl) return empty;
    const spellings = urlSpellings(pageUrl);
    const page = await this.prisma.page.findFirst({
      where: { crawlJobId: site.crawl.id, url: { in: spellings } },
      select: { indexability: true, jsRequired: true, pageType: true, crawledAt: true },
    });
    const edges = await this.prisma.internalGraph.groupBy({
      by: ['targetUrl'],
      where: { crawlJobId: site.crawl.id },
      _count: { _all: true },
    });
    const key = canonicalUrl(pageUrl);
    const inlinks = edges.filter((e) => canonicalUrl(e.targetUrl) === key).reduce((sum, e) => sum + e._count._all, 0);
    return {
      inlinks: page || inlinks > 0 ? inlinks : null,
      siteMedianInlinks: median(edges.map((e) => e._count._all)),
      crawledIndexability: page?.indexability ?? null,
      jsRequired: page?.jsRequired ?? null,
      pageType: page?.pageType ?? null,
      crawledAt: page?.crawledAt ?? null,
    };
  }
}

function summarise(p: ReadPage) {
  return {
    url: p.url,
    domain: p.domain,
    position: p.position,
    read: Boolean(p.facts),
    error: p.error,
    title: p.facts?.title ?? null,
    heading: p.facts?.h1[0] ?? null,
    wordCount: p.facts?.wordCount ?? null,
    subheadings: p.facts?.h2Count ?? null,
    structuredData: p.facts?.schemaTypes ?? [],
    format: p.format,
    formatLabel: FORMAT_LABEL[p.format],
    keywordInTitle: p.keywordInTitle,
    keywordInHeading: p.keywordInH1,
    keywordInAddress: p.keywordInUrl,
    keywordInOpening: p.keywordEarly,
  };
}

/** The spellings a crawl may have stored the same page under. */
export function urlSpellings(url: string): string[] {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    const out = new Set<string>();
    for (const scheme of ['https', 'http']) {
      for (const h of [host, `www.${host}`]) {
        for (const p of [path || '/', `${path}/`]) out.add(`${scheme}://${h}${p}${u.search}`);
      }
    }
    return [...out];
  } catch {
    return [url];
  }
}

function pathWords(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/[-_/.]+/g, ' ');
  } catch {
    return '';
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No answer within ${Math.round(ms / 1000)} seconds`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
