const workerInstances: any[] = [];
jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation((name: string) => {
    const instance = { name, on: jest.fn(), close: jest.fn().mockResolvedValue(undefined) };
    workerInstances.push(instance);
    return instance;
  }),
}));

import { CrawlerProcessor } from './crawler.processor';

/**
 * The queue connects asynchronously and nothing orders it against this
 * processor — QueueModule is `@Global()`, so no import edge exists. Reading the
 * Redis client before that settles is what left crawls enqueued with no
 * consumer, sitting at PENDING with the row never touched.
 */
describe('CrawlerProcessor — worker startup', () => {
  beforeEach(() => {
    workerInstances.length = 0;
    jest.clearAllMocks();
  });

  /** A queue whose client only appears once `ready` has resolved. */
  function slowQueue(client: unknown) {
    let release!: () => void;
    const ready = new Promise<void>((r) => (release = r));
    let settled = false;
    return {
      ready,
      finish: () => {
        settled = true;
        release();
      },
      getRedisClient: () => (settled ? client : undefined),
    };
  }

  it('starts workers on a connection that only becomes available after ready', async () => {
    const queue = slowQueue({ host: 'redis' });
    const processor = new CrawlerProcessor(queue as any, {} as any);

    const started = processor.onModuleInit();
    // Reading the client at this instant is what the old code did.
    expect(queue.getRedisClient()).toBeUndefined();

    queue.finish();
    await started;

    expect(workerInstances.map((w) => w.name).sort()).toEqual(['crawl-jobs', 'page-fetch']);
  });

  it('starts no workers when Redis never becomes available, leaving the synchronous fallback to run', async () => {
    const queue = slowQueue(undefined);
    const processor = new CrawlerProcessor(queue as any, {} as any);

    const started = processor.onModuleInit();
    queue.finish();
    await started;

    expect(workerInstances).toHaveLength(0);
  });

  it('waits rather than deciding early', async () => {
    const queue = slowQueue({ host: 'redis' });
    const processor = new CrawlerProcessor(queue as any, {} as any);

    const started = processor.onModuleInit();
    await Promise.resolve(); // let any un-awaited path run to completion
    expect(workerInstances).toHaveLength(0);

    queue.finish();
    await started;
    expect(workerInstances).toHaveLength(2);
  });
});
