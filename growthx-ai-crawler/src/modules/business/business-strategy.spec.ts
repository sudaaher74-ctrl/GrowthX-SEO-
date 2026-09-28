import {
  buildPriceRows,
  buildStrategyPrompt,
  CatalogRow,
  CrawledPage,
  formatPrice,
  LinkRow,
  normaliseStrategy,
  pathName,
  rankPushedProducts,
  StrategyFacts,
} from './business-strategy';

const SITE = 'https://www.mittaldairyfarms.com';
const page = (path: string, pageType = 'OTHER', title = path): CrawledPage => ({ url: `${SITE}${path}`, title, h1: [], pageType });
const link = (from: string, to: string, fromType = 'OTHER', anchorText: string | null = null, fromTitle: string | null = null): LinkRow => ({
  sourceUrl: `${SITE}${from}`,
  targetUrl: `${SITE}${to}`,
  sourceType: fromType,
  sourceTitle: fromTitle,
  anchorText,
});
const product = (path: string, price: number | null, category: string | null = 'Dairy', name: string | null = null): CatalogRow => ({
  url: `${SITE}${path}`,
  name,
  priceStatus: price == null ? 'NOT_PUBLISHED' : 'FOUND',
  priceMinorUnits: price,
  currency: price == null ? null : 'INR',
  category,
});

describe('rankPushedProducts', () => {
  it('puts first the product their own site links to most, from the homepage and from articles', () => {
    const pushed = rankPushedProducts({
      catalog: [product('/ghee', 89900, 'Dairy', 'A2 Ghee'), product('/paneer', 12000, 'Dairy', 'Paneer')],
      pages: [page('/', 'HOME'), page('/ghee', 'PRODUCT'), page('/paneer', 'PRODUCT'), page('/blog/ghee-benefits', 'BLOG', 'Why A2 ghee is good for you')],
      links: [
        link('/', '/ghee', 'HOME', 'A2 Desi Ghee'),
        link('/blog/ghee-benefits', '/ghee', 'BLOG', 'buy a2 ghee', 'Why A2 ghee is good for you'),
        link('/paneer', '/ghee', 'PRODUCT', 'A2 Desi Ghee'),
        link('/ghee', '/paneer', 'PRODUCT', 'Paneer'),
      ],
    });

    expect(pushed.map((p) => p.name)).toEqual(['A2 Ghee', 'Paneer']);
    expect(pushed[0]).toMatchObject({
      source: 'catalog',
      price: '₹899',
      linkedFrom: 3,
      onHomepage: true,
      fromArticles: [{ url: `${SITE}/blog/ghee-benefits`, title: 'Why A2 ghee is good for you' }],
      linkWords: ['A2 Desi Ghee', 'buy a2 ghee'],
    });
  });

  it('counts each linking page once, however many times it links', () => {
    const [ghee] = rankPushedProducts({
      catalog: [product('/ghee', null)],
      pages: [page('/a'), page('/ghee', 'PRODUCT')],
      links: [link('/a', '/ghee'), link('/a', '/ghee'), link('/a', '/ghee')],
    });
    expect(ghee.linkedFrom).toBe(1);
  });

  it('offers much-linked ordinary pages, marked as possible products, when a site shows no products', () => {
    // Mittal Dairy: product pages with an "Order now" button and no price or markup.
    const pushed = rankPushedProducts({
      catalog: [],
      pages: [
        page('/', 'HOME', 'Mr. Milk'),
        page('/best-a2-desi-cow-milk.php', 'OTHER', 'Fresh A2 Desi Cow Milk Delivered To Doorstep'),
        page('/about', 'ABOUT', 'About us'),
        page('/blog/why-a2', 'BLOG', 'Why A2'),
      ],
      links: [link('/', '/best-a2-desi-cow-milk.php', 'HOME', 'A2 Milk'), link('/', '/about', 'HOME'), link('/', '/blog/why-a2', 'HOME')],
    });

    expect(pushed).toHaveLength(1);
    expect(pushed[0]).toMatchObject({ source: 'linked-page', name: 'Fresh A2 Desi Cow Milk Delivered To Doorstep', price: null });
  });

  it('ignores a page linking to itself and generic link words', () => {
    const [p] = rankPushedProducts({
      catalog: [product('/ghee', null)],
      pages: [page('/ghee', 'PRODUCT')],
      links: [link('/ghee', '/ghee', 'PRODUCT', 'Ghee'), link('/x', '/ghee', 'OTHER', 'Read more')],
    });
    expect(p.linkedFrom).toBe(1);
    expect(p.linkWords).toEqual([]);
  });
});

describe('buildPriceRows', () => {
  it('compares your price range with each competitor\'s, category by category', () => {
    const rows = buildPriceRows(
      [product('/milk-1l', 7000, 'Milk'), product('/milk-500', 3800, 'Milk')],
      [{ name: 'mr milk', products: [product('/a2', 9000, 'Milk'), product('/b', 8500, 'Milk')] }],
    );
    expect(rows).toEqual([
      {
        category: 'Milk',
        you: { min: 3800, max: 7000, count: 2, currency: 'INR' },
        them: [{ competitor: 'mr milk', band: { min: 8500, max: 9000, count: 2, currency: 'INR' } }],
      },
    ]);
  });

  it('keeps a category only they price, and drops one nobody prices', () => {
    const rows = buildPriceRows([product('/ghee', null, 'Ghee')], [
      { name: 'r', products: [product('/g', 90000, 'Ghee'), product('/c', null, 'Curd')] },
    ]);
    expect(rows.map((r) => [r.category, r.you])).toEqual([['Ghee', null]]);
  });
});

