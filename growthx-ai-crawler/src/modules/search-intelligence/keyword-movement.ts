/**
 * New and rising keywords, and pages that compete for the same query.
 *
 * Pure functions over rows already aggregated from stored Search Console data.
 * The rules are named constants and returned with the result, so a list is
 * never read as more certain than the rule that produced it.
 */

/** A query needs this many impressions in the current window before it is called new or rising: below it, a swing is noise. */
export const MIN_IMPRESSIONS = 30;
/** Rising means at least this many more clicks... */
export const RISING_MIN_EXTRA_CLICKS = 3;
/** ...and at least this much more, in percent; or a position gain of RISING_MIN_PLACES on enough impressions in both windows. */
export const RISING_MIN_PCT = 25;
export const RISING_MIN_PLACES = 3;

/** Cannibalization: a query with this many impressions, answered by two or more pages that each hold this share of them. */
export const CANNIBAL_MIN_QUERY_IMPRESSIONS = 100;
export const CANNIBAL_MIN_PAGE_SHARE = 0.1;

export interface QueryAgg {
  key: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface QueryPageAgg {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface NewKeyword {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface RisingKeyword {
  query: string;
  clicks: number;
  previousClicks: number;
  clicksChange: number;
  clicksChangePct: number | null;
  position: number;
  previousPosition: number;
  /** Positive is up the page. */
  movement: number;
}

/**
 * `prior` is null when there is no stored earlier window: nothing can be called
 * new or rising then, and an empty list would wrongly say nothing changed.
 */
export function keywordMovement(current: QueryAgg[], prior: QueryAgg[] | null) {
  if (prior === null) return null;
  const before = new Map(prior.map((r) => [r.key, r]));
  const fresh: NewKeyword[] = [];
  const rising: RisingKeyword[] = [];

  for (const row of current) {
    if (row.impressions < MIN_IMPRESSIONS) continue;
    const was = before.get(row.key);
    if (!was || was.impressions === 0) {
      fresh.push({ query: row.key, clicks: row.clicks, impressions: row.impressions, position: row.position });
      continue;
    }
    const extra = row.clicks - was.clicks;
    const pct = was.clicks > 0 ? (extra / was.clicks) * 100 : null;
    const clicksUp = extra >= RISING_MIN_EXTRA_CLICKS && (pct === null || pct >= RISING_MIN_PCT);
    const movement = was.impressions >= MIN_IMPRESSIONS ? was.position - row.position : 0;
    if (clicksUp || movement >= RISING_MIN_PLACES) {
      rising.push({
        query: row.key,
        clicks: row.clicks,
        previousClicks: was.clicks,
        clicksChange: extra,
        clicksChangePct: pct,
        position: row.position,
        previousPosition: was.position,
        movement,
      });
    }
  }

  fresh.sort((a, b) => b.impressions - a.impressions);
  rising.sort((a, b) => b.clicksChange - a.clicksChange || b.movement - a.movement);
  return { new: fresh, rising };
}

export interface CannibalPage {
  page: string;
  clicks: number;
  impressions: number;
  position: number;
  /** Share of the query's impressions this page received, 0-1. */
  share: number;
}

export interface Cannibalization {
  query: string;
  impressions: number;
  clicks: number;
  pages: CannibalPage[];
}

export function findCannibalization(rows: QueryPageAgg[]): Cannibalization[] {
  const byQuery = new Map<string, QueryPageAgg[]>();
  for (const r of rows) {
    if (!r.query || !r.page) continue;
    const list = byQuery.get(r.query) ?? [];
    list.push(r);
    byQuery.set(r.query, list);
  }

  const out: Cannibalization[] = [];
  for (const [query, list] of byQuery) {
    const impressions = list.reduce((s, r) => s + r.impressions, 0);
    if (impressions < CANNIBAL_MIN_QUERY_IMPRESSIONS) continue;
    const pages = list
      .map((r) => ({ page: r.page, clicks: r.clicks, impressions: r.impressions, position: r.position, share: r.impressions / impressions }))
      .sort((a, b) => b.impressions - a.impressions);
    if (pages.filter((p) => p.share >= CANNIBAL_MIN_PAGE_SHARE).length < 2) continue;
    out.push({ query, impressions, clicks: list.reduce((s, r) => s + r.clicks, 0), pages: pages.slice(0, 5) });
  }
  return out.sort((a, b) => b.impressions - a.impressions);
}
