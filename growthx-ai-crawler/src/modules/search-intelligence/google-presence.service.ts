import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { normalizeKeyword } from './keyword-ideas';
import { bareDomain, ownSite } from './own-site';
import { RankTrackingService } from './rank-tracking.service';
import { resolveMarket } from './search-market';

export interface PresenceResult {
  keyword: string;
  /** The site is among the pages Google returned for this search. This is not a position. */
  appears: boolean;
  /** Distinct sites Google returned, in the order Gemini read them. The order is not a ranking. */
  sites: string[];
  competitorsSeen: string[];
  /** The Google searches that were actually run. */
  searchQueries: string[];
  error: string | null;
}

export interface PresenceReport {
  city: string | null;
  country: string;
  checkedAt: string;
  results: PresenceResult[];
  /** How this was measured and what it cannot tell you. Shown with the results. */
  method: string;
}

const METHOD =
  "Checked by asking Gemini to search Google for each phrase and listing the sites it read. It shows whether your site is among the results and who else is, but not an exact position: Google's own ranking order is not exposed this way.";

const GOOGLE_REDIRECT_HOSTS = ['vertexaisearch.cloud.google.com'];

/** The site a grounded source points at: Gemini puts the domain in the title. */
export function sourceDomain(source: { title: string | null; url: string | null }): string | null {
  const fromTitle = bareDomain(source.title);
  if (fromTitle && fromTitle.includes('.')) return fromTitle;
  const fromUrl = bareDomain(source.url);
  if (fromUrl && !GOOGLE_REDIRECT_HOSTS.includes(fromUrl)) return fromUrl;
  return null;
}

/** Whether `domain` is `own` or one of its subdomains. */
export function isSameSite(domain: string, own: string): boolean {
  return domain === own || domain.endsWith(`.${own}`);
}

/** Reads one grounded answer into who was seen, against the customer and their competitors. */
export function readPresence(
  keyword: string,
  grounded: { sources: Array<{ title: string | null; url: string | null }>; searchQueries: string[] },
  ownDomain: string,
  competitorDomains: string[],
): PresenceResult {
  const sites: string[] = [];
  for (const source of grounded.sources) {
    const domain = sourceDomain(source);
    if (domain && !sites.includes(domain)) sites.push(domain);
  }
  const own = bareDomain(ownDomain) ?? ownDomain;
  const competitors = competitorDomains.map((d) => bareDomain(d)).filter((d): d is string => Boolean(d) && d !== own);
  return {
    keyword,
    appears: sites.some((s) => isSameSite(s, own)),
    sites: sites.slice(0, 12),
    competitorsSeen: competitors.filter((c) => sites.some((s) => isSameSite(s, c))),
    searchQueries: grounded.searchQueries.slice(0, 4),
    error: null,
  };
}

const MAX_PER_REQUEST = 10;
const CONCURRENCY = 3;
const DEFAULT_DAILY = 100;

function dailyLimit(): number {
  const n = Number(process.env.GROUNDED_DAILY_CHECKS_PER_PROJECT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY;
}

/**
 * "Does my site show up on Google for this search?", answered with Gemini's
 * Google Search grounding, so it works without a paid rank-tracking provider.
 *
 * It answers presence, not position, and says so. Nothing is stored: a stored
 * "not found" would read as a ranking history the method cannot support.
 */
@Injectable()
export class GooglePresenceService {
  private readonly logger = new Logger(GooglePresenceService.name);
  /** project -> { day, count }. Per process; a restart resets it, which only ever lets a few more through. */
  private readonly usage = new Map<string, { day: string; count: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MultiAiRouterService,
    private readonly ranks: RankTrackingService,
  ) {}

  async check(projectId: string, input: { keywords: string[]; city?: string }): Promise<PresenceReport> {
    const keywords = [...new Set(input.keywords.map(normalizeKeyword).filter((k) => k.length >= 3))].slice(0, MAX_PER_REQUEST);
    if (keywords.length === 0) throw new BadRequestException('Choose at least one keyword to check.');

    const site = await ownSite(this.prisma, projectId);
    if (!site) throw new BadRequestException('This project has no website yet.');
    this.reserve(projectId, keywords.length);

    const [market, competitors] = await Promise.all([resolveMarket(this.prisma, projectId), this.ranks.competitorsOf(projectId)]);
    const city = input.city?.trim().slice(0, 60) || null;
    const where = city ? `${city}, ${market.country}` : market.country;
    const competitorDomains = competitors.map((c) => c.domain);

    const results: PresenceResult[] = new Array(keywords.length);
    let next = 0;
    const worker = async () => {
      while (next < keywords.length) {
        const i = next++;
        const keyword = keywords[i];
        try {
          const grounded = await this.router.searchGrounded({
            projectId,
            timeoutMs: 40_000,
            prompt: [
              `Search Google for: "${keyword}"`,
              `Act as a person searching from ${where}, in ${market.language === 'en' ? 'English' : market.language}.`,
              'Use Google Search and list the websites that appear for this search, most prominent first. One line each: site name and what the page is.',
              'Do not guess. Only list sites you actually found.',
            ].join('\n'),
          });
          results[i] = readPresence(keyword, grounded, site.website.domain, competitorDomains);
        } catch (error) {
          this.logger.warn(`Presence check failed for "${keyword}": ${(error as Error)?.message}`);
          results[i] = {
            keyword,
            appears: false,
            sites: [],
            competitorsSeen: [],
            searchQueries: [],
            error: 'Gemini could not search for this phrase just now.',
          };
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, keywords.length) }, worker));

    return { city, country: market.country, checkedAt: new Date().toISOString(), results, method: METHOD };
  }

  private reserve(projectId: string, count: number): void {
    const day = new Date().toISOString().slice(0, 10);
    const current = this.usage.get(projectId);
    const used = current && current.day === day ? current.count : 0;
    if (used + count > dailyLimit()) {
      throw new HttpException(
        `Today's limit of ${dailyLimit()} Google checks for this project has been reached. It resets tomorrow.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.usage.set(projectId, { day, count: used + count });
  }
}
