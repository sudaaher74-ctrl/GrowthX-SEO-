/**
 * Changes worth a look, detected from two real stored periods.
 *
 * Every rule is a plain threshold on a comparison the Google section already
 * shows, with a minimum volume so a swing on a handful of visits is not called
 * a collapse. The thresholds are returned with the alerts. Nothing here is a
 * forecast, and a figure with no earlier period produces no alert.
 */

/** A count moving this much, in percent, is flagged. */
export const ALERT_PCT = 20;
/** Counts below this in the earlier period are too small to judge. */
export const ALERT_MIN_PREVIOUS = 50;
/** CTR moving this many points, or position this many places, is flagged. */
export const ALERT_CTR_PTS = 1;
export const ALERT_POSITION_PLACES = 1;
/** A page losing this much of its clicks, with at least this many before. */
export const PAGE_DROP_PCT = 40;
export const PAGE_DROP_MIN_CLICKS = 30;

export interface AlertKpi {
  key: string;
  label: string;
  source: 'GSC' | 'GA4';
  format: 'count' | 'percent' | 'position' | 'currency';
  value: number | null;
  previous: number | null;
  delta: { kind: 'pct' | 'pts' | 'places'; value: number } | null;
  lowerIsBetter: boolean;
}

export interface AlertPage {
  url: string;
  previousClicks: number;
  clicks: number;
}

export interface GoogleAlert {
  id: string;
  /** DOWN and worse is a problem; UP and better is worth knowing. */
  direction: 'BAD' | 'GOOD';
  severity: 'HIGH' | 'MEDIUM';
  title: string;
  detail: string;
  source: 'GSC' | 'GA4';
  view: string;
  segment?: string;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function detectAlerts(kpis: AlertKpi[], pages: AlertPage[], days: number): GoogleAlert[] {
  const alerts: GoogleAlert[] = [];

  for (const k of kpis) {
    if (!k.delta || k.value === null || k.previous === null) continue;
    const d = k.delta.value;
    let flagged = false;
    let text = '';
    if (k.delta.kind === 'pct') {
      if (k.previous < ALERT_MIN_PREVIOUS || Math.abs(d) < ALERT_PCT) continue;
      flagged = true;
      text = `${round(Math.abs(d))}%`;
    } else if (k.delta.kind === 'pts') {
      if (Math.abs(d) < ALERT_CTR_PTS) continue;
      flagged = true;
      text = `${round(Math.abs(d))} points`;
    } else {
      if (Math.abs(d) < ALERT_POSITION_PLACES) continue;
      flagged = true;
      text = `${round(Math.abs(d))} places`;
    }
    if (!flagged) continue;
    const up = d > 0;
    const good = k.lowerIsBetter ? !up : up;
    const verb = k.delta.kind === 'places' ? (up ? 'worsened' : 'improved') : up ? 'rose' : 'fell';
    alerts.push({
      id: `kpi-${k.key}`,
      direction: good ? 'GOOD' : 'BAD',
      severity: !good && k.delta.kind === 'pct' && Math.abs(d) >= ALERT_PCT * 2 ? 'HIGH' : 'MEDIUM',
      title: `${k.label} ${verb} ${text}`,
      detail: `Against the previous ${days} days, ${k.label.toLowerCase()} went from ${round(k.previous)} to ${round(k.value)}.`,
      source: k.source,
      view: k.source === 'GSC' ? 'search-performance' : k.key === 'keyEvents' ? 'conversions' : 'engagement',
    });
  }

  const dropped = pages
    .filter((p) => p.previousClicks >= PAGE_DROP_MIN_CLICKS && (p.previousClicks - p.clicks) / p.previousClicks >= PAGE_DROP_PCT / 100)
    .sort((a, b) => b.previousClicks - b.clicks - (a.previousClicks - a.clicks));
  if (dropped.length > 0) {
    const lost = dropped.reduce((s, p) => s + (p.previousClicks - p.clicks), 0);
    alerts.push({
      id: 'pages-dropped',
      direction: 'BAD',
      severity: dropped.length >= 5 ? 'HIGH' : 'MEDIUM',
      title: `${dropped.length} page${dropped.length === 1 ? '' : 's'} lost ${PAGE_DROP_PCT}% or more of their clicks`,
      detail: `Together they lost ${lost} clicks against the previous ${days} days. Biggest: ${dropped[0].url}.`,
      source: 'GSC',
      view: 'pages',
      segment: 'declining',
    });
  }

  return alerts.sort((a, b) => Number(b.direction === 'BAD') - Number(a.direction === 'BAD') || Number(b.severity === 'HIGH') - Number(a.severity === 'HIGH'));
}
