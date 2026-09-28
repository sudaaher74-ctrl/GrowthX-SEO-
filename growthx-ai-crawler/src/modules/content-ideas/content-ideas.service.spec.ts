import { ContentIdeasService, buildIdeasPrompt, normaliseBlogIdeas, normaliseKeywordIdeas, toSitePages } from './content-ideas.service';

const row = (url: string, title: string | null, pageType = 'PRODUCT', h1: string[] = []) => ({ url, title, h1, pageType });

/**
 * Keyword and blog suggestions are the one part of a report that is not a
 * measurement, so what matters is what they are grounded in and what they
 * are not allowed to claim.
 */
describe('toSitePages', () => {
  it('keeps pages that say what the business sells, home and main sections first, each title once', () => {
    const pages = toSitePages([
      row('https://milquufresh.in/products/a2-cow-milk', 'A2 Cow Milk | MilQuu Fresh', 'PRODUCT', ['Fresh A2 Desi Cow Milk']),
      row('https://milquufresh.in/', 'MilQuu Fresh – Premium Dairy', 'HOME'),
      row('https://milquufresh.in/privacy-policy', 'Privacy Policy', 'LEGAL'),
      row('https://milquufresh.in/contact', 'Contact us', 'CONTACT'),
      row('https://milquufresh.in/products/a2-cow-milk?ref=x', 'A2 Cow Milk | MilQuu Fresh'),
      row('https://milquufresh.in/blank', null),
    ]);
    expect(pages).toEqual([
      { path: '/', title: 'MilQuu Fresh – Premium Dairy', heading: null },
      { path: '/products/a2-cow-milk', title: 'A2 Cow Milk | MilQuu Fresh', heading: 'Fresh A2 Desi Cow Milk' },
    ]);
  });
});

describe('buildIdeasPrompt', () => {
  const pages = [{ path: '/products/a2-cow-milk', title: 'A2 Cow Milk', heading: null }];

  it("is grounded in the site's own pages, and forbids numbers nobody measured", () => {
    const prompt = buildIdeasPrompt({ name: 'milquufresh', domain: 'milquufresh.in', pages });
    expect(prompt).toContain('- /products/a2-cow-milk: A2 Cow Milk');
    expect(prompt).toContain('Do not give search volumes, rankings, prices, percentages or any other numbers');
    expect(prompt).not.toContain('COMPETITORS');
  });

  it('adds the topics and questions competitors cover, in the competitor report', () => {
    const prompt = buildIdeasPrompt({
      name: 'milquufresh',
      domain: 'milquufresh.in',
      pages,
      rivalTopics: [{ title: 'Benefits of A2 milk for children', rival: 'country delight' }],
      rivalQuestions: ['Is A2 milk better than regular milk?'],
    });
    expect(prompt).toContain('- "Benefits of A2 milk for children" (country delight)');
    expect(prompt).toContain('- Is A2 milk better than regular milk?');
  });
});

describe('normalising what the model returned', () => {
  const pages = [{ path: '/products/a2-cow-milk', title: 'A2 Cow Milk', heading: null }];

  it('keeps distinct phrases, and a page only when it is one of the site\'s own', () => {
    expect(
      normaliseKeywordIdeas(
        [
          { phrase: '"a2 cow milk delivery pune"', why: 'People in Pune looking for A2 milk at home.', usePage: '/products/a2-cow-milk' },
          { phrase: 'A2 cow milk delivery Pune', why: 'duplicate' },
          { phrase: 'fresh paneer near me', why: 'x', usePage: '/made-up-page' },
          { phrase: '', why: 'empty' },
          'not an object',
        ],
        pages,
      ),
    ).toEqual([
      { phrase: 'a2 cow milk delivery pune', why: 'People in Pune looking for A2 milk at home.', usePage: '/products/a2-cow-milk' },
      { phrase: 'fresh paneer near me', why: 'x', usePage: null },
    ]);
  });

  it('keeps at most ten phrases and six posts', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ phrase: `phrase ${i}`, why: '', usePage: 'new page', title: `Post ${i}`, covers: '', keyword: '' }));
    expect(normaliseKeywordIdeas(many, pages)).toHaveLength(10);
    expect(normaliseBlogIdeas(many)).toHaveLength(6);
  });
});

