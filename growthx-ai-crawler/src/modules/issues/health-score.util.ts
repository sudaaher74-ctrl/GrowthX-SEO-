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
export class HealthScoreCalculator {
  private pagesCrawled: number;
  private isSiteWideFailure: boolean;
  
  private uniqueIssuesCount = 0;
  
  private criticalPenaltyRaw = 0;
  private highPenaltyRaw = 0;
  private mediumPenaltyRaw = 0;
  private lowPenaltyRaw = 0;
  
  private siteWidePenaltyRaw = 0;
  private urlPenaltyMap = new Map<string, number>();

  constructor(pagesCrawled: number, isSiteWideFailure = false) {
    this.pagesCrawled = Math.max(1, pagesCrawled || 1);
    this.isSiteWideFailure = isSiteWideFailure;
  }

  addIssue(issue: IssueScoreItem) {
    if (this.isSiteWideFailure) return;

    this.uniqueIssuesCount++;

    const sev = (issue.severity || 'LOW').toUpperCase();
    const conf = (issue.confidence || 'LIKELY').toUpperCase();

    const weight = SEVERITY_WEIGHTS[sev] ?? 1;
    const mult = CONFIDENCE_MULTIPLIERS[conf] ?? 0.8;
    const penaltyValue = weight * mult;

    if (sev === 'CRITICAL') this.criticalPenaltyRaw += penaltyValue;
    else if (sev === 'HIGH') this.highPenaltyRaw += penaltyValue;
    else if (sev === 'MEDIUM') this.mediumPenaltyRaw += penaltyValue;
    else this.lowPenaltyRaw += penaltyValue;

    const url = issue.affectedUrl?.trim();
    if (!url || url === 'SITE_WIDE' || issue.issueType === 'MISSING_ROBOTS_TXT' || issue.issueType === 'SITEWIDE_NOINDEX') {
      const swWeight = SEVERITY_WEIGHTS[sev] ?? 3;
      const swMult = CONFIDENCE_MULTIPLIERS[conf] ?? 0.8;
      this.siteWidePenaltyRaw += swWeight * swMult;
    } else {
      const existingPenalty = this.urlPenaltyMap.get(url) || 0;
      this.urlPenaltyMap.set(url, existingPenalty + penaltyValue);
    }
  }

  getScore(): HealthScoreBreakdown {
    if (this.isSiteWideFailure) {
      return {
        healthScore: 0,
        totalPenalty: 100,
        criticalPenalty: 100,
        highPenalty: 0,
        mediumPenalty: 0,
        lowPenalty: 0,
        uniqueIssuesCount: this.uniqueIssuesCount,
        pagesCrawled: this.pagesCrawled,
        siteWidePenalty: 100,
        pageLevelPenalty: 0,
        perUrlCapsApplied: 0,
        summary: 'Site-wide failure detected (DNS, connection, or robots.txt block).',
      };
    }

    const siteWidePenalty = Math.min(40, this.siteWidePenaltyRaw);

    let sumCappedUrlPenalties = 0;
    let perUrlCapsApplied = 0;

    for (const pagePenalty of this.urlPenaltyMap.values()) {
      if (pagePenalty > MAX_PENALTY_PER_URL) {
        sumCappedUrlPenalties += MAX_PENALTY_PER_URL;
        perUrlCapsApplied++;
      } else {
        sumCappedUrlPenalties += pagePenalty;
      }
    }

    const avgPagePenalty = sumCappedUrlPenalties / this.pagesCrawled;
    const pageLevelPenalty = Math.min(100 - siteWidePenalty, avgPagePenalty * 5);

    const totalPenalty = Math.min(100, Math.round(siteWidePenalty + pageLevelPenalty));
    const healthScore = Math.max(0, Math.min(100, 100 - totalPenalty));

    const summary = `${this.uniqueIssuesCount} unique issue(s) across ${this.pagesCrawled} crawled page(s). Total penalty: -${totalPenalty} pts.`;

    return {
      healthScore,
      totalPenalty,
      criticalPenalty: Math.round(this.criticalPenaltyRaw),
      highPenalty: Math.round(this.highPenaltyRaw),
      mediumPenalty: Math.round(this.mediumPenaltyRaw),
      lowPenalty: Math.round(this.lowPenaltyRaw),
      uniqueIssuesCount: this.uniqueIssuesCount,
      pagesCrawled: this.pagesCrawled,
      siteWidePenalty: Math.round(siteWidePenalty),
      pageLevelPenalty: Math.round(pageLevelPenalty),
      perUrlCapsApplied,
      summary,
    };
  }
}

export function calculateHealthScore(params: {
  pagesCrawled: number;
  issues: IssueScoreItem[];
  isSiteWideFailure?: boolean;
}): HealthScoreBreakdown {
  const calculator = new HealthScoreCalculator(params.pagesCrawled, params.isSiteWideFailure);
  for (const issue of params.issues || []) {
    calculator.addIssue(issue);
  }
  return calculator.getScore();
}
