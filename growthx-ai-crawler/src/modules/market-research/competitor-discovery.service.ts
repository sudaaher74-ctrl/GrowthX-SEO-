import { Injectable, Logger } from '@nestjs/common';
import { DetectedBusinessProfile } from './business-profile.service';
import { VerifiableCompetitor } from './competitor-verification.service';
import { WebSearchService } from './web-search.service';

export type MarketScope = 'worldwide' | 'india' | 'maharashtra';

export interface DiscoveryInput {
  /** The client's own domain, which never competes with itself. */
  domain: string;
  businessName: string;
  /** The niche in the client's own words. */
  subject: string;
  region: MarketScope;
  profile?: DetectedBusinessProfile | null;
}

export interface DiscoveryOutcome {
  candidates: VerifiableCompetitor[];
  /** The queries actually issued, so a thin result is explainable. */
  queriesRun: string[];
  /** Set when no search could run at all. */
  unavailable?: string;
}

/** One domain's showing across the client's own buyer searches. */
interface DomainEvidence {
  domain: string;
  title: string;
  excerpt: string;
  /** The client keywords this domain actually ranked for. */
  queries: Set<string>;
  /** Best (lowest) position it reached on any of them. */
  bestRank: number;
}

/**
 * Hosts that rank for commercial queries without being a company in the
 * market: directories, marketplaces, review aggregators, news, jobs boards
 * and user-generated content.
 *
 * A search for "doorstep milk delivery Pune" returns Justdial, a Times of
 * India listicle and a Reddit thread long before it returns a dairy. None of
 * them sells milk. The registrable domain is matched, so `m.economictimes.com`
 * and `blog.hubspot.com` are caught with their parents.
 */
const NOT_A_COMPANY = new Set([
  // Search, social and reference
  'google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'wikipedia.org', 'wikiwand.com',
  'youtube.com', 'facebook.com', 'instagram.com', 'linkedin.com', 'twitter.com', 'x.com',
  'pinterest.com', 'reddit.com', 'quora.com', 'medium.com', 'substack.com', 'tumblr.com',
  'blogspot.com', 'wordpress.com', 'wixsite.com', 'weebly.com', 'github.io',
  // Marketplaces and directories
  'amazon.com', 'amazon.in', 'flipkart.com', 'indiamart.com', 'tradeindia.com', 'exportersindia.com',
  'alibaba.com', 'made-in-china.com', 'etsy.com', 'ebay.com', 'walmart.com', 'target.com',
  'justdial.com', 'sulekha.com', 'yelp.com', 'tripadvisor.com', 'zomato.com', 'swiggy.com',
  'blinkit.com', 'zeptonow.com', 'jiomart.com', 'yellowpages.com', 'bbb.org',
  // Company data, reviews and jobs
  'crunchbase.com', 'zaubacorp.com', 'tofler.in', 'glassdoor.com', 'ambitionbox.com',
  'indeed.com', 'naukri.com', 'linkedin.cn', 'owler.com', 'zoominfo.com', 'g2.com',
  'capterra.com', 'trustpilot.com', 'clutch.co', 'sitejabber.com', 'producthunt.com',
  'similarweb.com', 'semrush.com', 'ahrefs.com',
  // News and trade press
  'timesofindia.com', 'indiatimes.com', 'economictimes.com', 'business-standard.com',
  'livemint.com', 'moneycontrol.com', 'hindustantimes.com', 'thehindu.com', 'ndtv.com',
  'financialexpress.com', 'businesstoday.in', 'forbes.com', 'bloomberg.com', 'reuters.com',
  'techcrunch.com', 'entrepreneur.com', 'inc.com', 'businessinsider.com', 'cnbc.com',
  'theguardian.com', 'bbc.com', 'nytimes.com', 'wsj.com',
]);

/** Public-suffix fragments that need a third label to identify a company. */
const MULTI_PART_SUFFIXES = new Set([
  'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in', 'ac.in', 'gov.in', 'edu.in',
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au', 'com.br', 'com.sg', 'com.my', 'com.ph', 'com.pk', 'com.bd',
  'co.za', 'co.nz', 'co.jp', 'co.kr', 'co.th', 'com.tr', 'com.mx', 'com.ar', 'com.cn',
  'com.hk', 'com.tw', 'com.sa', 'com.eg', 'com.ng', 'com.vn', 'com.ua',
]);

/** Sections of a site that are content about a market, not a company in it. */
const CONTENT_PATH = /\/(blog|news|article|articles|press|stories|wiki|forum|help|support|docs)\//i;

