import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AutomationRunKind, AutomationRunStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SecurityService } from '../security/security.service';
import { assertPublicUrl, browserMayLoad, SsrfBlockedError } from '../security/ssrf';

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

@Injectable()
export class WordPressCmsService {
  private readonly logger = new Logger(WordPressCmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly security: SecurityService,
  ) {}

  private normalizeSiteUrl(rawUrl: string): string {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
      throw new BadRequestException('WordPress site URL is required.');
    }
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try {
      parsed = new URL(withProtocol);
    } catch {
      throw new BadRequestException('Enter a valid WordPress site URL.');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http:// and https:// WordPress site URLs are supported.');
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException('Do not embed credentials inside the WordPress site URL.');
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

  private async assertSafeOutboundUrl(targetUrl: string): Promise<URL> {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      throw new BadRequestException('Invalid target URL.');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BadRequestException('Only http:// and https:// URLs are allowed.');
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException('Credentials in URLs are not permitted.');
    }
    try {
      assertPublicUrl(parsed.toString());
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    const allowed = await browserMayLoad(parsed.toString());
    if (!allowed) {
      throw new BadRequestException(
        `Refusing to connect to an internal or reserved address: ${parsed.hostname}`,
      );
    }
    return parsed;
  }

  /**
   * Executes an outbound HTTP request after verifying that the target URL and
   * any redirect hops resolve exclusively to public internet addresses. Strips
   * Authorization headers if a redirect ever crosses origins.
   */
  private async safeFetch(url: string, init: RequestInit, timeoutMs = 15000): Promise<Response> {
    let currentUrl = url;
    const initialOrigin = (await this.assertSafeOutboundUrl(currentUrl)).origin;
    const maxRedirects = 3;

    for (let hop = 0; hop <= maxRedirects; hop++) {
      const currentParsed = hop === 0 ? new URL(currentUrl) : await this.assertSafeOutboundUrl(currentUrl);
      const headers = new Headers(init.headers ?? {});
      if (currentParsed.origin !== initialOrigin) {
        headers.delete('Authorization');
      }

      const response = await fetch(currentUrl, {
        ...init,
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return response;
        if (hop === maxRedirects) {
          throw new BadRequestException('Too many redirects from target site.');
        }
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }

      return response;
    }

    throw new BadRequestException('Too many redirects from target site.');
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
    const siteUrl = this.normalizeSiteUrl(input.siteUrl);
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

    const siteUrl = integration.selectedResourceId;
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

    // If draft mode and title/content changed, use /autosaves endpoint so a revision is created without overwriting live content unreviewed,
    // or update meta fields directly.
    const targetEndpoint =
      publishMode === 'draft' && (updateBody.title || updateBody.content)
        ? `${siteUrl}/wp-json/wp/v2/${endpointType}/${wpItem.id}/autosaves`
        : `${siteUrl}/wp-json/wp/v2/${endpointType}/${wpItem.id}`;

    const updateRes = await this.safeFetch(targetEndpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Reigel-SEO-Agent/1.0',
      },
      body: JSON.stringify(updateBody),
    }, 15000);

    if (!updateRes.ok) {
      const errText = await updateRes.text().catch(() => '');
      throw new BadRequestException(
        `WordPress REST API rejected the update (HTTP ${updateRes.status}): ${errText.slice(0, 200)}`,
      );
    }

    const updatedWp = (await updateRes.json()) as any;
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
            step: 'wordpress-update',
            detail:
              publishMode === 'publish'
                ? `Published ${input.field} directly via WordPress REST API (${endpointType} #${wpItem.id})`
                : `Staged ${input.field} revision in WordPress (${endpointType} #${wpItem.id})`,
            ok: true,
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
          snapshotType: publishMode === 'publish' ? 'VERIFIED_LIVE' : 'PROPOSED',
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
        eventType: publishMode === 'publish' ? 'DEPLOYMENT_VERIFIED' : 'PR_CREATED',
        title:
          publishMode === 'publish'
            ? `WordPress Fix Published: ${input.findingTitle || input.field}`
            : `WordPress Revision Staged: ${input.findingTitle || input.field}`,
        description: `Applied ${input.field} update on ${targetUrl} via WordPress REST API (${endpointType} #${wpItem.id}).`,
        actor: 'WORDPRESS_AGENT',
        affectedUrl: targetUrl,
        pullRequestUrl: wpAdminEditUrl,
        verificationStatus: publishMode === 'publish' ? 'VERIFIED_LIVE' : 'AWAITING_REVIEW',
        evidenceData: {
          wpPostId: wpItem.id,
          wpRevisionId: updatedWp?.id || wpItem.id,
          endpointType,
          publishMode,
          field: input.field,
          before: beforeValue,
          after: input.afterValue,
        },
      },
    });

    if (input.findingId) {
      await this.prisma.growthOpportunity
        .update({
          where: { id: input.findingId },
          data: {
            lifecycle: publishMode === 'publish' ? 'VERIFIED' : 'VERIFYING',
          },
        })
        .catch(() => null);
    }

    return {
      success: true,
      runId: run.id,
      wpPostId: wpItem.id,
      wpAdminEditUrl,
      publishMode,
      status: publishMode === 'publish' ? 'VERIFIED_LIVE' : 'STAGED_IN_WORDPRESS',
    };
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

    const normalizedHtml = html.replace(/\s+/g, ' ').toLowerCase();
    const normalizedExpected = expected.replace(/\s+/g, ' ').trim().toLowerCase();

    let verified = false;
    let detectedLiveValue = '';

    if (input.field === 'META_TITLE') {
      detectedLiveValue = liveTitle;
      verified =
        liveTitle.toLowerCase().includes(normalizedExpected) ||
        normalizedHtml.includes(normalizedExpected);
    } else if (input.field === 'META_DESCRIPTION') {
      detectedLiveValue = liveDescription;
      verified =
        liveDescription.toLowerCase().includes(normalizedExpected) ||
        normalizedHtml.includes(normalizedExpected);
    } else {
      detectedLiveValue = normalizedHtml.includes(normalizedExpected) ? expected : liveTitle || 'Live HTML';
      verified = normalizedHtml.includes(normalizedExpected);
    }

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
        eventType: verified ? 'TECHNICAL_FIX_CONFIRMED' : 'DEPLOYMENT_VERIFIED',
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

    if (input.findingId && verified) {
      await this.prisma.growthOpportunity
        .update({
          where: { id: input.findingId },
          data: { lifecycle: 'VERIFIED' },
        })
        .catch(() => null);
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
}
