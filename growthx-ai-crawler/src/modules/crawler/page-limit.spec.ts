import { CrawlerService } from './crawler.service';

/**
 * A competitor is a third party who never asked to be crawled. Their bandwidth
 * is not ours to spend without a bound, and there was no bound anywhere in the
 * crawler before this: `maxDepth` limits how far a link chain is followed, not
 * how many pages a site has at that depth, so a large site meant an unbounded
 * crawl.
 *
 * The ceiling is enforced in `markUrlVisited` because that is the one point
 * every fetch passes through in both the Redis and the in-memory path. A cap
 * applied where work is enqueued would not hold — links are discovered while
 * the crawl runs.
 */
describe('CrawlerService — page ceiling', () => {
  const build = (redisClient: any) => {
    const queue = { getRedisClient: () => redisClient };
    const service: any = new (CrawlerService as any)({}, {}, queue, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});
    service.onModuleDestroy?.();
    return service;
  };

  describe('in memory, with no Redis', () => {
    it('stops claiming URLs once the ceiling is reached', async () => {
      const service = build(null);

      const claimed: string[] = [];
      for (let i = 0; i < 10; i++) {
        const skip = await service.markUrlVisited('job1', `https://acme.com/p${i}`, 3);
        if (!skip) claimed.push(`p${i}`);
      }

      expect(claimed).toEqual(['p0', 'p1', 'p2']);
    });

    it('does not bound a crawl that was given no ceiling', async () => {
      // A customer's own site is theirs to crawl in full; the ceiling exists
      // for sites that are not.
      const service = build(null);

      let claimed = 0;
      for (let i = 0; i < 50; i++) {
        if (!(await service.markUrlVisited('job1', `https://mine.com/p${i}`))) claimed++;
      }

      expect(claimed).toBe(50);
    });

    it('still skips a URL already seen', async () => {
      const service = build(null);

      expect(await service.markUrlVisited('job1', 'https://acme.com/a', 10)).toBe(false);
      expect(await service.markUrlVisited('job1', 'https://acme.com/a', 10)).toBe(true);
    });

    it('counts each job separately', async () => {
      // Two competitor crawls running at once must each get their own budget,
      // not share one.
      const service = build(null);

      expect(await service.markUrlVisited('job1', 'https://a.com/1', 1)).toBe(false);
      expect(await service.markUrlVisited('job1', 'https://a.com/2', 1)).toBe(true);
      expect(await service.markUrlVisited('job2', 'https://b.com/1', 1)).toBe(false);
    });
  });

  describe('with Redis', () => {
    const redis = () => {
      const sets = new Map<string, Set<string>>();
      return {
        sets,
        scard: jest.fn(async (key: string) => sets.get(key)?.size ?? 0),
        sadd: jest.fn(async (key: string, member: string) => {
          const set = sets.get(key) ?? new Set<string>();
          sets.set(key, set);
          if (set.has(member)) return 0;
          set.add(member);
          return 1;
        }),
        expire: jest.fn(async () => 1),
      };
    };

    it('stops claiming URLs once the ceiling is reached', async () => {
      const client = redis();
      const service = build(client);

      const claimed: string[] = [];
      for (let i = 0; i < 10; i++) {
        if (!(await service.markUrlVisited('job1', `https://acme.com/p${i}`, 3))) claimed.push(`p${i}`);
      }

      expect(claimed).toEqual(['p0', 'p1', 'p2']);
      expect(client.sets.get('job:job1:visited')?.size).toBe(3);
    });

    it('does not ask Redis for a count when there is no ceiling', async () => {
      // One extra round trip per page on every crawl of every customer site,
      // to enforce a limit that is not set.
      const client = redis();
      const service = build(client);

      await service.markUrlVisited('job1', 'https://mine.com/a');

      expect(client.scard).not.toHaveBeenCalled();
      expect(client.sadd).toHaveBeenCalled();
    });
  });
});

/**
 * A site links itself both ways: the footer uses example.com/about, the nav
 * uses www.example.com/about. Both were fetched and both were stored, so one
 * page became two rows and every page-kind count inflated with it — on the
 * first site crawled in production, 35 pages recorded as 44 rows.
 *
 * That is worse than a wasted fetch. How often a site links itself each way
 * varies per site, so the inflation varies too, and a competitor comparison
 * was subtracting two differently-wrong numbers.
 */
describe('CrawlerService — one page, however it is linked', () => {
  const build = () => {
    const service: any = new (CrawlerService as any)({}, {}, { getRedisClient: () => null }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {});
    service.onModuleDestroy?.();
    return service;
  };

  it('does not fetch the same page under both host spellings', async () => {
    const service = build();

    expect(await service.markUrlVisited('j', 'https://aivaenterprises.com/about')).toBe(false);
    expect(await service.markUrlVisited('j', 'https://www.aivaenterprises.com/about')).toBe(true);
  });

  it('treats http and https as the same page', async () => {
    const service = build();

    expect(await service.markUrlVisited('j', 'http://x.com/a')).toBe(false);
    expect(await service.markUrlVisited('j', 'https://x.com/a')).toBe(true);
  });

  it('keeps genuinely different pages apart', async () => {
    // Over-collapsing is the opposite failure and just as bad: a subdomain is
    // a different site, and a query string can be the whole page.
    const service = build();

    expect(await service.markUrlVisited('j', 'https://x.com/a')).toBe(false);
    expect(await service.markUrlVisited('j', 'https://x.com/b')).toBe(false);
    expect(await service.markUrlVisited('j', 'https://shop.x.com/a')).toBe(false);
    expect(await service.markUrlVisited('j', 'https://x.com/a?page=2')).toBe(false);
  });

  it('still fetches the URL the site actually published', async () => {
    // Only the deduplication key is canonicalised. Rewriting the request would
    // break every site that serves one spelling and redirects the other.
    const service = build();

    expect(service.visitKey('https://www.x.com/a')).toBe('x.com/a');
    expect(service.normalizeUrl('https://www.x.com/a')).toBe('https://www.x.com/a');
  });
});