/**
 * Finds competitors by searching what the client's own customers search for.
 *
 * The curated market list this supplements covers six industries in three
 * regions. That is the right answer for a Nashik fruit exporter and no answer
 * at all for a dentist in São Paulo, a textile mill in Tirupur or a law firm
 * in Leeds — and the platform is sold to all of them. Asking a model to recall
 * competitors has the opposite failure: it knows the famous names in every
 * market and invents the rest.
 *
 * Searching the client's own buyer keywords has neither problem. Whoever ranks
 * for the phrases this client's customers type is, by the only definition that
 * matters to an SEO product, their competitor — in any industry, any country
 * and any language, with the SERP itself as the evidence. Nothing here is
 * curated, so nothing here goes stale.
 */
@Injectable()
export class CompetitorDiscoveryService {
  private readonly logger = new Logger(CompetitorDiscoveryService.name);

  /** Tavily caps the useful query count; these are the highest-signal ones. */
  private readonly MAX_QUERIES = 4;
  /** Handed on to verification, which fetches every one of them. */
  private readonly MAX_CANDIDATES = 12;

  constructor(private readonly webSearch: WebSearchService) {}

  isConfigured(): boolean {
    return this.webSearch.isConfigured();
  }

  async discover(input: DiscoveryInput): Promise<DiscoveryOutcome> {
    const queries = this.buildQueries(input);
    if (queries.length === 0) {
      return { candidates: [], queriesRun: [], unavailable: 'The client profile had nothing specific enough to search on.' };
    }

    // One search call per query rather than one call for all of them: the
    // shared service merges its results and drops the attribution, and which
    // keyword a competitor ranked for is the whole evidence of this feature.
    // Tavily issues one request per query either way, so this costs nothing.
    const settled = await Promise.allSettled(queries.map((query) => this.webSearch.search([query])));

    const byDomain = new Map<string, DomainEvidence>();
    const queriesRun: string[] = [];
    let failures = 0;
    let firstUnavailable: string | undefined;

    settled.forEach((result, index) => {
      const query = queries[index];
      if (result.status === 'rejected') {
        failures += 1;
        this.logger.warn(`Competitor discovery search failed for "${query}": ${result.reason}`);
        return;
      }
      if (result.value.unavailable && result.value.sources.length === 0) {
        failures += 1;
        firstUnavailable ??= result.value.unavailable;
        return;
      }
      queriesRun.push(query);
      this.collect(byDomain, result.value.sources, query, input.domain);
    });

    if (byDomain.size === 0) {
      return {
        candidates: [],
        queriesRun,
        unavailable:
          failures === queries.length
            ? firstUnavailable || 'No web search provider is configured, so the market could not be searched.'
            : 'The searches ran but returned no company websites to check.',
      };
    }

    const candidates = [...byDomain.values()]
      .sort((a, b) => this.score(b) - this.score(a))
      .slice(0, this.MAX_CANDIDATES)
      .map((entry) => this.toCandidate(entry, input));

    return {
      candidates,
      queriesRun,
      unavailable: failures ? `${failures} of ${queries.length} market searches failed, so the list may be short.` : undefined,
    };
  }

  /**
   * The queries a buyer in this market would actually type.
   *
   * Built from the client's own seed keywords, which detection reads off their
   * site — so they are already in the right language and vocabulary for the
   * market, whether that is "aseptic mango pulp exporter" or "dentista
   * implantes São Paulo". The place name is appended only where the client is
   * regional; a global SaaS competes on the bare keyword.
   */
  private buildQueries(input: DiscoveryInput): string[] {
    const profile = input.profile;
    const place = this.placeFor(input);

    const seeds = [
      ...(profile?.seedKeywords || []),
      ...(profile?.offerings || []),
      input.subject,
    ]
      .map((seed) => (seed || '').trim())
      .filter((seed) => seed.length > 3);

    const queries: string[] = [];
    const seen = new Set<string>();

    for (const seed of seeds) {
      const query = place && !seed.toLowerCase().includes(place.toLowerCase())
        ? `${seed} ${place}`
        : seed;
      const key = query.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      queries.push(query);
      if (queries.length >= this.MAX_QUERIES - 1) break;
    }

    // One deliberately competitive phrasing. The others find who ranks for the
    // client's own terms; this one finds who the market names as its players.
    const leaders = place
      ? `top ${input.subject} companies in ${place}`
      : `top ${input.subject} companies`;
    if (!seen.has(leaders.toLowerCase())) queries.push(leaders);

    return queries.slice(0, this.MAX_QUERIES);
  }

  /** Where to search, from the client's own address rather than a guess. */
  private placeFor(input: DiscoveryInput): string {
    const profile = input.profile;
    if (input.region === 'maharashtra') return profile?.city || profile?.state || 'Maharashtra';
    if (input.region === 'india') return profile?.country || 'India';
    // Worldwide: a place name would narrow a global market wrongly, but a
    // client with an address still competes locally first.
    return profile?.country && profile.country.toLowerCase() !== 'worldwide' ? profile.country : '';
  }

