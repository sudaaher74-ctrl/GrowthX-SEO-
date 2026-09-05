import { seoQualityFindings } from './findings-collector.service';
import { SiteProfile, EMPTY_PROFILE } from './site-profile';

const site = (domain: string, over: Partial<SiteProfile> = {}): SiteProfile => ({
  domain,
  ...EMPTY_PROFILE,
  crawledAt: new Date('2026-09-01T00:00:00Z'),
  totalPages: 40,
  ...over,
});

const rival = (name: string, over: Partial<SiteProfile> = {}) => ({
  id: name.toLowerCase(),
  name,
  profile: site(`${name.toLowerCase()}.com`, over),
});

describe('seoQualityFindings', () => {
  it('reports the health-score gap, naming the leader and the size of it', () => {
    const findings = seoQualityFindings(site('you.com', { healthScore: 62 }), [
      rival('Alpha', { healthScore: 91 }),
      rival('Beta', { healthScore: 74 }),
    ]);

    const score = findings.find((f) => f.metricName === 'health_score')!;
    expect(score.summary).toBe('Alpha scores 91 on site health against your 62');
    expect(score.detail).toContain('29-point gap');
    expect(score.competitorId).toBe('alpha');
    expect(score.customerValue).toBe(62);
    expect(score.metricValue).toBe(91);
  });

  // A customer already leading needs no action, and a finding saying so would
  // compete for space in the plan with the ones that do.
  it('writes nothing when the customer already leads', () => {
    const findings = seoQualityFindings(site('you.com', { healthScore: 95 }), [
      rival('Alpha', { healthScore: 60 }),
    ]);
    expect(findings.filter((f) => f.metricName === 'health_score')).toEqual([]);
  });

  // A crawl that predates the score has no opinion; treating that as zero
  // would report every such competitor as catastrophically behind.
  it('skips the score entirely when either side has none', () => {
    expect(
      seoQualityFindings(site('you.com', { healthScore: null }), [rival('Alpha', { healthScore: 90 })]),
    ).toEqual([]);

    expect(
      seoQualityFindings(site('you.com', { healthScore: 50 }), [rival('Alpha', { healthScore: null })]),
    ).toEqual([]);
  });

  it('reports a competitor carrying fewer serious problems than the customer', () => {
    const findings = seoQualityFindings(
      site('you.com', { healthScore: 70, issuesBySeverity: { CRITICAL: 9, HIGH: 20 } }),
      [rival('Alpha', { healthScore: 65, issuesBySeverity: { CRITICAL: 2, HIGH: 25 } })],
    );

    const critical = findings.find((f) => f.metricName === 'issues_critical')!;
    expect(critical.summary).toBe("9 critical SEO problems on your site against Alpha's 2");
    expect(critical.customerValue).toBe(9);
    // Alpha has more HIGH problems than the customer, so that is not a gap.
    expect(findings.find((f) => f.metricName === 'issues_high')).toBeUndefined();
  });

  it('says nothing about a severity the customer has none of', () => {
    const findings = seoQualityFindings(
      site('you.com', { healthScore: 70, issuesBySeverity: {} }),
      [rival('Alpha', { healthScore: 60, issuesBySeverity: { CRITICAL: 4 } })],
    );
    expect(findings.filter((f) => f.metricName?.startsWith('issues_'))).toEqual([]);
  });

  it('ignores a competitor that has never been crawled', () => {
    const uncrawled = { id: 'ghost', name: 'Ghost', profile: { domain: 'ghost.com', ...EMPTY_PROFILE } };
    const findings = seoQualityFindings(
      site('you.com', { healthScore: 70, issuesBySeverity: { CRITICAL: 3 } }),
      [uncrawled],
    );
    expect(findings).toEqual([]);
  });
});
