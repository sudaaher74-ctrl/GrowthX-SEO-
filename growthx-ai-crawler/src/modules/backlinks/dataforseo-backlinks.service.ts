import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';
import { bareDomain } from '../search-intelligence/own-site';

export class DataForSeoBacklinksError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly endpoint?: string,
  ) {
    super(message);
    this.name = 'DataForSeoBacklinksError';
  }
}

export interface DataForSeoBacklinkSummary {
  target: string;
  rank: number;
  backlinks: number;
  crawledPages: number;
  internalLinksCount: number;
  externalLinksCount: number;
  brokenBacklinks: number;
  brokenPages: number;
  referringDomains: number;
  referringMainDomains: number;
  referringIps: number;
  referringSubnets: number;
  referringPages: number;
  dofollow: number;
  nofollow: number;
  referringLinksTld: Record<string, number>;
  referringLinksTypes: Record<string, number>;
  referringLinksAttributes: Record<string, number>;
  referringLinksPlatformTypes: Record<string, number>;
  spamScore: number | null;
  costUsd: number | null;
}

export interface DataForSeoBacklinkItem {
  urlFrom: string;
  urlTo: string;
  domainFrom: string;
  tldFrom: string;
  anchor: string | null;
  textPre: string | null;
  textPost: string | null;
  dofollow: boolean;
  rank: number;
  pageFromRank: number;
  domainFromRank: number;
  spamScore: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  isBroken: boolean;
  isNew: boolean;
  isLost: boolean;
  linkType: string;
}

export interface DataForSeoReferringDomainItem {
  domain: string;
  rank: number;
  backlinks: number;
  dofollowBacklinks: number;
  firstSeen: string | null;
  lostDate: string | null;
  spamScore: number | null;
  brokenBacklinks: number;
  brokenPages: number;
}

export interface DataForSeoAnchorItem {
  anchor: string;
  backlinks: number;
  referringDomains: number;
  referringPages: number;
  firstSeen: string | null;
  lastSeen: string | null;
  spamScore: number | null;
  brokenBacklinks: number;
}

export const DATAFORSEO_NOT_CONFIGURED_MSG =
  'DataForSEO API credentials are not configured. Add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD or DATAFORSEO_AUTH_HEADER to environment variables.';

@Injectable()
export class DataForSeoBacklinksService {
  private readonly logger = new Logger(DataForSeoBacklinksService.name);
  private readonly BASE = 'https://api.dataforseo.com/v3';
  private readonly TIMEOUT_MS = 60_000;
  private readonly MAX_RETRIES = 3;

  constructor(private readonly config: ConfigService) {}

  /**
   * Resolves authentication credentials from environment variables.
   * Supports either Basic Auth credentials (login & password) or direct Base64 Authorization header.
   */
  private getAuth(): { header?: string; auth?: { username: string; password: string } } | null {
    const rawHeader = this.config.get<string>('DATAFORSEO_AUTH_HEADER')?.trim();
    if (rawHeader) {
      const header = rawHeader.startsWith('Basic ') ? rawHeader : `Basic ${rawHeader}`;
      return { header };
    }

    const username = this.config.get<string>('DATAFORSEO_LOGIN')?.trim();
    const password = this.config.get<string>('DATAFORSEO_PASSWORD')?.trim();
    if (username && password && !/^(your_|changeme)/i.test(username)) {
      return { auth: { username, password } };
    }

    return null;
  }

  isConfigured(): boolean {
    return this.getAuth() !== null;
  }

