import { computeCrawlSummary, summariseCoreWebVitals, computeHealth } from './crawl-summary';

describe('computeCrawlSummary', () => {
  // The contradiction on the screenshot: Technical SEO said "0 blocked" while
  // the Pages tab said "1 Blocked", from two formulas over the same rows.
  it('gives one answer for blocked, errored and unreachable', () => {
    const summary = computeCrawlSummary({
      pages: [
        { url: 'a', statusCode: 200, indexability: 'INDEXABLE' },
        { url: 'b', statusCode: 404, indexability: 'NOT_INDEXABLE' },
        { url: 'c', statusCode: 403, blockedSuspected: true, indexability: 'UNKNOWN' },
        { url: 'd', statusCode: undefined, fetchFailed: true, indexability: 'UNKNOWN' },
      ],
      issues: [],
    });

    expect(summary.successful).toBe(1);
    expect(summary.errored).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.unreachable).toBe(1);
    // A blocked page is not double-counted as an error.
    expect(summary.errored + summary.blocked + summary.unreachable + summary.successful).toBe(4);
  });

  it('counts a stored 0 as unreachable, not as a successful fetch', () => {
    // 0 is what the crawler writes when no origin answered.
    const summary = computeCrawlSummary({
      pages: [{ url: 'a', statusCode: 0, indexability: 'UNKNOWN' }],
      issues: [{ issueType: 'FETCH_FAILED', severity: 'CRITICAL', affectedUrl: 'a' }],
    });

    expect(summary.unreachable).toBe(1);
    expect(summary.successful).toBe(0);
    expect(summary.errored).toBe(0);
    // And it is excluded from the score: our network failure is not their defect.
    expect(summary.health.pagesExcluded).toBe(1);
    expect(summary.health.totalPenalty).toBe(0);
  });

  it('reads indexability off the page, never off the status code', () => {
    const summary = computeCrawlSummary({
      pages: [{ url: 'a', statusCode: 403, indexability: 'INDEXABLE' }],
      issues: [],
    });

    expect(summary.indexable).toBe(1);
    expect(summary.nonIndexable).toBe(0);
  });

  it('counts unknown indexability apart from non-indexable', () => {
    const summary = computeCrawlSummary({
      pages: [
        { url: 'a', statusCode: 200, indexability: 'UNKNOWN' },
        { url: 'b', statusCode: 200, indexability: 'NOT_INDEXABLE' },
      ],
      issues: [],
    });

    expect(summary.indexabilityUnknown).toBe(1);
    expect(summary.nonIndexable).toBe(1);
  });

  it('counts pages by how they were discovered', () => {
    const summary = computeCrawlSummary({
      pages: [
        { url: 'a', statusCode: 200, discoverySource: 'sitemap' },
        { url: 'b', statusCode: 200, discoverySource: 'link' },
        { url: 'c', statusCode: 200, discoverySource: 'link' },
        { url: 'd', statusCode: 200, discoverySource: 'bundle' },
      ],
      issues: [],
    });

    expect(summary.bySource).toEqual({ sitemap: 1, link: 2, bundle: 1 });
  });
});

describe('summariseCoreWebVitals', () => {
  // The previous rule scored a missing metric as passing.
  it('says "No data" rather than "Good" when nothing was measured', () => {
    const cwv = summariseCoreWebVitals([]);

    expect(cwv.status).toBe('No data');
    expect(cwv.lcpMs).toBeNull();
    expect(cwv.pagesMeasured).toBe(0);
  });

  it('says "No data" for rows that exist but hold no metrics', () => {
    expect(summariseCoreWebVitals([{ lcpMs: null, inpMs: null, clsScore: null }]).status).toBe('No data');
  });

  it('grades real measurements', () => {
    expect(summariseCoreWebVitals([{ lcpMs: 1800, inpMs: 90, clsScore: 0.02 }]).status).toBe('Good');
    expect(summariseCoreWebVitals([{ lcpMs: 3200 }]).status).toBe('Needs Work');
    expect(summariseCoreWebVitals([{ lcpMs: 5200 }]).status).toBe('Poor');
    expect(summariseCoreWebVitals([{ clsScore: 0.4 }]).status).toBe('Poor');
  });
});

describe('computeHealth', () => {
  it('shows what subtracted what', () => {
    const health = computeHealth(
      [
        { issueType: 'A', severity: 'CRITICAL', affectedUrl: 'p1' },
        { issueType: 'B', severity: 'MEDIUM', affectedUrl: 'p2' },
      ],
      10,
      0,
    );

    expect(health.penalties.find((p) => p.severity === 'CRITICAL')).toEqual({ severity: 'CRITICAL', count: 1, penalty: 20 });
    expect(health.penalties.find((p) => p.severity === 'MEDIUM')).toEqual({ severity: 'MEDIUM', count: 1, penalty: 3 });
    expect(health.totalPenalty).toBe(23);
    expect(health.score).toBe(98);
  });

  it('caps one broken page so it cannot sink the whole site', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ issueType: `T${i}`, severity: 'CRITICAL', affectedUrl: 'same-page' }));

    expect(computeHealth(many, 10, 0).totalPenalty).toBe(20);
  });

  it('excludes pages we could not fetch, and says so', () => {
    const summary = computeCrawlSummary({
      pages: [
        { url: 'ok', statusCode: 200 },
        { url: 'dead', statusCode: undefined, fetchFailed: true },
      ],
      issues: [
        { issueType: 'FETCH_FAILED', severity: 'CRITICAL', affectedUrl: 'dead' },
        { issueType: 'MISSING_H1', severity: 'HIGH', affectedUrl: 'ok' },
      ],
    });

    expect(summary.health.pagesExcluded).toBe(1);
    expect(summary.health.note).toContain('not counted as an SEO defect');
    // Only the finding on the page we actually read counts.
    expect(summary.health.totalPenalty).toBe(8);
  });

  it('never returns NaN or a negative score', () => {
    expect(computeHealth([], 0, 0).score).toBe(100);
    const huge = Array.from({ length: 500 }, (_, i) => ({ issueType: 'T', severity: 'CRITICAL', affectedUrl: `p${i}` }));
    expect(computeHealth(huge, 1, 0).score).toBe(0);
  });
});
