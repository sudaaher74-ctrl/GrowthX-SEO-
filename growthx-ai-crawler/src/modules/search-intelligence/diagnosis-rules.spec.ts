import { diagnose, DiagnosisInput, ReadPage } from './diagnosis-rules';
import { dominantFormat, intentFromResults } from './serp-analysis';

function readPage(over: Partial<ReadPage> & { words?: number; title?: string; h1?: string; schema?: string[] }): ReadPage {
  return {
    url: over.url ?? 'https://rival.com/blog/a2-milk-benefits',
    domain: over.domain ?? 'rival.com',
    position: over.position ?? 1,
    statusCode: 200,
    error: null,
    facts: {
      title: over.title ?? 'A2 milk benefits',
      h1: [over.h1 ?? 'A2 milk benefits'],
      h2Count: 6,
      wordCount: over.words ?? 1400,
      schemaTypes: over.schema ?? ['Article', 'FAQPage'],
      metaRobots: null,
      canonical: null,
      opening: 'a2 milk benefits',
    },
    format: over.format ?? 'ARTICLE',
    keywordInTitle: over.keywordInTitle ?? true,
    keywordInH1: over.keywordInH1 ?? true,
    keywordInUrl: true,
    keywordEarly: true,
  };
}

function input(over: Partial<DiagnosisInput> = {}): DiagnosisInput {
  const top = [1, 2, 3, 4, 5].map((position) => ({ position, url: `https://r${position}.com/blog/x`, domain: `r${position}.com`, format: 'ARTICLE' as const }));
  return {
    keyword: 'a2 milk benefits',
    page: {
      ...readPage({ url: 'https://milquu.in/products/a2-milk', domain: 'milquu.in', position: null, words: 180, title: 'A2 Cow Milk 1L', h1: 'A2 Cow Milk', schema: ['Product'], format: 'PRODUCT', keywordInTitle: false, keywordInH1: false }),
      inlinks: 1,
      siteMedianInlinks: 12,
      crawledIndexability: 'INDEXABLE',
      jsRequired: false,
    },
    competitors: [1, 2, 3, 4].map((position) => readPage({ position, url: `https://r${position}.com/blog/x`, domain: `r${position}.com` })),
    serp: { ownPosition: null, ownUrl: null, features: ['featured_snippet', 'people_also_ask'], top },
    intent: intentFromResults(['featured_snippet', 'people_also_ask'], top),
    dominant: dominantFormat(top),
    searchConsole: { clicks: 0, impressions: 40, position: 38.2, pages: [{ url: 'https://milquu.in/products/a2-milk', clicks: 0, impressions: 40, position: 38.2 }] },
    indexStatus: { verdict: 'PASS', coverageState: 'Submitted and indexed', inspectedAt: new Date('2026-09-20') },
    ownUrlIsThisPage: false,
    ...over,
  };
}

const codes = (d: ReturnType<typeof diagnose>) => d.reasons.map((r) => r.code);

describe('diagnose', () => {
  it('explains a product page aimed at a search Google answers with articles', () => {
    const d = diagnose(input());
    expect(codes(d)).toEqual(
      expect.arrayContaining(['FORMAT_MISMATCH', 'KEYWORD_NOT_IN_TITLE', 'KEYWORD_NOT_IN_HEADING', 'LESS_CONTENT', 'MISSING_STRUCTURED_DATA', 'FEW_INTERNAL_LINKS']),
    );
    expect(d.verdict).toBe('NOT_IN_TOP_20');
  });

  it('backs every reason with evidence that names its source', () => {
    for (const reason of diagnose(input()).reasons) {
      expect(reason.evidence.length).toBeGreaterThan(0);
      for (const e of reason.evidence) expect(e.source).toBeTruthy();
    }
  });

  it('puts the blocking reasons first', () => {
    const d = diagnose(input({ indexStatus: { verdict: 'NEUTRAL', coverageState: 'Crawled - currently not indexed', inspectedAt: new Date() } }));
    expect(d.reasons[0]).toMatchObject({ code: 'NOT_INDEXED', severity: 'HIGH' });
    expect(d.reasons[0].evidence[0].value).toBe('Crawled - currently not indexed');
  });

  it('says when Google prefers a different page of yours, with its numbers', () => {
    const d = diagnose(
      input({
        searchConsole: {
          clicks: 12,
          impressions: 900,
          position: 9.1,
          pages: [
            { url: 'https://milquu.in/blog/why-a2', clicks: 12, impressions: 860, position: 8.7 },
            { url: 'https://milquu.in/products/a2-milk', clicks: 0, impressions: 40, position: 38.2 },
          ],
        },
      }),
    );
    const reason = d.reasons.find((r) => r.code === 'OTHER_PAGE_PREFERRED')!;
    expect(reason.evidence[0]).toMatchObject({ label: 'https://milquu.in/blog/why-a2', source: 'Google Search Console' });
  });

  it('does not call a near-miss format a mismatch', () => {
    const top = [1, 2, 3, 4].map((position) => ({ position, url: `https://r${position}.com/c/milk`, domain: `r${position}.com`, format: 'CATEGORY' as const }));
    const d = diagnose(input({ serp: { ownPosition: null, ownUrl: null, features: [], top }, dominant: dominantFormat(top), intent: intentFromResults([], top) }));
    expect(codes(d)).not.toContain('FORMAT_MISMATCH');
  });

  it('reports the position when this page ranks', () => {
    const d = diagnose(input({ serp: { ...input().serp, ownPosition: 7, ownUrl: 'https://milquu.in/products/a2-milk' }, ownUrlIsThisPage: true }));
    expect(d.verdict).toBe('PAGE_ONE');
    expect(d.verdictText).toMatch(/position 7/);
  });

  it('flags a page that tells Google not to index it', () => {
    const base = input();
    const d = diagnose(input({ page: { ...base.page, facts: { ...base.page.facts!, metaRobots: 'noindex, follow' } } }));
    expect(codes(d)).toContain('NOINDEX');
  });

  it('warns when marketplaces and directories hold most of the results', () => {
    const top = ['amazon.in', 'flipkart.com', 'justdial.com', 'indiamart.com', 'x.com', 'bigbasket.com'].map((domain, i) => ({
      position: i + 1,
      url: `https://${domain}/p`,
      domain,
      format: (domain === 'x.com' ? 'OTHER' : domain === 'justdial.com' ? 'DIRECTORY' : 'MARKETPLACE') as any,
    }));
    const d = diagnose(input({ serp: { ownPosition: null, ownUrl: null, features: [], top }, dominant: dominantFormat(top) }));
    expect(codes(d)).toContain('RESULTS_HELD_BY_PLATFORMS');
  });

  it('rates confidence by what could actually be read, and says what was missing', () => {
    expect(diagnose(input()).confidence.level).toBe('HIGH');
    const thin = diagnose(input({ searchConsole: null, indexStatus: null, competitors: [readPage({})] }));
    expect(thin.confidence.level).toBe('LOW');
    expect(thin.confidence.missing.join(' ')).toMatch(/Search Console is not connected/);
  });
});
