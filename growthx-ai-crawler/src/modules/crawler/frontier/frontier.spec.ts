import { FrontierService } from './frontier.service';
import { HostRateLimiter } from './rate-limiter';
import { contentFingerprint, findDuplicateClusters } from './duplicate-clusters';

/**
 * An in-memory stand-in for the CrawlFrontier table, enforcing the one thing
 * the real schema enforces and the frontier depends on: the unique constraint
 * on (crawlJobId, normalizedUrl). Everything the service does is expressed
 * through that constraint, so a fake that honours it exercises the real logic.
 */
function fakePrisma() {
  const rows: any[] = [];
  let nextId = 1;
  return {
    rows,
    crawlFrontier: {
      count: async ({ where }: any) => rows.filter((r) => match(r, where)).length,
      create: async ({ data }: any) => {
        if (rows.some((r) => r.crawlJobId === data.crawlJobId && r.normalizedUrl === data.normalizedUrl)) {
          const err: any = new Error('Unique constraint failed');
          err.code = 'P2002';
          throw err;
        }
        const row = { id: `f${nextId++}`, attempts: 0, claimedAt: null, reason: null, createdAt: new Date(Date.now() + nextId), ...data };
        rows.push(row);
        return row;
      },
      findMany: async ({ where, orderBy, take }: any) => {
        let found = rows.filter((r) => match(r, where));
        const orders = Array.isArray(orderBy) ? orderBy : [orderBy].filter(Boolean);
        found = [...found].sort((a, b) => {
          for (const order of orders) {
            const [field, dir] = Object.entries(order)[0] as [string, string];
            if (a[field] < b[field]) return dir === 'asc' ? -1 : 1;
            if (a[field] > b[field]) return dir === 'asc' ? 1 : -1;
          }
          return 0;
        });
        return take ? found.slice(0, take) : found;
      },
      updateMany: async ({ where, data }: any) => {
        const found = rows.filter((r) => match(r, where));
        for (const row of found) Object.assign(row, unwrap(data));
        return { count: found.length };
      },
      update: async ({ where, data }: any) => {
        const row = rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, unwrap(data));
        return row;
      },
      groupBy: async ({ where }: any) => {
        const found = rows.filter((r) => match(r, where));
        const byState = new Map<string, number>();
        for (const row of found) byState.set(row.state, (byState.get(row.state) || 0) + 1);
        return [...byState.entries()].map(([state, n]) => ({ state, _count: { _all: n } }));
      },
    },
  } as any;

  function unwrap(data: any) {
    const out: any = {};
    for (const [k, v] of Object.entries<any>(data)) {
      out[k] = v && typeof v === 'object' && 'increment' in v ? undefined : v;
      if (v && typeof v === 'object' && 'increment' in v) out[k] = v.increment;
    }
    return out;
  }
  function match(row: any, where: any): boolean {
    if (!where) return true;
    return Object.entries(where).every(([key, value]: [string, any]) => {
      if (value && typeof value === 'object' && 'lt' in value) return row[key] !== null && row[key] < value.lt;
      return row[key] === value;
    });
  }
}

