/**
 * Before / after, without overclaiming.
 *
 * Two windows of real stored figures go in; per-metric verdicts come out. A
 * verdict needs both sides measured and enough volume for the change to mean
 * something — otherwise it says so rather than inventing a direction. Windows
 * can differ in length (the after window only runs from when the change went
 * live), so counts are compared per day, not as totals.
 *
 * Nothing here says an action caused a change. The result carries the other
 * changes made in the same period and a fixed statement of what a before/after
 * comparison can and cannot show.
 */
export interface SearchFigures { clicks: number; impressions: number; ctr: number; position: number }
export interface VisitFigures { sessions: number; engagementRate: number | null; conversions: number | null }
export interface LocalFigures { websiteClicks: number; calls: number; directions: number }
export interface AiFigures { checks: number; citedChecks: number; ratePct: number }

export interface Snapshot {
  capturedAt: string;
  range: { start: string; end: string; days: number };
  page: { gsc: SearchFigures | null; ga4: VisitFigures | null } | null;
  site: { gsc: SearchFigures | null; ga4: VisitFigures | null; gbp: LocalFigures | null; ai: AiFigures | null };
}

export type Verdict = 'IMPROVED' | 'WORSE' | 'NO_CLEAR_CHANGE' | 'NOT_COMPARABLE';

export interface MetricChange {
  key: string;
  label: string;
  scope: 'page' | 'site';
  source: 'GSC' | 'GA4' | 'GBP' | 'AI_VISIBILITY';
  unit: 'count_per_day' | 'ratio' | 'position' | 'points';
  before: number | null;
  after: number | null;
  /** Relative change for counts and ratios, absolute for position and points. Null when not comparable. */
  change: number | null;
  verdict: Verdict;
  reason: string;
}

export const COMPARE = {
  /** Relative change below this is treated as noise. */
  relative: 0.1,
  /** Position must move by at least this many places. */
  positionPlaces: 1,
  /** AI citation rate must move by at least this many points. */
  aiPoints: 10,
  /** Window totals below these on the before side are too small to judge. */
  minBefore: { clicks: 20, impressions: 100, sessions: 30, conversions: 5, gbp: 10, aiChecks: 5 },
} as const;

type Def = {
  key: string;
  label: string;
  scope: MetricChange['scope'];
  source: MetricChange['source'];
  unit: MetricChange['unit'];
  higherIsBetter: boolean;
  pick: (s: Snapshot) => { value: number | null; total?: number | null; missing?: string } ;
  floor?: number;
};

const ok = (value: number, total?: number) => ({ value, total });
const missing = (why: string) => ({ value: null as number | null, missing: why });

const DEFS: Def[] = [
  { key: 'page.position', label: 'Average position', scope: 'page', source: 'GSC', unit: 'position', higherIsBetter: false, pick: (s) => (s.page?.gsc ? ok(s.page.gsc.position, s.page.gsc.impressions) : missing('no Search Console data for this page')), floor: COMPARE.minBefore.impressions },
  { key: 'page.impressions', label: 'Impressions per day', scope: 'page', source: 'GSC', unit: 'count_per_day', higherIsBetter: true, pick: (s) => (s.page?.gsc ? ok(s.page.gsc.impressions / s.range.days, s.page.gsc.impressions) : missing('no Search Console data for this page')), floor: COMPARE.minBefore.impressions },
  { key: 'page.clicks', label: 'Clicks per day', scope: 'page', source: 'GSC', unit: 'count_per_day', higherIsBetter: true, pick: (s) => (s.page?.gsc ? ok(s.page.gsc.clicks / s.range.days, s.page.gsc.clicks) : missing('no Search Console data for this page')), floor: COMPARE.minBefore.clicks },
  { key: 'page.ctr', label: 'Click-through rate', scope: 'page', source: 'GSC', unit: 'ratio', higherIsBetter: true, pick: (s) => (s.page?.gsc ? ok(s.page.gsc.ctr, s.page.gsc.impressions) : missing('no Search Console data for this page')), floor: COMPARE.minBefore.impressions },
  { key: 'page.sessions', label: 'Visits per day (all channels)', scope: 'page', source: 'GA4', unit: 'count_per_day', higherIsBetter: true, pick: (s) => (s.page?.ga4 ? ok(s.page.ga4.sessions / s.range.days, s.page.ga4.sessions) : missing('no Analytics data for this page')), floor: COMPARE.minBefore.sessions },
  { key: 'page.engagement', label: 'Engagement rate', scope: 'page', source: 'GA4', unit: 'ratio', higherIsBetter: true, pick: (s) => (s.page?.ga4?.engagementRate != null ? ok(s.page.ga4.engagementRate, s.page.ga4.sessions) : missing('no engagement data for this page')), floor: COMPARE.minBefore.sessions },
  { key: 'page.keyEvents', label: 'Key events per day', scope: 'page', source: 'GA4', unit: 'count_per_day', higherIsBetter: true, pick: (s) => (s.page?.ga4?.conversions != null ? ok(s.page.ga4.conversions / s.range.days, s.page.ga4.conversions) : missing('key events are not configured')), floor: COMPARE.minBefore.conversions },
  { key: 'site.clicks', label: 'Site clicks per day', scope: 'site', source: 'GSC', unit: 'count_per_day', higherIsBetter: true, pick: (s) => (s.site.gsc ? ok(s.site.gsc.clicks / s.range.days, s.site.gsc.clicks) : missing('Search Console not measured')), floor: COMPARE.minBefore.clicks },
  { key: 'site.keyEvents', label: 'Site key events per day', scope: 'site', source: 'GA4', unit: 'count_per_day', higherIsBetter: true, pick: (s) => (s.site.ga4?.conversions != null ? ok(s.site.ga4.conversions / s.range.days, s.site.ga4.conversions) : missing('key events are not configured')), floor: COMPARE.minBefore.conversions },
  { key: 'site.gbpWebsiteClicks', label: 'Business Profile website clicks per day', scope: 'site', source: 'GBP', unit: 'count_per_day', higherIsBetter: true, pick: (s) => (s.site.gbp ? ok(s.site.gbp.websiteClicks / s.range.days, s.site.gbp.websiteClicks) : missing('Business Profile not measured')), floor: COMPARE.minBefore.gbp },
  { key: 'site.gbpCalls', label: 'Business Profile calls per day', scope: 'site', source: 'GBP', unit: 'count_per_day', higherIsBetter: true, pick: (s) => (s.site.gbp ? ok(s.site.gbp.calls / s.range.days, s.site.gbp.calls) : missing('Business Profile not measured')), floor: COMPARE.minBefore.gbp },
  { key: 'site.ai', label: 'AI citation rate', scope: 'site', source: 'AI_VISIBILITY', unit: 'points', higherIsBetter: true, pick: (s) => (s.site.ai ? ok(s.site.ai.ratePct, s.site.ai.checks) : missing('AI visibility not measured')), floor: COMPARE.minBefore.aiChecks },
];

