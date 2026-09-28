import { PageFacts } from './page-reader';
import { DominantFormat, FORMAT_LABEL, IntentReading, PageFormat, featureLabel, median, sameFamily } from './serp-analysis';

export interface Evidence {
  label: string;
  value: string;
  source: string;
}

export interface Reason {
  code: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  detail: string;
  evidence: Evidence[];
}

export interface ReadPage {
  url: string;
  domain: string;
  /** Position in Google's organic results, null for a page not in them. */
  position: number | null;
  statusCode: number | null;
  error: string | null;
  facts: PageFacts | null;
  format: PageFormat;
  keywordInTitle: boolean;
  keywordInH1: boolean;
  keywordInUrl: boolean;
  /** The keyword appears in the first ~120 words of content. */
  keywordEarly: boolean;
}

export interface DiagnosisInput {
  keyword: string;
  page: ReadPage & {
    /** Internal links pointing at the page in our last crawl; null when not crawled. */
    inlinks: number | null;
    siteMedianInlinks: number | null;
    crawledIndexability: string | null;
    jsRequired: boolean | null;
  };
  /** Top organic results that are not the customer's, as read. */
  competitors: ReadPage[];
  serp: {
    ownPosition: number | null;
    ownUrl: string | null;
    features: string[];
    top: Array<{ position: number; url: string; domain: string; format: PageFormat }>;
  };
  intent: IntentReading;
  dominant: DominantFormat | null;
  searchConsole: {
    clicks: number;
    impressions: number;
    position: number | null;
    /** The customer's pages Google showed for this search, most impressions first. */
    pages: Array<{ url: string; clicks: number; impressions: number; position: number | null }>;
  } | null;
  indexStatus: { verdict: string | null; coverageState: string | null; inspectedAt: Date } | null;
  /** Whether `serp.ownUrl` is the page being diagnosed. */
  ownUrlIsThisPage: boolean;
}

export type Verdict = 'TOP_3' | 'PAGE_ONE' | 'PAGE_TWO' | 'NOT_IN_TOP_20';

export interface Diagnosis {
  verdict: Verdict;
  verdictText: string;
  reasons: Reason[];
  confidence: { level: 'HIGH' | 'MEDIUM' | 'LOW'; basis: string[]; missing: string[] };
}

const SRC = {
  google: 'Google results (DataForSEO)',
  page: 'Your page, read live',
  top: 'Top-ranking pages, read live',
  gsc: 'Google Search Console',
  inspect: 'Google URL Inspection',
  crawl: 'Your site crawl',
};

const MARKETPLACE_LIKE: PageFormat[] = ['MARKETPLACE', 'DIRECTORY'];

function yes(n: number, of: number): string {
  return `${n} of ${of}`;
}

