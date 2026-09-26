import { UrlInventoryService } from './url-inventory.service';

/**
 * The queue delivers a task more than once — a retry, a lapsed lock, or the
 * same URL discovered again through a second source. The crawler answers the
 * repeat with `duplicate`, and that must never rewrite the row of a page it has
 * already fetched.
 *
 * Caught by a real crawl of milquufresh.in, which finished with 31 pages on
 * disk and only 25 URLs the inventory would admit to having crawled: six pages
 * with a 200, a Page row and a crawledAt were all labelled "not crawled:
 * duplicate", because a second task for each arrived after they were fetched.
 */
describe('UrlInventoryService.markExcluded', () => {
  function serviceWith(updateMany: jest.Mock) {
    return new UrlInventoryService({ crawlFrontier: { updateMany } } as never);
  }

  it('refuses to mark an already-crawled URL as excluded', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    await serviceWith(updateMany).markExcluded('job1', 'https://milquufresh.in/products', 'duplicate');

    // The guard is in the WHERE clause, so the database settles it rather than
    // a read-then-write that another worker can race.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { crawlJobId: 'job1', normalizedUrl: 'https://milquufresh.in/products', crawledAt: null },
      }),
    );
  });

  it('still excludes a URL that was never fetched', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    await serviceWith(updateMany).markExcluded('job1', 'https://milquufresh.in/admin', 'robots_blocked', {
      robotsAllowed: false,
    });

    const call = updateMany.mock.calls[0][0];
    expect(call.where.crawledAt).toBeNull();
    expect(call.data.reason).toBe('robots_blocked');
    expect(call.data.state).toBe('SKIPPED');
  });

  it('routes a fetch failure to FAILED and an exclusion to SKIPPED', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = serviceWith(updateMany);

    for (const [reason, state] of [
      ['timeout', 'FAILED'],
      ['fetch_failed', 'FAILED'],
      ['crawl_error', 'FAILED'],
      ['robots_blocked', 'SKIPPED'],
      ['duplicate', 'SKIPPED'],
      ['crawl_budget_exceeded', 'SKIPPED'],
      ['queue_failed', 'SKIPPED'],
    ] as const) {
      updateMany.mockClear();
      await service.markExcluded('job1', 'https://s.in/x', reason);
      expect(updateMany.mock.calls[0][0].data.state).toBe(state);
    }
  });

  it('clears the reason when a URL is crawled, so a crawled row carries none', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    await serviceWith(updateMany).markCrawled('job1', 'https://s.in/a', { httpStatus: 200, indexability: 'INDEXABLE' });

    const call = updateMany.mock.calls[0][0];
    expect(call.data.state).toBe('DONE');
    expect(call.data.reason).toBeNull();
    expect(call.data.crawledAt).toBeInstanceOf(Date);
  });
});

/**
 * Recording what a page links to. Nearly every link is to a URL already known
 * (every page repeats the navigation), so the batch must not be written as one
 * insert per link, each failing on the unique constraint and logging a
 * prisma:error — which on a small instance starved the health check.
 */
describe('UrlInventoryService.record', () => {
  function harness(existing: string[]) {
    const createMany = jest.fn(async ({ data }: any) => ({
      count: data.filter((row: any) => !existing.includes(row.normalizedUrl)).length,
    }));
    const create = jest.fn();
    const executeRaw = jest.fn().mockResolvedValue(0);
    const prisma = { crawlFrontier: { createMany, create }, $executeRaw: executeRaw };
    return { service: new UrlInventoryService(prisma as never), createMany, create, executeRaw };
  }

  it('writes the batch in one statement that skips known URLs', async () => {
    const { service, createMany, create } = harness(['https://example.com/about']);

    const result = await service.record('job1', [
      { url: 'https://example.com/about', source: 'link' },
      { url: 'https://example.com/new', source: 'link' },
      { url: 'https://example.com/new', source: 'sitemap' },
      { url: 'http://[bad', source: 'link' },
    ]);

    expect(result).toEqual({ added: 1, merged: 2, invalid: 1 });
    expect(create).not.toHaveBeenCalled();
    expect(createMany).toHaveBeenCalledTimes(1);
    const call = createMany.mock.calls[0][0];
    expect(call.skipDuplicates).toBe(true);
    // One row per URL, from its first sighting.
    expect(call.data.map((row: any) => [row.normalizedUrl, row.sources])).toEqual([
      ['https://example.com/about', ['link']],
      ['https://example.com/new', ['link']],
    ]);
  });

  it('credits every source that found a URL, once per source', async () => {
    const { service, executeRaw } = harness(['https://example.com/about']);

    await service.record('job1', [
      { url: 'https://example.com/about', source: 'link' },
      { url: 'https://example.com/about', source: 'sitemap' },
    ]);

    const sources = executeRaw.mock.calls.map((call: any[]) => call.slice(1)).map((values: any[]) => values[0]);
    expect(sources.sort()).toEqual(['link', 'sitemap']);
  });
});
