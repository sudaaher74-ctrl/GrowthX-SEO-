import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { WebSearchService } from '../market-research/web-search.service';
import { normalizeDomain } from '../ai-visibility/citation/citation-detector';

/** Where a row's keyword came from, so the page can say so. */
export type KeywordSource = 'search_console' | 'site_topics' | 'none';

export interface SeoGapRow {
  keyword: string;
  /** Search Console impressions over the window; null when unknown. */
  impressions: number | null;
  /** Average Search Console position; null when unknown. */
  position: number | null;
  /** null means "not measured", which is never the same as "no". */
  customerCoverage: boolean | null;
  competitorCoverage: Record<string, boolean | null>;
  gapStatus: 'CUSTOMER_MISSING' | 'CUSTOMER_WINNING' | 'OPTIMIZED' | 'UNTRACKED_OPPORTUNITY' | 'UNKNOWN';
  opportunityScore: number;
}

export interface SeoGapMatrix {
  customerDomain: string;
  competitors: Array<{ id: string; name: string; domain: string }>;
  keywordMatrix: SeoGapRow[];
  keywordSource: KeywordSource;
  /** False when no live search ran, so competitor columns are unknown. */
  competitorCoverageMeasured: boolean;
  /** Plain-language explanation of anything missing from the table. */
  notes: string[];
}

interface ClientKeyword {
  keyword: string;
  impressions?: number;
  position?: number;
  source: 'search_console' | 'site_topics';
}

/** Search Console window the impression counts are summed over. */
const GSC_WINDOW_DAYS = 28;
/** Each one costs a live search, so this is a latency budget as much as a cap. */
const MAX_KEYWORDS = 8;
/** Past this, a listing is not winning traffic in any useful sense. */
const RANKING_POSITION = 20;

@Injectable()
export class SeoCompetitorsService {
  private readonly logger = new Logger(SeoCompetitorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouter: MultiAiRouterService,
    @Optional() private readonly webSearch?: WebSearchService,
  ) {}

