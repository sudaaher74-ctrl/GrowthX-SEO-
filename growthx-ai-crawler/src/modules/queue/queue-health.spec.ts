import { QueueService } from './queue.service';

/**
 * BullMQ keeps queue state, job payloads and locks in Redis. Under an LRU
 * eviction policy Redis may delete any of them to free memory, and the crawl
 * that owned them then never finishes. BullMQ logs "Eviction policy is
 * allkeys-lru. It should be noeviction" at boot, which is Render's default.
 */
describe('QueueService — Redis eviction policy', () => {
  const previous = process.env.REDIS_ENFORCE_NOEVICTION;
  afterEach(() => {
    if (previous === undefined) delete process.env.REDIS_ENFORCE_NOEVICTION;
    else process.env.REDIS_ENFORCE_NOEVICTION = previous;
  });

  function client(policy: string, setFails = false) {
    return {
      config: jest.fn(async (op: string) => {
        if (op === 'GET') return ['maxmemory-policy', policy];
        if (setFails) throw new Error("ERR unknown command 'CONFIG'");
        return 'OK';
      }),
    };
  }

  it('leaves a correctly configured server alone', async () => {
    const redis = client('noeviction');

    await expect(new QueueService().ensureNoEviction(redis as any)).resolves.toBe('ok');
    expect(redis.config).toHaveBeenCalledTimes(1);
  });

  it('switches an LRU policy to noeviction where the server allows it', async () => {
    const redis = client('allkeys-lru');

    await expect(new QueueService().ensureNoEviction(redis as any)).resolves.toBe('corrected');
    expect(redis.config).toHaveBeenCalledWith('SET', 'maxmemory-policy', 'noeviction');
  });

  it('reports rather than throws when a managed server refuses CONFIG SET', async () => {
    const redis = client('allkeys-lru', true);

    await expect(new QueueService().ensureNoEviction(redis as any)).resolves.toBe('wrong');
  });

  it('only reports when enforcement is switched off', async () => {
    process.env.REDIS_ENFORCE_NOEVICTION = 'false';
    const redis = client('volatile-lru');

    await expect(new QueueService().ensureNoEviction(redis as any)).resolves.toBe('wrong');
    expect(redis.config).not.toHaveBeenCalledWith('SET', expect.anything(), expect.anything());
  });

  it('carries on when the policy cannot even be read', async () => {
    const redis = { config: jest.fn().mockRejectedValue(new Error('NOPERM')) };

    await expect(new QueueService().ensureNoEviction(redis as any)).resolves.toBe('unknown');
  });
});

/**
 * The stall sweep asks this before failing a quiet crawl. A crawl whose work
 * is still in Redis is waiting its turn, after a restart or a wake from sleep,
 * and failing it would make the workers drop that work.
 */
describe('QueueService — whether a crawl still has queued work', () => {
  function service(opts: { startState?: string; pending?: number; pageCounts?: Record<string, number> }): any {
    const svc: any = new QueueService();
    svc.crawlJobsQueue = {
      getJob: jest.fn(async () => (opts.startState ? { getState: async () => opts.startState } : undefined)),
    };
    svc.pageFetchQueue = { getJobCounts: jest.fn(async () => opts.pageCounts ?? {}) };
    svc.getPendingTasks = jest.fn(async () => opts.pending ?? 0);
    return svc;
  }

  it('is true while the start-crawl job is still waiting for a worker', async () => {
    await expect(service({ startState: 'waiting' }).hasQueuedWork('j1')).resolves.toBe(true);
  });

  it('is true while the crawl has pages outstanding and the page queue is not empty', async () => {
    const svc = service({ startState: 'completed', pending: 12, pageCounts: { waiting: 30, active: 1 } });

    await expect(svc.hasQueuedWork('j1')).resolves.toBe(true);
  });

  it('is false when the crawl has pages outstanding but nothing is queued to do them', async () => {
    const svc = service({ startState: 'completed', pending: 12, pageCounts: { waiting: 0, active: 0, delayed: 0 } });

    await expect(svc.hasQueuedWork('j1')).resolves.toBe(false);
  });

  it('is false when the crawl has no pages outstanding', async () => {
    const svc = service({ startState: 'failed', pending: 0, pageCounts: { waiting: 30 } });

    await expect(svc.hasQueuedWork('j1')).resolves.toBe(false);
  });

  it('is false without Redis, leaving the sweep to decide', async () => {
    await expect(new QueueService().hasQueuedWork('j1')).resolves.toBe(false);
  });

  it('is false when Redis errors, rather than throwing into the sweep', async () => {
    const svc = service({});
    svc.crawlJobsQueue.getJob = jest.fn().mockRejectedValue(new Error('Connection is closed.'));

    await expect(svc.hasQueuedWork('j1')).resolves.toBe(false);
  });
});
