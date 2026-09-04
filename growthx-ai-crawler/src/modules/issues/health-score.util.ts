export interface IssueScoreItem {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | string;
  confidence?: 'CONFIRMED' | 'LIKELY' | 'ADVISORY' | string;
  affectedUrl?: string | null;
  issueType?: string;
}

export interface HealthScoreBreakdown {
  healthScore: number;
  totalPenalty: number;
  criticalPenalty: number;
  highPenalty: number;
  mediumPenalty: number;
  lowPenalty: number;
  uniqueIssuesCount: number;
  pagesCrawled: number;
  siteWidePenalty: number;
  pageLevelPenalty: number;
  perUrlCapsApplied: number;
  summary: string;
}

export const SEVERITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 20,
  HIGH: 8,
  MEDIUM: 3,
  LOW: 1,
};

export const CONFIDENCE_MULTIPLIERS: Record<string, number> = {
  CONFIRMED: 1.0,
  LIKELY: 0.8,
  ADVISORY: 0.5,
};

export const MAX_PENALTY_PER_URL = 20;

/**
 * Calculates a fair, robust, deterministic SEO Health Score between 0 and 100.
 *
 * Requirements:
 * - Always between 0 and 100.
 * - Never returns NaN or accidental 0.
 * - Deduplicates issues per URL and caps impact per URL to prevent one broken page from destroying the score.
 * - Weights by severity and confidence.
 * - Normalizes across crawled pages so large and small sites are evaluated fairly.
 */
export function calculateHealthScore(params: {
  pagesCrawled: number;
  issues: IssueScoreItem[];
  isSiteWideFailure?: boolean;
}): HealthScoreBreakdown {
  const pagesCrawled = Math.max(1, params.pagesCrawled || 1);
  const issues = params.issues || [];

  if (params.isSiteWideFailure) {
    return {
      healthScore: 0,
      totalPenalty: 100,
      criticalPenalty: 100,
      highPenalty: 0,
      mediumPenalty: 0,
      lowPenalty: 0,
      uniqueIssuesCount: issues.length,
      pagesCrawled,
      siteWidePenalty: 100,
      pageLevelPenalty: 0,
      perUrlCapsApplied: 0,
      summary: 'Site-wide failure detected (DNS, connection, or robots.txt block).',
    };
  }

  // Group issues by normalized URL
  const urlIssueMap = new Map<string, IssueScoreItem[]>();
  const siteWideIssues: IssueScoreItem[] = [];

  let criticalPenaltyRaw = 0;
  let highPenaltyRaw = 0;
  let mediumPenaltyRaw = 0;
  let lowPenaltyRaw = 0;

  for (const issue of issues) {
    const sev = (issue.severity || 'LOW').toUpperCase();
    const conf = (issue.confidence || 'LIKELY').toUpperCase();

    const weight = SEVERITY_WEIGHTS[sev] ?? 1;
    const mult = CONFIDENCE_MULTIPLIERS[conf] ?? 0.8;
    const penaltyValue = weight * mult;

    if (sev === 'CRITICAL') criticalPenaltyRaw += penaltyValue;
    else if (sev === 'HIGH') highPenaltyRaw += penaltyValue;
    else if (sev === 'MEDIUM') mediumPenaltyRaw += penaltyValue;
    else lowPenaltyRaw += penaltyValue;

    const url = issue.affectedUrl?.trim();
    if (!url || url === 'SITE_WIDE' || issue.issueType === 'MISSING_ROBOTS_TXT' || issue.issueType === 'SITEWIDE_NOINDEX') {
      siteWideIssues.push(issue);
    } else {
      const existing = urlIssueMap.get(url) || [];
      existing.push(issue);
      urlIssueMap.set(url, existing);
    }
  }

  // 1. Calculate site-wide penalties (applied directly, but capped at 40)
  let siteWidePenalty = 0;
  for (const issue of siteWideIssues) {
    const sev = (issue.severity || 'MEDIUM').toUpperCase();
    const conf = (issue.confidence || 'LIKELY').toUpperCase();
    const weight = SEVERITY_WEIGHTS[sev] ?? 3;
    const mult = CONFIDENCE_MULTIPLIERS[conf] ?? 0.8;
    siteWidePenalty += weight * mult;
  }
  siteWidePenalty = Math.min(40, siteWidePenalty);

  // 2. Calculate per-URL capped penalties
  let sumCappedUrlPenalties = 0;
  let perUrlCapsApplied = 0;

  for (const [, pageIssues] of urlIssueMap.entries()) {
    let pagePenalty = 0;
    for (const issue of pageIssues) {
      const sev = (issue.severity || 'LOW').toUpperCase();
      const conf = (issue.confidence || 'LIKELY').toUpperCase();
      const weight = SEVERITY_WEIGHTS[sev] ?? 1;
      const mult = CONFIDENCE_MULTIPLIERS[conf] ?? 0.8;
      pagePenalty += weight * mult;
    }

    if (pagePenalty > MAX_PENALTY_PER_URL) {
      sumCappedUrlPenalties += MAX_PENALTY_PER_URL;
      perUrlCapsApplied++;
    } else {
      sumCappedUrlPenalties += pagePenalty;
    }
  }

  // 3. Normalize page-level penalty over crawled pages
  // Scale factor: If every page hits the 20-point URL cap, average is 20 -> scaled by 5 gives 100 penalty
  const avgPagePenalty = sumCappedUrlPenalties / pagesCrawled;
  const pageLevelPenalty = Math.min(100 - siteWidePenalty, avgPagePenalty * 5);

  const totalPenalty = Math.min(100, Math.round(siteWidePenalty + pageLevelPenalty));
  const healthScore = Math.max(0, Math.min(100, 100 - totalPenalty));

  const summary = `${issues.length} unique issue(s) across ${pagesCrawled} crawled page(s). Total penalty: -${totalPenalty} pts.`;

  return {
    healthScore,
    totalPenalty,
    criticalPenalty: Math.round(criticalPenaltyRaw),
    highPenalty: Math.round(highPenaltyRaw),
    mediumPenalty: Math.round(mediumPenaltyRaw),
    lowPenalty: Math.round(lowPenaltyRaw),
    uniqueIssuesCount: issues.length,
    pagesCrawled,
    siteWidePenalty: Math.round(siteWidePenalty),
    pageLevelPenalty: Math.round(pageLevelPenalty),
    perUrlCapsApplied,
    summary,
  };
}