  /**
   * Executes a POST request to DataForSEO with retry logic for 429 rate limits.
   */
  private async executeRequest<T = any>(
    path: string,
    payload: any,
    method: 'POST' | 'GET' = 'POST',
    attempt = 1,
  ): Promise<{ result: T; task?: any; costUsd: number | null }> {
    const authConfig = this.getAuth();
    if (!authConfig) {
      throw new DataForSeoBacklinksError(DATAFORSEO_NOT_CONFIGURED_MSG, 401, path);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authConfig.header) {
      headers['Authorization'] = authConfig.header;
    }

    const axiosConfig: AxiosRequestConfig = {
      timeout: this.TIMEOUT_MS,
      headers,
      validateStatus: () => true,
    };
    if (authConfig.auth) {
      axiosConfig.auth = authConfig.auth;
    }

    let response;
    const url = `${this.BASE}${path}`;

    try {
      if (method === 'GET') {
        response = await axios.get(url, axiosConfig);
      } else {
        response = await axios.post(url, payload, axiosConfig);
      }
    } catch (error: any) {
      throw new DataForSeoBacklinksError(
        `Network error communicating with DataForSEO at ${path}: ${error?.message || 'unknown error'}`,
        500,
        path,
      );
    }

    const body = response.data;
    const httpStatus = response.status;

    // Handle Rate Limiting with exponential backoff
    if (httpStatus === 429 || body?.status_code === 42900) {
      if (attempt < this.MAX_RETRIES) {
        const delayMs = attempt * 1500;
        this.logger.warn(`DataForSEO rate limit reached at ${path}. Retrying in ${delayMs}ms (attempt ${attempt}/${this.MAX_RETRIES})…`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return this.executeRequest<T>(path, payload, method, attempt + 1);
      }
      throw new DataForSeoBacklinksError('DataForSEO rate limit exceeded. Please try again shortly.', 429, path);
    }

    // Specific DataForSEO error statuses
    if (httpStatus === 401 || body?.status_code === 40100) {
      throw new DataForSeoBacklinksError(
        'DataForSEO authentication rejected. Check DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD or DATAFORSEO_AUTH_HEADER.',
        401,
        path,
      );
    }

    if (body?.status_code === 40104) {
      throw new DataForSeoBacklinksError(
        'DataForSEO account verification required. Please complete account verification in the user panel at https://app.dataforseo.com/ to activate Backlinks API access.',
        40104,
        path,
      );
    }

    if (httpStatus === 402 || body?.status_code === 40200) {
      throw new DataForSeoBacklinksError(
        'DataForSEO account has insufficient balance. Please top up your account balance at https://app.dataforseo.com/.',
        402,
        path,
      );
    }

    if (httpStatus >= 400 || (body?.status_code && body.status_code !== 20000)) {
      throw new DataForSeoBacklinksError(
        `DataForSEO API error (${body?.status_code ?? httpStatus}): ${body?.status_message || `HTTP ${httpStatus}`}`,
        body?.status_code ?? httpStatus,
        path,
      );
    }

    const task = body?.tasks?.[0];
    if (!task) {
      throw new DataForSeoBacklinksError(`DataForSEO returned no tasks in response from ${path}.`, 502, path);
    }

    if (task.status_code !== 20000) {
      throw new DataForSeoBacklinksError(
        `DataForSEO task failed (${task.status_code}): ${task.status_message || 'unknown error'}`,
        task.status_code,
        path,
      );
    }

    const costUsd = typeof task.cost === 'number' ? task.cost : typeof body.cost === 'number' ? body.cost : null;
    const result = Array.isArray(task.result) ? task.result[0] : task.result;

    return { result, task, costUsd };
  }

  /**
   * 1. TARGET DOMAIN OVERVIEW
   * Fetches summary metrics for a given domain: total backlinks, referring domains, domain rank, etc.
   * Endpoint: POST /v3/backlinks/summary/live
   */
  async getDomainSummary(
    domain: string,
    options?: { includeSubdomains?: boolean },
  ): Promise<DataForSeoBacklinkSummary> {
    const target = bareDomain(domain) ?? domain;
    const { result, costUsd } = await this.executeRequest('/backlinks/summary/live', [
      {
        target,
        include_subdomains: options?.includeSubdomains ?? true,
      },
    ]);

    const res = result || {};
    const attr = res.referring_links_attributes || {};
    const dofollow = Number(attr.dofollow ?? 0);
    const nofollow = Number(attr.nofollow ?? 0);

    return {
      target,
      rank: Number(res.rank ?? 0),
      backlinks: Number(res.backlinks ?? 0),
      crawledPages: Number(res.crawled_pages ?? 0),
      internalLinksCount: Number(res.internal_links_count ?? 0),
      externalLinksCount: Number(res.external_links_count ?? 0),
      brokenBacklinks: Number(res.broken_backlinks ?? 0),
      brokenPages: Number(res.broken_pages ?? 0),
      referringDomains: Number(res.referring_domains ?? 0),
      referringMainDomains: Number(res.referring_main_domains ?? 0),
      referringIps: Number(res.referring_ips ?? 0),
      referringSubnets: Number(res.referring_subnets ?? 0),
      referringPages: Number(res.referring_pages ?? 0),
      dofollow,
      nofollow,
      referringLinksTld: res.referring_links_tld || {},
      referringLinksTypes: res.referring_links_types || {},
      referringLinksAttributes: res.referring_links_attributes || {},
      referringLinksPlatformTypes: res.referring_links_platform_types || {},
      spamScore: typeof res.backlinks_spam_score === 'number' ? res.backlinks_spam_score : null,
      costUsd,
    };
  }

  /**
   * 2. BACKLINKS LIST
   * Fetches detailed list of backlinks pointing to the target domain.
   * Endpoint: POST /v3/backlinks/backlinks/live
   */
  async getBacklinks(
    domain: string,
    options?: {
      limit?: number;
      offset?: number;
      mode?: 'as_is' | 'one_per_domain';
      orderBy?: string[];
      filters?: any[];
    },
  ): Promise<{ items: DataForSeoBacklinkItem[]; totalCount: number; costUsd: number | null }> {
    const target = bareDomain(domain) ?? domain;
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 1000);
    const offset = Math.max(options?.offset ?? 0, 0);

    const payload: Record<string, any> = {
      target,
      mode: options?.mode ?? 'as_is',
      limit,
      offset,
      order_by: options?.orderBy ?? ['rank,desc'],
    };
    if (options?.filters && options.filters.length > 0) {
      payload.filters = options.filters;
    }

    const { result, costUsd } = await this.executeRequest('/backlinks/backlinks/live', [payload]);
    const itemsRaw = Array.isArray(result?.items) ? result.items : [];
    const totalCount = typeof result?.total_count === 'number' ? result.total_count : itemsRaw.length;

    const items: DataForSeoBacklinkItem[] = itemsRaw.map((b: any) => ({
      urlFrom: String(b.url_from || ''),
      urlTo: String(b.url_to || ''),
      domainFrom: String(b.domain_from || ''),
      tldFrom: String(b.tld_from || ''),
      anchor: b.anchor != null ? String(b.anchor) : null,
      textPre: b.text_pre != null ? String(b.text_pre) : null,
      textPost: b.text_post != null ? String(b.text_post) : null,
      dofollow: Boolean(b.dofollow),
      rank: Number(b.rank ?? 0),
      pageFromRank: Number(b.page_from_rank ?? 0),
      domainFromRank: Number(b.domain_from_rank ?? 0),
      spamScore: typeof b.backlink_spam_score === 'number' ? b.backlink_spam_score : null,
      firstSeen: b.first_seen || null,
      lastSeen: b.last_seen || null,
      isBroken: Boolean(b.is_broken),
      isNew: Boolean(b.is_new),
      isLost: Boolean(b.is_lost),
      linkType: String(b.type || 'anchor'),
    }));

    return { items, totalCount, costUsd };
  }

