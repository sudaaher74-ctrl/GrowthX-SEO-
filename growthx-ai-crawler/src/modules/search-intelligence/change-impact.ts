/**
 * Did a change help? Read from Search Console, in equal windows either side
 * of the day it went live.
 *
 * A page's numbers move for reasons that have nothing to do with the change:
 * seasons, Google updates, a sale. So the page is read against the whole site
 * over the same two windows, and the verdict rests on how the page moved
 * relative to that, not on the raw before-and-after.
 */

export interface Window {
  from: string;
  to: string;
  /** Days in the window that actually have data. */
  days: number;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number | null;
}

export type ImpactVerdict = 'IMPROVED' | 'DECLINED' | 'NO_CLEAR_CHANGE' | 'TOO_EARLY' | 'TOO_LITTLE_DATA';

export interface ImpactReading {
  verdict: ImpactVerdict;
  verdictText: string;
  /** Per-day figures, so windows of unequal length compare fairly. */
  perDay: {
    clicks: { before: number; after: number; changePct: number | null };
    impressions: { before: number; after: number; changePct: number | null };
  };
  ctr: { before: number; after: number };
  /** Positive means the page moved up. */
  positionGain: number | null;
  /** How the whole site moved over the same two windows. */
  siteChange: { clicksChangePct: number | null; impressionsChangePct: number | null };
  /** Page change minus site change, in percentage points. */
  relative: { clicks: number | null; impressions: number | null };
  readout: string[];
}

/** Days of post-change data needed before a verdict means anything. */
export const MIN_DAYS_AFTER = 7;
/** Impressions across both windows below which any movement is noise. */
export const MIN_IMPRESSIONS = 30;

function pct(before: number, after: number): number | null {
  if (before <= 0) return after > 0 ? null : 0;
  return Math.round(((after - before) / before) * 100);
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export function readImpact(page: { before: Window; after: Window }, site: { before: Window; after: Window }): ImpactReading {
  const perDay = (w: Window, v: number) => (w.days > 0 ? v / w.days : 0);
  const pc = { before: perDay(page.before, page.before.clicks), after: perDay(page.after, page.after.clicks) };
  const pi = { before: perDay(page.before, page.before.impressions), after: perDay(page.after, page.after.impressions) };
  const sc = { before: perDay(site.before, site.before.clicks), after: perDay(site.after, site.after.clicks) };
  const si = { before: perDay(site.before, site.before.impressions), after: perDay(site.after, site.after.impressions) };

  const clicksPct = pct(pc.before, pc.after);
  const impressionsPct = pct(pi.before, pi.after);
  const siteClicksPct = pct(sc.before, sc.after);
  const siteImpressionsPct = pct(si.before, si.after);
  const relClicks = clicksPct !== null && siteClicksPct !== null ? clicksPct - siteClicksPct : null;
  const relImpressions = impressionsPct !== null && siteImpressionsPct !== null ? impressionsPct - siteImpressionsPct : null;
  const positionGain =
    page.before.position !== null && page.after.position !== null ? round(page.before.position - page.after.position) : null;

  const base = {
    perDay: {
      clicks: { before: round(pc.before, 2), after: round(pc.after, 2), changePct: clicksPct },
      impressions: { before: round(pi.before, 1), after: round(pi.after, 1), changePct: impressionsPct },
    },
    ctr: { before: round(page.before.ctr * 100, 2), after: round(page.after.ctr * 100, 2) },
    positionGain,
    siteChange: { clicksChangePct: siteClicksPct, impressionsChangePct: siteImpressionsPct },
    relative: { clicks: relClicks, impressions: relImpressions },
  };

  if (page.after.days < MIN_DAYS_AFTER) {
    return {
      ...base,
      verdict: 'TOO_EARLY',
      verdictText: `Too early to tell: Search Console has ${page.after.days} day(s) of data since the change, and a fair reading needs at least ${MIN_DAYS_AFTER}.`,
      readout: [],
    };
  }
  if (page.before.impressions + page.after.impressions < MIN_IMPRESSIONS) {
    return {
      ...base,
      verdict: 'TOO_LITTLE_DATA',
      verdictText: 'Google showed this page too rarely, before and after, for any change to mean something.',
      readout: [],
    };
  }

  let score = 0;
  if (relClicks !== null) score += relClicks >= 20 ? 1 : relClicks <= -20 ? -1 : 0;
  else if (pc.before === 0 && pc.after > 0) score += 1;
  if (relImpressions !== null) score += relImpressions >= 20 ? 1 : relImpressions <= -20 ? -1 : 0;
  else if (pi.before === 0 && pi.after > 0) score += 1;
  if (positionGain !== null) score += positionGain >= 1.5 ? 1 : positionGain <= -1.5 ? -1 : 0;

  const verdict: ImpactVerdict = score >= 2 ? 'IMPROVED' : score <= -2 ? 'DECLINED' : 'NO_CLEAR_CHANGE';
  const readout: string[] = [];
  const fmt = (n: number | null) => (n === null ? 'n/a' : `${n > 0 ? '+' : ''}${n}%`);
  readout.push(
    `Clicks from Google went from ${round(pc.before, 1)} to ${round(pc.after, 1)} a day (${clicksPct === null ? 'up from none' : fmt(clicksPct)}), ` +
      `while your whole site changed ${fmt(siteClicksPct)} over the same days.`,
  );
  readout.push(`Times shown in Google went from ${round(pi.before)} to ${round(pi.after)} a day (${impressionsPct === null ? 'up from none' : fmt(impressionsPct)}).`);
  if (positionGain !== null) {
    readout.push(
      positionGain > 0
        ? `Average position improved by ${positionGain} (from ${page.before.position} to ${page.after.position}).`
        : positionGain < 0
          ? `Average position slipped by ${Math.abs(positionGain)} (from ${page.before.position} to ${page.after.position}).`
          : `Average position held at ${page.after.position}.`,
    );
  }
  readout.push(`Click-through rate went from ${base.ctr.before}% to ${base.ctr.after}%.`);

  const verdictText =
    verdict === 'IMPROVED'
      ? 'Improved after the change, by more than the rest of your site did.'
      : verdict === 'DECLINED'
        ? 'Declined after the change, by more than the rest of your site did.'
        : 'No clear change beyond what the rest of your site did over the same days.';
  return { ...base, verdict, verdictText, readout };
}
