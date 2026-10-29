import { measuredFinding } from './finding-evidence';
describe('Measured finding evidence', () => {
  it('removes unsupported saved benchmark claims while preserving actual crawl evidence', () => {
    const result = measuredFinding({ title: 'Improve a page', summary: 'High-intent queries convert 3x better.', evidence: [{ label: 'Observed', value: '68 impressions', source: 'Traffic Improvement Report' }, { label: 'Conversion Lift', value: '3.2% conversion rate', source: 'Industry Benchmark' }] });
    expect(JSON.stringify(result)).not.toMatch(/3x|3\.2%/);
    expect(result.evidence).toContainEqual({ label: 'Observed', value: '68 impressions', source: 'Traffic Improvement Report' });
    expect(result.summary).toContain('No project-specific');
  });
  it('does not replace actual report measurements with defaults', () => {
    const finding = { summary: 'Recorded 68 impressions and zero clicks.', evidence: [{ label: 'Clicks', value: '0', source: 'Search Console' }] };
    expect(measuredFinding(finding)).toBe(finding);
  });
  it('filters saved invented review configuration and market-share claims', () => {
    const result = measuredFinding({ evidence: [{ value: '0 automated review requests configured', source: 'GrowthX Local Intelligence' }, { value: 'Over 30% of commercial buyer research queries now originate in LLM search interfaces', source: 'GrowthX AI Search Intelligence' }, { value: 'Businesses with 20+ recent reviews rank 50% higher', source: 'Local SEO Benchmark' }] });
    expect(JSON.stringify(result)).not.toMatch(/30%|50%|automated review requests configured/);
  });
});