  /**
   * Which of the client's real search terms their competitors also rank for.
   *
   * This used to be five hard-coded SEO-SaaS keywords — "local seo software",
   * "competitor backlink checker" — shown to every client whatever they sold,
   * with `Math.random()` deciding who ranked for what. A milk delivery service
   * was told Amul competes with it on "local seo software", and the answer
   * changed on every page load. None of it was ever measured.
   *
   * Everything here is now observed. The keywords are the client's own Search
   * Console queries, the impression counts are Google's, and competitor
   * coverage is read off a live search for that exact term. Where something
   * cannot be observed it is returned as unknown rather than guessed, and the
   * page says which — an empty table that explains itself is worth more than a
   * full one that invents.
   */
  async getSeoGapMatrix(projectId: string): Promise<SeoGapMatrix> {
    const [competitors, project] = await Promise.all([
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        select: { id: true, domain: true, name: true, label: true },
      }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: { websites: true },
      }),
    ]);

    const customerDomain = normalizeDomain(project?.websites[0]?.domain || '');
    const competitorCols = competitors.map((c) => ({
      id: c.id,
      name: c.name || c.label || c.domain,
      domain: normalizeDomain(c.domain),
    }));

    const keywords = await this.clientKeywords(projectId);

    if (keywords.length === 0) {
      return {
        customerDomain,
        competitors: competitorCols,
        keywordMatrix: [],
        keywordSource: 'none',
        competitorCoverageMeasured: false,
        notes: [
          'No search terms are known for this site yet. Connect Google Search Console, or run a crawl so the site\'s own topics can be read, and this table will fill with the terms you actually appear for.',
        ],
      };
    }

    // A live search per keyword is what makes competitor coverage a fact
    // rather than an opinion. Without a provider we do not know who ranks, and
    // the row says so instead of filling itself in.
    const canSearch = Boolean(this.webSearch?.isConfigured());
    const notes: string[] = [];
    if (!canSearch) {
      notes.push(
        'Competitor columns are blank because no live search provider is configured, so who ranks for these terms could not be checked.',
      );
    }

    const serps = canSearch ? await this.serpsFor(keywords.map((k) => k.keyword)) : new Map<string, string[]>();

    const matrixRows: SeoGapRow[] = keywords.map((entry) => {
      const ranked = serps.get(entry.keyword);
      const competitorCoverage: Record<string, boolean | null> = {};
      let competitorsWith = 0;

      for (const competitor of competitorCols) {
        if (!ranked) {
          competitorCoverage[competitor.id] = null;
          continue;
        }
        const covers = ranked.some((domain) => sameCompany(domain, competitor.domain));
        competitorCoverage[competitor.id] = covers;
        if (covers) competitorsWith += 1;
      }

      // Search Console knows whether the client ranks; a SERP that came back
      // is the fallback. Neither available means unknown, never false.
      const customerCoverage =
        entry.position !== undefined
          ? entry.position <= RANKING_POSITION
          : ranked
            ? ranked.some((domain) => sameCompany(domain, customerDomain))
            : null;

      return {
        keyword: entry.keyword,
        /// Impressions, not a licensed volume estimate — this is what Google
        /// reported for this site, and it is labelled as such on the page.
        impressions: entry.impressions ?? null,
        position: entry.position ?? null,
        customerCoverage,
        competitorCoverage,
        gapStatus: gapStatusFor(customerCoverage, competitorsWith, ranked ? true : false),
        opportunityScore: opportunityFor(customerCoverage, competitorsWith, entry.impressions ?? 0),
      };
    });

    matrixRows.sort((a, b) => b.opportunityScore - a.opportunityScore);

    return {
      customerDomain,
      competitors: competitorCols,
      keywordMatrix: matrixRows,
      keywordSource: keywords[0].source,
      competitorCoverageMeasured: canSearch,
      notes,
    };
  }

  /**
   * The terms this client actually appears for, best source first.
   *
   * Search Console is the truth when it is connected: real queries, real
   * impressions, real positions. Failing that, the topics read off the site's
   * own pages — no volume attached, because we do not have one and inventing
   * it is how this table went wrong in the first place.
   */
  private async clientKeywords(projectId: string): Promise<ClientKeyword[]> {
    const since = new Date();
    since.setDate(since.getDate() - GSC_WINDOW_DAYS);

    try {
      const rows = await this.prisma.gscDailyMetric.groupBy({
        by: ['query'],
        where: { projectId, grain: 'QUERY', date: { gte: since }, query: { not: null } },
        _sum: { impressions: true },
        _avg: { position: true },
        orderBy: { _sum: { impressions: 'desc' } },
        take: MAX_KEYWORDS,
      });

      const keywords = rows
        .filter((row) => row.query)
        .map((row) => ({
          keyword: row.query as string,
          impressions: row._sum.impressions ?? 0,
          position: row._avg.position ?? undefined,
          source: 'search_console' as const,
        }));

      if (keywords.length > 0) return keywords;
    } catch (err) {
      this.logger.warn(`Search Console queries unavailable for ${projectId}: ${err}`);
    }

    // Nothing from Google. The crawl still knows what the site is about.
    const pages = await this.prisma.page.findMany({
      where: { crawlJob: { website: { projectId } }, statusCode: 200, title: { not: null } },
      orderBy: { crawledAt: 'desc' },
      select: { title: true },
      take: 40,
    });

    const seen = new Set<string>();
    const fromPages: ClientKeyword[] = [];
    for (const page of pages) {
      const phrase = topicFromTitle(page.title || '');
      if (!phrase || seen.has(phrase.toLowerCase())) continue;
      seen.add(phrase.toLowerCase());
      fromPages.push({ keyword: phrase, impressions: undefined, position: undefined, source: 'site_topics' });
      if (fromPages.length >= MAX_KEYWORDS) break;
    }

    return fromPages;
  }

  /** Who actually ranks for each term right now, one live search each. */
  private async serpsFor(keywords: string[]): Promise<Map<string, string[]>> {
    const byKeyword = new Map<string, string[]>();
    if (!this.webSearch) return byKeyword;

    const settled = await Promise.allSettled(keywords.map((keyword) => this.webSearch!.search([keyword])));

    settled.forEach((result, index) => {
      const keyword = keywords[index];
      if (result.status === 'rejected') {
        this.logger.debug(`SERP lookup failed for "${keyword}": ${result.reason}`);
        return;
      }
      if (result.value.sources.length === 0) return;

      const domains = result.value.sources
        .map((source) => {
          try {
            return new URL(source.url || '').hostname.toLowerCase().replace(/^www\./, '');
          } catch {
            return '';
          }
        })
        .filter(Boolean);

      byKeyword.set(keyword, domains);
    });

    return byKeyword;
  }

  async generateSeoGapInsights(projectId: string, organizationId: string) {
    const matrix = await this.getSeoGapMatrix(projectId);
    
    // Feed the top missing keywords to the AI to generate a content strategy
    const missing = matrix.keywordMatrix.filter(r => r.gapStatus === 'CUSTOMER_MISSING').slice(0, 5);
    
    if (missing.length === 0) {
      // "You are outperforming everyone" is the wrong thing to tell someone
      // whose table was empty because nothing could be measured.
      if (matrix.keywordMatrix.length === 0 || !matrix.competitorCoverageMeasured) {
        return {
          insights:
            matrix.notes[0] ||
            'There is not enough measured data yet to compare you against your competitors on search terms.',
          recommendedContent: [],
        };
      }
      return {
        insights:
          'On every term measured here, you rank where your tracked competitors do not. Expanding into adjacent topics is the next place to look for traffic.',
        recommendedContent: [],
      };
    }

    const prompt = `You are an expert SEO strategist. 
Here are the top keywords that competitors are ranking for but our site (${matrix.customerDomain}) is missing:
${JSON.stringify(missing.map(m => m.keyword), null, 2)}

Provide a strategic insight paragraph and exactly 3 recommended article/page ideas to close this gap and steal back traffic.
Respond ONLY in valid JSON matching this schema:
{
  "insights": "Strategic analysis...",
  "recommendedContent": [
    { "title": "Article Title", "type": "Blog Post", "targetKeyword": "keyword" }
  ]
}`;

    const res = await this.aiRouter.generate({
      prompt,
      systemInstruction: "You are an expert SEO. Return only JSON.",
      task: AiTask.FAST,
      organizationId,
    });

    return JSON.parse(res.text);
  }
}

