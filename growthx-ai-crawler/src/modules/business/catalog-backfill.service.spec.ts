import { CatalogBackfillService } from './catalog-backfill.service';

const PRODUCT_HTML = `<html><head><script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'A2 Desi Ghee',
  offers: { price: '899', priceCurrency: 'INR', availability: 'https://schema.org/InStock' },
})}</script></head><body><h1>A2 Desi Ghee</h1><button>Add to cart</button></body></html>`;
const ARTICLE_HTML = '<html><body><h1>Why A2 milk</h1><p>Some words.</p></body></html>';

function build(existing = 0) {
  const prisma = {
    catalogProduct: {
      count: jest.fn().mockResolvedValue(existing),
      upsert: jest.fn().mockResolvedValue({}),
    },
    page: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([
          { id: 'p1', url: 'https://rival.in/ghee', pageType: 'OTHER', rawHtml: PRODUCT_HTML, renderedHtml: null },
          { id: 'p2', url: 'https://rival.in/blog/a2', pageType: 'BLOG', rawHtml: ARTICLE_HTML, renderedHtml: null },
        ])
        .mockResolvedValue([]),
    },
  };
  return { prisma, service: new CatalogBackfillService(prisma as any) };
}

const target = { projectId: 'p', competitorId: 'c1', organizationId: 'o' };

describe('CatalogBackfillService', () => {
  it('finds products in pages a crawl already stored, without a new crawl', async () => {
    const { prisma, service } = build();

    expect(await service.rebuild(target, 'job1')).toBe(1);
    expect(prisma.catalogProduct.upsert).toHaveBeenCalledTimes(1);
    const args = prisma.catalogProduct.upsert.mock.calls[0][0];
    expect(args.create).toMatchObject({ projectId: 'p', competitorId: 'c1', url: 'https://rival.in/ghee', pageId: 'p1', name: 'A2 Desi Ghee', priceMinorUnits: 89900 });
    // Only pages that opened are read.
    expect(prisma.page.findMany.mock.calls[0][0].where).toMatchObject({ crawlJobId: 'job1', statusCode: { gte: 200, lt: 400 }, blockedSuspected: false });
  });

  it('leaves a catalog alone that the crawl already filled', async () => {
    const { prisma, service } = build(12);
    expect(await service.rebuild(target, 'job1')).toBe(0);
    expect(prisma.page.findMany).not.toHaveBeenCalled();
  });

  it('runs once per crawl and catalog, and says so while it runs', async () => {
    const { prisma, service } = build();

    expect(service.ensure(target, 'job1')).toBe(true);
    expect(service.ensure(target, 'job1')).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(service.ensure(target, 'job1')).toBe(false);
    expect(prisma.catalogProduct.count).toHaveBeenCalledTimes(1);
  });
});
