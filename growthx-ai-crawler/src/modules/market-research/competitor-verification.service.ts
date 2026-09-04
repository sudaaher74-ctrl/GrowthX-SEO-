import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeDomain } from '../ai-visibility/citation/citation-detector';
import { MarketScope } from './competitor-discovery.service';

export interface VerifiableCompetitor {
  domain: string;
  name: string;
  industry: string;
  description: string;
  overlapScore: number;
  marketPosition: string;
  location?: string;
  sampleKeywords: string[];
  keyDifferentiator: string;
}

export interface VerifiedCompetitor extends VerifiableCompetitor {
  /** The site answered and looks like a real trading company in this niche. */
  verified: true;
  /** Title tag read from the live site — proof the domain is a real business. */
  verifiedTitle: string;
  verifiedAt: string;
  /** Which niche terms the live site actually shares with the client. */
  matchedTerms: string[];
  /**
   * How far the check got.
   *
   * `content` — the homepage was read and its copy matched this market.
   * `reachable` — a real server answered but refused to serve the page to a
   * bot (Cloudflare, a WAF, a 403 on a non-browser client). Large consumer
   * brands do this routinely, and dropping them was losing exactly the
   * competitors an operator most expects to see. A fabricated domain cannot
   * reach this state: there is no server behind it to refuse anything.
   */
  verificationLevel: 'content' | 'reachable';
}

export interface RejectedCompetitor {
  domain: string;
  name: string;
  /** Machine-readable reason, e.g. `duplicate`, `offline`, `off_niche`. */
  reason: string;
  detail: string;
}

export interface VerificationOutcome {
  verified: VerifiedCompetitor[];
  rejected: RejectedCompetitor[];
}

/** Hosts that are never a competitor, however confidently a model names them. */
const NEVER_A_COMPETITOR = new Set([
  'google.com',
  'google.co.in',
  'bing.com',
  'yahoo.com',
  'wikipedia.org',
  'youtube.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'twitter.com',
  'x.com',
  'pinterest.com',
  'reddit.com',
  'quora.com',
  'medium.com',
  'amazon.com',
  'amazon.in',
  'flipkart.com',
  'indiamart.com',
  'tradeindia.com',
  'alibaba.com',
  'justdial.com',
  'crunchbase.com',
  'glassdoor.com',
  'zaubacorp.com',
  'tofler.in',
]);

/** Domains a model reaches for when it is inventing rather than recalling. */
const PLACEHOLDER_PATTERNS = [
  /^example\./,
  /^test\./,
  /^demo\./,
  /^sample\./,
  /^dummy\./,
  /^placeholder\./,
  /^yourcompany\./,
  /^yourbrand\./,
  /^company(name)?\./,
  /^brand(name)?\./,
  /^competitor\d*\./,
  /^acme\./,
  /^apexbrand\./,
  /^localhost/,
  /\.example$/,
  /\.test$/,
  /\.invalid$/,
  /\.local$/,
];

/** Copy that means the domain is parked or for sale, not a trading company. */
const PARKED_MARKERS = [
  'domain is for sale',
  'buy this domain',
  'this domain is parked',
  'domain parking',
  'parked free, courtesy',
  'the domain name you have entered',
  'godaddy.com/domainsearch',
  'sedoparking',
  'hugedomains',
  'afternic',
  'namecheap parking',
  'future home of something quite cool',
  'website coming soon',
  'under construction',
  'account suspended',
  'default web page',
  'apache2 ubuntu default page',
  'welcome to nginx',
];

/**
 * Signals that a site actually trades in India, in rough order of how hard
 * they are to fake: a national TLD, the currency, the dialling code, then the
 * country and its larger cities by name.
 *
 * Presence is what is tested, never absence of others — a global company with
 * an Indian arm is a legitimate rival to an Indian client, and one page can
 * carry several markets at once. Both Indian scopes use this one list; see
 * `servesRegion` for why Maharashtra is not narrowed further.
 */
const INDIA_SIGNALS = [
  '\u20b9', 'inr', 'rupee', 'rs.', ' india', 'india ', 'indian', '+91', 'gstin', 'gst no',
  'maharashtra', 'mumbai', 'pune', 'nashik', 'nagpur', 'kolhapur', 'thane', 'delhi',
  'bengaluru', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'ahmedabad', 'gujarat',
  'karnataka', 'tamil nadu', 'telangana', 'kerala', 'punjab', 'rajasthan', 'haryana',
];

