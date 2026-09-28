import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { bareDomain } from './own-site';

/** One organic result, in the order Google showed it. */
export interface OrganicResult {
  /** Position among organic results, 1-based, as Google ranks them. */
  position: number;
  url: string;
  domain: string;
  title: string | null;
  snippet: string | null;
}

export interface GoogleResults {
  keyword: string;
  country: string;
  language: string;
  device: 'desktop' | 'mobile';
  organic: OrganicResult[];
  /** Every result type on the page other than plain organic, e.g. "local_pack". */
  features: string[];
  /** "People also ask" questions, when Google showed them. */
  questions: string[];
  /** Google's estimate of how many results exist, when given. */
  totalResults: number | null;
  costUsd: number | null;
}

export interface RankedKeyword {
  keyword: string;
  /** Average monthly Google searches, as DataForSEO reports it. Null when unknown. */
  searchVolume: number | null;
  position: number;
  url: string | null;
  /** DataForSEO's reading of the intent (informational, commercial, ...), when given. */
  intent: string | null;
}

export interface RankedKeywords {
  domain: string;
  items: RankedKeyword[];
  /** How many keywords the domain ranks for in total, when reported. */
  totalCount: number | null;
  costUsd: number | null;
}

/** Thrown for anything DataForSEO refuses or fails; the message is safe to show. */
export class DataForSeoError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'DataForSeoError';
  }
}

export const NOT_CONFIGURED_MESSAGE =
  'Google results are not connected. Add the DataForSEO login and password (DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD) ' +
  'to the API service settings on Render to turn this on.';

/**
 * Google results and rankings, from DataForSEO.
 *
 * The one source of "who ranks where in Google" the product has. Everything
 * built on it (keyword diagnosis, competitor keyword gaps, rank tracking)
 * reports "not connected" when the credentials are absent rather than
 * approximating Google from a general web search, which ranks differently.
 *
 * Live endpoints only: the answer is needed while the customer waits, and the
 * queued endpoints return minutes later.
 */
@Injectable()
export class DataForSeoService {
  private readonly logger = new Logger(DataForSeoService.name);
  private readonly BASE = 'https://api.dataforseo.com/v3';
  private readonly TIMEOUT_MS = 60_000;

  constructor(private readonly config: ConfigService) {}

  private credentials(): { username: string; password: string } | null {
    const username = this.config.get<string>('DATAFORSEO_LOGIN')?.trim();
    const password = this.config.get<string>('DATAFORSEO_PASSWORD')?.trim();
    if (!username || !password || /^(your_|changeme)/i.test(username)) return null;
    return { username, password };
  }

  isConfigured(): boolean {
    return this.credentials() !== null;
  }

