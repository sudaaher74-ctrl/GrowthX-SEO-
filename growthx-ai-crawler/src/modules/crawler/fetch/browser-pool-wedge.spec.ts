import { BrowserPoolService } from './browser-pool.service';

/**
 * A render that never returns must not take the permit with it.
 *
 * On a small instance `MAX_RENDER_CONCURRENCY` is 1, so there is exactly one
 * permit and nothing else reclaims it. Playwright's own timeouts cover
 * navigation and selectors but not `newPage()`, and nothing covers a Chromium
 * that has stopped answering altogether — which is how a squeezed browser
 * fails: it neither crashes nor returns. The `finally` that releases the
 * permit is then never reached, and every later render blocks on `acquire()`
 * for the life of the process.
 *
 * Production showed exactly this: ten page-fetch workers pinned to `active`
 * with the queue behind them unmoving for twenty minutes, twice.
 */
describe('BrowserPoolService — a wedged browser', () => {
  const OLD = { ...process.env };

  beforeEach(() => {
    process.env.MAX_RENDER_CONCURRENCY = '1';
    process.env.RENDER_HARD_TIMEOUT_MS = '80';
  });
  afterEach(() => {
    process.env = { ...OLD };
    jest.restoreAllMocks();
  });

  /** A pool whose browser is present but never answers. */
  function poolWithHangingBrowser(): BrowserPoolService {
    const pool = new BrowserPoolService();
    const never = new Promise<never>(() => {});
    (pool as any).ensureContext = jest.fn(async () => ({ newPage: async () => never }));
    (pool as any).shutdownBrowser = jest.fn(async () => {});
    return pool;
  }

  it('gives up on a render that never returns rather than hanging', async () => {
    const pool = poolWithHangingBrowser();

    const result = await pool.withPage('ua', async () => 'never gets here');

    expect(result).toBeUndefined();
  });

  it('frees the permit, so the next render still runs', async () => {
    const pool = new BrowserPoolService();
    let call = 0;
    (pool as any).shutdownBrowser = jest.fn(async () => {});
    (pool as any).ensureContext = jest.fn(async () => ({
      newPage: async () => {
        call += 1;
        // The first render wedges; the second gets a working page.
        if (call === 1) return new Promise<never>(() => {});
        return { close: async () => {} };
      },
    }));

    const first = await pool.withPage('ua', async () => 'first');
    const second = await pool.withPage('ua', async () => 'second');

    expect(first).toBeUndefined();
    // Without the timeout this line is never reached: the await above blocks
    // on a permit the first render still holds.
    expect(second).toBe('second');
  });

  it('tears the browser down, so the next render does not pay the same timeout', async () => {
    const pool = poolWithHangingBrowser();

    await pool.withPage('ua', async () => 'x');

    expect((pool as any).shutdownBrowser).toHaveBeenCalled();
  });

  it('bounds the work itself, not just opening the page', async () => {
    const pool = new BrowserPoolService();
    (pool as any).shutdownBrowser = jest.fn(async () => {});
    (pool as any).ensureContext = jest.fn(async () => ({ newPage: async () => ({ close: async () => {} }) }));

    const result = await pool.withPage('ua', () => new Promise<never>(() => {}));

    expect(result).toBeUndefined();
  });

  /**
   * One wedged page must cost one page, not the rest of the crawl.
   *
   * The caller queued behind a wedged render used to hold a context it had
   * taken before the permit. The wedge tore that context down, the queued
   * caller opened its page on it anyway, and Playwright neither failed nor
   * returned: it ran out the timeout, was reported as a second wedge, and its
   * teardown took the relaunched browser with it. Production logged "stopped
   * responding while opening a page" every 75 seconds for a whole crawl.
   */
  it('does not hand the next render the context of the browser being torn down', async () => {
    const pool = new BrowserPoolService();
    let current: { closed: boolean; newPage: () => Promise<unknown> } | undefined;
    const launch = () => {
      const context = {
        closed: false,
        // What Playwright does with a page opened on a closing context.
        newPage: async () => (context.closed ? new Promise<never>(() => {}) : { close: async () => {} }),
      };
      return context;
    };
    (pool as any).ensureContext = jest.fn(async () => (current ??= launch()));
    (pool as any).shutdownBrowser = jest.fn(async () => {
      if (current) current.closed = true;
      current = undefined;
    });

    const wedged = pool.withPage('ua', () => new Promise<never>(() => {}));
    const queued = pool.withPage('ua', async () => 'queued');

    expect(await wedged).toBeUndefined();
    expect(await queued).toBe('queued');
    expect((pool as any).shutdownBrowser).toHaveBeenCalledTimes(1);
  });

  /**
   * The wedged render's permit is held until its browser is closed, so a
   * close that never finishes must not hold it forever either.
   */
  it('gives up on a browser that will not close, so the next render still runs', async () => {
    const pool = new BrowserPoolService();
    const never = () => new Promise<never>(() => {});
    const hung = { newPage: async () => ({ close: never }), close: never };
    (pool as any).context = hung;
    (pool as any).browser = { close: never };
    (pool as any).ensureContext = jest.fn(async () => (pool as any).context ?? { newPage: async () => ({ close: async () => {} }) });

    const wedged = await pool.withPage('ua', () => new Promise<never>(() => {}));
    const next = await pool.withPage('ua', async () => 'next');

    expect(wedged).toBeUndefined();
    expect(next).toBe('next');
  });

  /** A real error is a different thing from silence and must still surface. */
  it('still propagates an ordinary render error', async () => {
    const pool = new BrowserPoolService();
    (pool as any).shutdownBrowser = jest.fn(async () => {});
    (pool as any).ensureContext = jest.fn(async () => ({ newPage: async () => ({ close: async () => {} }) }));

    await expect(
      pool.withPage('ua', async () => {
        throw new Error('net::ERR_NAME_NOT_RESOLVED');
      }),
    ).rejects.toThrow('ERR_NAME_NOT_RESOLVED');
  });
});