export function diagnose(input: DiagnosisInput): Diagnosis {
  const { keyword, page, competitors, serp, intent, dominant, searchConsole, indexStatus } = input;
  const reasons: Reason[] = [];
  const read = competitors.filter((c) => c.facts);
  const myPosition = input.ownUrlIsThisPage ? serp.ownPosition : null;

  // ── Google cannot or will not show the page at all ─────────────────────
  if (indexStatus && indexStatus.verdict && indexStatus.verdict !== 'PASS') {
    reasons.push({
      code: 'NOT_INDEXED',
      severity: 'HIGH',
      title: 'Google has not put this page in its index',
      detail: 'A page that is not in Google\'s index cannot rank for anything. Fix this before anything else on this list.',
      evidence: [{ label: 'Google says', value: indexStatus.coverageState ?? indexStatus.verdict, source: SRC.inspect }],
    });
  }
  if (page.statusCode !== null && page.statusCode !== 200) {
    reasons.push({
      code: 'PAGE_NOT_OK',
      severity: 'HIGH',
      title: `The page answers with an error (HTTP ${page.statusCode})`,
      detail: 'Google only ranks pages that load. Restore the page, or redirect this address to the page that should rank.',
      evidence: [{ label: 'Response', value: `HTTP ${page.statusCode}`, source: SRC.page }],
    });
  }
  if (page.facts?.metaRobots && /noindex/i.test(page.facts.metaRobots)) {
    reasons.push({
      code: 'NOINDEX',
      severity: 'HIGH',
      title: 'The page tells Google not to show it',
      detail: 'It carries a "noindex" instruction, so Google keeps it out of search results however good it is.',
      evidence: [{ label: 'Robots tag', value: page.facts.metaRobots, source: SRC.page }],
    });
  }
  if (page.facts?.canonical) {
    const declared = normalise(page.facts.canonical, page.url);
    if (declared && declared !== normalise(page.url, page.url)) {
      reasons.push({
        code: 'CANONICAL_ELSEWHERE',
        severity: 'HIGH',
        title: 'The page points Google at a different page',
        detail: 'Its canonical tag names another address as the main version, so Google ranks that one instead of this.',
        evidence: [{ label: 'Canonical tag', value: page.facts.canonical, source: SRC.page }],
      });
    }
  }
  if (page.jsRequired) {
    reasons.push({
      code: 'JS_ONLY',
      severity: 'MEDIUM',
      title: 'The page\'s text only appears after JavaScript runs',
      detail: 'Google renders JavaScript later and less often than it reads plain HTML, so changes reach search slowly and some content may be missed.',
      evidence: [{ label: 'Crawl finding', value: 'Content only available after JavaScript execution', source: SRC.crawl }],
    });
  }

  // ── Google prefers another page of yours ───────────────────────────────
  const gscTop = searchConsole?.pages[0];
  if (gscTop && normalise(gscTop.url, page.url) !== normalise(page.url, page.url) && gscTop.impressions > 0) {
    reasons.push({
      code: 'OTHER_PAGE_PREFERRED',
      severity: 'HIGH',
      title: 'Google shows a different page of yours for this search',
      detail:
        'Two of your pages compete for the same search, and Google picked the other one. Decide which page should rank, make it the ' +
        'clear best answer, and link the other page to it (or merge them).',
      evidence: searchConsole!.pages.slice(0, 3).map((p) => ({
        label: p.url,
        value: `${p.impressions.toLocaleString()} impressions, ${p.clicks} clicks${p.position ? `, average position ${p.position.toFixed(1)}` : ''}`,
        source: SRC.gsc,
      })),
    });
  } else if (!input.ownUrlIsThisPage && serp.ownUrl) {
    reasons.push({
      code: 'OTHER_PAGE_PREFERRED',
      severity: 'HIGH',
      title: 'Google shows a different page of yours for this search',
      detail: 'Google ranks another of your pages here. Decide which page should rank and make it the clear best answer.',
      evidence: [{ label: 'Ranking instead', value: `${serp.ownUrl} at position ${serp.ownPosition}`, source: SRC.google }],
    });
  }

  // ── The page is the wrong kind of page for this search ─────────────────
  if (dominant && dominant.of >= 3 && dominant.count / dominant.of >= 0.5 && !sameFamily(page.format, dominant.format)) {
    reasons.push({
      code: 'FORMAT_MISMATCH',
      severity: 'HIGH',
      title: `Google wants ${dominant.label} for this search; yours is one of the ${FORMAT_LABEL[page.format]}`,
      detail:
        `The searcher ${intent.primaryLabel}, and Google answers with ${dominant.label}. A different kind of page rarely breaks in, ` +
        'however well it is written. Either create the kind of page Google shows, or target a search that matches this page.',
      evidence: [
        { label: 'Top results', value: `${yes(dominant.count, dominant.of)} are ${dominant.label}`, source: SRC.google },
        ...intent.evidence.slice(0, 2).map((e) => ({ label: 'On the results page', value: e, source: SRC.google })),
        { label: 'Your page', value: FORMAT_LABEL[page.format], source: SRC.page },
      ],
    });
  }

  // ── On-page relevance, measured against the pages that do rank ─────────
  if (page.facts && read.length >= 2) {
    const titled = read.filter((c) => c.keywordInTitle).length;
    if (!page.keywordInTitle && titled / read.length >= 0.6) {
      reasons.push({
        code: 'KEYWORD_NOT_IN_TITLE',
        severity: 'MEDIUM',
        title: 'Your page title does not say what the searcher typed',
        detail: `Most pages that rank use the words of "${keyword}" in their title. Rewrite your title so it plainly says this.`,
        evidence: [
          { label: 'Your title', value: page.facts.title ?? '(none)', source: SRC.page },
          { label: 'Top pages with it in the title', value: yes(titled, read.length), source: SRC.top },
        ],
      });
    }
    const headed = read.filter((c) => c.keywordInH1).length;
    if (!page.keywordInH1 && headed / read.length >= 0.6) {
      reasons.push({
        code: 'KEYWORD_NOT_IN_HEADING',
        severity: 'LOW',
        title: 'Your main heading does not mention it',
        detail: 'Most ranking pages repeat the search in their main heading, which tells both visitors and Google they are in the right place.',
        evidence: [
          { label: 'Your main heading', value: page.facts.h1[0] ?? '(none)', source: SRC.page },
          { label: 'Top pages with it in the heading', value: yes(headed, read.length), source: SRC.top },
        ],
      });
    }

    const typical = median(read.map((c) => c.facts!.wordCount));
    if (typical !== null && typical >= 300 && page.facts.wordCount < typical * 0.5) {
      reasons.push({
        code: 'LESS_CONTENT',
        severity: 'MEDIUM',
        title: 'Your page says much less than the pages that rank',
        detail: 'The ranking pages cover the topic in far more depth. Add what a searcher needs to decide: details, prices, answers to common questions.',
        evidence: [
          { label: 'Your page', value: `${page.facts.wordCount.toLocaleString()} words`, source: SRC.page },
          { label: 'Typical ranking page', value: `${typical.toLocaleString()} words (median of ${read.length})`, source: SRC.top },
        ],
      });
    }

    const typeCounts = new Map<string, number>();
    for (const c of read) for (const t of new Set(c.facts!.schemaTypes)) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    const worthHaving = ['Product', 'Offer', 'AggregateRating', 'Review', 'FAQPage', 'HowTo', 'Recipe', 'LocalBusiness', 'Article', 'BlogPosting', 'Service', 'Course', 'Event'];
    const missing = [...typeCounts.entries()]
      .filter(([t, n]) => worthHaving.includes(t) && n / read.length >= 0.6 && !page.facts!.schemaTypes.includes(t))
      .map(([t, n]) => `${t} (${yes(n, read.length)})`);
    if (missing.length) {
      reasons.push({
        code: 'MISSING_STRUCTURED_DATA',
        severity: 'LOW',
        title: 'Ranking pages describe themselves to Google in a way yours does not',
        detail: 'They carry structured data Google uses for richer results (prices, ratings, questions). Adding the same kinds can earn the same treatment.',
        evidence: [
          { label: 'Common on ranking pages', value: missing.join(', '), source: SRC.top },
          { label: 'On your page', value: page.facts.schemaTypes.join(', ') || 'none', source: SRC.page },
        ],
      });
    }
  }

  // ── Site structure ─────────────────────────────────────────────────────
  if (page.inlinks !== null && page.siteMedianInlinks !== null && page.siteMedianInlinks >= 2 && page.inlinks < Math.max(2, page.siteMedianInlinks * 0.25)) {
    reasons.push({
      code: 'FEW_INTERNAL_LINKS',
      severity: 'MEDIUM',
      title: 'Few of your own pages link to it',
      detail: 'Pages your site links to often are the ones Google treats as important. Link to this page from your menu, homepage or related pages.',
      evidence: [
        { label: 'Links to this page', value: String(page.inlinks), source: SRC.crawl },
        { label: 'Typical page on your site', value: `${page.siteMedianInlinks} links`, source: SRC.crawl },
      ],
    });
  }

  // ── Who holds the results ──────────────────────────────────────────────
  const top10 = serp.top.slice(0, 10);
  const giants = top10.filter((r) => MARKETPLACE_LIKE.includes(r.format));
  if (top10.length >= 5 && giants.length >= Math.ceil(top10.length / 2)) {
    reasons.push({
      code: 'RESULTS_HELD_BY_PLATFORMS',
      severity: 'LOW',
      title: 'Big marketplaces and directories hold most of the results',
      detail:
        'These sites are very hard to outrank on a short, general search. A longer, more specific search (a place, a variety, a use) is usually winnable sooner.',
      evidence: [{ label: 'Top results', value: `${yes(giants.length, top10.length)}: ${[...new Set(giants.map((g) => g.domain))].slice(0, 5).join(', ')}`, source: SRC.google }],
    });
  }
  if (serp.features.some((f) => ['local_pack', 'map'].includes(f)) && (myPosition === null || myPosition > 3)) {
    reasons.push({
      code: 'MAP_RESULTS',
      severity: 'LOW',
      title: 'Google answers this search with a map of local businesses',
      detail: 'Much of the attention goes to the map, which is ranked from Google Business Profiles, not websites. Keep your Business Profile complete and reviewed.',
      evidence: [{ label: 'On the results page', value: featureLabel('local_pack'), source: SRC.google }],
    });
  }

  // ── Search Console's own view ──────────────────────────────────────────
  if (searchConsole && searchConsole.impressions === 0 && !reasons.some((r) => r.code === 'NOT_INDEXED')) {
    reasons.push({
      code: 'NO_IMPRESSIONS',
      severity: 'MEDIUM',
      title: 'Google has not shown any of your pages for this search in 28 days',
      detail: 'Not even on later pages of results. Google does not yet connect your site with this search at all; the page needs to be clearly about it.',
      evidence: [{ label: 'Impressions, last 28 days', value: '0', source: SRC.gsc }],
    });
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  reasons.sort((a, b) => order[a.severity] - order[b.severity]);

  const verdict: Verdict = myPosition === null || myPosition > 20 ? 'NOT_IN_TOP_20' : myPosition <= 3 ? 'TOP_3' : myPosition <= 10 ? 'PAGE_ONE' : 'PAGE_TWO';
  const verdictText =
    verdict === 'TOP_3'
      ? `Ranking at position ${myPosition}.`
      : verdict === 'PAGE_ONE'
        ? `On page one at position ${myPosition}, below the top three where most clicks go.`
        : verdict === 'PAGE_TWO'
          ? `At position ${myPosition}, on page two, where very few searchers look.`
          : 'Not in Google\'s top 20 results for this search.';

  return { verdict, verdictText, reasons, confidence: confidenceFor(input, read.length) };
}

function confidenceFor(input: DiagnosisInput, competitorsRead: number): Diagnosis['confidence'] {
  const basis: string[] = [`Google's live results for "${input.keyword}"`];
  const missing: string[] = [];
  if (input.page.facts) basis.push('your page, read just now');
  else missing.push(`your page could not be read${input.page.error ? ` (${input.page.error})` : ''}`);
  if (competitorsRead >= 3) basis.push(`${competitorsRead} top-ranking pages, read just now`);
  else missing.push(`only ${competitorsRead} top-ranking page(s) could be read`);
  if (input.searchConsole) basis.push('your Search Console data');
  else missing.push('Search Console is not connected, so Google\'s own impressions and clicks are not included');
  if (input.indexStatus) basis.push('Google\'s index status for the page');
  else missing.push('the page has not been checked with Google URL Inspection');

  const score = (input.page.facts ? 2 : 0) + (competitorsRead >= 3 ? 2 : competitorsRead >= 2 ? 1 : 0) + (input.searchConsole ? 1 : 0) + (input.indexStatus ? 1 : 0);
  const level = score >= 5 ? 'HIGH' : score >= 3 ? 'MEDIUM' : 'LOW';
  return { level, basis, missing };
}

function normalise(raw: string, base: string): string | null {
  try {
    const u = new URL(raw, base);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`;
  } catch {
    return null;
  }
}
