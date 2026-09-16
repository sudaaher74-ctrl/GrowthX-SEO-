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