export function compareSnapshots(before: Snapshot, after: Snapshot, hasPageScope: boolean): MetricChange[] {
  return DEFS.filter((d) => hasPageScope || d.scope === 'site').map((d) => {
    const b = d.pick(before);
    const a = d.pick(after);
    const base = { key: d.key, label: d.label, scope: d.scope, source: d.source, unit: d.unit, before: b.value, after: a.value } as const;
    if (b.value === null || a.value === null) {
      return { ...base, change: null, verdict: 'NOT_COMPARABLE', reason: b.value === null ? `Before: ${b.missing}.` : `After: ${a.missing}.` };
    }
    if ((b.total ?? 0) < (d.floor ?? 0)) {
      return { ...base, change: null, verdict: 'NOT_COMPARABLE', reason: `Too little data before the change (${Math.round(b.total ?? 0)}) to judge a difference.` };
    }
    const abs = a.value - b.value;
    let change: number;
    let significant: boolean;
    if (d.unit === 'position') {
      change = abs;
      significant = Math.abs(abs) >= COMPARE.positionPlaces;
    } else if (d.unit === 'points') {
      change = abs;
      significant = Math.abs(abs) >= COMPARE.aiPoints;
    } else {
      change = b.value === 0 ? (a.value === 0 ? 0 : Infinity) : abs / b.value;
      significant = Math.abs(change) >= COMPARE.relative;
    }
    if (!significant) return { ...base, change: Number.isFinite(change) ? change : null, verdict: 'NO_CLEAR_CHANGE', reason: 'The change is within normal variation.' };
    const better = d.higherIsBetter ? abs > 0 : abs < 0;
    return { ...base, change: Number.isFinite(change) ? change : null, verdict: better ? 'IMPROVED' : 'WORSE', reason: better ? 'Moved in the intended direction beyond normal variation.' : 'Moved the wrong way beyond normal variation.' };
  });
}

export const CAUSATION_NOTE =
  'A before/after comparison shows what changed after the action, not that the action caused it. ' +
  'Seasonality, other edits, competitors and search-engine updates in the same period can move the same figures.';

export function explain(changes: MetricChange[], contributors: string[]): { whatChanged: string[]; improved: string[]; notImproved: string[]; notComparable: string[]; contributors: string[]; note: string } {
  const label = (c: MetricChange) => `${c.label}`;
  return {
    whatChanged: changes
      .filter((c) => c.verdict === 'IMPROVED' || c.verdict === 'WORSE')
      .map((c) => `${label(c)}: ${fmt(c.before, c.unit)} → ${fmt(c.after, c.unit)}`),
    improved: changes.filter((c) => c.verdict === 'IMPROVED').map(label),
    notImproved: changes.filter((c) => c.verdict === 'WORSE' || c.verdict === 'NO_CLEAR_CHANGE').map(label),
    notComparable: changes.filter((c) => c.verdict === 'NOT_COMPARABLE').map((c) => `${label(c)} — ${c.reason}`),
    contributors,
    note: CAUSATION_NOTE,
  };
}

function fmt(v: number | null, unit: MetricChange['unit']): string {
  if (v === null) return '—';
  if (unit === 'ratio') return `${(v * 100).toFixed(1)}%`;
  if (unit === 'points') return `${v.toFixed(0)}%`;
  if (unit === 'position') return v.toFixed(1);
  return v.toFixed(v < 10 ? 2 : 0);
}
