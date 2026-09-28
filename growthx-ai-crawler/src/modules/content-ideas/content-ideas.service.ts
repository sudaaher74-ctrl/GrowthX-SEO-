import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SearchDemandService } from '../integrations/google/search-demand.service';
import {
  demandPromptLines,
  indexSearches,
  measure,
  Measured,
  MeasuredSearch,
  SearchDataStatus,
  SearchDemand,
} from '../integrations/google/search-demand';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';

/**
 * Search phrases to use and blog posts to write, suggested by Sarvam 105B
 * alongside every AI-written report.
 *
 * Reports said what was wrong and what competitors had; none of them told a
 * business owner which words their customers type into Google or what to
 * write about next, which is the question they actually ask. This answers it
 * from what the business's own website says it sells, and — in the
 * competitor report — from the topics and questions rivals cover that the
 * business does not.
 *
 * A separate call from the report's own analysis, run beside it: the
 * analysis already fills most of Sarvam's output allowance, and suggestions
 * appended to it would be the part cut off. Nothing here is a measurement,
 * so the prompt forbids numbers and the screen labels these as suggestions.
 */

export interface KeywordIdea {
  /** What a customer would type into Google. */
  phrase: string;
  /** Who searches it and why it fits, in one plain sentence. */
  why: string;
  /** The existing page that should use it (a path), or null for a new page. */
  usePage: string | null;
  /**
   * Google's own numbers for this phrase, when it is one of the searches the
   * site already appeared in (Search Console). Null means it is a suggestion
   * with nothing measured behind it — never an estimate.
   */
  measured?: Measured | null;
}

export interface BlogIdea {
  title: string;
  /** What the post should say. */
  covers: string;
  /** The search phrase it is written for. */
  keyword: string;
}

export interface ContentIdeas {
  keywords: KeywordIdea[];
  blogIdeas: BlogIdea[];
  /** The model that wrote them, as the router reports it. */
  model: string | null;
  /** The real Search Console numbers behind them, and whether there are any. */
  search?: SearchNumbers;
}

/** The part of the project's search data a report shows beside its ideas. */
export interface SearchNumbers {
  status: SearchDataStatus;
  days: number;
  range: { start: string; end: string } | null;
  /** Searches the site shows for just off the first page, most seen first. */
  almostWinning: Array<MeasuredSearch & { pagePath: string | null }>;
}

/** What the suggestions are grounded in, beyond the business's own pages. */
export interface ContentIdeasContext {
  /** Topics competitors have a page for and this business does not. */
  rivalTopics?: Array<{ title: string; rival: string }>;
  /** Questions competitors answer in their headings. */
  rivalQuestions?: string[];
}

const PAGES_SHOWN = 40;
const KEYWORDS_KEPT = 10;
const BLOGS_KEPT = 6;
/** Page kinds that say nothing about what a business sells. */
const NOT_ABOUT_THE_BUSINESS = new Set(['LEGAL', 'STATIC', 'CONTACT']);

const SCHEMA = {
  type: 'object',
  properties: {
    keywords: {
      type: 'array',
      items: {
        type: 'object',
        properties: { phrase: { type: 'string' }, why: { type: 'string' }, usePage: { type: 'string' } },
        required: ['phrase', 'why', 'usePage'],
      },
    },
    blogIdeas: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, covers: { type: 'string' }, keyword: { type: 'string' } },
        required: ['title', 'covers', 'keyword'],
      },
    },
  },
  required: ['keywords', 'blogIdeas'],
};

export interface SitePage {
  path: string;
  title: string;
  heading: string | null;
}

@Injectable()
export class ContentIdeasService {
  private readonly logger = new Logger(ContentIdeasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    @Optional() private readonly demand?: SearchDemandService,
  ) {}

