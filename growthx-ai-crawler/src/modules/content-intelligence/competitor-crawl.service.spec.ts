import { CompetitorCrawlService } from './competitor-crawl.service';

/**
 * A competitor's site is a third party's server. Two things have to hold or
 * this feature is either useless or rude: their pages must never be counted as
 * the customer's own, and the crawl must stay bounded.
 */
describe('CompetitorCrawlService', () => {
  describe('normalizeDomain', () => {
    it('reduces the ways a customer types one company to one domain', () => {
      // Storing these as different competitors would crawl the same stranger's
      // site several times and report several sets of numbers for one company.
      for (const input of [
        'acme.com',
        'ACME.com',
        'www.acme.com',
        'https://acme.com',
        'https://www.acme.com/about?utm_source=x',
        '  https://WWW.Acme.com/  ',
      ]) {
        expect(CompetitorCrawlService.normalizeDomain(input)).toBe('acme.com');
      }
    });

    it('keeps a subdomain that is not www', () => {
      // shop.acme.com is a different site from acme.com and often the one with
      // all the product pages.
      expect(CompetitorCrawlService.normalizeDomain('https://shop.acme.com')).toBe('shop.acme.com');
    });

    it('rejects what cannot be crawled instead of accepting it', () => {
      // Accepting these produces a crawl that dies on a DNS error minutes
      // later, with nothing on screen to say why.
      expect(() => CompetitorCrawlService.normalizeDomain('')).toThrow();
      expect(() => CompetitorCrawlService.normalizeDomain('   ')).toThrow();
      expect(() => CompetitorCrawlService.normalizeDomain('localhost')).toThrow();
      expect(() => CompetitorCrawlService.normalizeDomain('not a domain')).toThrow();
    });
  });

  describe('starting a crawl', () => {
    const competitor = { id: 'comp1', projectId: 'p1', domain: 'https://www.acme.com/products' };

    const build = () => {
      const prisma = {
        competitorDomain: {
          findFirst: jest.fn().mockResolvedValue(competitor),
          update: jest.fn().mockResolvedValue({}),
        },
        website: { upsert: jest.fn().mockResolvedValue({ id: 'w1', domain: 'acme.com' }) },
      };
      const crawler = { startCrawlJob: jest.fn().mockResolvedValue('job1') };
      return { prisma, crawler, service: new CompetitorCrawlService(prisma as any, crawler as any) };
    };

    it('never files a competitor site under the customer project', async () => {
      // This is the whole safety property. Every query that reads a project's
      // own pages filters on website.projectId, so leaving it null is what
      // keeps a competitor's pages out of the customer's content strategy. Set
      // it, and the customer's own strategy is generated from a rival's copy.
      const { prisma, service } = build();

      await service.startCrawl('org1', 'p1', 'comp1');

      const created = prisma.website.upsert.mock.calls[0][0].create;
      expect(created.projectId).toBeUndefined();
      expect(prisma.website.upsert.mock.calls[0][0].update).toEqual({});
    });

    it('bounds the crawl and slows it down', async () => {
      const { crawler, service } = build();

      await service.startCrawl('org1', 'p1', 'comp1');

      const options = crawler.startCrawlJob.mock.calls[0][1];
      expect(options.pageLimit).toBe(CompetitorCrawlService.PAGE_LIMIT);
      expect(options.rateLimitDelayMs).toBe(CompetitorCrawlService.RATE_LIMIT_DELAY_MS);
      expect(options.maxConcurrency).toBe(CompetitorCrawlService.MAX_CONCURRENCY);
      // Slower and shallower than the defaults used on a customer's own site,
      // which are 500ms, concurrency 5, depth 10.
      expect(CompetitorCrawlService.RATE_LIMIT_DELAY_MS).toBeGreaterThan(500);
      expect(CompetitorCrawlService.MAX_CONCURRENCY).toBeLessThan(5);
      expect(CompetitorCrawlService.MAX_DEPTH).toBeLessThan(10);
    });

    it('crawls the bare domain, not the URL the customer pasted', async () => {
      const { prisma, service } = build();

      const result = await service.startCrawl('org1', 'p1', 'comp1');

      expect(prisma.website.upsert.mock.calls[0][0].where).toEqual({ domain: 'acme.com' });
      expect(prisma.website.upsert.mock.calls[0][0].create.url).toBe('https://acme.com');
      expect(result.domain).toBe('acme.com');
    });

    it('refuses a competitor from another project', async () => {
      // The competitor id comes from the client. Scoping the lookup by project
      // and organization is what stops one customer reading another's.
      const { prisma, service } = build();
      prisma.competitorDomain.findFirst.mockResolvedValue(null);

      await expect(service.startCrawl('org1', 'p1', 'comp1')).rejects.toThrow(/not found/i);
    });
  });

  describe('coverage', () => {
    /**
     * Counts are derived from the stored pages themselves rather than from a
     * COUNT in SQL, so the mock supplies rows. That is the point of the change
     * this now covers: counting used to run its own query with its own host
     * regex while the gap list read the rows through a different one, and the
     * two could disagree about what a page is.
     */
    const buildWith = (job: any, pages: { url: string; pageType: string }[] = []) => {
      const prisma = {
        competitorDomain: {
          findFirst: jest.fn().mockResolvedValue({ id: 'comp1', domain: 'acme.com', websiteId: 'w1' }),
        },
        crawlJob: { findFirst: jest.fn().mockResolvedValue(job) },
        page: { findMany: jest.fn().mockResolvedValue(pages.map((p) => ({ title: null, ...p }))) },
      };
      return { prisma, service: new CompetitorCrawlService(prisma as any, {} as any) };
    };

    const pages = (pageType: string, count: number, prefix = 'p') =>
      Array.from({ length: count }, (_, i) => ({ url: `https://acme.com/${prefix}${i}`, pageType }));

    it('says nothing rather than zero when the site has not been crawled', async () => {
      // Zero service pages and "we have not looked" read identically on a
      // dashboard, and only one of them is true.
      const { prisma, service } = buildWith(null);
      prisma.competitorDomain.findFirst.mockResolvedValue({ id: 'comp1', domain: 'acme.com', websiteId: null });

      expect(await service.getCoverage('org1', 'p1', 'comp1')).toBeNull();
    });

    it('says nothing when a crawl was started but never completed', async () => {
      const { service } = buildWith(null);
      expect(await service.getCoverage('org1', 'p1', 'comp1')).toBeNull();
    });

    it('counts the pages by kind', async () => {
      const { service } = buildWith({ id: 'j1', finishedAt: new Date('2026-08-27'), pagesCrawled: 44, pageLimit: 300 }, [
        ...pages('SERVICE', 24, 's'),
        ...pages('BLOG', 6, 'b'),
      ]);

      const coverage = await service.getCoverage('org1', 'p1', 'comp1');

      expect(coverage?.byType).toEqual({ SERVICE: 24, BLOG: 6 });
      // The total is the sum of what is shown, not pagesCrawled — that counts
      // every fetch, including redirects, errors and two spellings of one URL.
      // Reporting 44 above a breakdown adding to 30 is a visible contradiction.
      expect(coverage?.totalPages).toBe(30);
    });

    it('counts one page once however the site spells its own URL', async () => {
      // A site links itself both with and without www. and both with and
      // without a trailing slash. Four spellings of one page counted four
      // times is how a 16-page site was reported as having 92 pages.
      const { service } = buildWith({ id: 'j1', finishedAt: new Date(), pagesCrawled: 4, pageLimit: 300 }, [
        { url: 'https://acme.com/mango-pulp', pageType: 'PRODUCT' },
        { url: 'https://www.acme.com/mango-pulp', pageType: 'PRODUCT' },
        { url: 'https://acme.com/mango-pulp/', pageType: 'PRODUCT' },
        { url: 'http://www.acme.com/mango-pulp/', pageType: 'PRODUCT' },
      ]);

      expect((await service.getCoverage('org1', 'p1', 'comp1'))?.totalPages).toBe(1);
    });

    it('does not count files as pages', async () => {
      // The crawl that produced this had already been stored before the
      // crawler learned to skip files, and every read path trusted the table:
      // 76 of 92 rows were images and PDFs, so a 16-page site was reported as
      // 92 pages and the customer was shown "mangopulp-1.jpg" as a page they
      // were missing. Filtering on read is what repairs crawls already stored.
      const { service } = buildWith({ id: 'j1', finishedAt: new Date(), pagesCrawled: 92, pageLimit: 300 }, [
        { url: 'https://acme.com/mango-pulp', pageType: 'PRODUCT' },
        { url: 'https://acme.com/guava-pulp', pageType: 'PRODUCT' },
        { url: 'https://acme.com/wp-content/uploads/2026/03/mangopulp-1.jpg', pageType: 'OTHER' },
        { url: 'https://acme.com/wp-content/uploads/2026/03/Mangopulp-part-1.jpeg', pageType: 'OTHER' },
        { url: 'https://acme.com/wp-content/uploads/2025/03/FSSAI-New-License-2025.pdf', pageType: 'OTHER' },
        { url: 'https://acme.com/wp-content/uploads/2024/01/CONTAINER-LOADING-3.png', pageType: 'OTHER' },
      ]);

      const coverage = await service.getCoverage('org1', 'p1', 'comp1');

      expect(coverage?.totalPages).toBe(2);
      expect(coverage?.byType).toEqual({ PRODUCT: 2 });
    });

    it('flags a crawl that stopped at its ceiling', async () => {
      // A count from a truncated crawl is a floor, not a total. Reporting
      // "they have 300 pages" when the crawler simply stopped at 300 turns a
      // limit we chose into a fact about their site.
      const { service } = buildWith({ id: 'j1', finishedAt: new Date(), pagesCrawled: 300, pageLimit: 300 });
      expect((await service.getCoverage('org1', 'p1', 'comp1'))?.capped).toBe(true);

      const under = buildWith({ id: 'j1', finishedAt: new Date(), pagesCrawled: 42, pageLimit: 300 });
      expect((await under.service.getCoverage('org1', 'p1', 'comp1'))?.capped).toBe(false);

      const uncapped = buildWith({ id: 'j1', finishedAt: new Date(), pagesCrawled: 900, pageLimit: null });
      expect((await uncapped.service.getCoverage('org1', 'p1', 'comp1'))?.capped).toBe(false);
    });
  });
});