/**
 * Statuses that mean "a real server refused a bot", not "no such company".
 * Cloudflare, Akamai and most enterprise WAFs answer an unknown client this
 * way, so these prove the domain is live without proving what is on it.
 */
const BOT_BLOCKED_STATUSES = new Set([401, 402, 403, 405, 406, 409, 418, 429, 503]);

/** Words too generic to prove two businesses are in the same market. */
const STOPWORDS = new Set([
  'and',
  'the',
  'for',
  'with',
  'from',
  'our',
  'your',
  'services',
  'service',
  'solutions',
  'solution',
  'company',
  'companies',
  'business',
  'businesses',
  'products',
  'product',
  'market',
  'markets',
  'best',
  'top',
  'leading',
  'global',
  'india',
  'indian',
  'digital',
  'online',
  'group',
  'limited',
  'private',
  'ltd',
  'pvt',
  'inc',
  'llp',
  'more',
  'about',
  'home',
  'contact',
]);

/**
 * Proves a proposed competitor is a real company in the client's market before
 * it is ever shown.
 *
 * The panel previously rendered whatever the model returned. That is how it
 * came to show `sugarcane.com` twice and a "MarketPulse" that does not exist:
 * a language model asked for five competitors will always produce five, and a
 * plausible-looking domain is the cheapest thing for it to invent. Nothing
 * downstream checked, so a fabricated row looked exactly like a real one.
 *
 * So each candidate is now fetched. A domain that does not resolve, answers
 * with a parking page, or whose live copy shares no vocabulary with the
 * client's niche is dropped with a reason instead of being displayed. Fewer
 * real competitors is the correct answer; five with two invented is not.
 */
@Injectable()
export class CompetitorVerificationService {
  private readonly logger = new Logger(CompetitorVerificationService.name);

  /** Enough to weed out fabrications without holding the request open. */
  private readonly TIMEOUT_MS = 6000;
  /** Candidates are checked in parallel; this bounds the outbound burst. */
  private readonly CONCURRENCY = 5;

  /**
   * @param candidates  Competitors proposed by search, the model or the list.
   * @param targetDomain The client's own domain, which is never a competitor.
   * @param nicheText   Industry, offerings and keywords describing the market.
   * @param region      The market the client sells into. A competitor with no
   *                    trace of that market is in a different one, however
   *                    well its products match.
   */
  async verify(
    candidates: VerifiableCompetitor[],
    targetDomain: string,
    nicheText: string,
    region: MarketScope = 'worldwide',
  ): Promise<VerificationOutcome> {
    const nicheTerms = this.termsOf(nicheText);
    const target = normalizeDomain(targetDomain);

    const rejected: RejectedCompetitor[] = [];
    const shortlist: VerifiableCompetitor[] = [];
    const seenDomains = new Set<string>();
    const seenNames = new Set<string>();

    for (const candidate of candidates) {
      const domain = normalizeDomain(candidate.domain || '');
      const name = (candidate.name || '').trim().toLowerCase();

      const staticReason = this.staticRejection(domain, target);
      if (staticReason) {
        rejected.push({ domain: domain || String(candidate.domain), name: candidate.name, ...staticReason });
        continue;
      }

      // Two rows for one company was the most visible symptom of the old
      // panel: the same brand arrived twice under the same domain and both
      // were rendered, so "Top 5" showed three companies.
      if (seenDomains.has(domain)) {
        rejected.push({
          domain,
          name: candidate.name,
          reason: 'duplicate',
          detail: 'Already present in the list under the same domain.',
        });
        continue;
      }
      if (name && seenNames.has(name)) {
        rejected.push({
          domain,
          name: candidate.name,
          reason: 'duplicate',
          detail: `Already present in the list as "${candidate.name}".`,
        });
        continue;
      }

      seenDomains.add(domain);
      if (name) seenNames.add(name);
      shortlist.push({ ...candidate, domain });
    }

    const verified: VerifiedCompetitor[] = [];
    for (let i = 0; i < shortlist.length; i += this.CONCURRENCY) {
      const batch = shortlist.slice(i, i + this.CONCURRENCY);
      const results = await Promise.all(
        batch.map((candidate) => this.checkLiveSite(candidate, nicheTerms, region)),
      );
      for (const result of results) {
        if ('reason' in result) rejected.push(result);
        else verified.push(result);
      }
    }

    verified.sort((a, b) => b.overlapScore - a.overlapScore);
    return { verified, rejected };
  }