  /**
   * Suggestions for one project. Throws a readable error when there is
   * nothing to base them on or Sarvam cannot answer; callers keep their
   * report and show the error in place of the suggestions.
   */
  async suggest(projectId: string, organizationId?: string, context: ContentIdeasContext = {}): Promise<ContentIdeas> {
    const [{ name, domain, pages }, demand] = await Promise.all([this.sitePages(projectId), this.searchDemand(projectId)]);
    if (!domain || pages.length === 0) {
      throw new Error("Your website hasn't been read yet, so there is nothing to base suggestions on. Run the audit first.");
    }

    const completion = await this.router.generate({
      prompt: buildIdeasPrompt({ name, domain, pages, ...context, searchLines: demandPromptLines(demand, pathOf) }),
      systemInstruction:
        'You suggest search phrases and blog posts for a small business whose owner knows nothing about SEO. ' +
        'Base everything on what their website says. Never invent numbers. Reply with valid JSON only.',
      task: AiTask.SEO_OPPORTUNITY_GENERATION,
      provider: AiProvider.SARVAM,
      // Shown as "Suggested by sarvam-105b"; another vendor's text would be
      // presented under the wrong name.
      allowFallback: false,
      jsonSchema: SCHEMA,
      organizationId,
      projectId,
      maxTokens: 3000,
    });
    if (completion.refused || !completion.text.trim()) throw new Error('Sarvam returned no suggestions. Try again.');

    const raw = extractAndParseJson<Record<string, unknown>>(completion.text);
    const ideas: ContentIdeas = {
      keywords: attachMeasured(normaliseKeywordIdeas(raw.keywords, pages), demand),
      blogIdeas: normaliseBlogIdeas(raw.blogIdeas),
      model: completion.model ?? null,
      search: toSearchNumbers(demand),
    };
    this.logger.log(`[${projectId}] ${ideas.keywords.length} keyword and ${ideas.blogIdeas.length} blog ideas from ${ideas.model}`);
    return ideas;
  }

  /**
   * For a report: the suggestions, or why there are none. Never throws, so a
   * failed suggestion call costs the report nothing but this section.
   */
  async forReport(
    projectId: string,
    organizationId?: string,
    context: ContentIdeasContext = {},
  ): Promise<{ ideas: ContentIdeas | null; ideasError: string | null }> {
    try {
      return { ideas: await this.suggest(projectId, organizationId, context), ideasError: null };
    } catch (err) {
      this.logger.warn(`[${projectId}] content ideas failed: ${(err as Error).message}`);
      return { ideas: null, ideasError: `Keyword and blog ideas could not be written: ${(err as Error).message}`.slice(0, 300) };
    }
  }

  /** Search Console numbers, or an honest "none" when there is no connection or data. */
  private async searchDemand(projectId: string): Promise<SearchDemand> {
    if (!this.demand) return { status: 'NOT_CONNECTED', days: 28, range: null, topSearches: [], almostWinning: [] };
    return this.demand.forProject(projectId);
  }

  /** The business's own pages from its latest completed crawl, the ones that say what it sells. */
  private async sitePages(projectId: string): Promise<{ name: string | null; domain: string | null; pages: SitePage[] }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, websites: { select: { id: true, domain: true }, take: 1 } },
    });
    const website = project?.websites[0];
    if (!website) return { name: project?.name ?? null, domain: null, pages: [] };

    const job = await this.prisma.crawlJob.findFirst({
      where: { websiteId: website.id, status: 'COMPLETED', pagesCrawled: { gt: 0 } },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return { name: project?.name ?? null, domain: website.domain, pages: [] };

    const rows = await this.prisma.page.findMany({
      where: { crawlJobId: job.id, statusCode: 200, title: { not: null } },
      select: { url: true, title: true, h1: true, pageType: true },
      take: 300,
    });
    return { name: project?.name ?? null, domain: website.domain, pages: toSitePages(rows) };
  }
}

