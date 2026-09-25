import { AiProvider } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { CompetitorIntelReportService, buildPrompt, normaliseAnalysis } from './competitor-intel-report.service';
import { AdvantagePage, computeAdvantages } from './rival-advantages';

type RawPage = Omit<AdvantagePage, 'schemaTypes'> & { schemas: Array<{ schemaType: string }> };
const page = (url: string, title: string, extra: Partial<RawPage> = {}): RawPage => ({
  url,
  title,
  pageType: 'SERVICE',
  wordCount: 400,
  h2: [] as string[],
  h3: [] as string[],
  schemas: [] as Array<{ schemaType: string }>,
  ...extra,
});

const OUR_PAGES = [
  page('https://milquufresh.in/', 'MilQuu Fresh', { pageType: 'HOME' }),
  page('https://milquufresh.in/cow-milk', 'Cow milk delivery | MilQuu Fresh'),
  page('https://milquufresh.in/buffalo-milk', 'Buffalo milk delivery | MilQuu Fresh'),
  page('https://milquufresh.in/paneer', 'Fresh paneer | MilQuu Fresh', { pageType: 'PRODUCT' }),
];
const THEIR_PAGES = [
  page('https://countrydelight.in/', 'Country Delight', { pageType: 'HOME' }),
  page('https://countrydelight.in/cow-milk', 'Cow milk delivery | Country Delight'),
  page('https://countrydelight.in/a2-milk', 'A2 milk delivery | Country Delight', {
    wordCount: 1400,
    h2: ['Is A2 milk better for digestion?'],
    schemas: [{ schemaType: 'FAQ' }],
  }),
  page('https://countrydelight.in/milk-delivery-pune', 'Milk delivery in Pune | Country Delight', { pageType: 'LOCATION' }),
];

function setup(router: { generate: jest.Mock }) {
  const prisma = {
    project: {
      findUnique: jest.fn().mockResolvedValue({ name: 'MilQuu Fresh', websites: [{ id: 'w1', domain: 'milquufresh.in' }] }),
    },
    competitorDomain: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'c1', domain: 'countrydelight.in', websiteId: 'w2', localRating: 4.4, localReviewCount: 910 }]),
    },
    crawlJob: {
      findFirst: jest.fn(({ where }) =>
        Promise.resolve({ id: `job-${where.websiteId}`, finishedAt: new Date('2026-09-17T10:00:00Z'), pagesCrawled: 4 }),
      ),
    },
    page: {
      findMany: jest.fn(({ where }) => Promise.resolve(where.crawlJobId === 'job-w1' ? OUR_PAGES : THEIR_PAGES)),
    },
    trackedPrompt: {
      findMany: jest.fn().mockResolvedValue([
        {
          text: 'best milk delivery service in pune',
          checks: [
            { assistant: 'CHATGPT', cited: false, competitorsCited: ['countrydelight.in'] },
            { assistant: 'GEMINI', cited: true, competitorsCited: ['www.countrydelight.in'] },
          ],
        },
      ]),
    },
  };
  const seoReport = {
    report: jest.fn().mockResolvedValue({
      competitor: { id: 'c1', name: 'Country Delight', domain: 'countrydelight.in', status: 'ANALYZED', lastAnalyzedAt: null },
      crawl: { crawledAt: '2026-09-20T00:00:00Z', pagesCrawled: 4, healthScore: 86, verdict: '' },
      coverage: [],
      issues: [{ issueType: 'MISSING_META_DESCRIPTION', severity: 'MEDIUM', pages: 5 }],
      issuesBySeverity: {},
      comparison: [
        { label: 'Location pages', whatItMeans: '', higherIsBetter: true, them: 1, you: 0, leader: 'them' },
        { label: 'Critical problems', whatItMeans: '', higherIsBetter: false, them: 3, you: 0, leader: 'you' },
      ],
      notes: [],
    }),
  };
  return new CompetitorIntelReportService(prisma as any, seoReport as any, router as any);
}