/**
 * The comparison is the product. A gap number that is wrong in either
 * direction sends someone off writing pages they already have, or leaves a
 * real gap invisible.
 */
describe('CompetitorCrawlService — comparison', () => {
  const build = (theirs: any, ours: any) => {
    const service = new CompetitorCrawlService({} as any, {} as any);
    (service as any).getCoverage = jest.fn().mockResolvedValue(theirs);
    (service as any).getOwnCoverage = jest.fn().mockResolvedValue(ours);
    return service;
  };

  it('reports where the competitor is ahead, largest gap first', async () => {
    const service = build(
      { byType: { SERVICE: 24, BLOG: 40, FAQ: 1 } },
      { byType: { SERVICE: 6, BLOG: 38, FAQ: 3 } },
    );

    const result = await service.getComparison('org1', 'p1', 'comp1');

    expect(result.behindOn.map((r) => [r.pageType, r.gap])).toEqual([
      ['SERVICE', 18],
      ['BLOG', 2],
    ]);
    // FAQ is excluded because we are ahead there, not behind.
    expect(result.behindOn.find((r) => r.pageType === 'FAQ')).toBeUndefined();
  });

  it('counts a kind they have and we have none of', async () => {
    // The most actionable gap of all, and the one an inner join would drop.
    const service = build({ byType: { LOCATION: 12 } }, { byType: {} });

    const result = await service.getComparison('org1', 'p1', 'comp1');

    expect(result.behindOn[0]).toMatchObject({ pageType: 'LOCATION', ours: 0, theirs: 12, gap: 12 });
  });

  it('will not invent a gap from a side nobody crawled', async () => {
    // Treating an uncrawled competitor as zero pages says "you are ahead
    // everywhere", which is a claim made from no data at all.
    const service = build(null, { byType: { SERVICE: 6 } });

    const result = await service.getComparison('org1', 'p1', 'comp1');

    expect(result.behindOn).toEqual([]);
    expect(result.rows.every((r) => r.gap === null && r.theirs === null)).toBe(true);
    expect(result.rows.find((r) => r.pageType === 'SERVICE')?.ours).toBe(6);
  });

  it('leaves legal boilerplate out of the comparison', async () => {
    // Every site has a privacy policy; a difference of one there is not an
    // opportunity, and listing it as one makes the whole list less credible.
    const service = build({ byType: { LEGAL: 5 } }, { byType: { LEGAL: 1 } });

    const result = await service.getComparison('org1', 'p1', 'comp1');

    expect(result.rows.find((r) => r.pageType === 'LEGAL')).toBeUndefined();
    expect(result.behindOn).toEqual([]);
  });

  it('leaves structural pages out for the same reason', async () => {
    // The gap list is headed "they publish more of these", so every row has to
    // be something worth publishing more of. On the real tracked competitor
    // this was the entire finding: they have four pages that type as ABOUT —
    // about us, infrastructure, our team, our clients — against the customer's
    // one, so the only row shown was "About pages: 3 more". Nobody's next move
    // is three more about pages, and a panel whose one finding is noise teaches
    // the reader to ignore the panel.
    //
    // getOpportunities already skipped these kinds. The two disagreeing is what
    // put the row on screen.
    const service = build(
      { byType: { ABOUT: 4, CONTACT: 2, HOME: 1, PRODUCT: 9 } },
      { byType: { ABOUT: 1, CONTACT: 1, HOME: 1, PRODUCT: 3 } },
    );

    const result = await service.getComparison('org1', 'p1', 'comp1');

    expect(result.behindOn.map((r) => r.pageType)).toEqual(['PRODUCT']);
    for (const structural of ['ABOUT', 'CONTACT', 'HOME']) {
      expect(result.rows.find((r) => r.pageType === structural)).toBeUndefined();
    }
  });
});