/** Distinct pages, shortest address first (home and main sections), about what the business sells. */
export function toSitePages(rows: Array<{ url: string; title: string | null; h1: string[]; pageType: string }>): SitePage[] {
  const seen = new Set<string>();
  const pages: SitePage[] = [];
  for (const row of [...rows].sort((a, b) => a.url.length - b.url.length)) {
    const title = (row.title ?? '').replace(/\s+/g, ' ').trim();
    if (!title || NOT_ABOUT_THE_BUSINESS.has(row.pageType) || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    let path = row.url;
    try {
      path = new URL(row.url).pathname || '/';
    } catch {
      // Keep the address as it was stored.
    }
    const heading = (row.h1?.[0] ?? '').replace(/\s+/g, ' ').trim();
    pages.push({ path, title, heading: heading && heading.toLowerCase() !== title.toLowerCase() ? heading : null });
    if (pages.length >= PAGES_SHOWN) break;
  }
  return pages;
}

export function buildIdeasPrompt(
  input: { name: string | null; domain: string; pages: SitePage[]; searchLines?: string } & ContentIdeasContext,
): string {
  const pages = input.pages.map((p) => `- ${p.path}: ${p.title}${p.heading ? ` (headline: ${p.heading})` : ''}`).join('\n');
  const topics = (input.rivalTopics ?? []).slice(0, 30).map((t) => `- "${t.title}" (${t.rival})`).join('\n');
  const questions = (input.rivalQuestions ?? []).slice(0, 20).map((q) => `- ${q}`).join('\n');

  return `Suggest what this business should be found for on Google, and what to write about.

BUSINESS
${input.name ? `${input.name} (${input.domain})` : input.domain}

WHAT THEIR WEBSITE SAYS (its own pages: address, title, headline)
${pages}
${input.searchLines ? `\n${input.searchLines}\n` : ''}${topics ? `\nTOPICS THEIR COMPETITORS HAVE A PAGE FOR AND THIS WEBSITE DOES NOT\n${topics}\n` : ''}${questions ? `\nQUESTIONS THEIR COMPETITORS ANSWER\n${questions}\n` : ''}
Return JSON exactly in this shape:
{
  "keywords": [
    { "phrase": "what a customer would type into Google to find a business like this, 2-6 words", "why": "one plain sentence: who searches this and why it fits this business", "usePage": "the address from the list above that should use this phrase, or \\"new page\\"" }
  ],
  "blogIdeas": [
    { "title": "a blog post title a customer would want to click", "covers": "1-2 plain sentences on what the post should say", "keyword": "the search phrase it is written for" }
  ]
}

Rules:
- keywords: ${KEYWORDS_KEPT - 2}-${KEYWORDS_KEPT} phrases real customers of this business would type, in their own everyday words, about what the website actually sells. Include the city or area when the website names one.${
    input.searchLines
      ? '\n- Where one of the real Google searches listed above fits, use that exact search as the phrase (especially the ones it almost wins), and point usePage at the page listed for it. Add new phrases only for what those searches miss.'
      : ''
  }
- usePage: an address from the list above when an existing page is the right place, otherwise "new page".
- blogIdeas: ${BLOGS_KEPT - 1}-${BLOGS_KEPT} posts that answer questions these customers have${topics || questions ? ', including topics and questions the competitors cover' : ''}. Each targets one of the keywords.
- Do not give search volumes, rankings, prices, percentages or any other numbers: none were measured.
- Do not invent products, places or claims the website does not make. Use plain words, no jargon.`;
}

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '').trim().slice(0, max) : '';

/** Distinct phrases, at most ten; a page is kept only when it is one of the site's own. */
export function normaliseKeywordIdeas(raw: unknown, pages: SitePage[]): KeywordIdea[] {
  const known = new Set(pages.map((p) => p.path));
  const seen = new Set<string>();
  const out: KeywordIdea[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const phrase = clean(item?.phrase, 80);
    if (!phrase || seen.has(phrase.toLowerCase())) continue;
    seen.add(phrase.toLowerCase());
    const page = clean(item?.usePage, 300);
    out.push({ phrase, why: clean(item?.why, 300), usePage: known.has(page) ? page : null });
    if (out.length >= KEYWORDS_KEPT) break;
  }
  return out;
}

export function normaliseBlogIdeas(raw: unknown): BlogIdea[] {
  const seen = new Set<string>();
  const out: BlogIdea[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const title = clean(item?.title, 160);
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    out.push({ title, covers: clean(item?.covers, 400), keyword: clean(item?.keyword, 80) });
    if (out.length >= BLOGS_KEPT) break;
  }
  return out;
}

/** A URL's path, or the URL unchanged when it cannot be parsed. */
export function pathOf(url: string): string {
  try {
    return new URL(url).pathname || '/';
  } catch {
    return url;
  }
}

/**
 * Google's numbers on each suggested phrase that is one of the site's real
 * searches. The model is told not to write numbers; these come from the data,
 * matched by the same words, and nothing else gets any.
 */
export function attachMeasured(keywords: KeywordIdea[], demand: SearchDemand): KeywordIdea[] {
  if (demand.status !== 'OK') return keywords;
  const index = indexSearches([...demand.topSearches, ...demand.almostWinning]);
  return keywords.map((k) => {
    const measured = measure(k.phrase, index, demand.days);
    // The page Google already shows for this search is the page to improve,
    // even when it was not among the pages the model was shown.
    return { ...k, usePage: k.usePage ?? (measured?.page ? pathOf(measured.page) : null), measured };
  });
}

export function toSearchNumbers(demand: SearchDemand): SearchNumbers {
  return {
    status: demand.status,
    days: demand.days,
    range: demand.range,
    almostWinning: demand.almostWinning.map((s) => ({ ...s, pagePath: s.page ? pathOf(s.page) : null })),
  };
}
