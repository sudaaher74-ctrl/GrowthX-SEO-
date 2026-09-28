import { BusinessStrategyService } from './business-strategy.service';

function build({ competitors = [{ id: 'c1', domain: 'mrmilk.in', label: 'mr milk', name: null, websiteId: 'w1' }], answer = '{}' } = {}) {
  const prisma = {
    project: { findUnique: jest.fn().mockResolvedValue({ name: 'milquufresh', organizationId: 'o1', websites: [{ domain: 'milquufresh.in' }] }) },
    catalogProduct: {
      findMany: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(
          where.competitorId === null
            ? [{ url: 'https://milquufresh.in/a2', name: 'A2 Milk 1L', priceStatus: 'FOUND', priceMinorUnits: 7000, currency: 'INR', category: 'Milk' }]
            : [{ url: 'https://mrmilk.in/ghee', name: 'A2 Ghee', priceStatus: 'FOUND', priceMinorUnits: 89900, currency: 'INR', category: 'Ghee' }],
        ),
      ),
    },
    competitorDomain: { findMany: jest.fn().mockResolvedValue(competitors) },
    marketingSignal: {
      findMany: jest.fn().mockResolvedValue([{ competitorId: 'c1', kind: 'VALUE_PROP', text: 'Farm fresh by 7am' }]),
      count: jest.fn().mockResolvedValue(1),
    },
    crawlJob: { findMany: jest.fn().mockResolvedValue([{ id: 'job1', status: 'COMPLETED', finishedAt: new Date(), pagesCrawled: 40 }]) },
    page: {
      findMany: jest.fn().mockResolvedValue([
        { url: 'https://mrmilk.in/', title: 'Mr Milk', h1: [], pageType: 'HOME' },
        { url: 'https://mrmilk.in/ghee', title: 'A2 Ghee', h1: [], pageType: 'PRODUCT' },
      ]),
      count: jest.fn().mockResolvedValue(38),
    },
    link: {
      findMany: jest.fn().mockResolvedValue([
        { targetUrl: 'https://mrmilk.in/ghee', anchorText: 'A2 Ghee', sourcePage: { url: 'https://mrmilk.in/', title: 'Mr Milk', pageType: 'HOME' } },
      ]),
    },
    businessStrategySnapshot: { create: jest.fn().mockResolvedValue({}), findFirst: jest.fn() },
  };
  const router = { generate: jest.fn().mockResolvedValue({ text: answer, model: 'sarvam-105b', refused: false }) };
  const marketing = { generateForOwnSite: jest.fn(), generateForCompetitor: jest.fn() };
  const backfill = { ensure: jest.fn().mockReturnValue(false) };
  const service = new BusinessStrategyService(prisma as any, router as any, marketing as any, backfill as any);
  return { service, prisma, router, marketing };
}

describe('BusinessStrategyService', () => {
  it('writes a strategy from the counted facts and keeps only products that are in them', async () => {
    const { service, prisma, router } = build({
      answer: JSON.stringify({
        summary: 'They push ghee from their homepage.',
        rivalProducts: [
          { url: 'https://mrmilk.in/ghee', whyItWorks: 'On their homepage.', keywords: ['a2 ghee'], counter: ['Add a ghee page'] },
          { url: 'https://mrmilk.in/invented', whyItWorks: 'x', keywords: [], counter: [] },
        ],
        keywords: [],
        blogPosts: [],
        actions: [],
      }),
    });

    const report = await service.generate('p1', 'o1');

    expect(router.generate).toHaveBeenCalledWith(expect.objectContaining({ provider: 'SARVAM', allowFallback: false }));
    expect(report.facts.competitors[0]).toMatchObject({ name: 'mr milk', pagesRead: 38, productCount: 1 });
    expect(report.facts.competitors[0].pushed[0]).toMatchObject({ url: 'https://mrmilk.in/ghee', onHomepage: true, price: '₹899' });
    expect(report.strategy?.rivalProducts.map((p) => p.url)).toEqual(['https://mrmilk.in/ghee']);
    expect(report.model).toBe('sarvam-105b');
    expect(prisma.businessStrategySnapshot.create).toHaveBeenCalledTimes(1);
  });

  it('asks for no strategy with no competitor to compare against, and says why', async () => {
    const { service, router } = build({ competitors: [] });
    const report = await service.generate('p1', 'o1');
    expect(router.generate).not.toHaveBeenCalled();
    expect(report.strategy).toBeNull();
    expect(report.strategyError).toMatch(/Add a competitor/);
  });

  it('keeps the facts when the model fails', async () => {
    const { service, router } = build();
    router.generate.mockRejectedValue(new Error('timeout'));
    const report = await service.generate('p1', 'o1');
    expect(report.strategy).toBeNull();
    expect(report.strategyError).toMatch(/timeout/);
    expect(report.facts.competitors).toHaveLength(1);
  });

  it('reads positioning for sites that have none before writing', async () => {
    const { service, prisma, marketing } = build();
    prisma.marketingSignal.count.mockResolvedValue(0);
    await service.generate('p1', 'o1');
    expect(marketing.generateForOwnSite).toHaveBeenCalledWith('o1', 'p1');
    expect(marketing.generateForCompetitor).toHaveBeenCalledWith('o1', 'p1', 'c1');
  });
});
