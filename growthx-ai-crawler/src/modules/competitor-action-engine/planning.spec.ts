import { buildSiteProfile, countOf, ProfilePage } from './site-profile';
import { coverageFindings, technicalFindings } from './findings-collector.service';
import { planActions, PlannerFinding } from './strategy-engine.service';

function page(overrides: Partial<ProfilePage> = {}): ProfilePage {
  return {
    url: 'https://example.com/a',
    statusCode: 200,
    title: 'A page',
    metaDescription: 'A description',
    robotsMeta: null,
    h1: ['A heading'],
    pageType: 'SERVICE',
    crawledAt: new Date('2026-09-01'),
    schemaCount: 1,
    ...overrides,
  };
}

describe('buildSiteProfile', () => {
  it('counts only pages a visitor can actually reach', () => {
    // A 404 that still carries a title is not coverage the customer has.
    const profile = buildSiteProfile('example.com', [
      page({ url: 'https://example.com/live', pageType: 'LOCATION' }),
      page({ url: 'https://example.com/gone', statusCode: 404, pageType: 'LOCATION' }),
    ]);

    expect(profile.totalPages).toBe(1);
    expect(countOf(profile, 'LOCATION')).toBe(1);
    expect(profile.brokenLinks).toBe(1);
  });

  it('records a sample URL per page kind so a finding can link to what was seen', () => {
    const profile = buildSiteProfile('rival.com', [
      page({ url: 'https://rival.com/mumbai', pageType: 'LOCATION' }),
      page({ url: 'https://rival.com/pune', pageType: 'LOCATION' }),
    ]);

    expect(profile.exampleUrlByType['LOCATION']).toBe('https://rival.com/mumbai');
  });

  it('counts the gaps a technical finding is built from', () => {
    const profile = buildSiteProfile('example.com', [
      page({ metaDescription: null }),
      page({ h1: [] }),
      page({ robotsMeta: 'noindex, follow' }),
      page({ schemaCount: 0 }),
    ]);

    expect(profile.pagesMissingMetaDescription).toBe(1);
    expect(profile.pagesMissingH1).toBe(1);
    expect(profile.pagesNoindex).toBe(1);
    expect(profile.pagesWithSchema).toBe(3);
  });
});

describe('coverageFindings', () => {
  const customer = buildSiteProfile('mine.com', [page({ pageType: 'SERVICE' })]);

  function rival(name: string, locationPages: number) {
    const pages = Array.from({ length: locationPages }, (_, i) =>
      page({ url: `https://${name}.com/city-${i}`, pageType: 'LOCATION' }),
    );
    return { id: `id_${name}`, name, profile: buildSiteProfile(`${name}.com`, pages) };
  }

  it('reports a gap only where a competitor genuinely has more', () => {
    const findings = coverageFindings(customer, [rival('acme', 3)]);
    const location = findings.find((finding) => finding.metricName === 'location_pages');

    expect(location).toBeDefined();
    expect(location!.metricValue).toBe(3);
    expect(location!.customerValue).toBe(0);
    expect(location!.sourceUrl).toBe('https://acme.com/city-0');
  });

  it('does not invent a gap when nobody covers the ground', () => {
    // Two sites with no case studies each is a market nobody serves, which is
    // different advice from a competitor lead — and must not be presented as one.
    const findings = coverageFindings(customer, [rival('acme', 0)]);

    expect(findings.some((finding) => finding.metricName === 'case_study_pages')).toBe(false);
  });

  it('treats one rival ahead as weaker evidence than several', () => {
    const single = coverageFindings(customer, [rival('acme', 2)]);
    const several = coverageFindings(customer, [rival('acme', 2), rival('globex', 4)]);

    expect(single[0].confidence).toBe('MEDIUM');
    expect(several[0].confidence).toBe('HIGH');
    expect(several[0].summary).toContain('2 competitors');
  });

  it('names the leader and the rest', () => {
    const findings = coverageFindings(customer, [rival('acme', 2), rival('globex', 6)]);
    const location = findings.find((finding) => finding.metricName === 'location_pages')!;

    // Highest count leads, because that is who set the bar.
    expect(location.detail).toContain('globex has 6');
    expect(location.detail).toContain('acme (2)');
  });
});

