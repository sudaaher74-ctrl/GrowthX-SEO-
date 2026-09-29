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
    const d = diagnose(input({ serp: { ...input().serp!, ownPosition: 7, ownUrl: 'https://milquu.in/products/a2-milk' }, ownUrlIsThisPage: true }));
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

/**
 * A check that never saw Google's results. Search Console is all it has, so what
 * it may say is limited to how Google has been showing the page and what is
 * wrong with the page itself.
 */
describe('diagnose from Search Console alone', () => {
  const PAGE = 'https://milquu.in/products/a2-milk';

  /** The page as Search Console recorded it for the search, over the last 28 days. */
  function consoleFor(row: { clicks: number; impressions: number; position: number }, previous?: { impressions: number; position: number }) {
    return {
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
      pages: [{ url: PAGE, ...row }],
      previous: previous ? { pages: [{ url: PAGE, clicks: 0, ...previous }] } : null,
    };
  }

  function withoutResults(over: Partial<DiagnosisInput> = {}): DiagnosisInput {
    return input({ competitors: [], serp: null, intent: null, dominant: null, ...over });
  }

  it('takes the verdict from the page’s average position and says it is an average', () => {
    const d = diagnose(withoutResults({ searchConsole: consoleFor({ clicks: 30, impressions: 900, position: 7.34 }) }));
    expect(d.verdict).toBe('PAGE_ONE');
    expect(d.verdictText).toBe('Averaging position 7.3, on page one but below the top three where most clicks go.');
  });

  it.each([
    [2.1, 'TOP_3', /^Averaging position 2\.1 for this search/],
    [14.6, 'PAGE_TWO', /on page two/],
    [33, 'NOT_IN_TOP_20', /beyond the second page/],
  ])('reads position %s as %s', (position, verdict, text) => {
    const d = diagnose(withoutResults({ searchConsole: consoleFor({ clicks: 1, impressions: 300, position }) }));
    expect(d.verdict).toBe(verdict);
    expect(d.verdictText).toMatch(text);
  });

  it('says so plainly when Google has not shown the page for the search at all', () => {
    const d = diagnose(withoutResults({ searchConsole: { clicks: 0, impressions: 0, position: null, pages: [], previous: null } }));
    expect(d.verdict).toBe('NOT_IN_TOP_20');
    expect(d.verdictText).toBe('Google has not shown this page for this search in the last 28 days.');
    expect(codes(d)).toContain('NO_IMPRESSIONS');
  });

  it('claims nothing that needs to have seen the results page', () => {
    const d = diagnose(withoutResults({ searchConsole: consoleFor({ clicks: 5, impressions: 400, position: 12 }) }));
    for (const code of ['FORMAT_MISMATCH', 'LESS_CONTENT', 'MISSING_STRUCTURED_DATA', 'RESULTS_HELD_BY_PLATFORMS', 'MAP_RESULTS']) {
      expect(codes(d)).not.toContain(code);
    }
  });

  it('still reports what is wrong with the page itself', () => {
    const base = input();
    const d = diagnose(
      withoutResults({
        page: { ...base.page, facts: { ...base.page.facts!, metaRobots: 'noindex' } },
        indexStatus: { verdict: 'NEUTRAL', coverageState: 'Excluded by ‘noindex’ tag', inspectedAt: new Date() },
      }),
    );
    expect(codes(d)).toEqual(expect.arrayContaining(['NOINDEX', 'NOT_INDEXED']));
  });

  describe('the title and heading', () => {
    it('names the words of the search the title lacks, as the searcher typed them', () => {
      const d = diagnose(withoutResults({ keyword: 'a2 cow milk delivery', searchConsole: consoleFor({ clicks: 1, impressions: 300, position: 18 }) }));
      const reason = d.reasons.find((r) => r.code === 'KEYWORD_NOT_IN_TITLE')!;
      // The fixture title is "A2 Cow Milk 1L": it has a2, cow and milk, but not delivery.
      expect(reason.evidence).toContainEqual(expect.objectContaining({ label: 'Words of the search missing from it', value: 'delivery' }));
      expect(reason.severity).toBe('MEDIUM');
    });

    it('treats a plural as the same word', () => {
      const base = input();
      const d = diagnose(
        withoutResults({
          keyword: 'cow milk deliveries',
          page: { ...base.page, facts: { ...base.page.facts!, title: 'Cow milk delivery in Pune', h1: ['Cow milk delivery'] } },
          searchConsole: consoleFor({ clicks: 1, impressions: 300, position: 18 }),
        }),
      );
      expect(codes(d)).not.toContain('KEYWORD_NOT_IN_TITLE');
      expect(codes(d)).not.toContain('KEYWORD_NOT_IN_HEADING');
    });

    it('is only a minor point for a page already on page one', () => {
      const d = diagnose(withoutResults({ keyword: 'a2 cow milk delivery', searchConsole: consoleFor({ clicks: 40, impressions: 900, position: 6 }) }));
      expect(d.reasons.find((r) => r.code === 'KEYWORD_NOT_IN_TITLE')!.severity).toBe('LOW');
    });

    it('leaves a page in the top three alone', () => {
      const d = diagnose(withoutResults({ keyword: 'a2 cow milk delivery', searchConsole: consoleFor({ clicks: 300, impressions: 900, position: 1.8 }) }));
      expect(codes(d)).not.toContain('KEYWORD_NOT_IN_TITLE');
    });

    it('does not apply when there are live results, which measure the title against the pages that rank', () => {
      const d = diagnose(input({ competitors: [readPage({})], keyword: 'a2 cow milk delivery' }));
      // One readable rival is below the two the comparison needs, and no substitute rule steps in.
      expect(d.reasons.find((r) => r.code === 'KEYWORD_NOT_IN_TITLE')).toBeUndefined();
    });
  });

  describe('click-through', () => {
    it('flags a page shown often on page one and clicked far less than that position usually gets', () => {
      const d = diagnose(withoutResults({ searchConsole: consoleFor({ clicks: 6, impressions: 1000, position: 4.2 }) }));
      const reason = d.reasons.find((r) => r.code === 'LOW_CLICK_THROUGH')!;
      expect(reason.severity).toBe('MEDIUM');
      expect(reason.evidence[0]).toMatchObject({ label: 'Shown, last 28 days', value: '1,000 times, 6 clicks (0.6%)', source: 'Google Search Console' });
    });

    it('is quiet for a page clicked about as often as its position suggests', () => {
      const d = diagnose(withoutResults({ searchConsole: consoleFor({ clicks: 70, impressions: 1000, position: 4.2 }) }));
      expect(codes(d)).not.toContain('LOW_CLICK_THROUGH');
    });

    it('does not judge a page shown only a few times', () => {
      const d = diagnose(withoutResults({ searchConsole: consoleFor({ clicks: 0, impressions: 60, position: 3 }) }));
      expect(codes(d)).not.toContain('LOW_CLICK_THROUGH');
    });

    it('does not judge a page beyond page one, where low click-through is normal', () => {
      const d = diagnose(withoutResults({ searchConsole: consoleFor({ clicks: 1, impressions: 5000, position: 15 }) }));
      expect(codes(d)).not.toContain('LOW_CLICK_THROUGH');
    });
  });

  describe('slipping', () => {
    const slip = (before: number, now: number, impressions = 400) =>
      diagnose(withoutResults({ searchConsole: consoleFor({ clicks: 20, impressions, position: now }, { impressions, position: before }) }));

    it('reports a page Google showed higher in the 28 days before, with both figures', () => {
      const reason = slip(5, 8.5).reasons.find((r) => r.code === 'POSITION_SLIPPING')!;
      expect(reason.severity).toBe('MEDIUM');
      expect(reason.evidence.map((e) => e.value)).toEqual(['5.0', '8.5']);
    });

    it('makes a fall of five places or more a first-order problem', () => {
      expect(slip(4, 11).reasons.find((r) => r.code === 'POSITION_SLIPPING')!.severity).toBe('HIGH');
    });

    it('does not report a small wobble, an improvement, or too little to go on', () => {
      expect(codes(slip(6, 7))).not.toContain('POSITION_SLIPPING');
      expect(codes(slip(9, 5))).not.toContain('POSITION_SLIPPING');
      expect(codes(slip(4, 11, 20))).not.toContain('POSITION_SLIPPING');
    });

    it('says nothing when Search Console holds no earlier period to compare with', () => {
      const d = diagnose(withoutResults({ searchConsole: consoleFor({ clicks: 20, impressions: 400, position: 12 }) }));
      expect(codes(d)).not.toContain('POSITION_SLIPPING');
    });
  });

  describe('confidence', () => {
    it('is never high, and says the results page was not seen', () => {
      const d = diagnose(withoutResults({ searchConsole: consoleFor({ clicks: 30, impressions: 900, position: 7 }) }));
      expect(d.confidence.level).toBe('MEDIUM');
      expect(d.confidence.basis).toContain('your Search Console numbers for this search, last 28 days');
      expect(d.confidence.missing.join(' ')).toMatch(/live results are not part of this check/);
    });

    it('drops to low when the page could not be read and Google shows it for nothing', () => {
      const base = input();
      const d = diagnose(
        withoutResults({
          page: { ...base.page, facts: null, error: 'HTTP 500' },
          searchConsole: { clicks: 0, impressions: 0, position: null, pages: [], previous: null },
          indexStatus: null,
        }),
      );
      expect(d.confidence.level).toBe('LOW');
      expect(d.confidence.missing.join(' ')).toMatch(/could not be read \(HTTP 500\)/);
      expect(d.confidence.missing.join(' ')).toMatch(/no impressions for this search/);
    });
  });

  it('backs every reason with evidence that names its source', () => {
    const d = diagnose(withoutResults({ keyword: 'a2 cow milk delivery', searchConsole: consoleFor({ clicks: 6, impressions: 1000, position: 12.2 }, { impressions: 900, position: 5 }) }));
    expect(d.reasons.length).toBeGreaterThan(0);
    for (const reason of d.reasons) {
      expect(reason.evidence.length).toBeGreaterThan(0);
      for (const e of reason.evidence) expect(e.source).toBeTruthy();
    }
  });
});
