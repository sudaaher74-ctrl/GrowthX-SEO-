import { BrowserPoolService } from './browser-pool.service';

/**
 * Chromium's memory is the whole budget on a small instance, so the two things
 * that give it back are worth pinning: a browser that has served its quota is
 * relaunched, and an idle one is closed rather than held until the next crawl.
 *
 * Both assertions read the private handle deliberately. The observable effect
 * is resident memory, which a unit test cannot see; the browser handle being
 * dropped and a new one taking its place is the mechanism that produces it.
 */
describe('BrowserPoolService memory lifecycle', () => {
  const env = { ...process.env };
  let pool: BrowserPoolService | undefined;

  afterEach(async () => {
    await pool?.onModuleDestroy();
    pool = undefined;
    process.env = { ...env };
  });

  const browserOf = (p: BrowserPoolService) => (p as unknown as { browser?: unknown }).browser;

  it('relaunches Chromium once it has served its render quota', async () => {
    process.env.MAX_RENDERS_PER_BROWSER = '2';
    process.env.BROWSER_IDLE_SHUTDOWN_MS = '0';
    pool = new BrowserPoolService();

    await pool.withPage('test-agent', async () => undefined);
    const first = browserOf(pool);
    expect(first).toBeDefined();

    // The second render hits the quota, so the browser is dropped after it.
    await pool.withPage('test-agent', async () => undefined);
    expect(browserOf(pool)).toBeUndefined();

    // The next render brings a genuinely new browser up, not the old handle.
    await pool.withPage('test-agent', async () => undefined);
    const second = browserOf(pool);
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
  }, 60_000);

  it('closes an idle Chromium instead of holding it between crawls', async () => {
    process.env.MAX_RENDERS_PER_BROWSER = '999';
    process.env.BROWSER_IDLE_SHUTDOWN_MS = '50';
    pool = new BrowserPoolService();

    await pool.withPage('test-agent', async () => undefined);
    expect(browserOf(pool)).toBeDefined();

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(browserOf(pool)).toBeUndefined();
  }, 60_000);

  it('still renders after a recycle, so the saving costs no capability', async () => {
    process.env.MAX_RENDERS_PER_BROWSER = '1';
    process.env.BROWSER_IDLE_SHUTDOWN_MS = '0';
    pool = new BrowserPoolService();

    const titles: Array<string | undefined> = [];
    for (let i = 0; i < 3; i++) {
      const title = await pool.withPage('test-agent', async (page) => {
        await page.setContent(`<html><head><title>page ${i}</title></head><body>hi</body></html>`);
        return page.title();
      });
      titles.push(title);
    }

    expect(titles).toEqual(['page 0', 'page 1', 'page 2']);
  }, 90_000);
});
