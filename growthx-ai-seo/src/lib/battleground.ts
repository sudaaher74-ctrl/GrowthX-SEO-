/**
 * Battleground: you vs your tracked rivals, from data that is actually held.
 *
 * Every figure here names its source, and a figure nobody measured is null —
 * never 0. A rival with no crawl is "not measured", not "worse than you".
 */

export type MetricKey = "pages" | "health" | "ai" | "rating" | "reviews";

export type SourceLabel = "Crawled" | "AI sampled" | "Google Places";

export interface SideValue {
  id: string;
  name: string;
  value: number | null;
}

export interface Metric {
  key: MetricKey;
  label: string;
  source: SourceLabel;
  you: number | null;
  rivals: SideValue[];
  /** How many observations sit behind the AI figures, so a thin sample says so. */
  sample?: number | null;
  format: (n: number) => string;
  /** The bare figure, for a stat tile whose label already carries the unit. */
  short: (n: number) => string;
}

export interface RivalInput {
  id: string;
  name: string;
  domain: string;
  pagesCrawled: number | null;
  healthScore: number | null;
  aiNamed: number | null;
  aiAnswers: number | null;
  rating: number | null;
  reviewCount: number | null;
  lastAnalyzedAt: string | null;
}

interface YouInput {
  domain: string;
  pagesCrawled: number | null;
  healthScore: number | null;
  aiSharePct: number | null;
  aiChecked: number | null;
  rating: number | null;
  reviewCount: number | null;
}

/** Below this many sampled answers, an AI share is shown with a warning. */
export const LOW_SAMPLE = 10;
const count = (n: number) => Math.round(n).toLocaleString("en-IN");

export function buildMetrics(you: YouInput, rivals: RivalInput[]): Metric[] {
  const side = (pick: (r: RivalInput) => number | null): SideValue[] =>
    rivals.map((r) => ({ id: r.id, name: r.name, value: pick(r) }));

  return [
    { key: "pages", label: "Audited pages", source: "Crawled", you: you.pagesCrawled, rivals: side((r) => r.pagesCrawled), format: (n) => `${count(n)} pages`, short: count },
    { key: "health", label: "Website health score", source: "Crawled", you: you.healthScore, rivals: side((r) => r.healthScore), format: (n) => `${Math.round(n)}/100`, short: (n) => String(Math.round(n)) },
  ];
}

/** The strongest rival on a metric, among those actually measured. */
export function bestRival(metric: Metric): SideValue | null {
  let best: SideValue | null = null;
  for (const r of metric.rivals) {
    if (r.value == null) continue;
    if (!best || (best.value ?? -Infinity) < r.value) best = r;
  }
  return best;
}

// ─── Moves ───────────────────────────────────────────────────────────────────

export type MoveKind = MetricKey | "content-gap" | "keyword-gap";

export interface Move {
  id: string;
  kind: MoveKind;
  rival: string;
  title: string;
  detail: string;
  source: SourceLabel;
  /** "Measured", or why the number should be read carefully. */
  confidence: string;
  /** 0–1: how far behind you are. Only used to order the list. */
  weight: number;
  context: Record<string, string | number>;
}

export interface GapCandidate {
  rival: string;
  rivalDomain: string;
  topic: string;
  url?: string;
}

// ─── Threat ──────────────────────────────────────────────────────────────────

export type ThreatLevel = "High" | "Medium" | "Low" | "Not measured";