/**
 * A page that cannot get a render slot must give up, not queue behind the
 * whole crawl.
 *
 * The page-fetch worker runs ten at a time against one render permit, so nine
 * callers wait. A caller waiting here is a BullMQ job holding its lock and
 * doing nothing; past the lock duration BullMQ runs it again, and the crawl's
 * pending-task counter -- decremented in a `finally` -- is decremented twice.
 * The counter hits zero with the site still queued and the crawl is marked
 * complete: a 29-page site reported as 5 pages, "completed in 4 minutes".
 */
describe('BrowserPoolService — contention for the render slot', () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    process.env.MAX_RENDER_CONCURRENCY = '1';
    process.env.RENDER_WAIT_TIMEOUT_MS = '60';
    process.env.RENDER_HARD_TIMEOUT_MS = '5000';
  });
  afterEach(() => { process.env = { ...OLD }; });

  function pool() {
    const p = new BrowserPoolService();
    (p as any).shutdownBrowser = jest.fn(async () => {});
    (p as any).ensureContext = jest.fn(async () => ({ newPage: async () => ({ close: async () => {} }) }));
    return p;
  }

  it('gives up rather than waiting behind a long render', async () => {
    const p = pool();
    let releaseFirst!: () => void;
    const first = p.withPage('ua', () => new Promise<string>((r) => { releaseFirst = () => r('first'); }));

    // Second caller finds the only permit taken and must not block on it.
    const second = await p.withPage('ua', async () => 'second');
    expect(second).toBeUndefined();

    releaseFirst();
    await first;
  });

  it('serves the next page normally once the slot frees up', async () => {
    const p = pool();

    expect(await p.withPage('ua', async () => 'one')).toBe('one');
    expect(await p.withPage('ua', async () => 'two')).toBe('two');
  });

  /** An abandoned waiter left in the queue would leak the permit forever. */
  it('does not leak the permit when a waiter gives up', async () => {
    const p = pool();
    let releaseFirst!: () => void;
    const first = p.withPage('ua', () => new Promise<string>((r) => { releaseFirst = () => r('first'); }));

    await p.withPage('ua', async () => 'gives up');
    releaseFirst();
    await first;

    // If the abandoned waiter still held a slot, this would never resolve.
    expect(await p.withPage('ua', async () => 'after')).toBe('after');
  });
});
