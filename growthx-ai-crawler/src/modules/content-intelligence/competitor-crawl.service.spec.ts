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
    // Counts come back from $queryRaw, which deduplicates a page linked both
    // with and without www. bigint is what the driver actually returns for a
    // count, so the mock returns it too — Number() on a bigint is the bug this
    // would otherwise hide.
    const buildWith = (job: any, counts: Record<string, number> = {}) => {
      const prisma = {
        competitorDomain: {
          findFirst: jest.fn().mockResolvedValue({ id: 'comp1', domain: 'acme.com', websiteId: 'w1' }),
        },
        crawlJob: { findFirst: jest.fn().mockResolvedValue(job) },
        $queryRaw: jest
          .fn()
          .mockResolvedValue(Object.entries(counts).map(([pageType, n]) => ({ pageType, n: BigInt(n) }))),
      };
      return { prisma, service: new CompetitorCrawlService(prisma as any, {} as any) };
    };

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
      const { service } = buildWith(
        { id: 'j1', finishedAt: new Date('2026-08-27'), pagesCrawled: 44, pageLimit: 300 },
        { SERVICE: 24, BLOG: 6 },
      );

      const coverage = await service.getCoverage('org1', 'p1', 'comp1');

      expect(coverage?.byType).toEqual({ SERVICE: 24, BLOG: 6 });
      // The total is the sum of what is shown, not pagesCrawled — that counts
      // every fetch, including redirects, errors and two spellings of one URL.
      // Reporting 44 above a breakdown adding to 30 is a visible contradiction.
      expect(coverage?.totalPages).toBe(30);
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
});
