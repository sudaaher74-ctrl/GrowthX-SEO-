import { QueueService } from './queue.service';

/**
 * A crawl finishes when its pending-task counter reaches zero, and BullMQ runs
 * a task more than once for two ordinary reasons: an attempt that throws is
 * retried, and an attempt whose lock lapses is declared stalled and run again
 * while the first is still going. Both reach the `finally` that decrements the
 * counter.
 *
 * Counting a re-run as separate work takes the counter one below the work
 * outstanding, so it hits zero with URLs still queued: the crawl is marked
 * COMPLETED and every remaining task is dropped by the check that refuses to
 * fetch for a finished crawl. That is how milquufresh.in — 29 URLs in its
 * sitemap — was audited as a six-page site.
 */
describe('QueueService — settling a page-fetch task', () => {
  function queue(): any {
    const service: any = new QueueService();
    // No Redis: the in-memory counters are the whole story, which is also the
    // shape the local fallback engine runs in.
    return service;
  }

  it('counts each task once, however many times it runs', async () => {
    const service = queue();
    await service.incrementPendingTasks('job1', 3);

    const first = await service.settlePageFetchTask('job1', 'task-a');
    const rerun = await service.settlePageFetchTask('job1', 'task-a');

    expect(first).toEqual({ remaining: 2, alreadySettled: false });
    expect(rerun).toEqual({ remaining: 2, alreadySettled: true });
  });

  it('only reaches zero once every distinct task has settled', async () => {
    const service = queue();
    await service.incrementPendingTasks('job1', 3);

    // The first task stalls and is run twice, then retried once more.
    await service.settlePageFetchTask('job1', 'task-a');
    await service.settlePageFetchTask('job1', 'task-a');
    await service.settlePageFetchTask('job1', 'task-a');
    expect(await service.getPendingTasks('job1')).toBe(2);

    await service.settlePageFetchTask('job1', 'task-b');
    const last = await service.settlePageFetchTask('job1', 'task-c');

    expect(last).toEqual({ remaining: 0, alreadySettled: false });
  });

  it('keeps the crawls apart', async () => {
    const service = queue();
    await service.incrementPendingTasks('job1', 1);
    await service.incrementPendingTasks('job2', 1);

    await service.settlePageFetchTask('job1', 'task-a');

    expect(await service.getPendingTasks('job2')).toBe(1);
  });

  /**
   * Tasks enqueued before this existed are still in Redis across a deploy.
   * They settle the old way — which is the behaviour being replaced, not a new
   * failure.
   */
  it('still settles a task that carries no id', async () => {
    const service = queue();
    await service.incrementPendingTasks('job1', 2);

    const first = await service.settlePageFetchTask('job1', undefined);

    expect(first).toEqual({ remaining: 1, alreadySettled: false });
  });

  it('gives every enqueued task an id to be settled by', async () => {
    const service = queue();
    const added: any[] = [];
    service.pageFetchQueue = { addBulk: async (jobs: any[]) => added.push(...jobs) };

    await service.bulkAddPageFetchTasks([
      { jobId: 'job1', websiteId: 'w', domain: 'd', targetUrl: 'https://example.test/a', depth: 0, maxDepth: 3, rateLimitDelayMs: 0 },
      { jobId: 'job1', websiteId: 'w', domain: 'd', targetUrl: 'https://example.test/b', depth: 0, maxDepth: 3, rateLimitDelayMs: 0 },
    ]);

    const ids = added.map((job) => job.data.taskId);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(2);
  });
});
