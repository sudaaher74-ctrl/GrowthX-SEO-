import { expectedCtr } from '../integrations/google/expected-ctr';

/**
 * The reasoning behind the Google section, kept free of I/O so every rule can
 * be checked against known numbers.
 *
 * Two rules run through it. Every sentence is built from figures that are
 * returned beside it (evidence), so a claim can always be traced to numbers.
 * And a figure that was not measured is `null` and stays `null` — a missing
 * source is never turned into a zero, and no rule fires on a zero that is
 * really "not measured".
 */

export type Source = 'GSC' | 'GA4' | 'Reigel';

export interface MetricChange {
  current: number;
  previous: number | null;
  change: number | null;
  changePct: number | null;
}

export interface SearchSummaryLike {
  clicks: MetricChange;
  impressions: MetricChange;
  ctr: MetricChange;
  position: MetricChange;
}

export interface OrganicLike {
  sessions: number;
  activeUsers: number;
  engagedSessions: number;
  engagementRate: number;
  keyEvents: number | null;
  revenue: number | null;
}

export interface Evidence {
  label: string;
  value: string;
  source: Source;
}

// ── Funnel ────────────────────────────────────────────────────────────────

export interface FunnelStage {
  key: 'impressions' | 'clicks' | 'sessions' | 'engaged' | 'keyEvents' | 'revenue';
  label: string;
  source: Source;
  /** Null when this stage was not measured; `note` says why. */
  value: number | null;
  /** The share this stage keeps of the one before it, where both were measured. */
  rate: number | null;
  rateLabel: string | null;
  note: string | null;
}

/**
 * Impressions → clicks → organic sessions → engaged sessions → key events →
 * revenue. The first two come from Search Console and the rest from Analytics,
 * two systems that count differently, so the step between clicks and sessions
 * is shown as a ratio of what each reported and is not a drop-off.
 */
export function buildFunnel(
  search: { clicks: number; impressions: number } | null,
  organic: OrganicLike | null,
): FunnelStage[] {
  const noSearch = 'Search Console has no data for this period.';
  const noGa = 'Google Analytics has no organic data for this period.';
  const ratio = (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? a / b : null);

  const impressions = search ? search.impressions : null;
  const clicks = search ? search.clicks : null;
  const sessions = organic ? organic.sessions : null;
  const engaged = organic ? organic.engagedSessions : null;
  const keyEvents = organic ? organic.keyEvents : null;
  const revenue = organic ? organic.revenue : null;

  return [
    { key: 'impressions', label: 'Impressions', source: 'GSC', value: impressions, rate: null, rateLabel: null, note: search ? null : noSearch },
    { key: 'clicks', label: 'Clicks', source: 'GSC', value: clicks, rate: ratio(clicks, impressions), rateLabel: 'click-through rate', note: search ? null : noSearch },
    {
      key: 'sessions',
      label: 'Organic sessions',
      source: 'GA4',
      value: sessions,
      rate: ratio(sessions, clicks),
      rateLabel: 'sessions per click',
      note: organic ? null : noGa,
    },
    { key: 'engaged', label: 'Engaged sessions', source: 'GA4', value: engaged, rate: ratio(engaged, sessions), rateLabel: 'engagement rate', note: organic ? null : noGa },
    {
      key: 'keyEvents',
      label: 'Key events',
      source: 'GA4',
      value: keyEvents,
      rate: ratio(keyEvents, sessions),
      rateLabel: 'key events per session',
      note: organic ? (keyEvents === null ? 'No key events are set up in this Google Analytics property.' : null) : noGa,
    },
    {
      key: 'revenue',
      label: 'Revenue',
      source: 'GA4',
      value: revenue,
      rate: null,
      rateLabel: null,
      note: organic ? (revenue === null ? 'No revenue is recorded in this Google Analytics property.' : null) : noGa,
    },
  ];
}

// ── Headlines ─────────────────────────────────────────────────────────────

export type Tone = 'good' | 'bad' | 'warn' | 'neutral';

