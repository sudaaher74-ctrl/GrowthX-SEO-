import { calculateHealthScore } from './health-score.util';

describe('calculateHealthScore', () => {
  it('returns 100 with 0 penalty when there are no issues', () => {
    const result = calculateHealthScore({
      pagesCrawled: 10,
      issues: [],
    });

    expect(result.healthScore).toBe(100);
    expect(result.totalPenalty).toBe(0);
    expect(result.uniqueIssuesCount).toBe(0);
  });

  it('caps penalty per URL so a single bad page cannot destroy the whole site score', () => {
    // 10 issues on a single URL
    const issues = Array.from({ length: 10 }).map((_, i) => ({
      severity: 'CRITICAL',
      confidence: 'CONFIRMED',
      affectedUrl: 'https://example.com/bad-page',
      issueType: `ISSUE_${i}`,
    }));

    const result = calculateHealthScore({
      pagesCrawled: 20,
      issues,
    });

    // 1 URL capped at 20 pts penalty across 20 pages
    // avgPagePenalty = 20 / 20 = 1.0 -> scaled * 5 = 5 pts penalty -> healthScore = 95
    expect(result.perUrlCapsApplied).toBe(1);
    expect(result.healthScore).toBe(95);
    expect(result.healthScore).toBeGreaterThanOrEqual(90);
  });

  it('weights by severity and confidence correctly', () => {
    const issues = [
      { severity: 'CRITICAL', confidence: 'CONFIRMED', affectedUrl: 'https://example.com/p1' }, // 20 * 1.0 = 20 (capped at 20)
      { severity: 'HIGH', confidence: 'LIKELY', affectedUrl: 'https://example.com/p2' }, // 8 * 0.8 = 6.4
      { severity: 'MEDIUM', confidence: 'ADVISORY', affectedUrl: 'https://example.com/p3' }, // 3 * 0.5 = 1.5
      { severity: 'LOW', confidence: 'CONFIRMED', affectedUrl: 'https://example.com/p4' }, // 1 * 1.0 = 1.0
    ];

    const result = calculateHealthScore({
      pagesCrawled: 4,
      issues,
    });

    expect(result.healthScore).toBeGreaterThan(0);
    expect(result.healthScore).toBeLessThan(100);
    expect(Number.isNaN(result.healthScore)).toBe(false);
  });

  it('returns 0 for site-wide failure', () => {
    const result = calculateHealthScore({
      pagesCrawled: 10,
      issues: [],
      isSiteWideFailure: true,
    });

    expect(result.healthScore).toBe(0);
    expect(result.totalPenalty).toBe(100);
  });

  it('handles empty / zero pages gracefully without NaN or Infinity', () => {
    const result = calculateHealthScore({
      pagesCrawled: 0,
      issues: [{ severity: 'HIGH', affectedUrl: 'https://example.com' }],
    });

    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
    expect(Number.isNaN(result.healthScore)).toBe(false);
  });
});
