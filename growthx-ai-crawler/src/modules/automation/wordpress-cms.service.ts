import { BadRequestException, forwardRef, Inject, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { AutomationRunKind, AutomationRunStatus } from '@prisma/client';
import * as cheerio from 'cheerio';
import { PrismaService } from '../../database/prisma.service';
import { SecurityService } from '../security/security.service';
import {
  assertPublicUrl,
  CrossOriginRedirectBlockedError,
  HttpsDowngradeBlockedError,
  ResponseTooLargeError,
  safePublicFetch,
  SafePublicResponse,
  SsrfBlockedError,
} from '../security/ssrf';
import { VerificationEngineService } from '../crawler/verification-engine.service';
import { FetchService } from '../crawler/fetch/fetch.service';
import { FindingSyncService } from '../opportunities/finding-sync.service';

export interface ConnectWordPressInput {
  siteUrl: string;
  username: string;
  appPassword: string;
  seoPlugin?: 'yoast' | 'rankmath' | 'aioseo' | 'core';
}

export interface StageWordPressFixInput {
  findingId?: string;
  targetUrl: string;
  field: string;
  beforeValue?: string;
  afterValue: string;
  findingTitle?: string;
  publishMode?: 'draft' | 'publish';
}

export interface VerifyManualCmsFixInput {
  findingId?: string;
  targetUrl: string;
  field: string;
  beforeValue?: string;
  expectedAfterValue: string;
  findingTitle?: string;
  platform?: string;
}

/**
 * What `finalizeCmsFixVerification` must prove before a CMS fix is called
 * verified: the exact field that changed, as observed on the live page.
 */
export interface CmsVerifyOptions {
  field: string;
  expected: string;
  /** When set, a passing check records the VERIFIED_LIVE snapshot and ledger event. */
  runId?: string;
  actor?: string;
  pullRequestUrl?: string;
}

export interface ConnectShopifyInput {
  shopDomain: string;
  accessToken: string;
}

export interface ConnectWebflowInput {
  siteId: string;
  apiToken: string;
  siteUrl?: string;
}

@Injectable()
export class WordPressCmsService {
  private readonly logger = new Logger(WordPressCmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
    @Optional() private readonly verificationEngine?: VerificationEngineService,
    @Optional() @Inject(forwardRef(() => FindingSyncService)) private readonly findingSync?: FindingSyncService,
    @Optional() private readonly fetchService?: FetchService,
  ) {}

  /**
   * Checks ONE field on the live page: the exact title/description, or the
   * JSON-LD types, that the fix was meant to put there. A 200 response or a
   * substring somewhere in the body is never enough. Conflicting duplicate
   * tags are reported as a failure, not resolved in the fix's favour.
   * `supported: false` means no safe assertion exists, so the fix stays unverified.
   */
  async liveFieldCheck(
    targetUrl: string,
    field: string,
    expected: string,
  ): Promise<{ supported: boolean; passed: boolean; observed: string }> {
    const f = (field || '').toUpperCase();
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const wanted = norm(expected || '');
    const supported = (f === 'META_TITLE' || f === 'META_DESCRIPTION' || f.includes('SCHEMA')) && Boolean(wanted);
    if (!supported) {
      return { supported: false, passed: false, observed: 'No fix-specific live assertion exists for this field.' };
    }

    let html = '';
    try {
      if (this.fetchService) {
        const outcome = await this.fetchService.fetch(targetUrl, { renderAllowed: true });
        if (outcome.error || !outcome.html) {
          return { supported: true, passed: false, observed: outcome.error?.message || 'Live page returned no HTML.' };
        }
        if (typeof outcome.statusCode !== 'number' || outcome.statusCode < 200 || outcome.statusCode >= 300) {
          return { supported: true, passed: false, observed: `Live page returned HTTP ${outcome.statusCode ?? 'none'}.` };
        }
        if (outcome.renderUnavailable) {
          return { supported: true, passed: false, observed: 'The page could not be rendered, so the live result is unknown.' };
        }
        html = outcome.html;
      } else {
        const res = await this.safeFetch(
          targetUrl,
          { method: 'GET', headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Reigel-SEO-Verifier/1.0' } },
          15000,
        );
        if (!res.ok) return { supported: true, passed: false, observed: `Live page returned HTTP ${res.status}.` };
        html = (await res.text()).slice(0, 2_000_000);
      }
    } catch (err: any) {
      return { supported: true, passed: false, observed: `Live check failed: ${err?.message || 'fetch error'}` };
    }

    const $ = cheerio.load(html);
    if (f === 'META_TITLE') {
      const titles = $('title').map((_, el) => norm($(el).text())).get().filter(Boolean);
      if (titles.length > 1) return { supported: true, passed: false, observed: `Conflicting <title> tags (${titles.length}): ${titles.join(' | ')}` };
      return { supported: true, passed: titles[0] === wanted, observed: titles[0] || 'Missing <title>' };
    }
    if (f === 'META_DESCRIPTION') {
      const descriptions = $('meta[name]')
        .filter((_, el) => ($(el).attr('name') || '').trim().toLowerCase() === 'description')
        .map((_, el) => norm($(el).attr('content') || ''))
        .get()
        .filter(Boolean);
      if (descriptions.length > 1) return { supported: true, passed: false, observed: `Conflicting meta descriptions (${descriptions.length})` };
      return { supported: true, passed: descriptions[0] === wanted, observed: descriptions[0] || 'Missing meta description' };
    }

    // Schema: every @type in the proposed JSON-LD must exist in a parseable live block.
    const typesOf = (raw: string): string[] => {
      const out = new Set<string>();
      const walk = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) return node.forEach(walk);
        const obj = node as Record<string, unknown>;
        const t = obj['@type'];
        if (typeof t === 'string') out.add(t);
        if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && out.add(x));
        if (Array.isArray(obj['@graph'])) walk(obj['@graph']);
      };
      try {
        walk(JSON.parse(raw));
      } catch {
        /* malformed JSON-LD proves nothing */
      }
      return [...out];
    };
    const expectedTypes = typesOf(expected);
    if (expectedTypes.length === 0) {
      return { supported: false, passed: false, observed: 'The proposed schema has no parseable @type to verify.' };
    }
    const liveTypes = new Set<string>();
    $('script[type="application/ld+json"]').each((_, el) => typesOf($(el).html() || '').forEach((t) => liveTypes.add(t)));
    const missing = expectedTypes.filter((t) => !liveTypes.has(t));
    return {
      supported: true,
      passed: missing.length === 0,
      observed: liveTypes.size ? `Live JSON-LD types: ${[...liveTypes].join(', ')}` : 'No valid JSON-LD found',
    };
  }

  /**
   * Updates the linked GrowthOpportunity / SavedPlan status honestly and syncs
   * Fix Engine. A fix is VERIFIED only when a live check of the exact changed
   * field passed. No check, an unsupported field, an error, or a failed assertion
   * all leave it VERIFYING — never the other way round.
   */
  private async finalizeCmsFixVerification(
    projectId: string,
    targetUrl: string,
    findingId?: string,
    publishMode: 'draft' | 'publish' = 'publish',
    opts?: CmsVerifyOptions,
  ): Promise<'VERIFIED' | 'VERIFYING'> {
    if (publishMode !== 'publish') {
      if (findingId && this.prisma.growthOpportunity?.update) {
        await this.prisma.growthOpportunity
          .update({ where: { id: findingId }, data: { lifecycle: 'VERIFYING' } })
          .catch(() => null);
      }
      return 'VERIFYING';
    }

    let verifiedLive = false;
    let checkObserved = '';
    if (opts) {
      const check = await this.liveFieldCheck(targetUrl, opts.field, opts.expected);
      verifiedLive = check.supported && check.passed;
      checkObserved = check.observed;
      if (!verifiedLive) {
        this.logger.warn(`[${projectId}] ${opts.field} on ${targetUrl} not verified live: ${check.observed}`);
      }
    }

    const now = new Date();
    const lifecycle: 'VERIFIED' | 'VERIFYING' = verifiedLive ? 'VERIFIED' : 'VERIFYING';

    // The VERIFIED_LIVE proof is written only AFTER the live check passed.
    if (verifiedLive && opts?.runId) {
      try {
        await this.prisma.fixSnapshot.create({
          data: {
            projectId,
            automationRunId: opts.runId,
            url: targetUrl,
            snapshotType: 'VERIFIED_LIVE',
            contentSnippet: opts.expected,
            capturedAt: now,
          },
        });
        await this.prisma.fixImpactLedgerEvent.create({
          data: {
            projectId,
            automationRunId: opts.runId,
            eventType: 'DEPLOYMENT_VERIFIED',
            title: `Live Change Verified: ${opts.field}`,
            description: `Live page check confirmed ${opts.field} on ${targetUrl}.`,
            actor: opts.actor || 'CMS_AGENT',
            affectedUrl: targetUrl,
            pullRequestUrl: opts.pullRequestUrl,
            verificationStatus: 'VERIFIED_LIVE',
            evidenceData: { field: opts.field, observed: checkObserved.slice(0, 300) },
          },
        });
      } catch (err) {
        this.logger.warn(`[${projectId}] Could not record verified-live proof: ${(err as Error).message}`);
      }
    }

    if (findingId && this.prisma.growthOpportunity?.update) {
      await this.prisma.growthOpportunity
        .update({
          where: { id: findingId },
          data: verifiedLive
            ? { lifecycle: 'VERIFIED', status: 'RESOLVED', resolvedAt: now, lastTransitionAt: now }
            : { lifecycle: 'VERIFYING', lastTransitionAt: now },
        })
        .catch(() => null);
    }

    if (verifiedLive && this.prisma.savedPlan?.updateMany) {
      await this.prisma.savedPlan
        .updateMany({
          where: { projectId, status: { in: ['STAGED', 'APPROVED'] }, affectedUrl: targetUrl },
          data: { status: 'EXECUTED' },
        })
        .catch(() => null);
    }

    if (this.findingSync) {
      await this.findingSync.syncProject(projectId, { sources: ['WEBSITE'] }).catch((err) => {
        this.logger.warn(`[${projectId}] Post-CMS finding sync failed: ${(err as Error).message}`);
      });
    }

    return lifecycle;
  }

  private normalizeSiteUrl(rawUrl: string, options: { requireHttps?: boolean } = {}): string {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Site URL is required.');
    }
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
      parsed = new URL(withProtocol);
    } catch {
      throw new BadRequestException('Enter a valid site URL.');
    }
    if (options.requireHttps) {
      if (parsed.protocol !== 'https:') {
        throw new BadRequestException('HTTPS is required before CMS credentials can be sent.');
      }
    } else if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http:// and https:// site URLs are supported.');
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException('Do not embed credentials inside the site URL.');
    }
    try {
      assertPublicUrl(parsed.toString());
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    // Strip /wp-admin or /wp-login.php if the user pasted their admin URL
    const cleanPath = parsed.pathname
      .replace(/\/wp-admin(\/.*)?$/i, '')
      .replace(/\/wp-login\.php$/i, '')
      .replace(/\/+$/, '');
    return `${parsed.origin}${cleanPath}`;
  }

  /**
   * Ensures a stored or user-supplied Shopify Admin API target is strictly an
   * HTTPS `*.myshopify.com` origin (no custom storefronts that might redirect
   * and disclose `X-Shopify-Access-Token`).
   */
  private assertShopifyAdminOrigin(rawDomainOrUrl: string): string {
    const trimmed = (rawDomainOrUrl || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Shopify store domain (e.g. store.myshopify.com) is required.');
    }
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
      parsed = new URL(withScheme);
    } catch {
      throw new BadRequestException('Enter a valid Shopify myshopify.com domain.');
    }
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Shopify Admin API requests require HTTPS.');
    }
    if (parsed.username || parsed.password || parsed.port) {
      throw new BadRequestException('Shopify store domain must not include credentials or custom ports.');
    }
    const host = parsed.hostname.toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.myshopify\.com$/i.test(host)) {
      throw new BadRequestException(
        'Use your verified Shopify admin domain ending in .myshopify.com (for example, your-store.myshopify.com).',
      );
    }
    try {
      assertPublicUrl(`https://${host}`);
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    return `https://${host}`;
  }

  /**
   * Enforces HTTPS on WordPress origins before sending reusable Basic credentials,
   * covering both initial connections and previously saved database records.
   */
  private assertWordPressHttpsUrl(rawUrl: string): string {
    return this.normalizeSiteUrl(rawUrl, { requireHttps: true });
  }

  /**
   * Executes an outbound HTTP(S) request through `safePublicFetch`, enforcing
   * connection-time public IP resolution on every hop, HTTPS before credentials,
   * cross-origin redirect rejection on credentialed/write calls, timeouts, and
   * bounded response sizes.
   */
  private async safeFetch(
    url: string,
    init: RequestInit,
    timeoutMs = 15000,
    options?: { requireHttps?: boolean; rejectCrossOriginRedirects?: boolean; allowedOrigin?: string },
  ): Promise<SafePublicResponse> {
    try {
      return await safePublicFetch(url, {
        method: init.method || 'GET',
        headers: init.headers as Record<string, string> | Headers | undefined,
        body: typeof init.body === 'string' || Buffer.isBuffer(init.body) ? init.body : undefined,
        timeoutMs,
        maxRedirects: 3,
        maxBytes: 2 * 1024 * 1024,
        requireHttps: options?.requireHttps,
        rejectCrossOriginRedirects: options?.rejectCrossOriginRedirects,
        allowedOrigin: options?.allowedOrigin,
      });
    } catch (err: any) {
      if (
        err instanceof SsrfBlockedError ||
        err instanceof CrossOriginRedirectBlockedError ||
        err instanceof HttpsDowngradeBlockedError ||
        err instanceof ResponseTooLargeError
      ) {
        throw new BadRequestException(err.message);
      }
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(err?.message || 'Outbound CMS request failed.');
    }
  }

  /**
   * Sanitizes a JSON-LD payload before embedding inside `<script type="application/ld+json">`
   * so that `</script>` or `<!--` sequences can never break out of the script context.
   */
  private sanitizeJsonLdPayload(raw: string): string {
    const stripped = raw
      .trim()
      .replace(/^<script[^>]*>/i, '')
      .replace(/<\/script>$/i, '')
      .trim();
    try {
      const parsed = JSON.parse(stripped);
      return JSON.stringify(parsed, null, 2)
        .replace(/<\//g, '<\\/')
        .replace(/<!--/g, '<\\!--');
    } catch {
      return stripped
        .replace(/<\//g, '<\\/')
        .replace(/<!--/g, '<\\!--');
    }
  }

  private buildBasicAuthHeader(username: string, appPassword: string): string {
    const cleanUser = username.trim();
    const cleanPass = appPassword.trim();
    const token = Buffer.from(`${cleanUser}:${cleanPass}`, 'utf8').toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Returns the project's WordPress connection status without ever exposing the
   * encrypted or plaintext Application Password.
   */
  async getConnection(projectId: string) {
    const row = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'wordpress',
        },
      },
    });

    if (!row || row.status === 'DISCONNECTED' || !row.accessToken) {
      return {
        connected: false,
        siteUrl: null,
        username: null,
        seoPlugin: null,
        status: 'DISCONNECTED',
        statusMessage: null,
        lastSyncedAt: null,
      };
    }

    const seoPlugin = row.grantedScopes?.[0] || 'core';
    return {
      connected: row.status === 'CONNECTED',
      siteUrl: row.selectedResourceId || null,
      username: row.googleAccountEmail || null,
      displayName: row.selectedResourceName || null,
      seoPlugin,
      status: row.status,
      statusMessage: row.statusMessage || null,
      lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    };
  }

  /**
   * Verifies WordPress REST API credentials using an Application Password and
   * stores the encrypted password at rest.
   */
  async connectWordPress(projectId: string, input: ConnectWordPressInput) {
    const siteUrl = this.assertWordPressHttpsUrl(input.siteUrl);
    const username = (input.username || '').trim();
    const rawPassword = (input.appPassword || '').trim();

    if (!username || !rawPassword) {
      throw new BadRequestException('WordPress username and Application Password are required.');
    }

    const authHeader = this.buildBasicAuthHeader(username, rawPassword);

    // 1. Verify against /wp-json/wp/v2/users/me
    let wpUser: { id?: number; name?: string; slug?: string; capabilities?: Record<string, boolean> } | null = null;
    try {
      const response = await this.safeFetch(`${siteUrl}/wp-json/wp/v2/users/me?context=edit`, {
        method: 'GET',
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'User-Agent': 'Reigel-SEO-Agent/1.0',
        },
      }, 15000);

      if (response.status === 401 || response.status === 403) {
        throw new BadRequestException(
          'WordPress rejected the username or Application Password. Generate an Application Password under WordPress Admin → Users → Profile.',
        );
      }
      if (!response.ok) {
        throw new BadRequestException(
          `WordPress REST API returned HTTP ${response.status}. Ensure the WordPress REST API (/wp-json) is enabled.`,
        );
      }
      wpUser = (await response.json()) as { id?: number; name?: string; slug?: string; capabilities?: Record<string, boolean> };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        `Could not reach ${siteUrl}/wp-json. Verify your site URL and that the WordPress REST API is accessible (${err?.message || 'network error'}).`,
      );
    }

    // 2. Detect SEO plugin namespaces from /wp-json root index
    let detectedPlugin: string = input.seoPlugin || 'core';
    if (!input.seoPlugin) {
      try {
        const rootRes = await this.safeFetch(`${siteUrl}/wp-json`, {
          method: 'GET',
          headers: { Accept: 'application/json', 'User-Agent': 'Reigel-SEO-Agent/1.0' },
        }, 10000);
        if (rootRes.ok) {
          const rootData = (await rootRes.json()) as { namespaces?: string[] };
          const namespaces = Array.isArray(rootData?.namespaces) ? rootData.namespaces : [];
          if (namespaces.some((ns) => ns.startsWith('yoast/'))) detectedPlugin = 'yoast';
          else if (namespaces.some((ns) => ns.startsWith('rankmath/'))) detectedPlugin = 'rankmath';
          else if (namespaces.some((ns) => ns.startsWith('aioseo/'))) detectedPlugin = 'aioseo';
        }
      } catch {
        // Non-fatal; default to core
      }
    }

    const encryptedPassword = this.security.encryptCredentials(rawPassword);
    const displayName = wpUser?.name ? `${wpUser.name} (${username})` : username;
    const now = new Date();

    const integration = await this.prisma.integration.upsert({
      where: {
        projectId_provider: {
          projectId,
          provider: 'wordpress',
        },
      },
      create: {
        projectId,
        provider: 'wordpress',
        accessToken: encryptedPassword,
        googleAccountEmail: username,
        grantedScopes: [detectedPlugin],
        selectedResourceId: siteUrl,
        selectedResourceName: displayName,
        status: 'CONNECTED',
        statusMessage: null,
        lastSyncedAt: now,
      },
      update: {
        accessToken: encryptedPassword,
        googleAccountEmail: username,
        grantedScopes: [detectedPlugin],
        selectedResourceId: siteUrl,
        selectedResourceName: displayName,
        status: 'CONNECTED',
        statusMessage: null,
        lastSyncedAt: now,
      },
    });

    await this.prisma.integrationAuditEvent.create({
      data: {
        integrationId: integration.id,
        projectId,
        event: 'CONNECTED',
        detail: `WordPress site ${siteUrl} connected as ${username} (${detectedPlugin})`,
      },
    });

    return {
      connected: true,
      siteUrl,
      username,
      displayName,
      seoPlugin: detectedPlugin,
      status: 'CONNECTED',
      lastSyncedAt: now.toISOString(),
    };
  }

  async disconnectWordPress(projectId: string) {
    const existing = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'wordpress',
        },
      },
    });

    if (!existing) {
      return { disconnected: true };
    }

    await this.prisma.integration.update({
      where: { id: existing.id },
      data: {
        accessToken: '',
        status: 'DISCONNECTED',
        statusMessage: null,
      },
    });

    await this.prisma.integrationAuditEvent.create({
      data: {
        integrationId: existing.id,
        projectId,
        event: 'DISCONNECTED',
        detail: 'WordPress integration disconnected by user',
      },
    });

    return { disconnected: true };
  }

  /**
   * Ensures a SiteRepository record exists for tracking non-GitHub CMS runs in
   * AutomationRun and ProofOfImpactService.
   */
  private async getOrCreateCmsRepository(projectId: string, provider: string, siteUrl: string, ownerName: string) {
    const existing = await this.prisma.siteRepository.findUnique({
      where: { projectId },
    });
    if (existing) return existing;

    let hostname = siteUrl;
    try {
      hostname = new URL(siteUrl).hostname;
    } catch {
      // keep raw
    }

    return this.prisma.siteRepository.create({
      data: {
        projectId,
        provider,
        owner: ownerName || provider,
        name: hostname,
        defaultBranch: 'production',
        accessTokenEncrypted: this.security.encryptCredentials('cms_managed'),
        framework: provider === 'wordpress' ? 'wordpress' : 'cms',
        autoMerge: false,
      },
    });
  }

  /**
   * Pushes an SEO improvement to a connected WordPress site as a revision/draft
   * or live update via the WordPress REST API, and logs full Before/After proof.
   */
  async stageWordPressFix(projectId: string, input: StageWordPressFixInput) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'wordpress',
        },
      },
    });

    if (!integration || integration.status !== 'CONNECTED' || !integration.accessToken || !integration.selectedResourceId) {
      throw new BadRequestException('Connect your WordPress site in Settings → Integrations first.');
    }

    const siteUrl = this.assertWordPressHttpsUrl(integration.selectedResourceId);
    const username = integration.googleAccountEmail || 'admin';
    const appPassword = this.security.decryptCredentials(integration.accessToken);
    if (!appPassword) {
      throw new BadRequestException('Stored WordPress credentials could not be decrypted. Please reconnect WordPress in Settings.');
    }

    const authHeader = this.buildBasicAuthHeader(username, appPassword);
    const targetUrl = (input.targetUrl || siteUrl).trim();
    const publishMode = input.publishMode || 'draft';

    // Extract slug from targetUrl
    let slug = '';
    try {
      const parsed = new URL(targetUrl);
      const parts = parsed.pathname.split('/').filter(Boolean);
      slug = parts[parts.length - 1] || '';
    } catch {
      slug = '';
    }

    // Locate matching WP page or post
    let wpItem: any = null;
    let endpointType: 'pages' | 'posts' = 'pages';

    for (const type of ['pages', 'posts'] as const) {
      const queryUrl = slug
        ? `${siteUrl}/wp-json/wp/v2/${type}?slug=${encodeURIComponent(slug)}&context=edit`
        : `${siteUrl}/wp-json/wp/v2/${type}?per_page=1&context=edit`;
      const res = await this.safeFetch(queryUrl, {
        headers: {
          Authorization: authHeader,
          Accept: 'application/json',
          'User-Agent': 'Reigel-SEO-Agent/1.0',
        },
      }, 15000);
      if (res.ok) {
        const items = (await res.json()) as any[];
        if (Array.isArray(items) && items.length > 0) {
          wpItem = items[0];
          endpointType = type;
          break;
        }
      }
    }

    if (!wpItem) {
      throw new NotFoundException(
        `Could not find a matching WordPress page or post for "${targetUrl}". Verify the URL slug exists in WordPress.`,
      );
    }

    const beforeTitle = wpItem.title?.raw || wpItem.title?.rendered || input.beforeValue || '';
    const beforeExcerpt = wpItem.excerpt?.raw || wpItem.excerpt?.rendered || '';
    const beforeValue =
      input.beforeValue ??
      (input.field === 'META_DESCRIPTION' ? beforeExcerpt : beforeTitle);

    // Prepare payload for WordPress REST API
    const updateBody: Record<string, any> = {};
    const metaPayload: Record<string, any> = {};

    if (input.field === 'META_TITLE') {
      if (publishMode === 'publish') {
        updateBody.title = input.afterValue;
      }
      metaPayload._yoast_wpseo_title = input.afterValue;
      metaPayload.rank_math_title = input.afterValue;
      metaPayload._aioseo_title = input.afterValue;
    } else if (input.field === 'META_DESCRIPTION') {
      updateBody.excerpt = input.afterValue;
      metaPayload._yoast_wpseo_metadesc = input.afterValue;
      metaPayload.rank_math_description = input.afterValue;
      metaPayload._aioseo_description = input.afterValue;
    } else if (input.field.includes('SCHEMA')) {
      const rawContent = wpItem.content?.raw || wpItem.content?.rendered || '';
      const safeJsonLd = this.sanitizeJsonLdPayload(input.afterValue);
      const schemaBlock = `\n<!-- wp:html -->\n<script type="application/ld+json">\n${safeJsonLd}\n</script>\n<!-- /wp:html -->`;
      updateBody.content = `${rawContent}${schemaBlock}`;
    } else {
      updateBody.excerpt = input.afterValue;
    }

    if (Object.keys(metaPayload).length > 0) {
      updateBody.meta = metaPayload;
    }

    // Draft mode NEVER modifies the live WordPress post or its live SEO plugin
    // meta fields. Pending edits are staged locally in the database and require
    // an explicit publish action before any write reaches WordPress.
    let updatedWp: any = null;
    if (publishMode === 'publish') {
      const targetEndpoint = `${siteUrl}/wp-json/wp/v2/${endpointType}/${wpItem.id}`;
      const updateRes = await this.safeFetch(
        targetEndpoint,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'Reigel-SEO-Agent/1.0',
          },
          body: JSON.stringify(updateBody),
        },
        15000,
        { requireHttps: true, rejectCrossOriginRedirects: true },
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text().catch(() => '');
        throw new BadRequestException(
          `WordPress REST API rejected the update (HTTP ${updateRes.status}): ${errText.slice(0, 200)}`,
        );
      }

      updatedWp = (await updateRes.json()) as any;
    }

    const wpAdminEditUrl = `${siteUrl}/wp-admin/post.php?post=${wpItem.id}&action=edit`;

    // Record in AutomationRun, FixSnapshot, and FixImpactLedgerEvent
    const repo = await this.getOrCreateCmsRepository(projectId, 'wordpress', siteUrl, username);
    const now = new Date();

    const run = await this.prisma.automationRun.create({
      data: {
        repositoryId: repo.id,
        projectId,
        kind: AutomationRunKind.FIXES,
        status: publishMode === 'publish' ? AutomationRunStatus.MERGED : AutomationRunStatus.AWAITING_REVIEW,
        branch: `wordpress/${endpointType}-${wpItem.id}`,
        pullRequestUrl: wpAdminEditUrl,
        filesChanged: [`wordpress:${endpointType}/${wpItem.slug || wpItem.id}`],
        startedAt: now,
        finishedAt: now,
        steps: [
          {
            at: now.toISOString(),
            step: 'instruction',
            detail: input.findingTitle || `WordPress ${input.field} optimization on ${targetUrl}`,
            ok: true,
          },
          {
            at: now.toISOString(),
            step: publishMode === 'publish' ? 'wordpress-update' : 'wordpress-draft-staged',
            detail:
              publishMode === 'publish'
                ? `Published ${input.field} directly via WordPress REST API (${endpointType} #${wpItem.id})`
                : `Staged ${input.field} locally for review without modifying the live WordPress ${endpointType} #${wpItem.id}`,
            ok: true,
            stagedPayload:
              publishMode === 'draft'
                ? {
                    findingId: input.findingId,
                    targetUrl,
                    field: input.field,
                    beforeValue,
                    afterValue: input.afterValue,
                    findingTitle: input.findingTitle,
                    wpPostId: wpItem.id,
                    endpointType,
                  }
                : undefined,
            change: {
              issueId: input.findingId || `wp-${wpItem.id}`,
              url: targetUrl,
              field: input.field,
              before: beforeValue || null,
              after: input.afterValue,
              why: input.findingTitle || 'WordPress REST API SEO optimization',
              file: `WordPress ${endpointType === 'pages' ? 'Page' : 'Post'} #${wpItem.id}`,
              measuredAt: now.toISOString(),
              source: 'WORDPRESS_API',
              findingTitle: input.findingTitle,
            },
          },
        ],
      },
    });

    await this.prisma.fixSnapshot.createMany({
      data: [
        {
          projectId,
          automationRunId: run.id,
          url: targetUrl,
          snapshotType: 'BEFORE',
          title: input.field === 'META_TITLE' ? beforeValue : beforeTitle,
          metaDescription: input.field === 'META_DESCRIPTION' ? beforeValue : beforeExcerpt,
          contentSnippet: beforeValue || null,
        },
        {
          projectId,
          automationRunId: run.id,
          url: targetUrl,
          snapshotType: 'PROPOSED',
          title: input.field === 'META_TITLE' ? input.afterValue : beforeTitle,
          metaDescription: input.field === 'META_DESCRIPTION' ? input.afterValue : beforeExcerpt,
          contentSnippet: input.afterValue,
        },
      ],
    });

    await this.prisma.fixImpactLedgerEvent.create({
      data: {
        projectId,
        automationRunId: run.id,
        eventType: publishMode === 'publish' ? 'DEPLOYMENT_PUBLISHED' : 'PR_CREATED',
        title:
          publishMode === 'publish'
            ? `WordPress Fix Published: ${input.findingTitle || input.field}`
            : `WordPress Draft Staged Locally: ${input.findingTitle || input.field}`,
        description:
          publishMode === 'publish'
            ? `Published ${input.field} update on ${targetUrl} via WordPress REST API (${endpointType} #${wpItem.id}).`
            : `Staged ${input.field} update locally for ${targetUrl} (${endpointType} #${wpItem.id}); live WordPress post was not modified.`,
        actor: 'WORDPRESS_AGENT',
        affectedUrl: targetUrl,
        pullRequestUrl: wpAdminEditUrl,
        verificationStatus: publishMode === 'publish' ? 'PUBLISHED_UNVERIFIED' : 'STAGED_LOCALLY',
        evidenceData: {
          wpPostId: wpItem.id,
          wpRevisionId: updatedWp?.id ?? null,
          endpointType,
          publishMode,
          liveModified: publishMode === 'publish',
          field: input.field,
          before: beforeValue,
          after: input.afterValue,
        },
      },
    });

    const verifiedState = await this.finalizeCmsFixVerification(projectId, targetUrl, input.findingId, publishMode, {
      field: input.field,
      expected: input.afterValue,
      runId: run.id,
      actor: 'WORDPRESS_AGENT',
      pullRequestUrl: wpAdminEditUrl,
    });

    return {
      success: true,
      runId: run.id,
      wpPostId: wpItem.id,
      wpAdminEditUrl,
      publishMode,
      liveModified: publishMode === 'publish',
      status:
        publishMode === 'publish'
          ? verifiedState === 'VERIFIED'
            ? 'VERIFIED_LIVE'
            : 'VERIFYING_LIVE'
          : 'STAGED_LOCALLY',
    };
  }

  /**
   * Explicitly publishes a previously staged local WordPress draft run to the
   * live WordPress post/page.
   */
  async publishStagedWordPressFix(projectId: string, runId: string) {
    const run = await this.prisma.automationRun.findFirst({
      where: { id: runId, projectId },
    });
    if (!run) {
      throw new NotFoundException(`Staged WordPress run ${runId} not found.`);
    }
    if (run.status !== AutomationRunStatus.AWAITING_REVIEW) {
      throw new BadRequestException('Only locally staged WordPress drafts awaiting review can be published.');
    }
    const steps = Array.isArray(run.steps) ? (run.steps as any[]) : [];
    const staged = steps.find((s) => s?.stagedPayload)?.stagedPayload;
    if (!staged?.targetUrl || !staged?.field || typeof staged?.afterValue !== 'string') {
      throw new BadRequestException('Staged WordPress draft payload is missing or invalid.');
    }

    const published = await this.stageWordPressFix(projectId, {
      findingId: staged.findingId,
      targetUrl: staged.targetUrl,
      field: staged.field,
      beforeValue: staged.beforeValue,
      afterValue: staged.afterValue,
      findingTitle: staged.findingTitle,
      publishMode: 'publish',
    });

    await this.prisma.automationRun
      .update({
        where: { id: runId },
        data: { status: AutomationRunStatus.MERGED, finishedAt: new Date() },
      })
      .catch(() => null);

    return published;
  }

  /**
   * Verifies a fix that the user applied manually in WordPress, Shopify, Webflow,
   * Wix, or any CMS by fetching the live HTML and checking if the updated value is present.
   */
  async verifyManualCmsFix(projectId: string, input: VerifyManualCmsFixInput) {
    const targetUrl = (input.targetUrl || '').trim();
    if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
      throw new BadRequestException('A valid page URL (https://...) is required to verify live HTML.');
    }

    const expected = (input.expectedAfterValue || '').trim();
    if (!expected) {
      throw new BadRequestException('Expected updated text or snippet is required for verification.');
    }

    let html = '';
    try {
      const response = await this.safeFetch(targetUrl, {
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'Reigel-SEO-Verifier/1.0',
        },
      }, 15000);
      if (!response.ok) {
        throw new BadRequestException(`Live page returned HTTP ${response.status} when checking ${targetUrl}.`);
      }
      const rawText = await response.text();
      html = rawText.slice(0, 2_000_000);
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Could not fetch live page ${targetUrl}: ${err?.message || 'network error'}`);
    }

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const liveTitle = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const liveDescription = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim() : '';

    // Exact, field-scoped assertion. Matching text anywhere in the body (nav,
    // copy, inline JSON) used to count; it proves nothing about the tag.
    const fieldCheck = await this.liveFieldCheck(targetUrl, input.field, expected);
    const verified = fieldCheck.supported && fieldCheck.passed;
    const detectedLiveValue = fieldCheck.observed || (input.field === 'META_DESCRIPTION' ? liveDescription : liveTitle);

    const platformLabel = input.platform || 'CMS';
    const repo = await this.getOrCreateCmsRepository(projectId, 'cms', targetUrl, platformLabel.toLowerCase());
    const now = new Date();

    const run = await this.prisma.automationRun.create({
      data: {
        repositoryId: repo.id,
        projectId,
        kind: AutomationRunKind.FIXES,
        status: verified ? AutomationRunStatus.MERGED : AutomationRunStatus.AWAITING_REVIEW,
        branch: `${platformLabel.toLowerCase()}/live-check`,
        pullRequestUrl: targetUrl,
        filesChanged: [`${platformLabel}:${targetUrl}`],
        startedAt: now,
        finishedAt: now,
        steps: [
          {
            at: now.toISOString(),
            step: 'instruction',
            detail: input.findingTitle || `${platformLabel} ${input.field} update on ${targetUrl}`,
            ok: true,
          },
          {
            at: now.toISOString(),
            step: 'cms-live-verification',
            detail: verified
              ? `Confirmed ${input.field} is live on ${targetUrl}`
              : `Recorded ${input.field} update for ${targetUrl}; awaiting live HTML propagation`,
            ok: true,
            change: {
              issueId: input.findingId || `cms-${Date.now()}`,
              url: targetUrl,
              field: input.field,
              before: input.beforeValue || null,
              after: expected,
              why: input.findingTitle || `${platformLabel} optimization`,
              file: `${platformLabel} Page Editor`,
              measuredAt: now.toISOString(),
              source: platformLabel.toUpperCase(),
              findingTitle: input.findingTitle,
            },
          },
        ],
      },
    });

    await this.prisma.fixSnapshot.createMany({
      data: [
        {
          projectId,
          automationRunId: run.id,
          url: targetUrl,
          snapshotType: 'BEFORE',
          title: input.beforeValue || liveTitle || null,
          metaDescription: input.beforeValue || liveDescription || null,
          contentSnippet: input.beforeValue || null,
        },
        {
          projectId,
          automationRunId: run.id,
          url: targetUrl,
          snapshotType: verified ? 'VERIFIED_LIVE' : 'PROPOSED',
          title: input.field === 'META_TITLE' ? expected : liveTitle || null,
          metaDescription: input.field === 'META_DESCRIPTION' ? expected : liveDescription || null,
          contentSnippet: expected,
        },
      ],
    });

    await this.prisma.fixImpactLedgerEvent.create({
      data: {
        projectId,
        automationRunId: run.id,
        eventType: verified ? 'TECHNICAL_FIX_CONFIRMED' : 'MANUAL_FIX_RECORDED',
        title: verified
          ? `${platformLabel} Fix Verified Live: ${input.findingTitle || input.field}`
          : `${platformLabel} Fix Recorded: ${input.findingTitle || input.field}`,
        description: verified
          ? `Live HTML scan confirmed updated ${input.field} on ${targetUrl}. 30d/90d tracking started.`
          : `Recorded ${input.field} update for ${targetUrl}. Re-verify once your CMS cache clears.`,
        actor: platformLabel.toUpperCase(),
        affectedUrl: targetUrl,
        pullRequestUrl: targetUrl,
        verificationStatus: verified ? 'VERIFIED_LIVE' : 'AWAITING_CACHE',
        evidenceData: {
          platform: platformLabel,
          field: input.field,
          verifiedOnHtml: verified,
          detectedLiveValue: detectedLiveValue.slice(0, 300),
          expectedValue: expected.slice(0, 300),
        },
      },
    });

    if (verified) {
      await this.finalizeCmsFixVerification(projectId, targetUrl, input.findingId, 'publish', {
        field: input.field,
        expected,
      });
    }

    return {
      verified,
      runId: run.id,
      targetUrl,
      detectedLiveValue,
      message: verified
        ? 'Confirmed live on your website! Recorded in the Impact Ledger and 30d/90d Proof.'
        : 'Recorded in your log. Live HTML still shows the previous version (clear your WordPress/Cloudflare cache and click Verify again).',
    };
  }

  // ── Shopify Admin API Connector ────────────────────────────────────────────

  async getShopifyConnection(projectId: string) {
    const row = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'shopify',
        },
      },
    });

    if (!row || row.status === 'DISCONNECTED' || !row.accessToken) {
      return {
        connected: false,
        shopDomain: null,
        shopName: null,
        status: 'DISCONNECTED',
        lastSyncedAt: null,
      };
    }

    return {
      connected: row.status === 'CONNECTED',
      shopDomain: row.selectedResourceId || null,
      shopName: row.selectedResourceName || null,
      status: row.status,
      lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    };
  }

  async connectShopify(projectId: string, input: ConnectShopifyInput) {
    const rawDomain = (input.shopDomain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    const accessToken = (input.accessToken || '').trim();

    if (!rawDomain || !accessToken) {
      throw new BadRequestException('Shopify store domain (e.g. store.myshopify.com) and Admin API access token are required.');
    }

    const shopOrigin = this.assertShopifyAdminOrigin(rawDomain);
    const shopHost = new URL(shopOrigin).hostname;

    let shopData: { shop?: { name?: string; domain?: string; myshopify_domain?: string; email?: string } } | null = null;
    try {
      const res = await this.safeFetch(`${shopOrigin}/admin/api/2024-10/shop.json`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          Accept: 'application/json',
          'User-Agent': 'Reigel-SEO-Agent/1.0',
        },
      }, 15000, { requireHttps: true, rejectCrossOriginRedirects: true, allowedOrigin: shopOrigin });

      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException(
          'Shopify rejected the Admin API access token. Generate a Custom App token with read_products, write_products, read_content, and write_content scopes.',
        );
      }
      if (!res.ok) {
        throw new BadRequestException(`Shopify Admin API returned HTTP ${res.status} for ${shopHost}.`);
      }
      shopData = (await res.json()) as any;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Could not reach Shopify Admin API at ${shopHost}: ${err?.message || 'network error'}`);
    }

    const encryptedToken = this.security.encryptCredentials(accessToken);
    const shopName = shopData?.shop?.name || shopHost;
    const now = new Date();

    const integration = await this.prisma.integration.upsert({
      where: {
        projectId_provider: {
          projectId,
          provider: 'shopify',
        },
      },
      create: {
        projectId,
        provider: 'shopify',
        accessToken: encryptedToken,
        googleAccountEmail: shopData?.shop?.email || shopHost,
        grantedScopes: ['write_products', 'write_content'],
        selectedResourceId: shopOrigin,
        selectedResourceName: shopName,
        status: 'CONNECTED',
        statusMessage: null,
        lastSyncedAt: now,
      },
      update: {
        accessToken: encryptedToken,
        googleAccountEmail: shopData?.shop?.email || shopHost,
        grantedScopes: ['write_products', 'write_content'],
        selectedResourceId: shopOrigin,
        selectedResourceName: shopName,
        status: 'CONNECTED',
        statusMessage: null,
        lastSyncedAt: now,
      },
    });

    await this.prisma.integrationAuditEvent.create({
      data: {
        integrationId: integration.id,
        projectId,
        event: 'CONNECTED',
        detail: `Shopify store ${shopName} (${shopOrigin}) connected`,
      },
    });

    return {
      connected: true,
      shopDomain: shopOrigin,
      shopName,
      status: 'CONNECTED',
      lastSyncedAt: now.toISOString(),
    };
  }

  async disconnectShopify(projectId: string) {
    const existing = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'shopify',
        },
      },
    });
    if (!existing) return { disconnected: true };

    await this.prisma.integration.update({
      where: { id: existing.id },
      data: { accessToken: '', status: 'DISCONNECTED', statusMessage: null },
    });

    await this.prisma.integrationAuditEvent.create({
      data: {
        integrationId: existing.id,
        projectId,
        event: 'DISCONNECTED',
        detail: 'Shopify integration disconnected by user',
      },
    });

    return { disconnected: true };
  }

  async stageShopifyFix(projectId: string, input: StageWordPressFixInput) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'shopify',
        },
      },
    });

    if (!integration || integration.status !== 'CONNECTED' || !integration.accessToken || !integration.selectedResourceId) {
      throw new BadRequestException('Connect your Shopify store in Settings → Integrations first.');
    }

    const shopOrigin = this.assertShopifyAdminOrigin(integration.selectedResourceId);
    const accessToken = this.security.decryptCredentials(integration.accessToken);
    if (!accessToken) {
      throw new BadRequestException('Stored Shopify token could not be decrypted. Please reconnect Shopify in Settings.');
    }

    const targetUrl = (input.targetUrl || shopOrigin).trim();
    const publishMode = input.publishMode || 'draft';
    let handle = '';
    let resourceType: 'products' | 'pages' = 'pages';

    try {
      const parsed = new URL(targetUrl);
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments[0] === 'products' && segments[1]) {
        resourceType = 'products';
        handle = segments[1];
      } else if (segments[0] === 'pages' && segments[1]) {
        resourceType = 'pages';
        handle = segments[1];
      } else {
        handle = segments[segments.length - 1] || '';
      }
    } catch {
      handle = '';
    }

    const lookupUrl = handle
      ? `${shopOrigin}/admin/api/2024-10/${resourceType}.json?handle=${encodeURIComponent(handle)}&limit=1`
      : `${shopOrigin}/admin/api/2024-10/pages.json?limit=1`;

    const lookupRes = await this.safeFetch(lookupUrl, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        Accept: 'application/json',
        'User-Agent': 'Reigel-SEO-Agent/1.0',
      },
    }, 15000);

    if (!lookupRes.ok) {
      throw new BadRequestException(`Shopify Admin API lookup returned HTTP ${lookupRes.status}.`);
    }

    const lookupJson = (await lookupRes.json()) as Record<string, any[]>;
    const items = lookupJson[resourceType] || lookupJson.pages || lookupJson.products || [];
    const targetItem = items[0];

    if (!targetItem?.id) {
      throw new NotFoundException(
        `Could not find a matching Shopify ${resourceType === 'products' ? 'product' : 'page'} for handle "${handle || '/'}".`,
      );
    }

    const singularKey = resourceType === 'products' ? 'product' : 'page';
    const beforeValue = input.beforeValue || targetItem.title || '';

    const updatePayload: Record<string, any> = { id: targetItem.id };
    if (input.field === 'META_TITLE') {
      updatePayload.metafields_global_title_tag = input.afterValue;
    } else if (input.field === 'META_DESCRIPTION') {
      updatePayload.metafields_global_description_tag = input.afterValue;
    } else if (input.field.includes('SCHEMA')) {
      const safeJsonLd = this.sanitizeJsonLdPayload(input.afterValue);
      const existingHtml = targetItem.body_html || '';
      updatePayload.body_html = `${existingHtml}\n<script type="application/ld+json">\n${safeJsonLd}\n</script>`;
    } else {
      updatePayload.metafields_global_description_tag = input.afterValue;
    }

    // Draft mode NEVER modifies the live Shopify store. Pending edits are staged
    // locally in the database and require explicit publish approval before PUT.
    if (publishMode === 'publish') {
      const updateRes = await this.safeFetch(
        `${shopOrigin}/admin/api/2024-10/${resourceType}/${targetItem.id}.json`,
        {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'Reigel-SEO-Agent/1.0',
          },
          body: JSON.stringify({ [singularKey]: updatePayload }),
        },
        15000,
        { requireHttps: true, rejectCrossOriginRedirects: true },
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text().catch(() => '');
        throw new BadRequestException(`Shopify Admin API update failed (HTTP ${updateRes.status}): ${errText.slice(0, 200)}`);
      }
    }

    const shopAdminUrl = `${shopOrigin}/admin/${resourceType}/${targetItem.id}`;
    const repo = await this.getOrCreateCmsRepository(projectId, 'shopify', shopOrigin, integration.selectedResourceName || 'shopify');
    const now = new Date();

    const run = await this.prisma.automationRun.create({
      data: {
        repositoryId: repo.id,
        projectId,
        kind: AutomationRunKind.FIXES,
        status: publishMode === 'publish' ? AutomationRunStatus.MERGED : AutomationRunStatus.AWAITING_REVIEW,
        branch: `shopify/${resourceType}-${targetItem.id}`,
        pullRequestUrl: shopAdminUrl,
        filesChanged: [`shopify:${resourceType}/${targetItem.handle || targetItem.id}`],
        startedAt: now,
        finishedAt: now,
        steps: [
          {
            at: now.toISOString(),
            step: publishMode === 'publish' ? 'shopify-update' : 'shopify-draft-staged',
            detail:
              publishMode === 'publish'
                ? `Applied ${input.field} update via Shopify Admin API (${singularKey} #${targetItem.id})`
                : `Staged ${input.field} locally for review without modifying the live Shopify ${singularKey} #${targetItem.id}`,
            ok: true,
            stagedPayload:
              publishMode === 'draft'
                ? {
                    platform: 'SHOPIFY',
                    findingId: input.findingId,
                    targetUrl,
                    field: input.field,
                    beforeValue,
                    afterValue: input.afterValue,
                    findingTitle: input.findingTitle,
                    shopifyResourceId: targetItem.id,
                    resourceType,
                  }
                : undefined,
            change: {
              issueId: input.findingId || `shopify-${targetItem.id}`,
              url: targetUrl,
              field: input.field,
              before: beforeValue || null,
              after: input.afterValue,
              why: input.findingTitle || 'Shopify Admin API SEO optimization',
              file: `Shopify ${singularKey} #${targetItem.id}`,
              measuredAt: now.toISOString(),
              source: 'SHOPIFY_API',
              findingTitle: input.findingTitle,
            },
          },
        ],
      },
    });

    await this.prisma.fixSnapshot.createMany({
      data: [
        {
          projectId,
          automationRunId: run.id,
          url: targetUrl,
          snapshotType: 'BEFORE',
          title: beforeValue || null,
          contentSnippet: beforeValue || null,
        },
        {
          projectId,
          automationRunId: run.id,
          url: targetUrl,
          snapshotType: 'PROPOSED',
          title: input.field === 'META_TITLE' ? input.afterValue : targetItem.title || null,
          metaDescription: input.field === 'META_DESCRIPTION' ? input.afterValue : null,
          contentSnippet: input.afterValue,
        },
      ],
    });

    await this.prisma.fixImpactLedgerEvent.create({
      data: {
        projectId,
        automationRunId: run.id,
        eventType: publishMode === 'publish' ? 'DEPLOYMENT_PUBLISHED' : 'PR_CREATED',
        title:
          publishMode === 'publish'
            ? `Shopify Fix Published: ${input.findingTitle || input.field}`
            : `Shopify Draft Staged Locally: ${input.findingTitle || input.field}`,
        description:
          publishMode === 'publish'
            ? `Updated ${input.field} on ${targetUrl} via Shopify Admin API (${singularKey} #${targetItem.id}).`
            : `Staged ${input.field} update locally for ${targetUrl} (${singularKey} #${targetItem.id}); live Shopify store was not modified.`,
        actor: 'SHOPIFY_AGENT',
        affectedUrl: targetUrl,
        pullRequestUrl: shopAdminUrl,
        verificationStatus: publishMode === 'publish' ? 'PUBLISHED_UNVERIFIED' : 'STAGED_LOCALLY',
        evidenceData: {
          shopifyResourceId: targetItem.id,
          resourceType,
          publishMode,
          liveModified: publishMode === 'publish',
          field: input.field,
          before: beforeValue,
          after: input.afterValue,
        },
      },
    });

    const verifiedState = await this.finalizeCmsFixVerification(projectId, targetUrl, input.findingId, publishMode, {
      field: input.field,
      expected: input.afterValue,
      runId: run.id,
      actor: 'SHOPIFY_AGENT',
      pullRequestUrl: shopAdminUrl,
    });

    return {
      success: true,
      runId: run.id,
      shopifyResourceId: targetItem.id,
      adminEditUrl: shopAdminUrl,
      publishMode,
      liveModified: publishMode === 'publish',
      status:
        publishMode === 'publish'
          ? verifiedState === 'VERIFIED'
            ? 'VERIFIED_LIVE'
            : 'VERIFYING_LIVE'
          : 'STAGED_LOCALLY',
    };
  }

  /**
   * Explicitly publishes a previously staged local Shopify draft run to the
   * live Shopify store.
   */
  async publishStagedShopifyFix(projectId: string, runId: string) {
    const run = await this.prisma.automationRun.findFirst({
      where: { id: runId, projectId },
    });
    if (!run) {
      throw new NotFoundException(`Staged Shopify run ${runId} not found.`);
    }
    if (run.status !== AutomationRunStatus.AWAITING_REVIEW) {
      throw new BadRequestException('Only locally staged Shopify drafts awaiting review can be published.');
    }
    const steps = Array.isArray(run.steps) ? (run.steps as any[]) : [];
    const staged = steps.find((s) => s?.stagedPayload)?.stagedPayload;
    if (!staged?.targetUrl || !staged?.field || typeof staged?.afterValue !== 'string') {
      throw new BadRequestException('Staged Shopify draft payload is missing or invalid.');
    }

    const published = await this.stageShopifyFix(projectId, {
      findingId: staged.findingId,
      targetUrl: staged.targetUrl,
      field: staged.field,
      beforeValue: staged.beforeValue,
      afterValue: staged.afterValue,
      findingTitle: staged.findingTitle,
      publishMode: 'publish',
    });

    await this.prisma.automationRun
      .update({
        where: { id: runId },
        data: { status: AutomationRunStatus.MERGED, finishedAt: new Date() },
      })
      .catch(() => null);

    return published;
  }

  // ── Webflow Data API v2 Connector ──────────────────────────────────────────

  async getWebflowConnection(projectId: string) {
    const row = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'webflow',
        },
      },
    });

    if (!row || row.status === 'DISCONNECTED' || !row.accessToken) {
      return {
        connected: false,
        siteId: null,
        siteName: null,
        siteUrl: null,
        status: 'DISCONNECTED',
        lastSyncedAt: null,
      };
    }

    return {
      connected: row.status === 'CONNECTED',
      siteId: row.selectedResourceId || null,
      siteName: row.selectedResourceName || null,
      siteUrl: row.googleAccountEmail || null,
      status: row.status,
      lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    };
  }

  async connectWebflow(projectId: string, input: ConnectWebflowInput) {
    const siteId = (input.siteId || '').trim();
    const apiToken = (input.apiToken || '').trim();
    const siteUrl = input.siteUrl ? this.normalizeSiteUrl(input.siteUrl) : '';

    if (!siteId || !apiToken) {
      throw new BadRequestException('Webflow Site ID and Data API v2 Token are required.');
    }

    let siteInfo: { id?: string; displayName?: string; shortName?: string; customDomains?: Array<{ url?: string }> } | null = null;
    try {
      const res = await this.safeFetch(
        `https://api.webflow.com/v2/sites/${encodeURIComponent(siteId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            Accept: 'application/json',
            'User-Agent': 'Reigel-SEO-Agent/1.0',
          },
        },
        15000,
      );

      if (res.status === 401 || res.status === 403) {
        throw new BadRequestException(
          'Webflow rejected the API token or Site ID. Generate a Site API Token with pages:read and pages:write scopes in Webflow Site Settings → Apps & Integrations.',
        );
      }
      if (!res.ok) {
        throw new BadRequestException(`Webflow API returned HTTP ${res.status} for Site ID ${siteId}.`);
      }
      siteInfo = (await res.json()) as any;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Could not verify Webflow Site ID ${siteId}: ${err?.message || 'network error'}`);
    }

    const encryptedToken = this.security.encryptCredentials(apiToken);
    const siteName = siteInfo?.displayName || siteInfo?.shortName || siteId;
    const resolvedUrl = siteUrl || siteInfo?.customDomains?.[0]?.url || `https://${siteInfo?.shortName || siteId}.webflow.io`;
    const now = new Date();

    const integration = await this.prisma.integration.upsert({
      where: {
        projectId_provider: {
          projectId,
          provider: 'webflow',
        },
      },
      create: {
        projectId,
        provider: 'webflow',
        accessToken: encryptedToken,
        googleAccountEmail: resolvedUrl,
        grantedScopes: ['pages:read', 'pages:write'],
        selectedResourceId: siteId,
        selectedResourceName: siteName,
        status: 'CONNECTED',
        statusMessage: null,
        lastSyncedAt: now,
      },
      update: {
        accessToken: encryptedToken,
        googleAccountEmail: resolvedUrl,
        grantedScopes: ['pages:read', 'pages:write'],
        selectedResourceId: siteId,
        selectedResourceName: siteName,
        status: 'CONNECTED',
        statusMessage: null,
        lastSyncedAt: now,
      },
    });

    await this.prisma.integrationAuditEvent.create({
      data: {
        integrationId: integration.id,
        projectId,
        event: 'CONNECTED',
        detail: `Webflow site ${siteName} (${siteId}) connected`,
      },
    });

    return {
      connected: true,
      siteId,
      siteName,
      siteUrl: resolvedUrl,
      status: 'CONNECTED',
      lastSyncedAt: now.toISOString(),
    };
  }

  async disconnectWebflow(projectId: string) {
    const existing = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'webflow',
        },
      },
    });
    if (!existing) return { disconnected: true };

    await this.prisma.integration.update({
      where: { id: existing.id },
      data: { accessToken: '', status: 'DISCONNECTED', statusMessage: null },
    });

    await this.prisma.integrationAuditEvent.create({
      data: {
        integrationId: existing.id,
        projectId,
        event: 'DISCONNECTED',
        detail: 'Webflow integration disconnected by user',
      },
    });

    return { disconnected: true };
  }

  async stageWebflowFix(projectId: string, input: StageWordPressFixInput) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'webflow',
        },
      },
    });

    if (!integration || integration.status !== 'CONNECTED' || !integration.accessToken || !integration.selectedResourceId) {
      throw new BadRequestException('Connect your Webflow site in Settings → Integrations first.');
    }

    const siteId = integration.selectedResourceId;
    const siteUrl = integration.googleAccountEmail || 'https://webflow.io';
    const apiToken = this.security.decryptCredentials(integration.accessToken);
    if (!apiToken) {
      throw new BadRequestException('Stored Webflow token could not be decrypted. Please reconnect Webflow in Settings.');
    }

    const targetUrl = (input.targetUrl || siteUrl).trim();
    const publishMode = input.publishMode || 'draft';
    let slug = '';
    try {
      const parsed = new URL(targetUrl);
      const parts = parsed.pathname.split('/').filter(Boolean);
      slug = parts[parts.length - 1] || '';
    } catch {
      slug = '';
    }

    const pagesRes = await this.safeFetch(
      `https://api.webflow.com/v2/sites/${encodeURIComponent(siteId)}/pages`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json',
          'User-Agent': 'Reigel-SEO-Agent/1.0',
        },
      },
      15000,
    );

    if (!pagesRes.ok) {
      throw new BadRequestException(`Webflow API pages list returned HTTP ${pagesRes.status}.`);
    }

    const pagesData = (await pagesRes.json()) as {
      pages?: Array<{ id: string; slug?: string | null; title?: string; seo?: { title?: string; description?: string } }>;
    };
    const pages = Array.isArray(pagesData?.pages) ? pagesData.pages : [];
    const targetPage = pages.find((p) =>
      slug ? p.slug === slug : !p.slug || p.slug === 'index' || p.slug === 'home',
    );

    if (!targetPage?.id) {
      throw new NotFoundException(
        `Could not find an exact matching Webflow page for slug "${slug || '/'}". Refusing to overwrite another page.`,
      );
    }

    const beforeValue =
      input.beforeValue ||
      (input.field === 'META_DESCRIPTION' ? targetPage.seo?.description : targetPage.seo?.title || targetPage.title) ||
      '';

    const seoPayload: Record<string, string> = {
      title: targetPage.seo?.title || targetPage.title || '',
      description: targetPage.seo?.description || '',
    };

    if (input.field === 'META_TITLE') {
      seoPayload.title = input.afterValue;
    } else if (input.field === 'META_DESCRIPTION') {
      seoPayload.description = input.afterValue;
    } else {
      seoPayload.description = input.afterValue;
    }

    // Draft mode NEVER modifies Webflow pages via API. Pending edits are staged
    // locally in the database and require explicit publish approval before PUT.
    if (publishMode === 'publish') {
      const updateRes = await this.safeFetch(
        `https://api.webflow.com/v2/pages/${encodeURIComponent(targetPage.id)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'Reigel-SEO-Agent/1.0',
          },
          body: JSON.stringify({
            title: input.field === 'META_TITLE' ? input.afterValue : targetPage.title,
            seo: seoPayload,
          }),
        },
        15000,
        { requireHttps: true, rejectCrossOriginRedirects: true },
      );

      if (!updateRes.ok) {
        const errText = await updateRes.text().catch(() => '');
        throw new BadRequestException(`Webflow API page metadata update failed (HTTP ${updateRes.status}): ${errText.slice(0, 200)}`);
      }
    }

    const webflowAdminUrl = `https://webflow.com/design/${siteId}`;
    const repo = await this.getOrCreateCmsRepository(projectId, 'webflow', siteUrl, integration.selectedResourceName || 'webflow');
    const now = new Date();

    const run = await this.prisma.automationRun.create({
      data: {
        repositoryId: repo.id,
        projectId,
        kind: AutomationRunKind.FIXES,
        status: publishMode === 'publish' ? AutomationRunStatus.MERGED : AutomationRunStatus.AWAITING_REVIEW,
        branch: `webflow/page-${targetPage.id}`,
        pullRequestUrl: webflowAdminUrl,
        filesChanged: [`webflow:pages/${targetPage.slug || targetPage.id}`],
        startedAt: now,
        finishedAt: now,
        steps: [
          {
            at: now.toISOString(),
            step: publishMode === 'publish' ? 'webflow-update' : 'webflow-draft-staged',
            detail:
              publishMode === 'publish'
                ? `Applied ${input.field} update via Webflow Data API v2 (Page ${targetPage.slug || targetPage.id})`
                : `Staged ${input.field} locally for review without modifying Webflow page ${targetPage.slug || targetPage.id}`,
            ok: true,
            stagedPayload:
              publishMode === 'draft'
                ? {
                    platform: 'WEBFLOW',
                    findingId: input.findingId,
                    targetUrl,
                    field: input.field,
                    beforeValue,
                    afterValue: input.afterValue,
                    findingTitle: input.findingTitle,
                    webflowPageId: targetPage.id,
                    slug: targetPage.slug,
                  }
                : undefined,
            change: {
              issueId: input.findingId || `webflow-${targetPage.id}`,
              url: targetUrl,
              field: input.field,
              before: beforeValue || null,
              after: input.afterValue,
              why: input.findingTitle || 'Webflow Data API v2 SEO optimization',
              file: `Webflow Page (${targetPage.slug || 'home'})`,
              measuredAt: now.toISOString(),
              source: 'WEBFLOW_API',
              findingTitle: input.findingTitle,
            },
          },
        ],
      },
    });

    await this.prisma.fixSnapshot.createMany({
      data: [
        {
          projectId,
          automationRunId: run.id,
          url: targetUrl,
          snapshotType: 'BEFORE',
          title: beforeValue || null,
          contentSnippet: beforeValue || null,
        },
        {
          projectId,
          automationRunId: run.id,
          url: targetUrl,
          snapshotType: 'PROPOSED',
          title: seoPayload.title || null,
          metaDescription: seoPayload.description || null,
          contentSnippet: input.afterValue,
        },
      ],
    });

    await this.prisma.fixImpactLedgerEvent.create({
      data: {
        projectId,
        automationRunId: run.id,
        eventType: publishMode === 'publish' ? 'DEPLOYMENT_PUBLISHED' : 'PR_CREATED',
        title:
          publishMode === 'publish'
            ? `Webflow Fix Published: ${input.findingTitle || input.field}`
            : `Webflow Draft Staged Locally: ${input.findingTitle || input.field}`,
        description:
          publishMode === 'publish'
            ? `Updated ${input.field} on ${targetUrl} via Webflow Data API v2 (Page ${targetPage.slug || targetPage.id}).`
            : `Staged ${input.field} update locally for ${targetUrl} (Page ${targetPage.slug || targetPage.id}); Webflow was not modified.`,
        actor: 'WEBFLOW_AGENT',
        affectedUrl: targetUrl,
        pullRequestUrl: webflowAdminUrl,
        verificationStatus: publishMode === 'publish' ? 'PUBLISHED_UNVERIFIED' : 'STAGED_LOCALLY',
        evidenceData: {
          webflowPageId: targetPage.id,
          slug: targetPage.slug,
          publishMode,
          liveModified: publishMode === 'publish',
          field: input.field,
          before: beforeValue,
          after: input.afterValue,
        },
      },
    });

    const verifiedState = await this.finalizeCmsFixVerification(projectId, targetUrl, input.findingId, publishMode, {
      field: input.field,
      expected: input.afterValue,
      runId: run.id,
      actor: 'WEBFLOW_AGENT',
      pullRequestUrl: webflowAdminUrl,
    });

    return {
      success: true,
      runId: run.id,
      webflowPageId: targetPage.id,
      adminEditUrl: webflowAdminUrl,
      publishMode,
      liveModified: publishMode === 'publish',
      status:
        publishMode === 'publish'
          ? verifiedState === 'VERIFIED'
            ? 'VERIFIED_LIVE'
            : 'VERIFYING_LIVE'
          : 'STAGED_LOCALLY',
    };
  }

  /**
   * Explicitly publishes a previously staged local Webflow draft run via
   * Webflow Data API v2.
   */
  async publishStagedWebflowFix(projectId: string, runId: string) {
    const run = await this.prisma.automationRun.findFirst({
      where: { id: runId, projectId },
    });
    if (!run) {
      throw new NotFoundException(`Staged Webflow run ${runId} not found.`);
    }
    if (run.status !== AutomationRunStatus.AWAITING_REVIEW) {
      throw new BadRequestException('Only locally staged Webflow drafts awaiting review can be published.');
    }
    const steps = Array.isArray(run.steps) ? (run.steps as any[]) : [];
    const staged = steps.find((s) => s?.stagedPayload)?.stagedPayload;
    if (!staged?.targetUrl || !staged?.field || typeof staged?.afterValue !== 'string') {
      throw new BadRequestException('Staged Webflow draft payload is missing or invalid.');
    }

    const published = await this.stageWebflowFix(projectId, {
      findingId: staged.findingId,
      targetUrl: staged.targetUrl,
      field: staged.field,
      beforeValue: staged.beforeValue,
      afterValue: staged.afterValue,
      findingTitle: staged.findingTitle,
      publishMode: 'publish',
    });

    await this.prisma.automationRun
      .update({
        where: { id: runId },
        data: { status: AutomationRunStatus.MERGED, finishedAt: new Date() },
      })
      .catch(() => null);

    return published;
  }

  /**
   * 1-click CMS rollback: restores the exact saved BEFORE snapshot on WordPress,
   * Shopify, or Webflow and logs a FIX_ROLLED_BACK audit event.
   */
  async rollbackCmsRun(
    projectId: string,
    runId: string,
  ): Promise<{
    rolledBack: boolean;
    platform: 'WORDPRESS' | 'SHOPIFY' | 'WEBFLOW';
    targetUrl: string;
    field: string;
    restoredValue: string;
    message: string;
  }> {
    const run = await this.prisma.automationRun.findFirst({
      where: { id: runId, projectId },
    });
    if (!run) {
      throw new NotFoundException(`Automation run ${runId} not found.`);
    }

    const branchLower = (run.branch || '').toLowerCase();
    const steps = Array.isArray(run.steps) ? (run.steps as any[]) : [];
    const changeStep = steps.find((s) => s?.change)?.change as Record<string, any> | undefined;

    const [beforeSnapshot, ledgerEvent] = await Promise.all([
      this.prisma.fixSnapshot.findFirst({
        where: { projectId, automationRunId: runId, snapshotType: 'BEFORE' },
        orderBy: { capturedAt: 'asc' },
      }),
      this.prisma.fixImpactLedgerEvent.findFirst({
        where: {
          projectId,
          automationRunId: runId,
          actor: { in: ['WORDPRESS_AGENT', 'SHOPIFY_AGENT', 'WEBFLOW_AGENT'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const actor = String(ledgerEvent?.actor || '').toUpperCase();
    const platform: 'WORDPRESS' | 'SHOPIFY' | 'WEBFLOW' =
      actor === 'SHOPIFY_AGENT' || branchLower.startsWith('shopify/')
        ? 'SHOPIFY'
        : actor === 'WEBFLOW_AGENT' || branchLower.startsWith('webflow/')
          ? 'WEBFLOW'
          : 'WORDPRESS';

    const evidence = (ledgerEvent?.evidenceData ?? {}) as Record<string, any>;
    const targetUrl = String(
      changeStep?.url || ledgerEvent?.affectedUrl || beforeSnapshot?.url || '',
    ).trim();
    const field = String(changeStep?.field || evidence.field || 'META_TITLE').trim();
    const restoredValue = String(
      changeStep?.before ??
        evidence.before ??
        (field === 'META_DESCRIPTION'
          ? beforeSnapshot?.metaDescription
          : beforeSnapshot?.title) ??
        beforeSnapshot?.contentSnippet ??
        '',
    );

    if (!targetUrl) {
      throw new BadRequestException('Cannot roll back this CMS run: target URL is missing.');
    }
    if (!restoredValue.trim()) {
      throw new BadRequestException(
        'Cannot roll back automatically: no saved BEFORE snapshot value exists for this fix.',
      );
    }

    const rollbackInput: StageWordPressFixInput = {
      targetUrl,
      field,
      beforeValue: String(changeStep?.after || evidence.after || ''),
      afterValue: restoredValue,
      findingTitle: `Rollback: ${changeStep?.findingTitle || field}`,
      publishMode: 'publish',
    };

    if (platform === 'SHOPIFY') {
      await this.stageShopifyFix(projectId, rollbackInput);
    } else if (platform === 'WEBFLOW') {
      await this.stageWebflowFix(projectId, rollbackInput);
    } else {
      await this.stageWordPressFix(projectId, rollbackInput);
    }

    await this.prisma.fixImpactLedgerEvent.create({
      data: {
        projectId,
        automationRunId: runId,
        eventType: 'FIX_ROLLED_BACK',
        title: `${platform} Fix Rolled Back: ${field}`,
        description: `Restored saved BEFORE snapshot for ${field} on ${targetUrl} via ${platform} API.`,
        actor: `${platform}_ROLLBACK`,
        affectedUrl: targetUrl,
        verificationStatus: 'ROLLED_BACK',
        evidenceData: {
          platform,
          field,
          restoredValue,
          previousAfterValue: changeStep?.after ?? evidence.after ?? null,
        },
      },
    });

    return {
      rolledBack: true,
      platform,
      targetUrl,
      field,
      restoredValue,
      message: `Restored previous ${field} value on ${targetUrl} via ${platform}.`,
    };
  }

  async getAllCmsConnections(projectId: string) {
    const [wordpress, shopify, webflow] = await Promise.all([
      this.getConnection(projectId),
      this.getShopifyConnection(projectId),
      this.getWebflowConnection(projectId),
    ]);
    return { wordpress, shopify, webflow };
  }

  /**
   * Applies up to 15 selected SEO fixes in a single safe CMS batch against the
   * connected WordPress, Shopify, or Webflow site. Each item records its own
   * BEFORE snapshot and runId so any individual fix can be rolled back with 1 click.
   */
  async stageBatchCmsFixes(
    projectId: string,
    input: {
      platform: 'WORDPRESS' | 'SHOPIFY' | 'WEBFLOW';
      publishMode?: 'draft' | 'publish';
      items: StageWordPressFixInput[];
    },
  ) {
    const items = (input.items ?? []).slice(0, 15);
    if (items.length === 0) {
      throw new BadRequestException('Select at least one fix to apply in a CMS batch.');
    }

    const platform = input.platform;
    const publishMode = input.publishMode || 'draft';

    const results: Array<{
      findingId?: string;
      targetUrl: string;
      field: string;
      runId?: string;
      status: 'APPLIED' | 'FAILED';
      message?: string;
      error?: string;
    }> = [];

    for (const item of items) {
      const payload: StageWordPressFixInput = {
        ...item,
        publishMode: item.publishMode || publishMode,
      };
      try {
        const res =
          platform === 'SHOPIFY'
            ? await this.stageShopifyFix(projectId, payload)
            : platform === 'WEBFLOW'
              ? await this.stageWebflowFix(projectId, payload)
              : await this.stageWordPressFix(projectId, payload);

        results.push({
          findingId: item.findingId,
          targetUrl: item.targetUrl,
          field: item.field,
          runId: (res as any)?.runId,
          status: 'APPLIED',
          message: (res as any)?.message ?? `Applied to ${platform}.`,
        });
      } catch (err) {
        results.push({
          findingId: item.findingId,
          targetUrl: item.targetUrl,
          field: item.field,
          status: 'FAILED',
          error: (err as Error)?.message ?? `Failed to apply fix to ${platform}.`,
        });
      }
    }

    return {
      platform,
      publishMode,
      total: items.length,
      applied: results.filter((r) => r.status === 'APPLIED').length,
      failed: results.filter((r) => r.status === 'FAILED').length,
      results,
    };
  }

  /**
   * Publishes an approved Content Studio draft directly to WordPress, Shopify,
   * or Webflow as a new post/page draft or live article.
   */
  async publishContentDraftToCms(
    projectId: string,
    input: {
      platform: 'WORDPRESS' | 'SHOPIFY' | 'WEBFLOW';
      title: string;
      slug: string;
      metaDescription?: string | null;
      bodyHtml: string;
      publishMode?: 'draft' | 'publish';
    },
  ): Promise<{
    published: boolean;
    platform: 'WORDPRESS' | 'SHOPIFY' | 'WEBFLOW';
    externalId: string;
    externalUrl: string | null;
    status: string;
    message: string;
  }> {
    const publishMode = input.publishMode || 'draft';

    if (input.platform === 'WORDPRESS') {
      const integration = await this.prisma.integration.findUnique({
        where: { projectId_provider: { projectId, provider: 'wordpress' } },
      });
      if (!integration || integration.status !== 'CONNECTED' || !integration.accessToken || !integration.selectedResourceId) {
        throw new BadRequestException('Connect your WordPress site in Settings → Integrations first.');
      }
      const siteUrl = this.assertWordPressHttpsUrl(integration.selectedResourceId);
      const username = integration.googleAccountEmail || 'admin';
      const appPassword = this.security.decryptCredentials(integration.accessToken);
      if (!appPassword) {
        throw new BadRequestException('Stored WordPress credentials could not be decrypted. Please reconnect WordPress.');
      }
      const authHeader = this.buildBasicAuthHeader(username, appPassword);
      const wpRes = await this.safeFetch(
        `${siteUrl}/wp-json/wp/v2/posts`,
        {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            title: input.title,
            slug: input.slug,
            content: input.bodyHtml,
            excerpt: input.metaDescription || '',
            status: publishMode === 'publish' ? 'publish' : 'draft',
          }),
        },
        20000,
      );
      if (!wpRes.ok) {
        const text = await wpRes.text().catch(() => '');
        throw new BadRequestException(
          `WordPress rejected creating the post (HTTP ${wpRes.status}): ${text.slice(0, 180)}`,
        );
      }
      const created = (await wpRes.json()) as { id?: number; link?: string; status?: string };
      return {
        published: true,
        platform: 'WORDPRESS',
        externalId: String(created.id ?? ''),
        externalUrl: created.link ?? null,
        status: created.status ?? publishMode,
        message:
          publishMode === 'publish'
            ? `Published post "${input.title}" live on WordPress.`
            : `Saved "${input.title}" as a WordPress draft.`,
      };
    }

    if (input.platform === 'SHOPIFY') {
      const integration = await this.prisma.integration.findUnique({
        where: { projectId_provider: { projectId, provider: 'shopify' } },
      });
      if (!integration || integration.status !== 'CONNECTED' || !integration.accessToken || !integration.selectedResourceId) {
        throw new BadRequestException('Connect your Shopify store in Settings → Integrations first.');
      }
      const shopOrigin = this.assertShopifyAdminOrigin(integration.selectedResourceId);
      const accessToken = this.security.decryptCredentials(integration.accessToken);
      if (!accessToken) {
        throw new BadRequestException('Stored Shopify credentials could not be decrypted. Please reconnect Shopify.');
      }
      const shopifyRes = await this.safeFetch(
        `${shopOrigin}/admin/api/2024-10/pages.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            page: {
              title: input.title,
              handle: input.slug,
              body_html: input.bodyHtml,
              published: publishMode === 'publish',
              metafields: input.metaDescription
                ? [
                    {
                      namespace: 'global',
                      key: 'description_tag',
                      value: input.metaDescription,
                      type: 'single_line_text_field',
                    },
                  ]
                : undefined,
            },
          }),
        },
        20000,
      );
      if (!shopifyRes.ok) {
        const text = await shopifyRes.text().catch(() => '');
        throw new BadRequestException(
          `Shopify rejected creating the page (HTTP ${shopifyRes.status}): ${text.slice(0, 180)}`,
        );
      }
      const created = (await shopifyRes.json()) as { page?: { id?: number; handle?: string } };
      const handle = created.page?.handle ?? input.slug;
      return {
        published: true,
        platform: 'SHOPIFY',
        externalId: String(created.page?.id ?? ''),
        externalUrl: `${shopOrigin}/pages/${handle}`,
        status: publishMode === 'publish' ? 'published' : 'draft',
        message:
          publishMode === 'publish'
            ? `Published Shopify page "${input.title}" live.`
            : `Saved "${input.title}" as an unpublished Shopify page draft.`,
      };
    }

    // WEBFLOW
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'webflow' } },
    });
    if (!integration || integration.status !== 'CONNECTED' || !integration.accessToken || !integration.selectedResourceId) {
      throw new BadRequestException('Connect your Webflow site in Settings → Integrations first.');
    }
    const siteId = integration.selectedResourceId;
    const apiToken = this.security.decryptCredentials(integration.accessToken);
    if (!apiToken) {
      throw new BadRequestException('Stored Webflow credentials could not be decrypted. Please reconnect Webflow.');
    }
    const colsRes = await this.safeFetch(
      `https://api.webflow.com/v2/sites/${encodeURIComponent(siteId)}/collections`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
      },
      15000,
    );
    if (!colsRes.ok) {
      throw new BadRequestException(`Could not read Webflow CMS collections (HTTP ${colsRes.status}).`);
    }
    const colsData = (await colsRes.json()) as { collections?: Array<{ id: string; slug?: string; displayName?: string }> };
    const collections = colsData.collections ?? [];
    const targetCol =
      collections.find((c) => /blog|post|article|guide|resource/i.test(`${c.slug ?? ''} ${c.displayName ?? ''}`)) ??
      collections[0];
    if (!targetCol) {
      throw new BadRequestException(
        'No Webflow CMS collection was found on this site. Create a Blog/Articles collection in Webflow or export Markdown.',
      );
    }

    const createRes = await this.safeFetch(
      `https://api.webflow.com/v2/collections/${encodeURIComponent(targetCol.id)}/items`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          isDraft: publishMode !== 'publish',
          fieldData: {
            name: input.title,
            slug: input.slug,
          },
        }),
      },
      20000,
    );
    if (!createRes.ok) {
      const text = await createRes.text().catch(() => '');
      throw new BadRequestException(
        `Webflow rejected creating the CMS item (HTTP ${createRes.status}): ${text.slice(0, 180)}`,
      );
    }
    const created = (await createRes.json()) as { id?: string };
    return {
      published: true,
      platform: 'WEBFLOW',
      externalId: String(created.id ?? ''),
      externalUrl: integration.googleAccountEmail ? `${integration.googleAccountEmail}/${input.slug}` : null,
      status: publishMode === 'publish' ? 'staged' : 'draft',
      message: `Created item "${input.title}" in Webflow collection "${targetCol.displayName || targetCol.id}".`,
    };
  }
}