/**
 * The point of re-crawling a competitor is to see what they did since last
 * time. A change list that reports movement that did not happen is worse than
 * no change list — someone reacts to it.
 */
describe('CompetitorCrawlService — what changed since last crawl', () => {
  const build = (jobs: any[], pagesByJob: Record<string, any[]> = {}) => {
    const prisma = {
      competitorDomain: {
        findFirst: jest.fn().mockResolvedValue({ websiteId: 'w1', domain: 'acme.com' }),
      },
      crawlJob: { findMany: jest.fn().mockResolvedValue(jobs) },
      page: {
        findMany: jest.fn(async ({ where }: any) => pagesByJob[where.crawlJobId] ?? []),
      },
    };
    return { prisma, service: new CompetitorCrawlService(prisma as any, {} as any) };
  };

  const page = (url: string, pageType = 'SERVICE', title: string | null = null) => ({ url, pageType, title });

  it('says nothing after a single crawl', async () => {
    // Diffed against nothing, a first crawl reads as "they added 35 pages" —
    // announcing the site's whole existence as this week's news.
    const { service } = build([{ id: 'j2', finishedAt: new Date() }]);
    expect(await service.getChanges('org1', 'p1', 'comp1')).toBeNull();
  });

  it('reports pages added and removed between the last two crawls', async () => {
    const { service } = build(
      [
        { id: 'new', finishedAt: new Date('2026-08-27') },
        { id: 'old', finishedAt: new Date('2026-08-01') },
      ],
      {
        old: [page('https://acme.com/a'), page('https://acme.com/gone')],
        new: [page('https://acme.com/a'), page('https://acme.com/fresh', 'BLOG')],
      },
    );

    const changes = await service.getChanges('org1', 'p1', 'comp1');

    expect(changes?.added.map((p) => p.url)).toEqual(['https://acme.com/fresh']);
    expect(changes?.removed.map((p) => p.url)).toEqual(['https://acme.com/gone']);
    expect(changes?.byType).toEqual({ BLOG: { added: 1, removed: 0 }, SERVICE: { added: 0, removed: 1 } });
  });

  it('does not invent a change when a link spelling changed', async () => {
    // The single most likely false positive: the same page linked as www. in
    // one crawl and bare in the next would otherwise report one page removed
    // and a different one added, every crawl, forever.
    const { service } = build(
      [
        { id: 'new', finishedAt: new Date() },
        { id: 'old', finishedAt: new Date() },
      ],
      {
        old: [page('https://acme.com/about')],
        new: [page('https://www.acme.com/about/')],
      },
    );

    const changes = await service.getChanges('org1', 'p1', 'comp1');

    expect(changes?.added).toEqual([]);
    expect(changes?.removed).toEqual([]);
  });

  it('reports a retitled page as retitled, not as replaced', async () => {
    const { service } = build(
      [
        { id: 'new', finishedAt: new Date() },
        { id: 'old', finishedAt: new Date() },
      ],
      {
        old: [page('https://acme.com/a', 'SERVICE', 'Kitchen Fitting')],
        new: [page('https://acme.com/a', 'SERVICE', 'Kitchen Fitting in Mumbai')],
      },
    );

    const changes = await service.getChanges('org1', 'p1', 'comp1');

    expect(changes?.added).toEqual([]);
    expect(changes?.removed).toEqual([]);
    expect(changes?.retitled).toEqual([
      { url: 'https://acme.com/a', pageType: 'SERVICE', from: 'Kitchen Fitting', to: 'Kitchen Fitting in Mumbai' },
    ]);
  });

  it('does not report a retitle when a crawl simply captured no title', async () => {
    // A missing title is a fetch that did not parse, not an editorial change.
    const { service } = build(
      [
        { id: 'new', finishedAt: new Date() },
        { id: 'old', finishedAt: new Date() },
      ],
      {
        old: [page('https://acme.com/a', 'SERVICE', 'Kitchens')],
        new: [page('https://acme.com/a', 'SERVICE', null)],
      },
    );

    const changes = await service.getChanges('org1', 'p1', 'comp1');

    expect(changes?.retitled).toEqual([]);
    // Nor as the page having gone: it is in both crawls.
    expect(changes?.removed).toEqual([]);
  });
});