describe('technicalFindings', () => {
  it('reports only what the crawl actually found', () => {
    const clean = buildSiteProfile('mine.com', [page(), page(), page(), page(), page()]);

    expect(technicalFindings(clean)).toHaveLength(0);
  });

  it('flags thin structured data as an AI-search problem', () => {
    const pages = Array.from({ length: 10 }, () => page({ schemaCount: 0 }));
    const findings = technicalFindings(buildSiteProfile('mine.com', pages));

    expect(findings.some((finding) => finding.category === 'AI_SEARCH')).toBe(true);
  });

  it('does not judge structured data on a crawl too small to judge', () => {
    const findings = technicalFindings(buildSiteProfile('mine.com', [page({ schemaCount: 0 })]));

    expect(findings.some((finding) => finding.category === 'AI_SEARCH')).toBe(false);
  });
});

describe('planActions', () => {
  function finding(overrides: Partial<PlannerFinding> = {}): PlannerFinding {
    return {
      id: 'f1',
      competitorId: 'c1',
      category: 'LOCAL_SEO',
      summary: 'acme has 4 location or city pages and you have 0',
      detail: 'acme has 4; you have 0.',
      metricValue: 4,
      customerValue: 0,
      confidence: 'HIGH',
      ...overrides,
    };
  }

  it('writes an action that carries the evidence it came from', () => {
    const [action] = planActions([finding()]);

    expect(action.findingIds).toEqual(['f1']);
    expect(action.rationale).toContain('acme has 4');
    expect(action.steps.length).toBeGreaterThan(2);
  });

  it('never writes an action with no evidence behind it', () => {
    const actions = planActions([finding(), finding({ id: 'f2', category: 'TECHNICAL_SEO', customerValue: 12 })]);

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((action) => action.findingIds.length > 0)).toBe(true);
  });

  it('scales technical effort and impact with the size of the problem', () => {
    const small = planActions([
      finding({ id: 'f_small', category: 'TECHNICAL_SEO', summary: '2 of your pages have no meta description', customerValue: 2 }),
    ])[0];
    const large = planActions([
      finding({ id: 'f_large', category: 'TECHNICAL_SEO', summary: '40 of your pages have no meta description', customerValue: 40 }),
    ])[0];

    expect(large.impact).toBe('HIGH');
    expect(small.impact).toBe('LOW');
    expect(large.effortHours).toBeGreaterThan(small.effortHours);
  });

  it('collapses several competitors publishing to one cadence action', () => {
    const actions = planActions([
      finding({ id: 'y1', category: 'YOUTUBE', metricValue: 6, summary: 'acme publishes about 6 videos a month' }),
      finding({ id: 'y2', category: 'YOUTUBE', metricValue: 3, summary: 'globex publishes about 3 videos a month' }),
    ]);

    expect(actions).toHaveLength(1);
    expect(actions[0].findingIds).toEqual(['y1', 'y2']);
    expect(actions[0].competitorsWithEvidence).toBe(2);
    // Matches the busiest rival rather than averaging down to a soft target.
    expect(actions[0].title).toContain('6 short videos');
  });

  it('carries the weakest confidence of its inputs into the action', () => {
    const actions = planActions([
      finding({ id: 'y1', category: 'YOUTUBE', metricValue: 4, confidence: 'HIGH' }),
      finding({ id: 'y2', category: 'YOUTUBE', metricValue: 2, confidence: 'LOW' }),
    ]);

    expect(actions[0].confidence).toBe('LOW');
  });

  it('produces nothing at all when there is nothing to act on', () => {
    expect(planActions([])).toEqual([]);
  });
});
