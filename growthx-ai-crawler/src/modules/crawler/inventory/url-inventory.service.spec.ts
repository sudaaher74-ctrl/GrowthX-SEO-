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