describe('ContentIdeasService', () => {
  function build(text: string, demand?: unknown) {
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ name: 'milquufresh', websites: [{ id: 'w1', domain: 'milquufresh.in' }] }) },
      crawlJob: { findFirst: jest.fn().mockResolvedValue({ id: 'job1' }) },
      page: { findMany: jest.fn().mockResolvedValue([row('https://milquufresh.in/products/a2-cow-milk', 'A2 Cow Milk')]) },
    };
    const router = { generate: jest.fn().mockResolvedValue({ text, refused: false, model: 'sarvam-105b' }) };
    const search = demand ? { forProject: jest.fn().mockResolvedValue(demand) } : undefined;
    return { prisma, router, service: new ContentIdeasService(prisma as any, router as any, search as any) };
  }

  it('asks Sarvam by name, with no other vendor standing in, and says which model wrote them', async () => {
    const { service, router } = build(
      JSON.stringify({
        keywords: [{ phrase: 'a2 milk delivery', why: 'Home delivery searches.', usePage: '/products/a2-cow-milk' }],
        blogIdeas: [{ title: 'Is A2 milk better for kids?', covers: 'What A2 milk is.', keyword: 'a2 milk for kids' }],
      }),
    );

    const ideas = await service.suggest('p1', 'org1');

    expect(router.generate.mock.calls[0][0]).toMatchObject({ provider: 'SARVAM', allowFallback: false, jsonSchema: expect.any(Object) });
    expect(ideas).toEqual({
      keywords: [{ phrase: 'a2 milk delivery', why: 'Home delivery searches.', usePage: '/products/a2-cow-milk' }],
      blogIdeas: [{ title: 'Is A2 milk better for kids?', covers: 'What A2 milk is.', keyword: 'a2 milk for kids' }],
      model: 'sarvam-105b',
      // Without Search Console, the ideas say so rather than carry numbers.
      search: { status: 'NOT_CONNECTED', days: 28, range: null, almostWinning: [] },
    });
  });

  it("puts Google's real numbers on a suggested phrase that is one of the site's searches, and only on those", async () => {
    const demand = {
      status: 'OK',
      days: 28,
      range: { start: '2026-08-31', end: '2026-09-27' },
      topSearches: [],
      almostWinning: [{ query: 'a2 cow milk pune', impressions: 340, clicks: 12, position: 14.26, page: 'https://milquufresh.in/a2-milk' }],
    };
    const { service, router } = build(
      JSON.stringify({
        keywords: [
          { phrase: 'A2 cow milk Pune', why: 'Already seen for it.', usePage: 'new page' },
          { phrase: 'fresh paneer delivery', why: 'A new phrase.', usePage: 'new page' },
        ],
        blogIdeas: [],
      }),
      demand,
    );

    const ideas = await service.suggest('p1', 'org1');

    expect(router.generate.mock.calls[0][0].prompt).toContain('"a2 cow milk pune": shown 340 times, 12 clicks, average position 14.3, page /a2-milk');
    expect(ideas.keywords[0]).toEqual({
      phrase: 'A2 cow milk Pune',
      why: 'Already seen for it.',
      // The page Google already shows for it, not "new page".
      usePage: '/a2-milk',
      measured: { impressions: 340, clicks: 12, position: 14.3, days: 28, page: 'https://milquufresh.in/a2-milk' },
    });
    expect(ideas.keywords[1].measured).toBeNull();
    expect(ideas.search?.almostWinning[0]).toMatchObject({ query: 'a2 cow milk pune', pagePath: '/a2-milk' });
  });

  it('refuses before calling the model when the website has not been read', async () => {
    const { service, prisma, router } = build('{}');
    prisma.crawlJob.findFirst.mockResolvedValue(null);

    await expect(service.suggest('p1')).rejects.toThrow(/hasn't been read yet/);
    expect(router.generate).not.toHaveBeenCalled();
  });

  it('gives a report a reason instead of an error, so the report still stands', async () => {
    const { service, router } = build('{}');
    router.generate.mockRejectedValue(new Error('SARVAM_API_KEY is not configured.'));

    await expect(service.forReport('p1')).resolves.toEqual({
      ideas: null,
      ideasError: 'Keyword and blog ideas could not be written: SARVAM_API_KEY is not configured.',
    });
  });
});