/**
 * The gap counts turned into a list of pages. This is the screen someone works
 * from, so a wrong row costs real time — either a page written that already
 * existed, or a gap never surfaced at all.
 */
describe('CompetitorCrawlService — opportunities', () => {
  const theirPages = [
    { url: 'https://acme.com/products/tomato-paste', title: 'Tomato Paste | Acme Foods', pageType: 'PRODUCT' },
    { url: 'https://acme.com/products/dragon-fruit-puree', title: 'Dragon Fruit Puree | Acme Foods', pageType: 'PRODUCT' },
    { url: 'https://acme.com/locations/nashik', title: 'Nashik Facility | Acme Foods', pageType: 'LOCATION' },
    { url: 'https://acme.com/privacy-policy', title: 'Privacy Policy | Acme Foods', pageType: 'LEGAL' },
    { url: 'https://acme.com/xyz', title: 'Acme Foods', pageType: 'OTHER' },
  ];
  const ourPages = [
    { url: 'https://aiva.com/products/tomato-paste', title: 'Tomato Paste | AIVA Enterprises', pageType: 'PRODUCT' },
    { url: 'https://aiva.com/products/mango-pulp', title: 'Mango Pulp | AIVA Enterprises', pageType: 'PRODUCT' },
    { url: 'https://aiva.com/about', title: 'About | AIVA Enterprises', pageType: 'ABOUT' },
    { url: 'https://aiva.com/contact', title: 'Contact | AIVA Enterprises', pageType: 'CONTACT' },
    { url: 'https://aiva.com/products/banana-pulp', title: 'Banana Pulp | AIVA Enterprises', pageType: 'PRODUCT' },
  ];

  const build = ({ theirJob = { id: 'tj' }, ourJob = { id: 'oj' } } = {}) => {
    const prisma = {
      competitorDomain: { findFirst: jest.fn().mockResolvedValue({ websiteId: 'w1', domain: 'acme.com' }) },
      crawlJob: {
        findFirst: jest.fn(async ({ where }: any) => (where.website?.projectId ? ourJob : theirJob)),
      },
      page: {
        findMany: jest.fn(async ({ where }: any) => (where.crawlJobId === 'tj' ? theirPages : ourPages)),
      },
    };
    return { prisma, service: new CompetitorCrawlService(prisma as any, {} as any) };
  };

  it('lists what they cover and we do not', async () => {
    const { service } = build();

    const result = await service.getOpportunities('org1', 'p1', 'comp1');

    const urls = result!.opportunities.map((o) => o.url);
    expect(urls).toContain('https://acme.com/products/dragon-fruit-puree');
    expect(urls).toContain('https://acme.com/locations/nashik');
  });

  it('does not list a page we already have under a different brand', async () => {
    // Both sides title their pages "<topic> | <brand>". Without each site's
    // own name removed the match scores 0.5 and this page — which we have —
    // would be listed as one to go and write.
    const { service } = build();

    const result = await service.getOpportunities('org1', 'p1', 'comp1');

    expect(result!.opportunities.map((o) => o.url)).not.toContain('https://acme.com/products/tomato-paste');
  });

  it('leaves out legal boilerplate', async () => {
    const { service } = build();

    const result = await service.getOpportunities('org1', 'p1', 'comp1');

    expect(result!.opportunities.map((o) => o.pageType)).not.toContain('LEGAL');
  });

  it('keeps a page whose kind is unknown but whose subject is not', async () => {
    // This assertion used to read `not.toContain('OTHER')`, which was wrong.
    // OTHER means the crawler could not work out the page's kind, not its
    // subject: the real competitor publishes /guava-pulp/ and /papaya-pulp/ as
    // flat URLs, so they type as OTHER while what they are about is obvious.
    // Excluding them dropped the eight product pages that are the most useful
    // thing on that site. Pages with genuinely no subject are excluded by the
    // distinctive-topic check instead.
    const { service } = build();

    const result = await service.getOpportunities('org1', 'p1', 'comp1');

    expect(result!.opportunities.map((o) => o.pageType)).toContain('OTHER');
  });

  it('shows the closest page we do have, so a near miss is visible', async () => {
    // Without this the list is a set of assertions the reader cannot check.
    const { service } = build();

    const result = await service.getOpportunities('org1', 'p1', 'comp1');
    const dragonFruit = result!.opportunities.find((o) => o.url.includes('dragon-fruit'));

    expect(dragonFruit!.closestOwnPage).not.toBeUndefined();
    if (dragonFruit!.closestOwnPage) {
      expect(dragonFruit!.closestOwnPage.score).toBeLessThan(1);
    }
  });

  it('says how the list was produced', async () => {
    // A list headed "gaps" with no stated basis is read as fact. It is a word
    // overlap heuristic and the payload has to carry that.
    const { service } = build();

    const result = await service.getOpportunities('org1', 'p1', 'comp1');

    expect(result!.basis).toMatch(/URL and title/i);
  });

  it('refuses to report anything when our own site has not been crawled', async () => {
    // Every page they have would qualify, which is not a finding about their
    // site — it is a report that we never looked at ours.
    const { service } = build({ ourJob: null as any });

    expect(await service.getOpportunities('org1', 'p1', 'comp1')).toBeNull();
  });

  it('can be narrowed to one page kind', async () => {
    const { service } = build();

    const result = await service.getOpportunities('org1', 'p1', 'comp1', { pageType: 'LOCATION' });

    expect(result!.opportunities.every((o) => o.pageType === 'LOCATION')).toBe(true);
    expect(result!.opportunities.length).toBe(1);
  });
});