  /** Folds one query's results into the running one-row-per-company tally. */
  private collect(
    byDomain: Map<string, DomainEvidence>,
    sources: Array<{ url?: string; title?: string; excerpt?: string }>,
    query: string,
    clientDomain: string,
  ): void {
    const client = registrableDomain(clientDomain);

    sources.forEach((source, index) => {
      const url = source.url || '';
      const host = hostOf(url);
      if (!host) return;

      const domain = registrableDomain(host);
      if (!domain || domain === client) return;
      if (NOT_A_COMPANY.has(domain)) return;
      // A ".gov" or university page is never a market rival.
      if (/\.(gov|edu|mil)(\.[a-z]{2})?$/.test(domain)) return;

      const existing = byDomain.get(domain);
      const rank = index + 1;
      // A blog post ranking is weaker evidence than a landing page, but it is
      // still this company ranking for the client's keyword — kept, ranked
      // lower, and never allowed to be the row's only appearance.
      const isContent = CONTENT_PATH.test(url);

      if (existing) {
        existing.queries.add(query);
        existing.bestRank = Math.min(existing.bestRank, isContent ? rank + 3 : rank);
        // A landing page describes the company better than a blog post does.
        if (!isContent && !existing.excerpt) existing.excerpt = (source.excerpt || '').slice(0, 600);
        return;
      }

      byDomain.set(domain, {
        domain,
        title: (source.title || domain).slice(0, 200),
        excerpt: (source.excerpt || '').slice(0, 600),
        queries: new Set([query]),
        bestRank: isContent ? rank + 3 : rank,
      });
    });
  }

  /**
   * How strongly the SERP says this is a competitor.
   *
   * Ranking for several of the client's keywords is the strong signal, so it
   * carries the most weight; position is the tie-break. Both are observations,
   * not a model's opinion, which is what makes the number defensible on the
   * card.
   */
  private score(entry: DomainEvidence): number {
    const breadth = Math.min(entry.queries.size, 4) * 9;
    const position = Math.max(0, 12 - entry.bestRank);
    return Math.min(97, 58 + breadth + position);
  }

  private toCandidate(entry: DomainEvidence, input: DiscoveryInput): VerifiableCompetitor {
    const matched = [...entry.queries];

    return {
      domain: entry.domain,
      name: companyNameFrom(entry.title, entry.domain),
      industry: input.subject,
      description:
        entry.excerpt.replace(/\s+/g, ' ').trim().slice(0, 280) ||
        `Ranks against ${input.businessName} for ${input.subject}.`,
      overlapScore: this.score(entry),
      marketPosition:
        entry.bestRank <= 3
          ? 'Top of search results'
          : matched.length > 1
            ? 'Ranks across your keywords'
            : 'Search rival',
      // The searches this domain actually turned up in — evidence the operator
      // can re-run for themselves, not keywords a model thought sounded right.
      sampleKeywords: matched.slice(0, 5),
      keyDifferentiator:
        matched.length > 1
          ? `Ranks against you for ${matched.length} of the searches your customers use.`
          : `Ranks against you for "${matched[0]}".`,
    };
  }
}

/** The hostname, or '' when the URL is unusable. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * The company-identifying part of a hostname.
 *
 * `blog.acme.co.in` and `shop.acme.co.in` are one company and must collapse to
 * one card. A fixed suffix list rather than a public-suffix dependency: it
 * covers the markets this product sells into, and an unknown suffix falls back
 * to the last two labels, which is right for the common case.
 */
export function registrableDomain(host: string): string {
  const clean = (host || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  const labels = clean.split('.').filter(Boolean);
  if (labels.length <= 2) return clean;

  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo)) return labels.slice(-3).join('.');
  return lastTwo;
}

/**
 * A readable company name from the page title.
 *
 * Titles are written for search, not for us: "Fresh Milk Delivery in Pune |
 * Sarda Farms" and "Sarda Farms - Farm to Home". The brand is whichever
 * separated part is shortest and least like a sentence; failing that, the
 * domain itself, which is never wrong, only plain.
 */
export function companyNameFrom(title: string, domain: string): string {
  const parts = (title || '')
    .split(/[|–—·:]|\s-\s/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2 && part.length <= 40);

  const brandish = parts
    .filter((part) => part.split(/\s+/).length <= 4)
    .sort((a, b) => a.length - b.length)[0];

  if (brandish) return brandish;

  const label = domain.split('.')[0] || domain;
  return label.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