  /**
   * One task, posted the way DataForSEO takes every request (an array of
   * tasks), with both the request-level and the task-level status checked:
   * a 200 response can carry a failed task.
   */
  private async post(path: string, task: Record<string, unknown>): Promise<{ result: any; costUsd: number | null }> {
    const auth = this.credentials();
    if (!auth) throw new DataForSeoError(NOT_CONFIGURED_MESSAGE);

    let response;
    try {
      response = await axios.post(`${this.BASE}${path}`, [task], {
        auth,
        timeout: this.TIMEOUT_MS,
        validateStatus: () => true,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      throw new DataForSeoError(`Could not reach DataForSEO: ${error?.message ?? 'network error'}.`);
    }

    if (response.status === 401) {
      throw new DataForSeoError('DataForSEO refused the login and password. Check DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD (the API credentials, not the account email).', 401);
    }
    if (response.status === 402) {
      throw new DataForSeoError('The DataForSEO account has run out of credit. Top it up to keep checking Google results.', 402);
    }
    const body = response.data;
    if (response.status >= 400 || body?.status_code !== 20000) {
      throw new DataForSeoError(`DataForSEO returned an error: ${body?.status_message ?? `HTTP ${response.status}`}.`, body?.status_code ?? response.status);
    }
    const t = body.tasks?.[0];
    if (!t) throw new DataForSeoError('DataForSEO returned no result for the request.');
    if (t.status_code !== 20000) {
      throw new DataForSeoError(`DataForSEO could not complete the request: ${t.status_message ?? 'unknown reason'}.`, t.status_code);
    }
    const costUsd = typeof t.cost === 'number' ? t.cost : typeof body.cost === 'number' ? body.cost : null;
    return { result: Array.isArray(t.result) ? (t.result[0] ?? null) : null, costUsd };
  }

  /** The live Google results page for one keyword. */
  async googleResults(
    keyword: string,
    options: { country: string; language: string; device?: 'desktop' | 'mobile'; depth?: number },
  ): Promise<GoogleResults> {
    const device = options.device ?? 'desktop';
    const { result, costUsd } = await this.post('/serp/google/organic/live/advanced', {
      keyword,
      location_name: options.country,
      language_code: options.language,
      device,
      depth: options.depth ?? 20,
    });
    return parseGoogleResults(result, { keyword, country: options.country, language: options.language, device, costUsd });
  }

  /** Keywords a domain ranks for in Google's top `maxPosition`, most searched first. */
  async rankedKeywords(
    domain: string,
    options: { country: string; language: string; limit?: number; maxPosition?: number },
  ): Promise<RankedKeywords> {
    const target = bareDomain(domain) ?? domain;
    const { result, costUsd } = await this.post('/dataforseo_labs/google/ranked_keywords/live', {
      target,
      location_name: options.country,
      language_code: options.language,
      item_types: ['organic'],
      limit: Math.min(options.limit ?? 300, 1000),
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
      filters: [['ranked_serp_element.serp_item.rank_group', '<=', options.maxPosition ?? 20]],
    });
    return parseRankedKeywords(result, target, costUsd);
  }
}

/** Reads a SERP result defensively: every field is optional on DataForSEO's side. */
export function parseGoogleResults(
  result: any,
  meta: { keyword: string; country: string; language: string; device: 'desktop' | 'mobile'; costUsd: number | null },
): GoogleResults {
  const items: any[] = Array.isArray(result?.items) ? result.items : [];
  const organic: OrganicResult[] = [];
  const features = new Set<string>();
  const questions: string[] = [];

  for (const item of items) {
    const type = String(item?.type ?? '');
    if (type === 'organic') {
      const url = typeof item.url === 'string' ? item.url : null;
      if (!url) continue;
      organic.push({
        position: Number(item.rank_group) || organic.length + 1,
        url,
        domain: bareDomain(item.domain ?? url) ?? '',
        title: item.title ?? null,
        snippet: item.description ?? null,
      });
      continue;
    }
    if (type) features.add(type);
    if (type === 'people_also_ask' && Array.isArray(item.items)) {
      for (const q of item.items) if (q?.title) questions.push(String(q.title));
    }
  }
  // item_types lists every type present, including ones beyond the depth read.
  for (const type of Array.isArray(result?.item_types) ? result.item_types : []) {
    if (type && type !== 'organic') features.add(String(type));
  }

  organic.sort((a, b) => a.position - b.position);
  return {
    keyword: meta.keyword,
    country: meta.country,
    language: meta.language,
    device: meta.device,
    organic,
    features: [...features],
    questions: questions.slice(0, 8),
    totalResults: typeof result?.se_results_count === 'number' ? result.se_results_count : null,
    costUsd: meta.costUsd,
  };
}

export function parseRankedKeywords(result: any, domain: string, costUsd: number | null): RankedKeywords {
  const items: any[] = Array.isArray(result?.items) ? result.items : [];
  const out: RankedKeyword[] = [];
  for (const item of items) {
    const keyword = item?.keyword_data?.keyword;
    const serp = item?.ranked_serp_element?.serp_item;
    const position = Number(serp?.rank_group);
    if (!keyword || !Number.isFinite(position) || position <= 0) continue;
    const volume = item?.keyword_data?.keyword_info?.search_volume;
    out.push({
      keyword: String(keyword),
      searchVolume: typeof volume === 'number' ? volume : null,
      position,
      url: serp?.url ?? null,
      intent: item?.keyword_data?.search_intent_info?.main_intent ?? null,
    });
  }
  return { domain, items: out, totalCount: typeof result?.total_count === 'number' ? result.total_count : null, costUsd };
}