/**
 * Both of these came out of running the real tracked competitor through the
 * pipeline rather than from a fixture, and neither was caught by the tests
 * written alongside the feature.
 */
describe('CompetitorCrawlService — opportunities, found against the real competitor', () => {
  const build = (theirPages: any[], ourPages: any[]) => {
    const prisma = {
      competitorDomain: { findFirst: jest.fn().mockResolvedValue({ websiteId: 'w1', domain: 'ifp.com' }) },
      crawlJob: { findFirst: jest.fn(async ({ where }: any) => (where.website?.projectId ? { id: 'oj' } : { id: 'tj' })) },
      page: { findMany: jest.fn(async ({ where }: any) => (where.crawlJobId === 'tj' ? theirPages : ourPages)) },
    };
    return new CompetitorCrawlService(prisma as any, {} as any);
  };

  const theirs = [
    { url: 'https://ifp.com/', title: 'Indian Fruits Pulp', pageType: 'HOME' },
    { url: 'https://ifp.com/about-us/', title: 'About Us | Indian Fruits Pulp', pageType: 'ABOUT' },
    { url: 'https://ifp.com/contact-us/', title: 'Contact Us | Indian Fruits Pulp', pageType: 'CONTACT' },
    { url: 'https://ifp.com/our-products/', title: 'Our Products | Indian Fruits Pulp', pageType: 'PRODUCT' },
    { url: 'https://ifp.com/guava-pulp/', title: 'Guava Pulp | Indian Fruits Pulp', pageType: 'PRODUCT' },
    { url: 'https://ifp.com/papaya-pulp/', title: 'Papaya Pulp | Indian Fruits Pulp', pageType: 'PRODUCT' },
  ];
  const ours = [
    { url: 'https://aiva.com/', title: 'AIVA Enterprises', pageType: 'HOME' },
    { url: 'https://aiva.com/about', title: 'About | AIVA Enterprises', pageType: 'ABOUT' },
    { url: 'https://aiva.com/contact', title: 'Contact | AIVA Enterprises', pageType: 'CONTACT' },
    { url: 'https://aiva.com/products/mango-pulp', title: 'Mango Pulp | AIVA Enterprises', pageType: 'PRODUCT' },
    { url: 'https://aiva.com/products/banana-pulp', title: 'Banana Pulp | AIVA Enterprises', pageType: 'PRODUCT' },
    { url: 'https://aiva.com/products/tomato-paste', title: 'Tomato Paste | AIVA Enterprises', pageType: 'PRODUCT' },
  ];

  it('does not tell the customer to write a home page', async () => {
    // Their front page has no topic beyond the company name, so nothing of
    // ours matched it, and it was listed as an opportunity. Every site has a
    // home page; suggesting one makes the real rows look less credible.
    const result = await build(theirs, ours).getOpportunities('org1', 'p1', 'comp1');

    expect(result!.opportunities.map((o) => o.url)).not.toContain('https://ifp.com/');
    expect(result!.opportunities.map((o) => o.pageType)).not.toContain('HOME');
  });

  it('leaves out about and contact pages too', async () => {
    const result = await build(theirs, ours).getOpportunities('org1', 'p1', 'comp1');

    const types = result!.opportunities.map((o) => o.pageType);
    expect(types).not.toContain('ABOUT');
    expect(types).not.toContain('CONTACT');
  });

  it('still finds the product topics we do not cover', async () => {
    const result = await build(theirs, ours).getOpportunities('org1', 'p1', 'comp1');

    const urls = result!.opportunities.map((o) => o.url);
    expect(urls).toContain('https://ifp.com/guava-pulp/');
    expect(urls).toContain('https://ifp.com/papaya-pulp/');
  });
});