export interface Headline {
  id: string;
  tone: Tone;
  /** One plain sentence saying what happened and, where the data shows it, why. */
  text: string;
  evidence: Evidence[];
  /** Where to look next: a Google-section view and optionally a Pages segment. */
  links: { label: string; view: string; segment?: string }[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: Source | 'GSC+GA4';
}

export interface HeadlineInput {
  days: number;
  search: SearchSummaryLike | null;
  organic: OrganicLike | null;
  organicPrevious: OrganicLike | null;
  /** Pages seen often and clicked rarely for where they rank. */
  ctrGap: { pages: number; missedClicks: number } | null;
  /** Searches whose position fell between the two windows. */
  decliningQueries: number | null;
}

/** A change smaller than this is treated as steady rather than as news. */
const NOTABLE_PCT = 10;
/** Fewer organic sessions than this and a rate is too noisy to judge. */
const MIN_SESSIONS_FOR_RATES = 30;

const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`;
const rate = (v: number) => `${(v * 100).toFixed(1)}%`;
const num = (v: number) => Math.round(v).toLocaleString('en-US');

export function buildHeadlines(input: HeadlineInput): Headline[] {
  const out: Headline[] = [];
  const { search, organic, organicPrevious, ctrGap, decliningQueries, days } = input;

  if (search) {
    const clicks = search.clicks.changePct;
    const impressions = search.impressions.changePct;
    const ctrNow = search.ctr.current;
    const ctrBefore = search.ctr.previous;
    const posNow = search.position.current;
    const posBefore = search.position.previous;

    const evidence: Evidence[] = [
      { label: 'Clicks', value: `${num(search.clicks.current)}${clicks !== null ? ` (${pct(clicks)})` : ''}`, source: 'GSC' },
      { label: 'Impressions', value: `${num(search.impressions.current)}${impressions !== null ? ` (${pct(impressions)})` : ''}`, source: 'GSC' },
      { label: 'Average CTR', value: rate(ctrNow), source: 'GSC' },
      { label: 'Average position', value: posNow.toFixed(1), source: 'GSC' },
    ];

    if (clicks === null && impressions === null) {
      out.push({
        id: 'search-no-baseline',
        tone: 'neutral',
        text: `Google showed your site ${num(search.impressions.current)} times and sent ${num(search.clicks.current)} clicks in the last ${days} days. There is no earlier period stored yet, so no change can be shown.`,
        evidence,
        links: [{ label: 'View pages', view: 'pages' }],
        confidence: 'HIGH',
        source: 'GSC',
      });
    } else if (impressions !== null && clicks !== null && impressions >= NOTABLE_PCT && clicks < impressions / 2) {
      // Visibility grew and clicks did not keep up. Name the cause only when
      // the numbers show it.
      const ctrFell = ctrBefore !== null && ctrNow < ctrBefore;
      out.push({
        id: 'visibility-outpaces-clicks',
        tone: 'warn',
        text:
          `Search visibility rose ${pct(impressions).replace('+', '')}, but clicks ${clicks < 0 ? `fell ${Math.abs(clicks).toFixed(1)}%` : `rose only ${clicks.toFixed(1)}%`}` +
          (ctrFell ? `, because click-through rate fell from ${rate(ctrBefore!)} to ${rate(ctrNow)}` : '') +
          (ctrGap && ctrGap.pages > 0 ? `. ${ctrGap.pages} page${ctrGap.pages === 1 ? ' is' : 's are'} seen often and clicked rarely for where ${ctrGap.pages === 1 ? 'it ranks' : 'they rank'}` : '') +
          '.',
        evidence,
        links: [
          { label: 'View affected pages', view: 'pages', segment: 'high-impressions-low-ctr' },
          { label: 'View affected queries', view: 'search-performance' },
        ],
        confidence: ctrFell ? 'HIGH' : 'MEDIUM',
        source: 'GSC',
      });
    } else if (clicks !== null && clicks <= -NOTABLE_PCT) {
      const slipped = posBefore !== null && posNow - posBefore >= 0.5;
      out.push({
        id: 'clicks-down',
        tone: 'bad',
        text:
          `Search clicks fell ${Math.abs(clicks).toFixed(1)}% against the previous ${days} days` +
          (impressions !== null && impressions <= -NOTABLE_PCT ? `, with impressions down ${Math.abs(impressions).toFixed(1)}% as well` : '') +
          (slipped ? `. Average position slipped from ${posBefore!.toFixed(1)} to ${posNow.toFixed(1)}` : '') +
          (decliningQueries ? `, and ${decliningQueries} search${decliningQueries === 1 ? '' : 'es'} lost ground` : '') +
          '.',
        evidence,
        links: [
          { label: 'View declining pages', view: 'pages', segment: 'declining' },
          { label: 'View affected queries', view: 'search-performance' },
        ],
        confidence: impressions !== null ? 'HIGH' : 'MEDIUM',
        source: 'GSC',
      });
    } else if (clicks !== null && clicks >= NOTABLE_PCT) {
      out.push({
        id: 'clicks-up',
        tone: 'good',
        text: `Search clicks grew ${clicks.toFixed(1)}% against the previous ${days} days${impressions !== null ? `, on ${pct(impressions)} impressions` : ''}.`,
        evidence,
        links: [{ label: 'View growing pages', view: 'pages', segment: 'growing' }],
        confidence: 'HIGH',
        source: 'GSC',
      });
    } else {
      out.push({
        id: 'search-steady',
        tone: 'neutral',
        text: `Search clicks are steady at ${num(search.clicks.current)} over the last ${days} days${clicks !== null ? ` (${pct(clicks)})` : ''}.`,
        evidence,
        links: [{ label: 'View pages', view: 'pages' }],
        confidence: 'HIGH',
        source: 'GSC',
      });
    }

    if (ctrGap && ctrGap.pages > 0 && !out.some((h) => h.id === 'visibility-outpaces-clicks')) {
      out.push({
        id: 'ctr-gap',
        tone: 'warn',
        text: `${ctrGap.pages} page${ctrGap.pages === 1 ? ' gets' : 's get'} seen often but clicked rarely for where ${ctrGap.pages === 1 ? 'it ranks' : 'they rank'} — about ${num(ctrGap.missedClicks)} clicks a period are being missed.`,
        evidence: [
          { label: 'Pages affected', value: String(ctrGap.pages), source: 'GSC' },
          { label: 'Estimated missed clicks', value: num(ctrGap.missedClicks), source: 'Reigel' },
        ],
        links: [{ label: 'View affected pages', view: 'pages', segment: 'high-impressions-low-ctr' }],
        confidence: 'MEDIUM',
        source: 'GSC',
      });
    }
  }

  if (organic) {
    const before = organicPrevious;
    const sessionsChange = before && before.sessions > 0 ? ((organic.sessions - before.sessions) / before.sessions) * 100 : null;

    if (sessionsChange !== null && Math.abs(sessionsChange) >= NOTABLE_PCT) {
      out.push({
        id: 'organic-sessions-change',
        tone: sessionsChange > 0 ? 'good' : 'bad',
        text: `Organic visits ${sessionsChange > 0 ? 'grew' : 'fell'} ${Math.abs(sessionsChange).toFixed(1)}% against the previous ${days} days (${num(before!.sessions)} → ${num(organic.sessions)} sessions).`,
        evidence: [
          { label: 'Organic sessions', value: `${num(organic.sessions)} (${pct(sessionsChange)})`, source: 'GA4' },
          { label: 'Organic users', value: num(organic.activeUsers), source: 'GA4' },
        ],
        links: [{ label: 'View pages', view: 'pages', segment: sessionsChange > 0 ? 'growing' : 'declining' }],
        confidence: organic.sessions >= MIN_SESSIONS_FOR_RATES ? 'HIGH' : 'LOW',
        source: 'GA4',
      });
    }

    if (organic.sessions >= MIN_SESSIONS_FOR_RATES && organic.engagementRate < 0.4) {
      out.push({
        id: 'low-engagement',
        tone: 'warn',
        text: `Only ${rate(organic.engagementRate)} of organic visits engaged with the site, so most people who arrive from Google leave without doing anything.`,
        evidence: [
          { label: 'Engagement rate', value: rate(organic.engagementRate), source: 'GA4' },
          { label: 'Organic sessions', value: num(organic.sessions), source: 'GA4' },
        ],
        links: [{ label: 'View pages', view: 'pages', segment: 'high-traffic-low-conversion' }],
        confidence: 'MEDIUM',
        source: 'GA4',
      });
    }

    if (organic.keyEvents === null) {
      out.push({
        id: 'no-key-events',
        tone: 'neutral',
        text: 'No key events are set up in your Google Analytics property, so Google visits cannot yet be connected to business results.',
        evidence: [{ label: 'Key events', value: 'not set up', source: 'GA4' }],
        links: [],
        confidence: 'HIGH',
        source: 'GA4',
      });
    } else if (organic.keyEvents === 0 && organic.sessions >= MIN_SESSIONS_FOR_RATES) {
      out.push({
        id: 'no-organic-conversions',
        tone: 'warn',
        text: `${num(organic.sessions)} organic visits recorded no key events in the last ${days} days.`,
        evidence: [
          { label: 'Key events', value: '0', source: 'GA4' },
          { label: 'Organic sessions', value: num(organic.sessions), source: 'GA4' },
        ],
        links: [{ label: 'View pages', view: 'pages', segment: 'high-traffic-low-conversion' }],
        confidence: 'MEDIUM',
        source: 'GA4',
      });
    }
  }

  return out;
}

// ── Page segments ─────────────────────────────────────────────────────────

export const SEGMENTS = [
  'top-traffic',
  'top-impressions',
  'top-converting',
  'declining',
  'growing',
  'high-impressions-low-ctr',
  'high-traffic-low-conversion',
  'low-traffic-high-conversion',
  'ranking-opportunity',
  'technical-risk',
] as const;
export type Segment = (typeof SEGMENTS)[number];

/** The thresholds behind each segment, returned with the data so the judgement is visible. */
export const SEGMENT_CRITERIA = {
  declining: 'Clicks down at least 20% on the previous period, with at least 10 clicks then.',
  growing: 'Clicks up at least 20% on the previous period, by at least 3 clicks.',
  'high-impressions-low-ctr': 'At least 100 impressions and a click-through rate under 60% of what is typical for its position.',
  'high-traffic-low-conversion': 'At least 20 organic sessions, key events measured, and none recorded.',
  'low-traffic-high-conversion': 'Key events recorded on fewer organic sessions than the median, at more than twice the site rate.',
  'ranking-opportunity': 'Average position 4–20 with at least 50 impressions.',
  'technical-risk': "Google's index check did not pass, or the last crawl found the page not indexable or erroring.",
} as const;

export interface PageRowFacts {
  gsc: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    previousClicks: number | null;
  } | null;
  ga: { sessions: number; keyEvents: number | null } | null;
  technicalRisk: string | null;
}

export interface SegmentContext {
  medianSessions: number;
  /** Key events per session across every organic page, or null when not measured. */
  siteConversionRate: number | null;
}

/** Which segments one page belongs to. Never returns a segment for data that was not measured. */
export function segmentsFor(row: PageRowFacts, ctx: SegmentContext): Segment[] {
  const out: Segment[] = [];
  const g = row.gsc;
  const a = row.ga;

  if (g && g.clicks > 0) out.push('top-traffic');
  if (g && g.impressions > 0) out.push('top-impressions');
  if (a && a.keyEvents !== null && a.keyEvents > 0) out.push('top-converting');

  if (g && g.previousClicks !== null) {
    if (g.previousClicks >= 10 && g.clicks <= g.previousClicks * 0.8) out.push('declining');
    if (g.clicks >= g.previousClicks * 1.2 && g.clicks - g.previousClicks >= 3) out.push('growing');
  }

  if (g && g.impressions >= 100 && g.ctr < expectedCtr(g.position) * 0.6) out.push('high-impressions-low-ctr');
  if (g && g.position >= 4 && g.position <= 20 && g.impressions >= 50) out.push('ranking-opportunity');

  if (a && a.keyEvents !== null) {
    if (a.sessions >= 20 && a.keyEvents === 0) out.push('high-traffic-low-conversion');
    if (
      a.keyEvents > 0 &&
      a.sessions < ctx.medianSessions &&
      ctx.siteConversionRate !== null &&
      a.keyEvents / a.sessions > ctx.siteConversionRate * 2
    ) {
      out.push('low-traffic-high-conversion');
    }
  }

  if (row.technicalRisk) out.push('technical-risk');
  return out;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Page diagnosis ────────────────────────────────────────────────────────

export interface DiagnosisFinding {
  id: string;
  tone: Tone;
  /** What the data shows, in one sentence. */
  text: string;
  evidence: Evidence[];
  /** What to do about it. */
  action: string;
  source: Source | 'GSC+GA4';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DiagnosisInput {
  gsc: { clicks: number; impressions: number; ctr: number; position: number; previousClicks: number | null } | null;
  ga: { sessions: number; engagementRate: number; keyEvents: number | null } | null;
  index: { verdict: string | null; coverageState: string | null; meaning: string | null; action: string | null } | null;
  crawl: {
    statusCode: number;
    indexability: string;
    title: string | null;
    metaDescription: string | null;
    h1Count: number;
    wordCount: number;
    canonicalUrl: string | null;
    pageUrl: string;
    schemaTypes: number;
  } | null;
}

/**
 * Why a page performs as it does, from what is recorded about it.
 *
 * Each finding fires on a stated threshold and carries the numbers that
 * triggered it. When nothing fires the answer says so: "no problem found" is a
 * result, and inventing a concern to fill the card would be the opposite of
 * evidence.
 */
export function diagnosePage(input: DiagnosisInput): DiagnosisFinding[] {
  const out: DiagnosisFinding[] = [];
  const { gsc, ga, index, crawl } = input;

  if (index && index.verdict && index.verdict !== 'PASS') {
    out.push({
      id: 'not-indexed',
      tone: 'bad',
      text: `Google's index check did not pass for this page: ${index.coverageState ?? index.verdict}.`,
      evidence: [{ label: "Google's status", value: index.coverageState ?? index.verdict, source: 'GSC' }],
      action: index.action ?? index.meaning ?? 'Open the Google Index view for details.',
      source: 'GSC',
      confidence: 'HIGH',
    });
  }

  if (crawl) {
    if (crawl.statusCode >= 400 || crawl.statusCode === 0) {
      out.push({
        id: 'crawl-error',
        tone: 'bad',
        text: `Our last crawl got ${crawl.statusCode === 0 ? 'no response' : `HTTP ${crawl.statusCode}`} from this page.`,
        evidence: [{ label: 'Crawl status', value: crawl.statusCode === 0 ? 'no response' : String(crawl.statusCode), source: 'Reigel' }],
        action: 'Restore the page, or redirect it to its replacement.',
        source: 'Reigel',
        confidence: 'HIGH',
      });
    }
    if (crawl.indexability === 'NOT_INDEXABLE') {
      out.push({
        id: 'not-indexable',
        tone: 'bad',
        text: 'The page tells Google not to index it, or cannot be indexed as it stands.',
        evidence: [{ label: 'Indexability', value: 'not indexable', source: 'Reigel' }],
        action: 'If this page should appear in search, remove the noindex setting or fix what blocks it.',
        source: 'Reigel',
        confidence: 'HIGH',
      });
    }
    if (crawl.canonicalUrl && crawl.canonicalUrl.replace(/\/+$/, '') !== crawl.pageUrl.replace(/\/+$/, '')) {
      out.push({
        id: 'canonical-elsewhere',
        tone: 'warn',
        text: 'This page names a different page as its main version, so Google may show that one instead.',
        evidence: [{ label: 'Canonical', value: crawl.canonicalUrl, source: 'Reigel' }],
        action: 'If this page should rank itself, point its canonical at its own address.',
        source: 'Reigel',
        confidence: 'MEDIUM',
      });
    }
    if (!crawl.title) {
      out.push({
        id: 'missing-title',
        tone: 'warn',
        text: 'The page has no title.',
        evidence: [{ label: 'Title', value: 'missing', source: 'Reigel' }],
        action: 'Add a title that says what the page offers and includes the search people use.',
        source: 'Reigel',
        confidence: 'HIGH',
      });
    }
    if (!crawl.metaDescription) {
      out.push({
        id: 'missing-description',
        tone: 'warn',
        text: 'The page has no meta description, so Google writes its own snippet.',
        evidence: [{ label: 'Meta description', value: 'missing', source: 'Reigel' }],
        action: 'Write a short description that answers the search and invites the click.',
        source: 'Reigel',
        confidence: 'MEDIUM',
      });
    }
    if (crawl.h1Count === 0) {
      out.push({
        id: 'missing-h1',
        tone: 'warn',
        text: 'The page has no main heading (H1).',
        evidence: [{ label: 'H1 headings', value: '0', source: 'Reigel' }],
        action: 'Add one clear H1 that matches the page’s purpose.',
        source: 'Reigel',
        confidence: 'MEDIUM',
      });
    }
    if (gsc && gsc.position > 10 && crawl.wordCount > 0 && crawl.wordCount < 300) {
      out.push({
        id: 'thin-content',
        tone: 'warn',
        text: `The page ranks around position ${gsc.position.toFixed(1)} and has only ${crawl.wordCount} words.`,
        evidence: [
          { label: 'Average position', value: gsc.position.toFixed(1), source: 'GSC' },
          { label: 'Words on page', value: String(crawl.wordCount), source: 'Reigel' },
        ],
        action: 'Compare with the pages ranking above it and cover what they answer that this page does not.',
        source: 'GSC+GA4',
        confidence: 'LOW',
      });
    }
  }

  if (gsc) {
    const expected = expectedCtr(gsc.position);
    if (gsc.impressions >= 100 && gsc.ctr < expected * 0.6) {
      out.push({
        id: 'low-ctr',
        tone: 'warn',
        text: 'This page is seen often in Google but clicked less than is typical for where it ranks.',
        evidence: [
          { label: 'Impressions', value: Math.round(gsc.impressions).toLocaleString('en-US'), source: 'GSC' },
          { label: 'CTR', value: `${(gsc.ctr * 100).toFixed(1)}%`, source: 'GSC' },
          { label: 'Typical CTR at this position', value: `${(expected * 100).toFixed(1)}%`, source: 'Reigel' },
          { label: 'Average position', value: gsc.position.toFixed(1), source: 'GSC' },
        ],
        action: 'Review the title and meta description against what people searching for it want.',
        source: 'GSC',
        confidence: 'MEDIUM',
      });
    }
    if (gsc.position >= 4 && gsc.position <= 20 && gsc.impressions >= 50) {
      out.push({
        id: 'near-top',
        tone: 'neutral',
        text: `The page ranks at position ${gsc.position.toFixed(1)}, close enough to the first results that improving it could bring clicks.`,
        evidence: [
          { label: 'Average position', value: gsc.position.toFixed(1), source: 'GSC' },
          { label: 'Impressions', value: Math.round(gsc.impressions).toLocaleString('en-US'), source: 'GSC' },
        ],
        action: 'Strengthen the page for its main search: content depth, internal links and a clearer title.',
        source: 'GSC',
        confidence: 'MEDIUM',
      });
    }
    if (gsc.previousClicks !== null && gsc.previousClicks >= 10 && gsc.clicks <= gsc.previousClicks * 0.8) {
      out.push({
        id: 'clicks-down',
        tone: 'bad',
        text: `Clicks from Google fell from ${Math.round(gsc.previousClicks)} to ${Math.round(gsc.clicks)} against the previous period.`,
        evidence: [
          { label: 'Clicks now', value: String(Math.round(gsc.clicks)), source: 'GSC' },
          { label: 'Clicks before', value: String(Math.round(gsc.previousClicks)), source: 'GSC' },
        ],
        action: 'Check which searches lost position below, and whether the page changed recently.',
        source: 'GSC',
        confidence: 'HIGH',
      });
    }
  }

  if (ga && ga.sessions >= 20) {
    if (ga.engagementRate < 0.4) {
      out.push({
        id: 'low-engagement',
        tone: 'warn',
        text: `Only ${(ga.engagementRate * 100).toFixed(1)}% of organic visits to this page engaged.`,
        evidence: [
          { label: 'Engagement rate', value: `${(ga.engagementRate * 100).toFixed(1)}%`, source: 'GA4' },
          { label: 'Organic sessions', value: String(Math.round(ga.sessions)), source: 'GA4' },
        ],
        action: 'Check that the page delivers what its search promises, and that it loads and reads well on a phone.',
        source: 'GA4',
        confidence: 'MEDIUM',
      });
    }
    if (ga.keyEvents === 0) {
      out.push({
        id: 'no-conversions',
        tone: 'warn',
        text: 'Visitors from Google reach this page but record no key events.',
        evidence: [
          { label: 'Organic sessions', value: String(Math.round(ga.sessions)), source: 'GA4' },
          { label: 'Key events', value: '0', source: 'GA4' },
        ],
        action: 'Make the next step (call, order, sign-up) clear on the page, and confirm it is tracked as a key event.',
        source: 'GA4',
        confidence: 'MEDIUM',
      });
    }
  }

  return out;
}
