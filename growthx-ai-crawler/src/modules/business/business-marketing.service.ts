import { Injectable, Logger, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';

/**
 * Business module, Marketing Signals — positioning/messaging claims read off
 * copy the crawl already fetched. Never a new crawl or a new data source:
 * the multi-AI router reads `Page.rawHtml` for the site's homepage (the page
 * a brand's own positioning statement lives on almost always), already
 * stored by the crawl job Website Audit runs.
 *
 * Explicitly out of scope for this pass: ad-spend and social-listening data.
 * Those are a different, higher-cost data category — on-page copy only here.
 */

export type MarketingSignalKind = 'VALUE_PROP' | 'PROMO' | 'TONE';

export interface MarketingSignalDto {
  id: string;
  kind: MarketingSignalKind;
  text: string;
  detectedAt: Date;
}

export interface MarketingSignalsResult {
  mine: MarketingSignalDto[];
  competitors: { competitor: { id: string; domain: string; label: string }; signals: MarketingSignalDto[] }[];
}

interface ExtractedSignals {
  valueProps: string[];
  promos: string[];
  tone: string | null;
}

const MAX_PAGE_TEXT_CHARS = 6000;

/**
 * Passed to the router so the reply is held to it. Without a schema the router
 * neither asks the vendor to enforce JSON nor moves on to the next provider
 * when the first answers in prose — and the fast providers this task routes to
 * first often wrap their JSON in a code fence, which a bare `JSON.parse`
 * rejects.
 */
const MARKETING_SCHEMA = {
  type: 'object',
  properties: {
    valueProps: {
      type: 'array',
      items: { type: 'string' },
      description: 'Short value-proposition phrases actually stated on the page, at most 5.',
    },
    promos: {
      type: 'array',
      items: { type: 'string' },
      description: 'Promos, discounts or offers actually stated on the page, at most 5. Empty if none.',
    },
    tone: {
      type: 'string',
      description: "One short phrase describing the page's tone.",
    },
  },
  required: ['valueProps', 'promos', 'tone'],
};

/** Everything in a document that is not copy a visitor reads. */
const NON_COPY_ELEMENTS = 'script, style, noscript, template, svg, iframe';

const PAGE_FIELDS = {
  id: true,
  title: true,
  metaDescription: true,
  h1: true,
  rawHtml: true,
  renderedHtml: true,
} as const;

interface CopySource {
  title: string | null;
  metaDescription: string | null;
  h1: string[];
  rawHtml: string | null;
  renderedHtml?: string | null;
}

@Injectable()
export class BusinessMarketingService {
  private readonly logger = new Logger(BusinessMarketingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouter: MultiAiRouterService,
  ) {}

  async getSignals(projectId: string): Promise<MarketingSignalsResult> {
    const [mineRows, competitors] = await Promise.all([
      this.prisma.marketingSignal.findMany({ where: { projectId, competitorId: null }, orderBy: { detectedAt: 'desc' } }),
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        select: { id: true, domain: true, label: true, name: true },
      }),
    ]);

    const competitorResults = await Promise.all(
      competitors.map(async (competitor) => ({
        competitor: { id: competitor.id, domain: competitor.domain, label: competitor.label ?? competitor.name ?? competitor.domain },
        signals: toDto(
          await this.prisma.marketingSignal.findMany({ where: { projectId, competitorId: competitor.id }, orderBy: { detectedAt: 'desc' } }),
        ),
      })),
    );

    return { mine: toDto(mineRows), competitors: competitorResults };
  }

  /** Regenerates the project's own signals from its own crawled homepage. */
  async generateForOwnSite(organizationId: string, projectId: string): Promise<MarketingSignalDto[]> {
    const page = await this.representativePage({ crawlJob: { website: { projectId } } });
    if (!page) throw new NotFoundException('No crawled page found yet — run a Website Audit crawl first.');

    const extracted = await this.extract(organizationId, projectId, page);
    return this.persist({ organizationId, projectId, competitorId: null, pageId: page.id, extracted });
  }

  /** Regenerates one competitor's signals from their own crawled homepage. */
  async generateForCompetitor(organizationId: string, projectId: string, competitorId: string): Promise<MarketingSignalDto[]> {
    const competitor = await this.prisma.competitorDomain.findFirst({ where: { id: competitorId, projectId } });
    if (!competitor) throw new NotFoundException('Competitor not found for this project.');
    if (!competitor.websiteId) throw new NotFoundException('This competitor has not been crawled yet.');

    const page = await this.representativePage({ crawlJob: { websiteId: competitor.websiteId } });
    if (!page) throw new NotFoundException('No crawled page found yet for this competitor — crawl them first.');

    const extracted = await this.extract(organizationId, projectId, page);
    return this.persist({ organizationId, projectId, competitorId, pageId: page.id, extracted });
  }

  private async representativePage(scope: { crawlJob: { website?: { projectId: string }; websiteId?: string } }) {
    const home = await this.prisma.page.findFirst({
      where: { ...scope, statusCode: 200, pageType: 'HOME' },
      orderBy: { crawledAt: 'desc' },
      select: PAGE_FIELDS,
    });
    if (home) return home;

    // No page classified HOME (rare, but a site with an unusual URL structure
    // can miss it) — the most content-rich page is a reasonable stand-in.
    return this.prisma.page.findFirst({
      where: { ...scope, statusCode: 200 },
      orderBy: { wordCount: 'desc' },
      select: PAGE_FIELDS,
    });
  }

  /**
   * Reads the page with the multi-AI router.
   *
   * Every failure here throws, and throws before `persist` runs. It used to
   * return "nothing found" instead, which `persist` then wrote — deleting the
   * last good read — and the screen went back to its empty state with no
   * message, so a customer clicking "Read your positioning" saw nothing happen.
   */
  private async extract(organizationId: string, projectId: string, page: CopySource): Promise<ExtractedSignals> {
    const pageText = pageCopy(page);
    if (!pageText.trim()) {
      throw new UnprocessableEntityException(
        'We found the page but could not read any text on it. Run a new Website Audit and try again.',
      );
    }

    const prompt = `Read this webpage's own copy and extract its marketing positioning. Do not invent anything not actually said on the page.

PAGE COPY:
"""
${pageText}
"""

Respond ONLY in valid JSON matching this schema:
{
  "valueProps": ["short value-proposition phrases actually stated on the page, at most 5"],
  "promos": ["any promo, discount or offer actually stated on the page, at most 5 — empty array if none"],
  "tone": "one short phrase describing the page's tone (e.g. 'premium and formal', 'playful and casual', 'plain B2B/technical')"
}`;

    let text: string;
    try {
      const res = await this.aiRouter.generate({
        prompt,
        systemInstruction: 'You extract only what a webpage actually says about itself. Return only JSON, nothing invented.',
        task: AiTask.CONTENT_STRUCTURE_ANALYSIS,
        organizationId,
        projectId,
        jsonSchema: MARKETING_SCHEMA,
      });
      if (res.refused) throw new Error(`${res.provider} declined to read the page`);
      text = res.text;
    } catch (err) {
      this.logger.warn(`Marketing signal extraction failed for project ${projectId}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'The AI could not read your page just now. Your previous results are unchanged — please try again in a minute.',
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = parseModelJson(text, 'Marketing signals');
    } catch (err) {
      this.logger.warn(`Marketing signal extraction returned unusable output for project ${projectId}: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'The AI returned an answer we could not read. Your previous results are unchanged — please try again.',
      );
    }

    return {
      valueProps: cleanList(parsed.valueProps),
      promos: cleanList(parsed.promos),
      tone: typeof parsed.tone === 'string' && parsed.tone.trim() ? parsed.tone.trim() : null,
    };
  }

  private async persist(params: {
    organizationId: string;
    projectId: string;
    competitorId: string | null;
    pageId: string;
    extracted: ExtractedSignals;
  }): Promise<MarketingSignalDto[]> {
    const { organizationId, projectId, competitorId, pageId, extracted } = params;

    // Regenerating replaces the previous read rather than appending to it —
    // a stale value prop from three crawls ago sitting next to a fresh one
    // would read as if the page said both at once.
    await this.prisma.marketingSignal.deleteMany({ where: { projectId, competitorId } });

    const rows = [
      ...extracted.valueProps.map((text) => ({ kind: 'VALUE_PROP' as const, text })),
      ...extracted.promos.map((text) => ({ kind: 'PROMO' as const, text })),
      ...(extracted.tone ? [{ kind: 'TONE' as const, text: extracted.tone }] : []),
    ];
    if (rows.length === 0) return [];

    await this.prisma.marketingSignal.createMany({
      data: rows.map((row) => ({ organizationId, projectId, competitorId, pageId, kind: row.kind, text: row.text })),
    });

    return toDto(
      await this.prisma.marketingSignal.findMany({ where: { projectId, competitorId }, orderBy: { detectedAt: 'desc' } }),
    );
  }
}

/**
 * The words a visitor actually reads on the page.
 *
 * Prefers the rendered DOM: on a site built in the browser the served HTML is
 * an empty shell and the copy only exists after scripts run. Scripts, styles
 * and inline SVG come out before the text is taken — `$('body').text()`
 * includes the contents of every `<script>` in the body, and on a Shopify or
 * Next.js page those JSON blobs alone can fill the whole character budget, so
 * the model was being sent code instead of the homepage's copy.
 */
export function pageCopy(page: CopySource): string {
  const html = page.renderedHtml || page.rawHtml;
  let bodyText = '';
  if (html) {
    const $ = cheerio.load(html);
    $(NON_COPY_ELEMENTS).remove();
    bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  }
  return [page.title, page.metaDescription, page.h1.join(' — '), bodyText]
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_PAGE_TEXT_CHARS);
}

/** Up to five non-empty strings, whatever shape the model returned. */
function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function toDto(rows: { id: string; kind: string; text: string; detectedAt: Date }[]): MarketingSignalDto[] {
  return rows.map((row) => ({ id: row.id, kind: row.kind as MarketingSignalKind, text: row.text, detectedAt: row.detectedAt }));
}
