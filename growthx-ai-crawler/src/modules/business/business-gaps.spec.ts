import { buildCategoryGapItems, CompetitorCatalog } from './business-gaps';
import type { CatalogProduct } from '@prisma/client';

let seq = 0;
const product = (over: Partial<CatalogProduct> = {}): CatalogProduct =>
  ({
    id: `cp_${++seq}`,
    organizationId: 'org_1',
    projectId: 'proj_1',
    competitorId: null,
    pageId: null,
    url: 'https://indianfruitspulp.com/products/mango-pulp',
    name: 'Alphonso Mango Pulp — 850g Tin',
    priceStatus: 'FOUND',
    priceMinorUnits: 34900,
    currency: 'INR',
    stockStatus: 'FOUND',
    stockValue: 'IN_STOCK',
    category: 'Aseptic Fruit Pulp',
    ctaType: 'ADD_TO_CART',
    completenessScore: 1,
    matchConfidence: null,
    detectedAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as CatalogProduct;

const rival = (id: string, label: string, products: CatalogProduct[]): CompetitorCatalog => ({
  id,
  domain: `${label.toLowerCase().replace(/\s+/g, '')}.com`,
  label,
  products,
});

/**
 * The Gaps tab is built entirely on this. A gap invented where none exists
 * sends someone chasing a category they already cover; a real gap missed
 * here is a category lost to a competitor with nothing said about it.
 */
describe('buildCategoryGapItems — missing category coverage', () => {
  it('flags a category the competitor sells and the project has none of', () => {
    const mine = [product({ category: 'Aseptic Fruit Pulp' })];
    const competitor = rival('c1', 'Country Delight', [
      product({ competitorId: 'c1', category: 'IQF Frozen Fruits', name: 'IQF Diced Mango' }),
      product({ competitorId: 'c1', category: 'IQF Frozen Fruits', name: 'IQF Mixed Berries' }),
    ]);

    const items = buildCategoryGapItems(mine, [competitor]);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('MISSING_CATEGORY');
    expect(items[0].category).toBe('IQF Frozen Fruits');
    expect(items[0].headline).toContain('Country Delight');
    expect(items[0].headline).toContain('2');
  });

  it('says nothing when both sides already carry the category', () => {
    const mine = [product({ category: 'Aseptic Fruit Pulp' })];
    const competitor = rival('c1', 'Country Delight', [product({ competitorId: 'c1', category: 'Aseptic Fruit Pulp' })]);

    const items = buildCategoryGapItems(mine, [competitor]);

    expect(items.filter((i) => i.kind === 'MISSING_CATEGORY')).toHaveLength(0);
  });
});

describe('buildCategoryGapItems — price delta', () => {
  it('flags a category priced meaningfully higher than the competitor, in the same currency', () => {
    const mine = [product({ category: 'Aseptic Fruit Pulp', priceMinorUnits: 40000, currency: 'INR' })];
    const competitor = rival('c1', 'Country Delight', [
      product({ competitorId: 'c1', category: 'Aseptic Fruit Pulp', priceMinorUnits: 30000, currency: 'INR' }),
    ]);

    const items = buildCategoryGapItems(mine, [competitor]);
    const priceGap = items.find((i) => i.kind === 'PRICE_DELTA');

    expect(priceGap).toBeDefined();
    expect(priceGap!.headline).toContain('higher');
  });

  it('does not flag a small difference that is normal variation', () => {
    const mine = [product({ category: 'Aseptic Fruit Pulp', priceMinorUnits: 31000, currency: 'INR' })];
    const competitor = rival('c1', 'Country Delight', [
      product({ competitorId: 'c1', category: 'Aseptic Fruit Pulp', priceMinorUnits: 30000, currency: 'INR' }),
    ]);

    const items = buildCategoryGapItems(mine, [competitor]);

    expect(items.filter((i) => i.kind === 'PRICE_DELTA')).toHaveLength(0);
  });

  it('reports incomparable rather than fabricating a cross-currency comparison', () => {
    const mine = [product({ category: 'Aseptic Fruit Pulp', priceMinorUnits: 40000, currency: 'INR' })];
    const competitor = rival('c1', 'Global Fruit Co', [
      product({ competitorId: 'c1', category: 'Aseptic Fruit Pulp', priceMinorUnits: 500, currency: 'USD' }),
    ]);

    const items = buildCategoryGapItems(mine, [competitor]);
    const incomparable = items.find((i) => i.kind === 'PRICE_INCOMPARABLE');

    expect(incomparable).toBeDefined();
    expect(items.filter((i) => i.kind === 'PRICE_DELTA')).toHaveLength(0);
  });

  it('skips the price comparison entirely when neither side has a published price', () => {
    const mine = [product({ category: 'Aseptic Fruit Pulp', priceStatus: 'NOT_PUBLISHED', priceMinorUnits: null, currency: null })];
    const competitor = rival('c1', 'Country Delight', [
      product({ competitorId: 'c1', category: 'Aseptic Fruit Pulp', priceStatus: 'NOT_PUBLISHED', priceMinorUnits: null, currency: null }),
    ]);

    const items = buildCategoryGapItems(mine, [competitor]);

    expect(items.filter((i) => i.kind === 'PRICE_DELTA' || i.kind === 'PRICE_INCOMPARABLE')).toHaveLength(0);
  });
});

describe('buildCategoryGapItems — stock transparency', () => {
  it('flags a category where the competitor publishes stock far more often', () => {
    const mine = [
      product({ category: 'IQF Frozen Fruits', stockStatus: 'NOT_PUBLISHED', stockValue: null }),
      product({ category: 'IQF Frozen Fruits', stockStatus: 'NOT_PUBLISHED', stockValue: null }),
    ];
    const competitor = rival('c1', 'Country Delight', [
      product({ competitorId: 'c1', category: 'IQF Frozen Fruits', stockStatus: 'FOUND', stockValue: 'IN_STOCK' }),
      product({ competitorId: 'c1', category: 'IQF Frozen Fruits', stockStatus: 'FOUND', stockValue: 'IN_STOCK' }),
    ]);

    const items = buildCategoryGapItems(mine, [competitor]);
    const stockGap = items.find((i) => i.kind === 'STOCK_TRANSPARENCY');

    expect(stockGap).toBeDefined();
    expect(stockGap!.category).toBe('IQF Frozen Fruits');
  });

  it('does not flag a small difference in how often stock is published', () => {
    const mine = [
      product({ category: 'IQF Frozen Fruits', stockStatus: 'FOUND', stockValue: 'IN_STOCK' }),
      product({ category: 'IQF Frozen Fruits', stockStatus: 'NOT_PUBLISHED', stockValue: null }),
    ];
    const competitor = rival('c1', 'Country Delight', [
      product({ competitorId: 'c1', category: 'IQF Frozen Fruits', stockStatus: 'FOUND', stockValue: 'IN_STOCK' }),
      product({ competitorId: 'c1', category: 'IQF Frozen Fruits', stockStatus: 'NOT_PUBLISHED', stockValue: null }),
    ]);

    const items = buildCategoryGapItems(mine, [competitor]);

    expect(items.filter((i) => i.kind === 'STOCK_TRANSPARENCY')).toHaveLength(0);
  });
});

describe('buildCategoryGapItems — general behavior', () => {
  it('ignores a competitor with no crawled products yet rather than treating it as every category missing', () => {
    const mine = [product({ category: 'Aseptic Fruit Pulp' })];
    const competitor = rival('c1', 'Not Yet Crawled Co', []);

    expect(buildCategoryGapItems(mine, [competitor])).toEqual([]);
  });

  it('never matches a product with no category on either side', () => {
    const mine = [product({ category: null })];
    const competitor = rival('c1', 'Country Delight', [product({ competitorId: 'c1', category: null })]);

    expect(buildCategoryGapItems(mine, [competitor])).toEqual([]);
  });

  it('sorts bigger gaps first', () => {
    const mine = [product({ category: 'Aseptic Fruit Pulp' })];
    const competitor = rival('c1', 'Country Delight', [
      product({ competitorId: 'c1', category: 'Small Gap', name: 'A' }),
      product({ competitorId: 'c1', category: 'Big Gap', name: 'A' }),
      product({ competitorId: 'c1', category: 'Big Gap', name: 'B' }),
      product({ competitorId: 'c1', category: 'Big Gap', name: 'C' }),
    ]);

    const items = buildCategoryGapItems(mine, [competitor]);

    expect(items[0].category).toBe('Big Gap');
    expect(items[0].weight).toBeGreaterThan(items[items.length - 1].weight);
  });
});
