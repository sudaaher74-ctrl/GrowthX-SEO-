import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResearchSourceType } from '@prisma/client';
import axios from 'axios';
import { RetrievedSource } from './evidence-retrieval.service';

/** One result as Tavily returns it. */
interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string | null;
  score?: number;
  published_date?: string;
}

export interface WebSearchOutcome {
  sources: RetrievedSource[];
  /** Set when no search could run; becomes an evidence gap on the answer. */
  unavailable?: string;
  /** The queries that were actually issued, for the run's progress detail. */
  queriesRun: string[];
}

/**
 * Live web search for market research.
 *
 * Until this existed, `ModelRouterService.supportsWebSearch()` returned false
 * unconditionally and every research run fell back to the client's own crawl.
 * The tab reported that honestly — low confidence, an evidence gap naming the
 * missing web search — but it meant a question about the market was answered
 * from the customer's own website and nothing else. This is the thing that
 * makes Market Research about the market.
 *
 * Tavily rather than a SERP scraper because it returns the page text alongside
 * each result. The pipeline's rule is that only pages actually read may be
 * cited, so a provider returning bare links would need a second fetch of every
 * result before anything became citable — slower, and one more thing to fail.
 *
 * Absent a key this reports itself unavailable and the run continues exactly as
 * it does today, so nothing here can take the product backwards.
 */
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  private readonly ENDPOINT = 'https://api.tavily.com/search';
  private readonly TIMEOUT_MS = 20_000;
  /** Per query. The queries are already narrow; depth beats breadth here. */
  private readonly RESULTS_PER_QUERY = 5;
  /** Across all queries, after de-duplication. Keeps the answer prompt sane. */
  private readonly MAX_SOURCES = 12;
  /** Below this, a news-only pass is topped up from the general index. */
  private readonly MIN_RECENT_RESULTS = 3;
  /** An extract shorter than this is topped up from the full page text. */
  private readonly THIN_EXTRACT = 400;
  /** Per source. The excerpt column stores 2000; this is the working budget. */
  private readonly MAX_EXCERPT = 2000;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  private apiKey(): string | undefined {
    const key = this.config.get<string>('TAVILY_API_KEY')?.trim();
    // A placeholder left in .env.example would otherwise look configured.
    if (!key || key.length < 16 || /^(your_|add-your-|changeme|tvly-xxx)/i.test(key)) return undefined;
    return key;
  }

  /**
   * Runs each planned query and returns what was actually read.
   *
   * Queries run in parallel because they are independent and the run is
   * already the slowest thing on the page. One failing query does not fail the
   * search: partial market evidence beats none, and the answer's evidence gaps
   * carry the shortfall.
   */
  async search(queries: string[], options?: { recentOnly?: boolean }): Promise<WebSearchOutcome> {
    const key = this.apiKey();
    if (!key) {
      return {
        sources: [],
        queriesRun: [],
        unavailable:
          'No web search provider is configured (TAVILY_API_KEY), so no public web sources were retrieved. ' +
          "The answer is based on this client's own data only.",
      };
    }

    const planned = queries.map((q) => q.trim()).filter(Boolean).slice(0, 4);
    if (planned.length === 0) {
      return { sources: [], queriesRun: [], unavailable: 'No search queries were planned for this question.' };
    }

    const topic: 'general' | 'news' = options?.recentOnly ? 'news' : 'general';
    const settled = await Promise.allSettled(planned.map((query) => this.runQuery(key, query, topic)));

    let failures = settled.filter((r) => r.status === 'rejected').length;
    let results = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

    // A 30-day news window on a niche B2B market can return almost nothing —
    // one result, where the general index returns several. Recent evidence is
    // preferred, not required, so a thin news pass is topped up rather than
    // left to stand as the whole answer to "what changed".
    if (topic === 'news' && results.length < this.MIN_RECENT_RESULTS) {
      const broader = await Promise.allSettled(
        planned.map((query) => this.runQuery(key, query, 'general')),
      );
      failures += broader.filter((r) => r.status === 'rejected').length;
      results = [...results, ...broader.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))];
    }

    if (results.length === 0) {
      return {
        sources: [],
        queriesRun: planned,
        unavailable:
          failures === planned.length
            ? 'The web search provider could not be reached, so no public web sources were retrieved.'
            : 'Web search returned no usable results for this question.',
      };
    }

    const sources = this.toSources(results);
    return {
      sources,
      queriesRun: planned,
      unavailable: failures
        ? `${failures} of ${planned.length} web searches failed, so the market evidence is partial.`
        : undefined,
    };
  }

  private async runQuery(key: string, query: string, topic: 'general' | 'news'): Promise<TavilyResult[]> {
    const response = await axios.post<{ results?: TavilyResult[] }>(
      this.ENDPOINT,
      {
        query,
        // `advanced` reads more of each page. The extra latency buys the
        // specification-level detail these answers are judged on.
        search_depth: 'advanced',
        // Up to three relevant passages per page rather than one.
        chunks_per_source: 3,
        max_results: this.RESULTS_PER_QUERY,
        include_answer: false,
        // The excerpt is the evidence a claim is written from, and `content`
        // alone came back as little as 155 characters on real queries — too
        // thin to support a claim. `raw_content` is the whole page, used only
        // to top up a short extract; see `excerptFor`.
        include_raw_content: true,
        ...(topic === 'news' ? { topic: 'news', days: 30 } : {}),
      },
      {
        timeout: this.TIMEOUT_MS,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return Array.isArray(response.data?.results) ? response.data.results : [];
  }

  private excerptFor(result: TavilyResult): string {
    return excerptFor(result, this.THIN_EXTRACT, this.MAX_EXCERPT);
  }

  /** Ranked, de-duplicated, and trimmed to what the answer prompt can hold. */
  private toSources(results: TavilyResult[]): RetrievedSource[] {
    const byUrl = new Map<string, RetrievedSource>();

    for (const result of results) {
      const url = (result.url || '').trim();
      const excerpt = this.excerptFor(result);
      if (!url || !excerpt) continue; // Nothing read means nothing citable.

      // The same page can come back from more than one query; keep the copy
      // the provider scored highest rather than whichever arrived first.
      const score = clamp01(result.score ?? 0.5);
      const existing = byUrl.get(url);
      if (existing && existing.qualityScore >= score) continue;

      byUrl.set(url, {
        type: ResearchSourceType.PUBLIC_WEB,
        url,
        title: (result.title || safeHostname(url) || url).slice(0, 400),
        publisher: safeHostname(url),
        publishedAt: parseDate(result.published_date),
        excerpt: excerpt.slice(0, 2000),
        qualityScore: score,
      });
    }

    return [...byUrl.values()]
      .sort((a, b) => b.qualityScore - a.qualityScore)
      .slice(0, this.MAX_SOURCES);
  }
}

/**
 * The text a claim will be written from.
 *
 * `content` is the passage Tavily selected as relevant to the query, so it is
 * the better evidence and comes first. It is also unreliable in length — real
 * queries returned anywhere from 155 to 2087 characters — and 155 characters
 * does not support a claim. `raw_content` is the whole page from the top,
 * mostly navigation and boilerplate before it reaches anything useful, which
 * is why it tops a thin extract up instead of replacing it.
 */
function excerptFor(result: TavilyResult, thin: number, max: number): string {
  const extract = (result.content || '').trim();
  const page = (result.raw_content || '').trim();

  if (!extract) return page.slice(0, max);
  if (extract.length >= thin || !page) return extract.slice(0, max);

  return `${extract}\n\n${page.slice(0, max - extract.length - 2)}`.slice(0, max);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.max(0, Math.min(1, value));
}

function safeHostname(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