  /**
   * 3. REFERRING DOMAINS LIST
   * Fetches list of domains referring to target domain.
   * Endpoint: POST /v3/backlinks/referring_domains/live
   */
  async getReferringDomains(
    domain: string,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: string[];
      filters?: any[];
    },
  ): Promise<{ items: DataForSeoReferringDomainItem[]; totalCount: number; costUsd: number | null }> {
    const target = bareDomain(domain) ?? domain;
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 1000);
    const offset = Math.max(options?.offset ?? 0, 0);

    const payload: Record<string, any> = {
      target,
      limit,
      offset,
      order_by: options?.orderBy ?? ['rank,desc'],
    };
    if (options?.filters && options.filters.length > 0) {
      payload.filters = options.filters;
    }

    const { result, costUsd } = await this.executeRequest('/backlinks/referring_domains/live', [payload]);
    const itemsRaw = Array.isArray(result?.items) ? result.items : [];
    const totalCount = typeof result?.total_count === 'number' ? result.total_count : itemsRaw.length;

    const items: DataForSeoReferringDomainItem[] = itemsRaw.map((r: any) => {
      const attr = r.referring_links_attributes || {};
      return {
        domain: String(r.domain || ''),
        rank: Number(r.rank ?? 0),
        backlinks: Number(r.backlinks ?? 0),
        dofollowBacklinks: Number(attr.dofollow ?? 0),
        firstSeen: r.first_seen || null,
        lostDate: r.lost_date || null,
        spamScore: typeof r.backlinks_spam_score === 'number' ? r.backlinks_spam_score : null,
        brokenBacklinks: Number(r.broken_backlinks ?? 0),
        brokenPages: Number(r.broken_pages ?? 0),
      };
    });

    return { items, totalCount, costUsd };
  }

  /**
   * 4. ANCHOR TEXT ANALYSIS
   * Aggregates top anchor texts for target domain.
   * Endpoint: POST /v3/backlinks/anchors/live
   */
  async getAnchors(
    domain: string,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: string[];
    },
  ): Promise<{ items: DataForSeoAnchorItem[]; totalCount: number; costUsd: number | null }> {
    const target = bareDomain(domain) ?? domain;
    const limit = Math.min(Math.max(options?.limit ?? 100, 1), 1000);
    const offset = Math.max(options?.offset ?? 0, 0);

    const payload: Record<string, any> = {
      target,
      limit,
      offset,
      order_by: options?.orderBy ?? ['backlinks,desc'],
    };

    const { result, costUsd } = await this.executeRequest('/backlinks/anchors/live', [payload]);
    const itemsRaw = Array.isArray(result?.items) ? result.items : [];
    const totalCount = typeof result?.total_count === 'number' ? result.total_count : itemsRaw.length;

    const items: DataForSeoAnchorItem[] = itemsRaw.map((a: any) => ({
      anchor: a.anchor ? String(a.anchor) : '<empty / image>',
      backlinks: Number(a.backlinks ?? 0),
      referringDomains: Number(a.referring_domains ?? 0),
      referringPages: Number(a.referring_pages ?? 0),
      firstSeen: a.first_seen || null,
      lastSeen: a.last_seen || null,
      spamScore: typeof a.backlinks_spam_score === 'number' ? a.backlinks_spam_score : null,
      brokenBacklinks: Number(a.broken_backlinks ?? 0),
    }));

    return { items, totalCount, costUsd };
  }

  /**
   * 5. TASK QUEUE PATTERNS (task_post and task_get fallback)
   * Generic task post for high-volume or async queues.
   */
  async postTask(endpoint: string, tasks: any[]): Promise<{ taskId: string; costUsd: number | null }> {
    const cleanEndpoint = endpoint.replace(/^\//, '');
    const { task, result, costUsd } = await this.executeRequest<any>(`/${cleanEndpoint}/task_post`, tasks);
    const taskId = task?.id || result?.id;
    if (!taskId) {
      throw new DataForSeoBacklinksError(`No task ID returned from /${cleanEndpoint}/task_post`, 502);
    }
    return { taskId, costUsd };
  }

  async getTaskResult<T = any>(endpoint: string, taskId: string): Promise<{ result: T; costUsd: number | null }> {
    const cleanEndpoint = endpoint.replace(/^\//, '');
    return this.executeRequest<T>(`/${cleanEndpoint}/task_get/${taskId}`, null, 'GET');
  }
}
