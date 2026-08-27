import { MarketResearchService } from './market-research.service';

const GENERIC = 'Which competitors are winning AI citations for our core topic?';

/**
 * The opening prompts on the Market Research page were fixed strings — "our
 * core topic", "this market" — identical for every client and specific to
 * none. The crawl already knows what the business sells, so the questions can
 * say it.
 */
describe('MarketResearchService — suggested questions', () => {
  let prisma: any;
  let service: any;

  beforeEach(() => {
    prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ name: 'Aiva' }), findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      page: { findMany: jest.fn().mockResolvedValue([]) },
      competitorDomain: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new (MarketResearchService as any)(prisma, {}, {});
  });

  it('names what the client sells, taken from its homepage title', async () => {
    prisma.page.findMany.mockResolvedValue([
      {
        url: 'https://aivaenterprises.com/',
        title: 'Premium Fruit Pulp Exporter India | AIVA Enterprises',
        metaDescription: 'AIVA Enterprises exports premium aseptic fruit pulps.',
      },
    ]);

    const questions = await service.suggestedQuestions('org', 'p1');

    expect(questions).toHaveLength(4);
    questions.forEach((q: string) => expect(q).toContain('Premium Fruit Pulp Exporter India'));
    expect(questions).not.toContain(GENERIC);
  });

  it('prefers the homepage over a deeper product page', async () => {
    prisma.page.findMany.mockResolvedValue([
      { url: 'https://x.com/products/alphonso-mango-pulp', title: 'Alphonso Mango Pulp | AIVA', metaDescription: null },
      { url: 'https://x.com/', title: 'Aseptic Fruit Pulp Exporter | AIVA', metaDescription: null },
    ]);

    const questions = await service.suggestedQuestions('org', 'p1');

    expect(questions[0]).toContain('Aseptic Fruit Pulp Exporter');
    expect(questions[0]).not.toContain('Alphonso');
  });

  it('drops the brand half of the title and keeps the descriptive half', async () => {
    prisma.page.findMany.mockResolvedValue([
      { url: 'https://x.com/', title: 'Aiva | Bulk Fruit Concentrate Supplier', metaDescription: null },
    ]);

    const questions = await service.suggestedQuestions('org', 'p1');

    expect(questions[0]).toContain('Bulk Fruit Concentrate Supplier');
    // The brand is already the workspace name; repeating it wastes the question.
    expect(questions[0]).not.toMatch(/\bAiva\b/);
  });

  it('names a competitor in the citations question when one is known', async () => {
    prisma.page.findMany.mockResolvedValue([
      { url: 'https://x.com/', title: 'Fruit Pulp Exporter India | Aiva', metaDescription: null },
    ]);
    prisma.competitorDomain.findMany.mockResolvedValue([{ domain: 'rival.com' }]);

    const questions = await service.suggestedQuestions('org', 'p1');

    expect(questions[1]).toContain('rival.com');
  });

  it('falls back to the generic set when the project has never been crawled', async () => {
    const questions = await service.suggestedQuestions('org', 'p1');
    expect(questions).toContain(GENERIC);
  });

  it('falls back rather than failing the page when the lookup throws', async () => {
    prisma.project.findFirst.mockRejectedValue(new Error('database unreachable'));

    const questions = await service.suggestedQuestions('org', 'p1');
    expect(questions).toContain(GENERIC);
  });
});
