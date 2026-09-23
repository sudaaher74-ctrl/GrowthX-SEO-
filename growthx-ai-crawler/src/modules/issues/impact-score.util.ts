import { CONFIDENCE_MULTIPLIERS, SEVERITY_WEIGHTS } from './health-score.util';
import { FixClass } from './fix-class';

/**
 * The one number that orders the queue. §6 of docs/workflow/00-ARCHITECTURE.md.
 *
 *   impact = ((0.45 × reach) + (0.35 × severity) + (0.20 × confidence))
 *            × { AUTO: 1.00, APPROVAL: 0.92, MANUAL: 0.78 }[fixClass]
 *
 * Severity and confidence are the health score's own weights, rescaled rather
 * than restated. A second copy of those numbers would drift the first time
 * someone tuned the health score, and then the gauge and the queue would
 * disagree about how bad the same finding is.
 */

/** Weighting of the three inputs. Sums to 1, so a perfect input scores 100. */
const REACH_WEIGHT = 0.45;
const SEVERITY_WEIGHT = 0.35;
const CONFIDENCE_WEIGHT = 0.2;

/**
 * When two findings score close, push toward the one we can fix for them.
 * That is what makes "Fix all safe" the primary button: it is not only the
 * safest action, it is usually the highest-ranked one too.
 */
export const FIX_CLASS_MULTIPLIER: Readonly<Record<FixClass, number>> = {
  AUTO: 1.0,
  APPROVAL: 0.92,
  MANUAL: 0.78,
};

/**
 * Stand-in for reach when Search Console is not connected.
 *
 * Neutral, not zero. Zero would push every finding on an unconnected project
 * to the bottom of the order for a reason that has nothing to do with the
 * finding, and the response says it is a stand-in so the UI can tell the user
 * why the ordering is not traffic-weighted rather than implying it is.
 */
export const NEUTRAL_REACH = 50;

/** CRITICAL 100, HIGH 40, MEDIUM 15, LOW 5 — the health score's weights on a 0-100 scale. */
export function severityScore(severity: string): number {
  const top = SEVERITY_WEIGHTS.CRITICAL;
  const weight = SEVERITY_WEIGHTS[severity];
  if (weight === undefined || !top) return 0;
  return (weight / top) * 100;
}

/** CONFIRMED 100, LIKELY 80, ADVISORY 50. */
export function confidenceScore(confidence: string): number {
  const mult = CONFIDENCE_MULTIPLIERS[confidence];
  return mult === undefined ? 0 : mult * 100;
}

export interface ImpactInput {
  severity: string;
  confidence: string;
  fixClass: FixClass;
  /**
   * 0-100 share of the project's search impressions landing on the affected
   * pages, or null when that cannot be measured. Never a guess.
   */
  reach: number | null;
}

export interface ImpactResult {
  /** 0-100, rounded to one decimal place. */
  impact: number;
  /** False when reach fell back to the neutral stand-in. */
  reachAvailable: boolean;
}

export function impactScore(input: ImpactInput): ImpactResult {
  const reachAvailable = input.reach !== null && Number.isFinite(input.reach);
  const reach = reachAvailable ? clamp(input.reach as number) : NEUTRAL_REACH;

  const base =
    REACH_WEIGHT * reach +
    SEVERITY_WEIGHT * severityScore(input.severity) +
    CONFIDENCE_WEIGHT * confidenceScore(input.confidence);

  const raw = base * (FIX_CLASS_MULTIPLIER[input.fixClass] ?? FIX_CLASS_MULTIPLIER.MANUAL);
  return { impact: Math.round(clamp(raw) * 10) / 10, reachAvailable };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
