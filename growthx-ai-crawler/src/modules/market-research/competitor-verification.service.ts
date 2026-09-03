import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { normalizeDomain } from '../ai-visibility/citation/citation-detector';

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
   * @param candidates  Competitors proposed by the model or the curated list.
   * @param targetDomain The client's own domain, which is never a competitor.
   * @param nicheText   Industry, offerings and keywords describing the market.
   */
  async verify(
    candidates: VerifiableCompetitor[],
    targetDomain: string,
    nicheText: string,
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
        batch.map((candidate) => this.checkLiveSite(candidate, nicheTerms)),
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
  ): Promise<VerifiedCompetitor | RejectedCompetitor> {
    const reject = (reason: string, detail: string): RejectedCompetitor => ({
      domain: candidate.domain,
      name: candidate.name,
      reason,
      detail,
    });

    let html = '';
    let reached = false;
    for (const url of [`https://${candidate.domain}`, `http://${candidate.domain}`]) {
      try {
        const res = await axios.get(url, {
          timeout: this.TIMEOUT_MS,
          maxRedirects: 4,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
              'Chrome/124.0.0.0 Safari/537.36 GrowthX-MarketBot/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          validateStatus: (status) => status < 400,
        });
        html = typeof res.data === 'string' ? res.data : '';
        reached = true;
        if (html) break;
      } catch (err) {
        this.logger.debug(`Verification fetch failed for ${url}: ${err}`);
      }
    }

    if (!reached) {
      return reject('offline', 'The domain did not resolve or refused the request — it is not a live business.');
    }
    if (!html) {
      return reject('empty', 'The domain answered but served no readable page.');
    }

    const $ = cheerio.load(html);
    const title = $('title').first().text().replace(/\s+/g, ' ').trim();
    const description =
      $('meta[name="description"]').attr('content')?.trim() ||
      $('meta[property="og:description"]').attr('content')?.trim() ||
      '';

    $('script, style, noscript, svg').remove();
    const body = $('body').text().replace(/\s+/g, ' ').trim();
    const pageText = `${title} ${description} ${body}`.toLowerCase();

    if (PARKED_MARKERS.some((marker) => pageText.includes(marker))) {
      return reject('parked', 'The domain serves a parking, for-sale or placeholder page.');
    }
    if (body.length < 200 && !description) {
      return reject('empty', 'The page has almost no content — not a trading company site.');
    }

    // Relevance is what keeps an unrelated multinational out of a Nashik fruit
    // exporter's competitor set. With no niche vocabulary to compare against we
    // cannot judge it, so a reachable, non-parked site is allowed through.
    const matchedTerms = nicheTerms.filter((term) => pageText.includes(term));
    if (nicheTerms.length >= 3 && matchedTerms.length === 0) {
      return reject(
        'off_niche',
        'The live site does not mention anything from this market — it is not a direct competitor.',
      );
    }

    return {
      ...candidate,
      verified: true,
      verifiedTitle: title.slice(0, 160) || candidate.name,
      verifiedAt: new Date().toISOString(),
      matchedTerms: matchedTerms.slice(0, 6),
    };
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