  private staticRejection(domain: string, target: string): { reason: string; detail: string } | null {
    if (!domain || !domain.includes('.') || domain.length < 4) {
      return { reason: 'invalid_domain', detail: 'Not a usable domain name.' };
    }
    if (domain === target || domain.endsWith(`.${target}`) || target.endsWith(`.${domain}`)) {
      return { reason: 'self', detail: "This is the client's own website." };
    }
    if (NEVER_A_COMPETITOR.has(domain)) {
      return { reason: 'not_a_competitor', detail: 'A search engine, marketplace or social network, not a market rival.' };
    }
    if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(domain))) {
      return { reason: 'placeholder', detail: 'A placeholder domain, not a real company.' };
    }
    return null;
  }

  /** Fetches the candidate's homepage and decides whether it is a real rival. */
  private async checkLiveSite(
    candidate: VerifiableCompetitor,
    nicheTerms: string[],
    region: MarketScope,
  ): Promise<VerifiedCompetitor | RejectedCompetitor> {
    const reject = (reason: string, detail: string): RejectedCompetitor => ({
      domain: candidate.domain,
      name: candidate.name,
      reason,
      detail,
    });

    let html = '';
    let reached = false;
    let blockedStatus = 0;

    // `www.` is tried too: plenty of established companies serve the apex only
    // as a redirect, and some not at all. Losing a real competitor to a missing
    // subdomain is the same failure as losing it to a 403.
    const urls = [
      `https://${candidate.domain}`,
      `https://www.${candidate.domain}`,
      `http://${candidate.domain}`,
    ];

    for (const url of urls) {
      try {
        const res = await axios.get(url, {
          timeout: this.TIMEOUT_MS,
          maxRedirects: 4,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
              'Chrome/124.0.0.0 Safari/537.36 GrowthX-MarketBot/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          // Anything short of a transport failure is an answer from a real
          // server, so the status is inspected here rather than thrown away as
          // an exception with no detail.
          validateStatus: () => true,
        });

        if (res.status < 400) {
          html = typeof res.data === 'string' ? res.data : '';
          reached = true;
          if (html) break;
          continue;
        }

        if (BOT_BLOCKED_STATUSES.has(res.status)) {
          blockedStatus = res.status;
          continue;
        }
      } catch (err) {
        this.logger.debug(`Verification fetch failed for ${url}: ${err}`);
      }
    }

    // A WAF saying "no" still proves a server is there. Amul, Nestlé and most
    // large consumer brands answer a non-browser client with 403 or 429, and
    // treating that as "this company does not exist" was quietly deleting the
    // best-known names in the market from every result.
    if (!reached && blockedStatus) {
      return {
        ...candidate,
        verified: true,
        verifiedTitle: candidate.name,
        verifiedAt: new Date().toISOString(),
        matchedTerms: [],
        verificationLevel: 'reachable',
      };
    }

    if (!reached) {
      return reject('offline', 'The domain did not resolve or refused the request — it is not a live business.');
    }
    if (!html) {
      return reject('empty', 'The domain answered but served no readable page.');
    }

    const $ = cheerio.load(html);
    const title =
      $('title').first().text().replace(/\s+/g, ' ').trim() ||
      $('meta[property="og:title"]').attr('content')?.trim() ||
      '';
    const description =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      '';

    // A single-page app serves an empty <body> and puts everything a crawler
    // can read in the head and its structured data. Reading only <body> text
    // marked those sites `empty` — which is most modern consumer brands.
    const structured = this.structuredText($);
    const headings = $('h1, h2')
      .map((_, el) => $(el).text())
      .get()
      .join(' ');
    const keywords = $('meta[name="keywords"]').attr('content') || '';

    $('script, style, noscript, svg').remove();
    const body = $('body').text().replace(/\s+/g, ' ').trim();
    const readable = `${title} ${description} ${keywords} ${headings} ${structured}`
      .replace(/\s+/g, ' ')
      .trim();
    const pageText = `${readable} ${body}`.toLowerCase();

    if (PARKED_MARKERS.some((marker) => pageText.includes(marker))) {
      return reject('parked', 'The domain serves a parking, for-sale or placeholder page.');
    }
    if (body.length < 200 && readable.length < 60) {
      return reject('empty', 'The page has almost no content — not a trading company site.');
    }

    // Relevance is what keeps an unrelated multinational out of a Nashik fruit
    // exporter's competitor set. With no niche vocabulary to compare against we
    // cannot judge it, so a reachable, non-parked site is allowed through.
    const matchedTerms = nicheTerms.filter((term) => this.mentions(pageText, term));
    if (nicheTerms.length >= 3 && matchedTerms.length === 0) {
      return reject(
        'off_niche',
        'The live site does not mention anything from this market — it is not a direct competitor.',
      );
    }

    // Selling the same thing on another continent is not competing. An Indian
    // client asking for Indian competitors was being shown whoever the model
    // knew best, which is usually American, and no check downstream disagreed.
    // The client's own domain TLD counts as a signal, as does the candidate's.
    if (!this.servesRegion(candidate.domain, pageText, region)) {
      return reject(
        'off_region',
        region === 'maharashtra'
          ? 'The site shows no sign of trading in Maharashtra — it competes in a different market.'
          : 'The site shows no sign of trading in India — it competes in a different market.',
      );
    }

    return {
      ...candidate,
      verified: true,
      verifiedTitle: title.slice(0, 160) || candidate.name,
      verifiedAt: new Date().toISOString(),
      matchedTerms: matchedTerms.slice(0, 6),
      verificationLevel: 'content',
    };
  }

  /** Company name and description from JSON-LD, which SPAs still render. */
  private structuredText($: cheerio.CheerioAPI): string {
    const parts: string[] = [];

    $('script[type="application/ld+json"]').each((_, el) => {
      const raw = $(el).contents().text().trim();
      if (!raw || raw.length > 200_000) return;
      try {
        const walk = (node: any, depth = 0) => {
          if (!node || depth > 4) return;
          if (Array.isArray(node)) {
            node.forEach((item) => walk(item, depth + 1));
            return;
          }
          if (typeof node !== 'object') return;
          for (const key of ['name', 'description', 'slogan', 'alternateName']) {
            if (typeof node[key] === 'string') parts.push(node[key]);
          }
          for (const value of Object.values(node)) walk(value, depth + 1);
        };
        walk(JSON.parse(raw));
      } catch {
        // Malformed JSON-LD is common and is not a reason to fail the check.
      }
    });

    return parts.join(' ').slice(0, 4000);
  }

  /**
   * Whether the site shows any trace of the client's market.
   *
   * Deliberately generous: one signal anywhere on the homepage is enough, and
   * a national TLD passes on its own. The check exists to drop a US-only
   * company from an Indian result, not to adjudicate how Indian a business is
   * — a false rejection costs a real competitor, which is the worse error.
   */
  private servesRegion(domain: string, pageText: string, region: MarketScope): boolean {
    if (region === 'worldwide') return true;
    if (/\.in$/.test(domain)) return true;

    // A Maharashtra scope is not narrowed to the state: Amul is registered in
    // Gujarat and sells on every street in Pune, and a national brand is the
    // rival a Pune business most needs to see. The country is the real line.
    return INDIA_SIGNALS.some((signal) => pageText.includes(signal));
  }

  /**
   * Whether the page uses a niche word in any ordinary inflection.
   *
   * A plain substring test already covers plurals like `milk` → `milks`, but
   * not the `y` → `ies` forms an English site actually writes: a dairy company
   * describes itself as one of the region's "dairies", and a delivery service
   * talks about "deliveries". Those pages were being called off-niche.
   */
  private mentions(pageText: string, term: string): boolean {
    if (pageText.includes(term)) return true;
    if (term.length >= 5 && term.endsWith('y')) {
      return pageText.includes(`${term.slice(0, -1)}ie`);
    }
    return false;
  }

  /** Distinctive words from the client's niche, used as the relevance test. */
  private termsOf(nicheText: string): string[] {
    const words = (nicheText || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOPWORDS.has(word));

    return Array.from(new Set(words)).slice(0, 14);
  }
}