describe('CompetitorIntelReportService.generate', () => {
  it('asks Sarvam only, and returns its analysis alongside the facts', async () => {
    const router = {
      generate: jest.fn().mockResolvedValue({
        model: 'sarvam-105b',
        refused: false,
        text:
          '```json\n{"executiveSummary":"Country Delight covers more.","gaps":[{"title":"Location pages","priority":"low"},' +
          '{"title":"A2 milk page","priority":"critical","howToBeatIt":["write it"]}],' +
          '"whyTheyRank":[{"competitor":"Country Delight","reasons":[{"factor":"More topics","evidence":"2 vs 0"}]}],"plan":[{"actions":["x"]}]}\n```',
      }),
    };
    const report = await setup(router).generate('p1', 'org1');

    expect(router.generate).toHaveBeenCalledWith(
      expect.objectContaining({ provider: AiProvider.SARVAM, allowFallback: false, organizationId: 'org1', projectId: 'p1' }),
    );
    expect(report.model).toBe('sarvam-105b');
    expect(report.analysisError).toBeNull();
    expect(report.analysis?.gaps.map((g) => g.priority)).toEqual(['high', 'low']);
    expect(report.analysis?.whyTheyRank[0]).toMatchObject({ competitor: 'Country Delight', threat: 'medium' });
    expect(report.analysis?.plan[0].week).toBe('Week 1');
  });

  it('gathers what the rival has, not what is wrong with it', async () => {
    const router = { generate: jest.fn().mockRejectedValue(new Error('SARVAM_API_KEY is not set')) };
    const report = await setup(router).generate('p1');

    expect(report.analysis).toBeNull();
    expect(report.analysisError).toContain('SARVAM_API_KEY is not set');
    const rival = report.facts.rivals[0];
    expect(rival).not.toHaveProperty('issues');
    expect(rival.comparison.map((c) => c.label)).toEqual(['Location pages']);
    expect(rival.aiMentions).toBe(2);
    expect(report.facts.aiAnswers).toEqual({ asked: 2, namedYou: 1 });
    expect(rival.googleReviews).toBe(910);
    expect(rival.advantages?.missingTopics.map((t) => t.url)).toEqual([
      'https://countrydelight.in/a2-milk',
      'https://countrydelight.in/milk-delivery-pune',
    ]);
  });
});

describe('computeAdvantages', () => {
  const toAdv = (p: RawPage): AdvantagePage => ({ ...p, schemaTypes: p.schemas.map((s) => s.schemaType) });
  const a = computeAdvantages(OUR_PAGES.map(toAdv), THEIR_PAGES.map(toAdv));

  it('lists their topics you have no page for, and never your shared ones or their home page', () => {
    expect(a.missingTopicsTotal).toBe(2);
    expect(a.missingTopics[0]).toMatchObject({ url: 'https://countrydelight.in/a2-milk', wordCount: 1400 });
    expect(a.yourUniqueTopicsTotal).toBe(2); // buffalo milk, paneer
  });

  it('counts page kinds, structured data, depth and question headings they lead on', () => {
    expect(a.pageTypes).toEqual([{ pageType: 'LOCATION', label: 'Location pages', you: 0, them: 1 }]);
    expect(a.schema).toEqual([{ type: 'FAQ', you: 0, them: 1, exampleUrl: 'https://countrydelight.in/a2-milk' }]);
    expect(a.depth).toMatchObject({ theirLongPages: 1, yourLongPages: 0 });
    expect(a.questions).toEqual({ theirs: ['Is A2 milk better for digestion?'], theirCount: 1, yourCount: 0 });
  });
});

describe('buildPrompt', () => {
  it('carries the measured strengths with URLs, and leaves out site problems', async () => {
    const router = { generate: jest.fn().mockResolvedValue({ model: 'm', refused: false, text: '{}' }) };
    const prompt = buildPrompt(await setup(router).gatherFacts('p1'));

    expect(prompt).toContain('topics they cover that you have no page for: 2');
    expect(prompt).toContain('https://countrydelight.in/a2-milk');
    expect(prompt).toContain('FAQ: them 1 page(s), you 0');
    expect(prompt).toContain('named in 2 of 2 AI answers (you: 1)');
    expect(prompt).toContain('4.4 stars from 910 reviews');
    expect(prompt).not.toContain('MISSING_META_DESCRIPTION');
    expect(prompt).not.toContain('Critical problems');
  });
});

describe('normaliseAnalysis', () => {
  it('turns anything the model sends into the report shape without throwing', () => {
    expect(normaliseAnalysis(null)).toEqual({
      executiveSummary: '',
      whyTheyRank: [],
      gaps: [],
      whereYouLead: [],
      plan: [],
      dataGaps: [],
    });
    const n = normaliseAnalysis({ gaps: [{ priority: 'urgent', howToBeatIt: 'not a list' }], whyTheyRank: [{ reasons: 'x' }] });
    expect(n.gaps[0]).toMatchObject({ title: 'Untitled gap', priority: 'medium', howToBeatIt: [], effort: 'medium', rivals: [] });
    expect(n.whyTheyRank).toEqual([]);
  });
});