describe('formatPrice and pathName', () => {
  it('prints a price the way the page shows it', () => {
    expect(formatPrice(19800, 'INR')).toBe('₹198');
    expect(formatPrice(3450, 'INR')).toBe('₹34.50');
    expect(formatPrice(null, 'INR')).toBeNull();
  });

  it('turns an address into a readable name', () => {
    expect(pathName('https://x.com/best-a2-desi-cow-milk-ghee.php')).toBe('best a2 desi cow milk ghee');
  });
});

function facts(): StrategyFacts {
  return {
    business: { name: 'milquufresh', domain: 'milquufresh.in' },
    you: { productCount: 1, pricedCount: 1, products: [{ name: 'A2 Milk 1L', url: 'https://milquufresh.in/a2', price: '₹70', category: 'Milk' }], positioning: null },
    competitors: [
      {
        id: 'c1',
        name: 'mr milk',
        domain: 'mrmilk.in',
        pagesRead: 40,
        productCount: 1,
        pricedCount: 1,
        products: [],
        pushed: [
          { url: 'https://mrmilk.in/ghee', name: 'A2 Ghee', source: 'catalog', price: '₹899', linkedFrom: 12, onHomepage: true, fromArticles: [], linkWords: ['a2 ghee'], headline: null },
        ],
        positioning: { valueProps: ['Farm fresh by 7am'], promos: ['Free trial'], tone: 'friendly' },
      },
    ],
    prices: [],
  };
}

describe('buildStrategyPrompt', () => {
  it('gives the model the evidence behind each pushed product, and forbids sales claims', () => {
    const prompt = buildStrategyPrompt(facts());
    expect(prompt).toContain('https://mrmilk.in/ghee');
    expect(prompt).toContain('linked from 12 of their pages; linked from their homepage; link words: "a2 ghee"');
    expect(prompt).toContain('Farm fresh by 7am');
    expect(prompt).toContain('never "best-selling"');
  });
});

describe('normaliseStrategy', () => {
  it('keeps only rival products that are in the facts, and names their owner', () => {
    const s = normaliseStrategy(
      {
        summary: 'You are cheaper.',
        rivalProducts: [
          { url: 'https://mrmilk.in/ghee', whyItWorks: 'Linked from the homepage.', keywords: ['a2 ghee'], counter: ['Add a ghee page'] },
          { url: 'https://mrmilk.in/made-up', whyItWorks: 'x', keywords: [], counter: ['y'] },
        ],
        keywords: [{ phrase: 'a2 milk pune', why: 'Local buyers', forProduct: 'A2 Milk 1L' }, { phrase: 'ghee', why: 'x', forProduct: 'Invented product' }],
        blogPosts: [{ title: 'A2 vs regular milk', covers: 'The difference', keyword: 'a2 milk' }],
        actions: [{ title: 'Add prices', why: 'Buyers compare', steps: ['Show the price'], priority: 'urgent' }],
      },
      facts(),
    );

    expect(s.rivalProducts).toEqual([
      { competitor: 'mr milk', url: 'https://mrmilk.in/ghee', whyItWorks: 'Linked from the homepage.', keywords: ['a2 ghee'], counter: ['Add a ghee page'] },
    ]);
    expect(s.keywords.map((k) => k.forProduct)).toEqual(['A2 Milk 1L', null]);
    expect(s.actions[0].priority).toBe('medium');
    expect(s.positioning).toBeNull();
  });

  it('rewords a claim about sales nobody measured', () => {
    const s = normaliseStrategy(
      {
        summary: 'Their best-selling product is ghee.',
        rivalProducts: [{ url: 'https://mrmilk.in/ghee', whyItWorks: 'It is their top seller.', keywords: [], counter: [] }],
        keywords: [],
        blogPosts: [],
        actions: [],
      },
      facts(),
    );
    expect(s.summary).toBe('Their most promoted product is ghee.');
    expect(s.rivalProducts[0].whyItWorks).toBe('It is their most promoted.');
  });

  it("puts Google's numbers on a strategy keyword that is one of the site's real searches", () => {
    const f = {
      ...facts(),
      search: {
        status: 'OK' as const,
        days: 28,
        range: { start: '2026-08-31', end: '2026-09-27' },
        topSearches: [{ query: 'a2 milk pune', impressions: 120, clicks: 9, position: 6.04, page: null }],
        almostWinning: [],
      },
    };
    const s = normaliseStrategy(
      { keywords: [{ phrase: 'Pune A2 milk', why: 'x' }, { phrase: 'ghee online', why: 'y' }] },
      f,
    );
    expect(s.keywords[0].measured).toEqual({ impressions: 120, clicks: 9, position: 6, days: 28, page: null });
    expect(s.keywords[1].measured).toBeNull();
    expect(buildStrategyPrompt(f)).toContain('"a2 milk pune": shown 120 times, 9 clicks, average position 6');
  });

  it('survives an answer missing whole sections', () => {
    const s = normaliseStrategy({}, facts());
    expect(s).toEqual({ summary: '', rivalProducts: [], pricing: [], keywords: [], blogPosts: [], positioning: null, actions: [] });
  });
});
