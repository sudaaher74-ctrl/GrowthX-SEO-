import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { FindingLifecycle, Prisma } from '@prisma/client';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { assertPublicUrl, isPrivateAddress, publicAxios, SSRF_ERROR_CODE, SsrfBlockedError } from '../security/ssrf';
import { FetchService } from '../crawler/fetch/fetch.service';
import { normalizeUrl } from '../crawler/url/url-normalizer';
import type { LifecycleActor, LifecycleTransitionRecord } from './lifecycle.service';

export interface LiveSignalCheck {
  name: string;
  passed: boolean;
  observed: string;
}

export interface ManualVerificationResult {
  findingId: string;
  verified: boolean;
  url: string;
  httpStatus: number | null;
  checkedAt: string;
  checks: LiveSignalCheck[];
  observed: {
    title: string | null;
    titles?: string[];
    metaDescription: string | null;
    metaDescriptions?: string[];
    h1: string | null;
    canonicalUrl: string | null;
    canonicalUrls?: string[];
    robotsDirectives: string | null;
    xRobotsTag?: string | null;
    renderUnavailable?: boolean;
    jsonLdCount: number;
    jsonLdTypes: string[];
  } | null;
  summary: string;
  ledgerEventId: string | null;
  lifecycle: FindingLifecycle;
}

const SEARCH_INDEX_BOTS = new Set(['*', 'googlebot', 'googlebot-news', 'googlebot-image', 'bingbot', 'growthxbot']);

function hasSearchNoindexDirective(value: string | null | undefined): boolean {
  if (!value) return false;
  const clauses = value.toLowerCase().split(/[,;]+/).map((c) => c.trim()).filter(Boolean);
  for (const clause of clauses) {
    const botMatch = clause.match(/^([a-z0-9_*-]+)\s*:\s*(.+)$/);
    if (botMatch) {
      const bot = botMatch[1].trim();
      const tokens = botMatch[2].trim().split(/\s+/);
      if (SEARCH_INDEX_BOTS.has(bot) && tokens.some((t) => t === 'noindex' || t === 'none')) {
        return true;
      }
      continue;
    }
    const tokens = clause.split(/\s+/);
    if (tokens.some((t) => t === 'noindex' || t === 'none')) {
      return true;
    }
  }
  return false;
}

function normalizeCandidateUrl(raw: string | null | undefined, fallbackDomain: string | null): string | null {
  const input = (raw ?? '').trim();
  if (!input) {
    return fallbackDomain ? `https://${fallbackDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '')}/` : null;
  }
  if (/^https?:\/\//i.test(input)) return input;
  if (input.startsWith('/') && fallbackDomain) {
    const cleanHost = fallbackDomain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    return `https://${cleanHost}${input}`;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(input)) {
    return `https://${input}`;
  }
  return null;
}

function extractJsonLdTypes(rawBlocks: string[]): string[] {
  const types = new Set<string>();
  const collect = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    const obj = node as Record<string, unknown>;
    const rawType = obj['@type'];
    if (typeof rawType === 'string' && rawType.trim()) types.add(rawType.trim());
    if (Array.isArray(rawType)) {
      rawType.forEach((t) => {
        if (typeof t === 'string' && t.trim()) types.add(t.trim());
      });
    }
    if (Array.isArray(obj['@graph'])) collect(obj['@graph']);
  };

  for (const raw of rawBlocks) {
    try {
      collect(JSON.parse(raw));
    } catch {
      // Malformed JSON-LD does not count as valid structured data
    }
  }
  return [...types];
}

