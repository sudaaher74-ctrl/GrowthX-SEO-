import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PrismaService } from '../../database/prisma.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

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
      select: { id: true, title: true, metaDescription: true, h1: true, rawHtml: true },
    });
    if (home) return home;

    // No page classified HOME (rare, but a site with an unusual URL structure
    // can miss it) — the most content-rich page is a reasonable stand-in.
    return this.prisma.page.findFirst({
      where: { ...scope, statusCode: 200 },
      orderBy: { wordCount: 'desc' },
      select: { id: true, title: true, metaDescription: true, h1: true, rawHtml: true },
    });
  }

  private async extract(
    organizationId: string,
    projectId: string,
    page: { title: string | null; metaDescription: string | null; h1: string[]; rawHtml: string | null },
  ): Promise<ExtractedSignals> {
    const bodyText = page.rawHtml ? cheerio.load(page.rawHtml)('body').text().replace(/\s+/g, ' ').trim() : '';
    const pageText = [page.title, page.metaDescription, page.h1.join(' — '), bodyText]
      .filter(Boolean)
      .join('\n')
      .slice(0, MAX_PAGE_TEXT_CHARS);

    if (!pageText.trim()) return { valueProps: [], promos: [], tone: null };

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

    try {
      const res = await this.aiRouter.generate({
        prompt,
        systemInstruction: 'You extract only what a webpage actually says about itself. Return only JSON, nothing invented.',
        task: AiTask.CONTENT_STRUCTURE_ANALYSIS,
        organizationId,
        projectId,
      });
      const parsed = JSON.parse(res.text);
      return {
        valueProps: Array.isArray(parsed.valueProps) ? parsed.valueProps.filter((v: unknown) => typeof v === 'string').slice(0, 5) : [],
        promos: Array.isArray(parsed.promos) ? parsed.promos.filter((v: unknown) => typeof v === 'string').slice(0, 5) : [],
        tone: typeof parsed.tone === 'string' ? parsed.tone : null,
      };
    } catch (err) {
      this.logger.warn(`Marketing signal extraction failed: ${(err as Error).message}`);
      return { valueProps: [], promos: [], tone: null };
    }
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

function toDto(rows: { id: string; kind: string; text: string; detectedAt: Date }[]): MarketingSignalDto[] {
  return rows.map((row) => ({ id: row.id, kind: row.kind as MarketingSignalKind, text: row.text, detectedAt: row.detectedAt }));
}
