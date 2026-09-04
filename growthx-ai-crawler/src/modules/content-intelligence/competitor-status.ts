/**
 * The status vocabulary of `CompetitorDomain.status`.
 *
 * Written down once because the scheduler and the writer had drifted apart.
 * `addSelectedCompetitors` stores `ANALYZED`, the daily crawl swept
 * `['ACTIVE', 'ANALYZING', 'PENDING']`, and the alert sweep required `ACTIVE`
 * — a value nothing in the codebase has ever written to this model and which
 * the schema does not list. Every competitor a customer picked from the panel
 * was therefore skipped by both jobs for good, their content was never
 * collected, and the tabs that read that content stayed permanently empty.
 */
export const COMPETITOR_STATUS = {
  /** Added, not yet crawled. The schema default. */
  PENDING: 'PENDING',
  /** A crawl is in flight. */
  ANALYZING: 'ANALYZING',
  /** Crawled at least once. The steady state, not a finished state. */
  ANALYZED: 'ANALYZED',
  /** Crawling failed; left out of the recurring sweeps. */
  FAILED: 'FAILED',
} as const;

/**
 * Competitors the recurring jobs should keep working on.
 *
 * `ANALYZED` belongs here and its absence was the bug: a daily *recrawl* whose
 * whole purpose is spotting what changed cannot skip everything it has already
 * seen once. Only `FAILED` is left out.
 */
export const TRACKED_COMPETITOR_STATUSES: string[] = [
  COMPETITOR_STATUS.PENDING,
  COMPETITOR_STATUS.ANALYZING,
  COMPETITOR_STATUS.ANALYZED,
];