/**
 * Whether a SERP hostname belongs to the tracked competitor.
 *
 * Subdomains count — a competitor ranking with `shop.` or `blog.` is still
 * that competitor ranking — but a domain that merely ends with the same
 * letters does not.
 */
function sameCompany(serpDomain: string, competitorDomain: string): boolean {
  if (!serpDomain || !competitorDomain) return false;
  return serpDomain === competitorDomain || serpDomain.endsWith(`.${competitorDomain}`);
}

/** The status is only as certain as the measurements behind it. */
function gapStatusFor(
  customerCoverage: boolean | null,
  competitorsWith: number,
  serpKnown: boolean,
): SeoGapRow['gapStatus'] {
  if (customerCoverage === null || !serpKnown) return 'UNKNOWN';
  if (!customerCoverage && competitorsWith > 0) return 'CUSTOMER_MISSING';
  if (customerCoverage && competitorsWith === 0) return 'CUSTOMER_WINNING';
  if (!customerCoverage && competitorsWith === 0) return 'UNTRACKED_OPPORTUNITY';
  return 'OPTIMIZED';
}

/**
 * How much is on the table for this term.
 *
 * Weighted by real impressions where Google gave us them: a term the client
 * misses that competitors hold and that draws traffic is worth more than the
 * same gap on a term nobody searches. Unmeasured rows score zero rather than
 * a flattering default, so they sort to the bottom instead of the top.
 */
function opportunityFor(
  customerCoverage: boolean | null,
  competitorsWith: number,
  impressions: number,
): number {
  if (customerCoverage === null) return 0;
  if (customerCoverage) return Math.min(30, competitorsWith * 5);

  const demand = Math.min(40, Math.round(Math.log10(Math.max(impressions, 1) + 1) * 14));
  const contested = Math.min(30, competitorsWith * 10);
  return Math.min(99, 30 + demand + contested);
}

/**
 * The subject of a page title, for a site with no Search Console attached.
 *
 * Titles carry the brand and a separator far more often than not, and the
 * brand is the one part that is never a search term worth comparing on.
 */
function topicFromTitle(title: string): string {
  const head = title.split(/[|–—:]|\s-\s/)[0].trim();
  const words = head.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 8) return '';
  return head.toLowerCase();
}
