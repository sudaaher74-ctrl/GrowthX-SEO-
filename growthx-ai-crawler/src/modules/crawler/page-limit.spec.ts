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