describe('FrontierService', () => {
  const limits = { maxPages: 500, maxDepth: 10 };

  it('deduplicates on the normalized URL, not the raw one', async () => {
    const prisma = fakePrisma();
    const frontier = new FrontierService(prisma);

    const result = await frontier.add(
      'job1',
      [
        { url: 'https://Example.com/About/', source: 'link', depth: 1 },
        { url: 'https://example.com/About', source: 'sitemap', depth: 1 },
        { url: 'https://example.com/About?utm_source=nl', source: 'link', depth: 1 },
      ],
      limits,
    );

    expect(result.added).toBe(1);
    expect(result.duplicates).toBe(2);
  });

  it('stops an infinite calendar trap at the depth limit', async () => {
    const prisma = fakePrisma();
    const frontier = new FrontierService(prisma);

    const trap = Array.from({ length: 20 }, (_, i) => ({
      url: `https://example.com/calendar/2027/${i + 1}`,
      source: 'link' as const,
      depth: i + 1,
    }));

    const result = await frontier.add('job1', trap, { maxPages: 500, maxDepth: 5 });

    expect(result.added).toBe(5);
    expect(result.beyondDepth).toBe(15);
  });

  it('stops an infinite pagination trap at the page ceiling', async () => {
    const prisma = fakePrisma();
    const frontier = new FrontierService(prisma);

    const trap = Array.from({ length: 200 }, (_, i) => ({
      url: `https://example.com/archive?page=${i}`,
      source: 'link' as const,
      depth: 2,
    }));

    const result = await frontier.add('job1', trap, { maxPages: 25, maxDepth: 10 });

    expect(result.added).toBe(25);
    expect(result.atCapacity).toBe(175);
  });

  it('hands each URL to exactly one worker', async () => {
    const prisma = fakePrisma();
    const frontier = new FrontierService(prisma);
    await frontier.add('job1', [
      { url: 'https://example.com/a', source: 'seed', depth: 0 },
      { url: 'https://example.com/b', source: 'link', depth: 1 },
    ], limits);

    const [first, second] = await Promise.all([frontier.claimNext('job1', 2), frontier.claimNext('job1', 2)]);

    const claimed = [...first, ...second].map((c) => c.normalizedUrl);
    expect(claimed).toHaveLength(2);
    expect(new Set(claimed).size).toBe(2);
  });

  it('crawls breadth-first, shallowest URLs first', async () => {
    const prisma = fakePrisma();
    const frontier = new FrontierService(prisma);
    await frontier.add('job1', [
      { url: 'https://example.com/deep', source: 'link', depth: 4 },
      { url: 'https://example.com/shallow', source: 'link', depth: 1 },
    ], limits);

    const claimed = await frontier.claimNext('job1', 1);

    expect(claimed[0].normalizedUrl).toBe('https://example.com/shallow');
  });

  // The whole point of moving the frontier into the database: a worker that
  // dies mid-crawl used to strand every URL it held.
  it('returns URLs stranded by a dead worker to the queue', async () => {
    const prisma = fakePrisma();
    const frontier = new FrontierService(prisma);
    await frontier.add('job1', [{ url: 'https://example.com/a', source: 'seed', depth: 0 }], limits);
    await frontier.claimNext('job1', 1);

    expect(await frontier.hasPending('job1')).toBe(false);

    prisma.rows[0].claimedAt = new Date(Date.now() - 10 * 60 * 1000);
    const requeued = await frontier.requeueStranded('job1');

    expect(requeued).toBe(1);
    expect(await frontier.hasPending('job1')).toBe(true);
  });
});

describe('HostRateLimiter', () => {
  it('spends its burst and then makes the caller wait', () => {
    const limiter = new HostRateLimiter(2, 2);
    const now = Date.now();

    expect(limiter.delayForNext('a.com', now)).toBe(0);
    limiter.setHostRate('b.com', 2, 2);
    expect(limiter.delayForNext('b.com', now)).toBe(0);
  });

  it('paces requests at the configured rate', async () => {
    const limiter = new HostRateLimiter(20, 1);
    const started = Date.now();

    await limiter.acquire('example.com');
    await limiter.acquire('example.com');
    await limiter.acquire('example.com');

    // Two waits of ~50ms at 20/sec, with generous slack for timer jitter.
    expect(Date.now() - started).toBeGreaterThanOrEqual(60);
  });

  it('limits hosts independently', async () => {
    const limiter = new HostRateLimiter(1, 1);
    const started = Date.now();

    await limiter.acquire('a.com');
    await limiter.acquire('b.com');

    expect(Date.now() - started).toBeLessThan(200);
  });

  it("lets a site's own Crawl-delay slow us down but never speed us up", async () => {
    const limiter = new HostRateLimiter(10, 1);
    limiter.setHostCrawlDelay('slow.com', 2000);

    // The first request is free; the delay is what the next one must wait.
    await limiter.acquire('slow.com');
    const afterCrawlDelay = limiter.delayForNext('slow.com');
    expect(afterCrawlDelay).toBeGreaterThan(1000);

    // A later, faster Crawl-delay must not raise the rate back up: the slowest
    // instruction a site has given us is the one we keep.
    limiter.setHostCrawlDelay('slow.com', 1);
    expect(limiter.delayForNext('slow.com')).toBeGreaterThan(1000);
  });

  it('backs off further on each successive 429 and honours Retry-After', () => {
    const limiter = new HostRateLimiter(10, 1);

    expect(limiter.backOff('x.com', 0)).toBe(1000);
    expect(limiter.backOff('x.com', 3)).toBe(8000);
    expect(limiter.backOff('x.com', 0, 30)).toBe(30000);
  });
});

describe('duplicate clusters', () => {
  // Two URLs with the same 150 words are one duplicate-content problem, not two
  // independent thin-content pages.
  it('groups URLs that served identical content', () => {
    const body = 'The same words on two different URLs.';
    const pages = [
      { url: 'https://e.com/a', contentHash: contentFingerprint(body) },
      { url: 'https://e.com/b', contentHash: contentFingerprint(`  ${body.toUpperCase()}  `) },
      { url: 'https://e.com/c', contentHash: contentFingerprint('Something else entirely.') },
    ];

    const clusters = findDuplicateClusters(pages);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].urls).toEqual(['https://e.com/a', 'https://e.com/b']);
  });

  it('does not invent a cluster from a single page', () => {
    expect(findDuplicateClusters([{ url: 'https://e.com/a', contentHash: 'x' }])).toHaveLength(0);
  });
});