export function evaluateFindingLiveSignals(
  finding: { title: string; summary: string; recommendedAction: string; source: string },
  httpStatus: number,
  observed: {
    title: string | null;
    titles?: string[];
    metaDescription: string | null;
    metaDescriptions?: string[];
    h1: string | null;
    canonicalUrl: string | null;
    canonicalUrls?: string[];
    robotsDirectives: string | null;
    xRobotsTag?: string | null;
    renderUnavailable?: boolean;
    jsonLdCount: number;
    jsonLdTypes: string[];
  },
  targetUrl?: string,
): LiveSignalCheck[] {
  const hay = `${finding.title} ${finding.summary} ${finding.recommendedAction}`.toLowerCase();
  const checks: LiveSignalCheck[] = [
    {
      name: 'Live HTTP status',
      passed: httpStatus >= 200 && httpStatus < 400,
      observed: `HTTP ${httpStatus}`,
    },
  ];

  if (observed.renderUnavailable) {
    checks.push({
      name: 'Rendered page assessment',
      passed: false,
      observed: 'JavaScript rendering was unavailable; live DOM could not be verified safely.',
    });
  }

  let matchedSpecificRule = 0;

  if (/\btitle\b|title tag/.test(hay)) {
    matchedSpecificRule++;
    const titles = observed.titles ?? (observed.title ? [observed.title] : []);
    const uniqueTitles = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
    const len = uniqueTitles[0]?.length ?? 0;
    const singleValid = titles.length === 1 && len >= 10;
    checks.push({
      name: 'Page <title> present and unique',
      passed: singleValid,
      observed:
        titles.length > 1
          ? `Conflicting <title> tags (${titles.length}): ${uniqueTitles.slice(0, 3).map((t) => `"${t.slice(0, 50)}"`).join(' vs. ')}`
          : observed.title
            ? `"${observed.title.slice(0, 80)}" (${len} chars)`
            : 'Missing <title>',
    });
  }

  if (/meta description|description tag/.test(hay)) {
    matchedSpecificRule++;
    const descriptions = observed.metaDescriptions ?? (observed.metaDescription ? [observed.metaDescription] : []);
    const uniqueDescs = [...new Set(descriptions.map((d) => d.trim()).filter(Boolean))];
    const len = uniqueDescs[0]?.length ?? 0;
    const singleValid = descriptions.length === 1 && len >= 30;
    checks.push({
      name: 'Meta description present and unique',
      passed: singleValid,
      observed:
        descriptions.length > 1
          ? `Conflicting meta description tags (${descriptions.length})`
          : observed.metaDescription
            ? `"${observed.metaDescription.slice(0, 90)}" (${len} chars)`
            : 'Missing meta description',
    });
  }

  if (/\bh1\b|primary heading|main heading/.test(hay)) {
    matchedSpecificRule++;
    checks.push({
      name: 'Primary <h1> present',
      passed: Boolean(observed.h1 && observed.h1.length >= 3),
      observed: observed.h1 ? `"${observed.h1.slice(0, 80)}"` : 'Missing <h1>',
    });
  }

  if (/canonical/.test(hay)) {
    matchedSpecificRule++;
    const rawCanonicals = observed.canonicalUrls ?? (observed.canonicalUrl ? [observed.canonicalUrl] : []);
    const normalizedCanonicals = [...new Set(rawCanonicals.map((c) => normalizeUrl(c)).filter(Boolean))];
    const normalizedTarget = targetUrl ? normalizeUrl(targetUrl) : null;
    const hasSingleCanonical = rawCanonicals.length === 1 && normalizedCanonicals.length === 1;
    const matchesTarget = !normalizedTarget || normalizedCanonicals[0] === normalizedTarget;
    const isHttpUrl = Boolean(rawCanonicals[0] && /^https?:\/\//i.test(rawCanonicals[0]));
    checks.push({
      name: 'Canonical tag valid and unambiguous',
      passed: hasSingleCanonical && isHttpUrl && matchesTarget,
      observed:
        normalizedCanonicals.length > 1
          ? `Conflicting canonical targets (${normalizedCanonicals.length}): ${normalizedCanonicals.join(', ')}`
          : rawCanonicals.length === 0
            ? 'Missing canonical <link>'
            : !matchesTarget
              ? `Canonical points elsewhere: ${rawCanonicals[0]} (expected ${targetUrl})`
              : rawCanonicals[0],
    });
  }

  if (/\b(json-ld|schema|structured data|localbusiness|faqpage|organization)\b/i.test(hay)) {
    matchedSpecificRule++;
    checks.push({
      name: 'Valid JSON-LD schema detected',
      passed: observed.jsonLdCount > 0,
      observed:
        observed.jsonLdCount > 0
          ? `${observed.jsonLdCount} block(s): ${observed.jsonLdTypes.join(', ') || 'JSON-LD'}`
          : 'No valid JSON-LD found',
    });
  }

  if (/noindex|blocked by robots|indexability/.test(hay)) {
    matchedSpecificRule++;
    const metaNoindex = hasSearchNoindexDirective(observed.robotsDirectives);
    const headerNoindex = hasSearchNoindexDirective(observed.xRobotsTag);
    const hasNoindex = metaNoindex || headerNoindex;
    checks.push({
      name: 'Page allows search indexing',
      passed: !hasNoindex,
      observed: headerNoindex
        ? `X-Robots-Tag: ${observed.xRobotsTag}`
        : metaNoindex
          ? `<meta name="robots" content="${observed.robotsDirectives}">`
          : observed.robotsDirectives || 'Indexable (no search noindex directive)',
    });
  }

  if (matchedSpecificRule === 0) {
    checks.push({
      name: 'Fix-specific live check',
      passed: false,
      observed:
        'Automatic single-URL verification is not supported for this finding type (HTTP 200 alone cannot prove resolution). Run a full site recrawl to verify.',
    });
  }

  return checks;
}

/**
 * Closes the loop for manual implementations shipped outside GitHub/CMS Fix Engine:
 * fetches the live public URL (with SSRF protection and Playwright rendering when
 * FetchService is available), verifies real HTML/HTTP signals, and — ONLY when
 * fix-specific checks pass — records VERIFIED_LIVE proof.
 */
@Injectable()
export class ManualVerificationService {
  private readonly logger = new Logger(ManualVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly fetchService?: FetchService,
  ) {}

  async verifyManualFix(
    projectId: string,
    findingId: string,
    actor: LifecycleActor,
    options: { url?: string; note?: string } = {},
  ): Promise<ManualVerificationResult> {
    const finding = await this.prisma.growthOpportunity.findFirst({
      where: { id: findingId, projectId },
    });
    if (!finding) {
      throw new NotFoundException(`Finding ${findingId} not found`);
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { select: { domain: true }, take: 1 } },
    });
    const fallbackDomain = project?.websites?.[0]?.domain ?? null;

    const affectedPages = Array.isArray(finding.affectedPages)
      ? finding.affectedPages.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
      : [];

    const targetUrl = normalizeCandidateUrl(options.url || affectedPages[0], fallbackDomain);
    if (!targetUrl) {
      throw new BadRequestException(
        'Provide a valid public URL (https://...) to verify this manual fix live.',
      );
    }

    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new BadRequestException('Only public http:// and https:// URLs can be verified live.');
      }
      const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
      if (
        isPrivateAddress(host) ||
        /^(localhost|localhost\.localdomain|ip6-localhost|ip6-loopback)$|\.(localhost|local|internal|intranet|lan|home\.arpa)$/i.test(host)
      ) {
        throw new BadRequestException(`Refusing to verify private or local address (${host}).`);
      }
      assertPublicUrl(targetUrl);
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(err?.message || 'Target URL is not a permitted public address.');
    }

    const checkedAt = new Date();
    let httpStatus: number | null = null;
    let html = '';
    let finalUrl = targetUrl;
    let xRobotsTag: string | null = null;
    let renderUnavailable = false;

    try {
      if (this.fetchService) {
        const outcome = await this.fetchService.fetch(targetUrl, { renderAllowed: true });
        if (outcome.error) {
          throw new Error(outcome.error.message || 'Live URL could not be reached.');
        }
        httpStatus = typeof outcome.statusCode === 'number' ? outcome.statusCode : null;
        html = outcome.html || '';
        finalUrl = outcome.finalUrl || targetUrl;
        xRobotsTag = outcome.headers?.['x-robots-tag'] || null;
        renderUnavailable = Boolean(outcome.renderUnavailable);
      } else {
        const response = await publicAxios.get<string>(targetUrl, {
          timeout: 12_000,
          maxRedirects: 5,
          responseType: 'text',
          validateStatus: () => true,
          headers: {
            'User-Agent': 'ReigelBot/1.0 (+https://www.reigel.in/verification)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        httpStatus = typeof response.status === 'number' ? response.status : null;
        html = typeof response.data === 'string' ? response.data : '';
        const rawHeader = (response as any)?.headers?.['x-robots-tag'];
        xRobotsTag = Array.isArray(rawHeader) ? rawHeader.join(', ') : typeof rawHeader === 'string' ? rawHeader : null;
      }
    } catch (err: any) {
      if (err instanceof SsrfBlockedError || err?.code === SSRF_ERROR_CODE) {
        throw new BadRequestException(err?.message || 'Blocked unsafe redirect or private address.');
      }
      const message = err instanceof Error ? err.message : 'Live URL could not be reached.';
      this.logger.warn(`Manual live verification fetch failed for ${targetUrl}: ${message}`);
      return {
        findingId,
        verified: false,
        url: targetUrl,
        httpStatus: null,
        checkedAt: checkedAt.toISOString(),
        checks: [{ name: 'Live URL reachable', passed: false, observed: message }],
        observed: null,
        summary: `Could not reach ${targetUrl} (${message}). Finding was NOT marked verified.`,
        ledgerEventId: null,
        lifecycle: finding.lifecycle,
      };
    }

    const $ = cheerio.load(html || '');
    const titles = $('title')
      .map((_, el) => $(el).text().replace(/\s+/g, ' ').trim())
      .get()
      .filter(Boolean);
    const title = titles[0] || null;

    const metaDescriptions = $('meta[name]')
      .filter((_, el) => ($(el).attr('name') || '').trim().toLowerCase() === 'description')
      .map((_, el) => ($(el).attr('content') || '').trim())
      .get()
      .filter(Boolean);
    const metaDescription = metaDescriptions[0] || null;

    const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim() || null;

    const canonicalUrls = $('link[rel]')
      .filter((_, el) => ($(el).attr('rel') || '').toLowerCase().split(/\s+/).includes('canonical'))
      .map((_, el) => {
        const href = ($(el).attr('href') || '').trim();
        if (!href) return '';
        try {
          return new URL(href, finalUrl).toString();
        } catch {
          return href;
        }
      })
      .get()
      .filter(Boolean);
    const canonicalUrl = canonicalUrls[0] || null;

    const robotsValues = $('meta[name]')
      .filter((_, el) => {
        const name = ($(el).attr('name') || '').trim().toLowerCase();
        return name === 'robots' || name === 'googlebot';
      })
      .map((_, el) => ($(el).attr('content') || '').trim())
      .get()
      .filter(Boolean);
    const robotsDirectives = robotsValues.length > 0 ? robotsValues.join(', ') : null;

    const rawJsonLd: string[] = [];
    $('script[type="application/ld+json"]').each((_idx, el) => {
      const text = $(el).html()?.trim();
      if (text) rawJsonLd.push(text);
    });
    const jsonLdTypes = extractJsonLdTypes(rawJsonLd);

    const observed = {
      title,
      titles,
      metaDescription,
      metaDescriptions,
      h1,
      canonicalUrl,
      canonicalUrls,
      robotsDirectives,
      xRobotsTag,
      renderUnavailable,
      jsonLdCount: jsonLdTypes.length > 0 ? rawJsonLd.length : 0,
      jsonLdTypes,
    };

    const checks = evaluateFindingLiveSignals(
      {
        title: finding.title,
        summary: finding.summary,
        recommendedAction: finding.recommendedAction,
        source: finding.source,
      },
      httpStatus ?? 0,
      observed,
      finalUrl,
    );

    const allPassed = checks.every((c) => c.passed);

    if (!allPassed) {
      const failedLabels = checks.filter((c) => !c.passed).map((c) => `${c.name} (${c.observed})`);
      return {
        findingId,
        verified: false,
        url: targetUrl,
        httpStatus,
        checkedAt: checkedAt.toISOString(),
        checks,
        observed,
        summary: `Live check on ${targetUrl} did not pass: ${failedLabels.join('; ')}. Finding remains open.`,
        ledgerEventId: null,
        lifecycle: finding.lifecycle,
      };
    }

    const htmlHash = createHash('sha256').update(html).digest('hex').slice(0, 32);
    const note = options.note?.trim() || null;

    if (this.prisma.fixSnapshot?.create) {
      await this.prisma.fixSnapshot.create({
        data: {
          projectId,
          url: targetUrl,
          snapshotType: 'VERIFIED_LIVE',
          title,
          metaDescription,
          h1,
          canonicalUrl,
          robotsDirectives,
          structuredData: jsonLdTypes as unknown as Prisma.InputJsonValue,
          htmlContentHash: htmlHash,
          capturedAt: checkedAt,
        },
      });
    }

    let ledgerEventId: string | null = null;
    if (this.prisma.fixImpactLedgerEvent?.create) {
      const event = await this.prisma.fixImpactLedgerEvent.create({
        data: {
          projectId,
          eventType: 'TECHNICAL_FIX_CONFIRMED',
          title: `Manual Fix Verified Live: ${finding.title}`,
          description: note
            ? `${note} — Live check passed (${checks.map((c) => c.name).join(', ')}).`
            : `Live URL check passed on ${targetUrl} (${checks.map((c) => `${c.name}: ${c.observed}`).join('; ')}).`,
          actor: actor.id ? `USER:${actor.id}` : 'USER_MANUAL',
          affectedUrl: targetUrl,
          verificationStatus: 'VERIFIED_LIVE',
          evidenceData: {
            findingId,
            source: finding.source,
            httpStatus,
            checks,
            observed,
            note,
          } as unknown as Prisma.InputJsonValue,
        },
      });
      ledgerEventId = event.id;
    }

    const existingTransitions = Array.isArray(finding.transitions)
      ? (finding.transitions as unknown as LifecycleTransitionRecord[])
      : [];

    const transitionRecord: LifecycleTransitionRecord = {
      from: finding.lifecycle,
      to: FindingLifecycle.VERIFIED,
      at: checkedAt.toISOString(),
      actor,
      reason: note
        ? `Manual fix verified live on ${targetUrl}: ${note}`
        : `Manual fix verified live on ${targetUrl}`,
    };

    const updated = await this.prisma.growthOpportunity.update({
      where: { id: findingId },
      data: {
        lifecycle: FindingLifecycle.VERIFIED,
        status: 'ACTIONED',
        resolvedAt: checkedAt,
        lastTransitionAt: checkedAt,
        transitions: [...existingTransitions, transitionRecord] as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      findingId,
      verified: true,
      url: targetUrl,
      httpStatus,
      checkedAt: checkedAt.toISOString(),
      checks,
      observed,
      summary: `Verified live on ${targetUrl} (HTTP ${httpStatus}) and logged to your Results Ledger.`,
      ledgerEventId,
      lifecycle: updated.lifecycle,
    };
  }
}
