import { BrowserPoolService } from './browser-pool.service';

/**
 * The render permit is a memory budget, not a fairness device.
 *
 * On a 512MB instance `MAX_RENDER_CONCURRENCY` is 1 because there is room for
 * exactly one Chromium page beside the app. Handing out two at once is not a
 * slowdown, it is the OOM kill that loses the whole crawl and reports nothing
 * but FAILED — and the crawl that dies that way is the one the customer is
 * waiting on.
 */
describe('BrowserPoolService — the render permit', () => {
  const OLD = { ...process.env };

  beforeEach(() => {
    process.env.MAX_RENDER_CONCURRENCY = '1';
  });
  afterEach(() => {
    process.env = { ...OLD };
  });

  function semaphoreOf(pool: BrowserPoolService): any {
    return (pool as any).semaphore;
  }

  /**
   * Releasing by decrementing and then waking a waiter leaves a window: the
   * waiter is resolved but its continuation has not run, so a caller arriving
   * in between sees a free slot and takes it — and then the waiter takes one
   * too. Ten page-fetch workers against one permit hit that window often.
   */
  it('never lets two callers hold the only permit', async () => {
    const semaphore = semaphoreOf(new BrowserPoolService());

    expect(await semaphore.acquire()).toBe(true);
    const waiting = semaphore.acquire();

    // The permit is handed to the waiter; the arrival below must not also get in.
    semaphore.release();
    const arrival = semaphore.acquire(20);

    expect(await waiting).toBe(true);
    expect(await arrival).toBe(false);
    expect(semaphore.active).toBe(1);
  });

  it('gives the permit to the next caller in line', async () => {
    const semaphore = semaphoreOf(new BrowserPoolService());

    await semaphore.acquire();
    const waiting = semaphore.acquire(1000);
    semaphore.release();

    expect(await waiting).toBe(true);
    expect(semaphore.active).toBe(1);
  });

  it('frees the permit when nobody is waiting', async () => {
    const semaphore = semaphoreOf(new BrowserPoolService());

    await semaphore.acquire();
    semaphore.release();

    expect(semaphore.active).toBe(0);
    expect(await semaphore.acquire(20)).toBe(true);
  });

  /**
   * A caller that gave up waiting must not leave the permit with nobody: that
   * leaks it for the life of the process, and every render after it blocks.
   */
  it('keeps the permit usable after a caller gives up waiting', async () => {
    const semaphore = semaphoreOf(new BrowserPoolService());

    await semaphore.acquire();
    expect(await semaphore.acquire(10)).toBe(false);
    semaphore.release();

    expect(await semaphore.acquire(20)).toBe(true);
  });
});
