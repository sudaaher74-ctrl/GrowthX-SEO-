import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { renderBudget } from './memory-budget';

/** Caps concurrent renders. Chromium pages are the expensive resource here. */
class Semaphore {
  private inFlight = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly max: number) {}

  /**
   * Takes a permit, or gives up waiting.
   *
   * Waiting without a bound is what turned a slow render into a stalled job.
   * The page-fetch worker runs ten at a time and there is one render permit on
   * a small instance, so nine callers queue here — and a caller blocked here
   * is a BullMQ job holding its lock while doing nothing. Past the lock
   * duration BullMQ calls it stalled and runs it again, and because the
   * pending-task counter is decremented in a `finally`, the second run
   * decrements it a second time. The counter reaches zero while most of the
   * site is still queued, the crawl is marked complete, and a 29-page site is
   * reported as 5 pages.
   *
   * Returning false instead lets the caller record the page from its static
   * response and move on, which is a worse page but a correct crawl.
   */
  async acquire(timeoutMs?: number): Promise<boolean> {
    if (this.inFlight < this.max) {
      this.inFlight++;
      return true;
    }
    if (!timeoutMs) {
      await new Promise<void>((resolve) => this.waiting.push(resolve));
      this.inFlight++;
      return true;
    }

    let waiter!: () => void;
    const granted = await new Promise<boolean>((resolve) => {
      waiter = () => resolve(true);
      this.waiting.push(waiter);
      const timer = setTimeout(() => resolve(false), timeoutMs);
      timer.unref?.();
    });

    if (!granted) {
      // Drop the abandoned waiter so a later release does not hand a permit to
      // nobody, which would leak the permit for the life of the process.
      const index = this.waiting.indexOf(waiter);
      if (index >= 0) this.waiting.splice(index, 1);
      return false;
    }

    this.inFlight++;
    return true;
  }

  release(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const next = this.waiting.shift();
    if (next) next();
  }

  /** Renders currently running. Recycling is only safe when this is zero. */
  get active(): number {
    return this.inFlight;
  }
}

/** A Chromium that stopped answering, as opposed to one that returned an error. */
class RenderTimeoutError extends Error {
  constructor(readonly phase: string) {
    super(`Chromium did not respond while ${phase}.`);
  }
}

export const DEFAULT_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * One warm Chromium per process, reused across every render.
 *
 * Launching per URL costs roughly a second and 250 MB each time, which on a
 * 500-page crawl is the difference between a render budget that is affordable
 * and one that is not.
 *
 * Launch failure is reported, not swallowed. The old fetcher returned `false`
 * when Chromium would not start and let the caller quietly analyse the
 * unrendered shell, so a site whose content is entirely client-rendered scored
 * zero words with no indication that rendering had been skipped. Here the
 * caller is told, and records it.
 */
@Injectable()
export class BrowserPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(BrowserPoolService.name);
  private browser?: Browser;
  private context?: BrowserContext;
  private launching?: Promise<BrowserContext | undefined>;
  private readonly semaphore: Semaphore;

  /** Set once a launch has failed, so we do not pay the timeout on every page. */
  private launchFailure?: string;

  /** Renders served by the browser currently running. Reset on every launch. */
  private rendersSinceLaunch = 0;
  private idleTimer?: NodeJS.Timeout;
  private closing?: Promise<void>;

  /**
   * Chromium leaks steadily: a renderer process that has served a few dozen
   * pages holds noticeably more than a fresh one, and no amount of closing
   * pages gives it back. Relaunching on a page count is the standard remedy.
   */
  private readonly maxRendersPerBrowser = Math.max(1, Number(process.env.MAX_RENDERS_PER_BROWSER || 40));

  /**
   * A crawl is bursty: minutes of rendering, then hours of nothing. Holding a
   * warm Chromium through the idle stretch costs ~250MB of a 512MB container
   * for no benefit, and it is what leaves the API one allocation away from the
   * OOM killer while it is doing nothing at all. Zero disables the idle close.
   */
  private readonly idleShutdownMs = Number(process.env.BROWSER_IDLE_SHUTDOWN_MS ?? 90_000);

  /**
   * The wall-clock ceiling on one render, after which the browser is presumed
   * wedged rather than slow.
   *
   * Comfortably above the sum of the navigation and settle budgets a caller
   * sets (20s navigation, 6s network idle, 3s settle, plus one retry), so a
   * genuinely slow page finishes normally and only a browser that has stopped
   * answering trips it.
   */
  private readonly renderHardTimeoutMs = Number(process.env.RENDER_HARD_TIMEOUT_MS ?? 75_000);

  /**
   * How long a page waits for a free render slot before giving up on the
   * rendered tier.
   *
   * Sized so a page can wait out one render in front of it but not a whole
   * queue of them. Giving up costs this page its JavaScript content, which is
   * recorded as RENDER_UNAVAILABLE; waiting costs the crawl its page count.
   */
  private readonly renderWaitTimeoutMs = Number(process.env.RENDER_WAIT_TIMEOUT_MS ?? 90_000);

  constructor() {
    const max = Number(process.env.MAX_RENDER_CONCURRENCY || process.env.MAX_PLAYWRIGHT_CONCURRENCY || 3);
    this.semaphore = new Semaphore(Math.max(1, max));
  }

  /**
   * Why the last launch was declined for want of memory, and when to look
   * again. Separate from `launchFailure` because this one can come right.
   */
  private budgetRefusal?: string;
  private budgetRecheckAt = 0;
  private readonly budgetCooldownMs = Number(process.env.RENDER_BUDGET_RECHECK_MS ?? 60_000);

  /** The reason the browser is unavailable, or undefined if it is fine. */
  get unavailableReason(): string | undefined {
    return this.launchFailure ?? this.budgetRefusal;
  }

  private async ensureContext(userAgent: string): Promise<BrowserContext | undefined> {
    // A close already in flight must finish before a relaunch is attempted, or
    // the two race and leave a live browser with no reference to it.
    if (this.closing) await this.closing.catch(() => {});
    if (this.context && this.browser?.isConnected()) return this.context;
    if (this.launchFailure) return undefined;
    if (this.launching) return this.launching;
    if (this.budgetRefusal && Date.now() < this.budgetRecheckAt) return undefined;

    // Checked before every launch, not once at startup: the browser is closed
    // and relaunched as a crawl progresses, and the memory available to the
    // next launch is not the memory that was available to the first.
    //
    // Launching into insufficient memory does not fail, it gets the container
    // killed, which loses the crawl and every page it had already recorded.
    // Declining to launch costs only the rendered tier, and the caller records
    // RENDER_UNAVAILABLE so the report states what was not assessed.
    // Not recorded as a launch failure: that flag is permanent for the life of
    // the process, which is right for a missing executable and wrong for
    // memory. A crawl that finishes, or the idle close giving Chromium back,
    // changes the answer. The refusal is held for a cooldown instead, so the
    // check is neither permanent nor repeated on every page of a large crawl.
    const budget = renderBudget();
    if (!budget.allowed) {
      this.budgetRefusal = budget.reason;
      this.budgetRecheckAt = Date.now() + this.budgetCooldownMs;
      this.logger.warn(`Chromium was not launched: ${budget.reason}`);
      return undefined;
    }
    this.budgetRefusal = undefined;

    this.rendersSinceLaunch = 0;

    this.launching = (async () => {
      try {
        this.browser = await chromium.launch({
          headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
          // Set only where the runtime needs it (a sandbox with an egress
          // proxy, say). Unset in production, so nothing is routed anywhere
          // the operator did not ask for.
          ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}),
          ...(process.env.PLAYWRIGHT_PROXY_SERVER ? { proxy: { server: process.env.PLAYWRIGHT_PROXY_SERVER } } : {}),
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            // /dev/shm is 64MB in a default container, which Chromium exhausts
            // and then crashes on rather than degrading.
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            // Footprint, not speed. The smallest deployment target is a 512MB
            // container already running a 300MB Node heap, so a default
            // Chromium does not fit beside it. Each of these removes a
            // subsystem a crawler never uses.
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-sync',
            '--disable-translate',
            '--no-first-run',
            '--no-default-browser-check',
            '--mute-audio',
            // One renderer, not one per tab. Render concurrency is already 1,
            // so a second renderer process only ever arrives from a page
            // opening another, and on a 512MB instance that is the allocation
            // that does not fit. Distinct from --single-process, which is
            // rejected below for a different reason.
            '--renderer-process-limit=1',
            `--js-flags=--max-old-space-size=${process.env.RENDER_JS_HEAP_MB || 128}`,
            // Deliberately NOT --single-process. It saves memory and it also
            // makes a slow page wedge the whole browser rather than one tab,
            // which is how renders came back as empty shells under load.
            ...(process.env.CHROMIUM_EXTRA_ARGS ? process.env.CHROMIUM_EXTRA_ARGS.split(' ').filter(Boolean) : []),
          ],
        });

        this.browser.on('disconnected', () => {
          this.logger.warn('Chromium disconnected; the next render will relaunch it.');
          this.context = undefined;
          this.browser = undefined;
        });

        this.context = await this.browser.newContext({
          userAgent,
          viewport: { width: 1366, height: 900 },
          ignoreHTTPSErrors: true,
          javaScriptEnabled: true,
        });
        return this.context;
      } catch (err) {
        this.launchFailure = (err as Error).message;
        this.logger.error(`Chromium could not be launched: ${this.launchFailure}. Pages needing JavaScript cannot be rendered.`);
        return undefined;
      } finally {
        this.launching = undefined;
      }
    })();

    return this.launching;
  }

  /**
   * Runs `work` on a fresh page in the shared context.
   *
   * Returns undefined only when the browser itself is unavailable, which the
   * caller must record rather than treat as "the page had no content".
   */
  async withPage<T>(userAgent: string, work: (page: Page) => Promise<T>): Promise<T | undefined> {
    const context = await this.ensureContext(userAgent);
    if (!context) return undefined;

    if (this.idleTimer) clearTimeout(this.idleTimer);

    // Bounded, for the reason on `acquire`: a caller blocked here is a queue
    // job holding its lock and doing nothing, and past the lock duration that
    // job is re-run and the crawl's pending counter is decremented twice.
    if (!(await this.semaphore.acquire(this.renderWaitTimeoutMs))) {
      this.logger.warn('Waited too long for a render slot; reading this page without JavaScript.');
      return undefined;
    }

    let page: Page | undefined;
    let wedged = false;
    try {
      // Bounded, because the permit taken above is the only one on a small
      // instance and nothing else reclaims it.
      //
      // Playwright's own timeouts cover navigation and selectors, and every
      // caller sets them. They do not cover `newPage()`, and they do not cover
      // a Chromium that has stopped answering at all — which is what a browser
      // does when it is squeezed rather than killed: it neither crashes nor
      // returns, so `work` never settles, the `finally` never runs, and the
      // permit is held for the life of the process. Every subsequent render
      // then blocks on `acquire()` forever. Production showed exactly that:
      // ten page-fetch workers pinned to `active` with the queue behind them
      // unmoving for twenty minutes.
      page = await this.bounded(context.newPage(), 'opening a page');
      return await this.bounded(work(page), 'rendering a page');
    } catch (err) {
      wedged = err instanceof RenderTimeoutError;
      if (wedged) this.logger.error(`Chromium stopped responding while ${(err as RenderTimeoutError).phase}; recycling it.`);
      else throw err;
      return undefined;
    } finally {
      // A page belonging to a browser that has stopped answering will not
      // close either, so it is not waited on.
      if (page && !wedged) await page.close().catch(() => {});
      this.rendersSinceLaunch++;
      this.semaphore.release();
      // A browser that failed to answer once is not trusted again: it is torn
      // down here so the next render starts a fresh one, rather than every
      // later render paying the same timeout.
      if (wedged) await this.shutdownBrowser().catch(() => {});
      else await this.recycleIfSpent();
      this.scheduleIdleShutdown();
    }
  }

  /**
   * Rejects with RenderTimeoutError if `promise` has not settled in time.
   *
   * The underlying operation is abandoned rather than cancelled — there is no
   * way to cancel a wedged CDP call — which is why the caller tears the
   * browser down afterwards instead of reusing it.
   */
  private bounded<T>(promise: Promise<T>, phase: string): Promise<T> {
    const ms = this.renderHardTimeoutMs;
    let timer: NodeJS.Timeout;
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RenderTimeoutError(phase)), ms);
        timer.unref?.();
      }),
    ]).finally(() => clearTimeout(timer!)) as Promise<T>;
  }

  /** Relaunches a browser that has served its quota, once nothing is running. */
  private async recycleIfSpent(): Promise<void> {
    if (this.semaphore.active > 0) return;
    if (this.rendersSinceLaunch < this.maxRendersPerBrowser) return;
    this.logger.log(`Recycling Chromium after ${this.rendersSinceLaunch} renders to give its leaked memory back.`);
    await this.shutdownBrowser();
  }

  /** Gives Chromium's memory back while no crawl is running. */
  private scheduleIdleShutdown(): void {
    if (this.idleShutdownMs <= 0) return;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.semaphore.active > 0) return;
      this.logger.log(`Closing idle Chromium after ${this.idleShutdownMs}ms with no renders.`);
      void this.shutdownBrowser();
    }, this.idleShutdownMs);
    // Never hold the event loop open on account of the idle timer.
    this.idleTimer.unref?.();
  }

  private async shutdownBrowser(): Promise<void> {
    if (this.closing) return this.closing;
    const context = this.context;
    const browser = this.browser;
    this.context = undefined;
    this.browser = undefined;
    this.rendersSinceLaunch = 0;
    this.closing = (async () => {
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
    })().finally(() => {
      this.closing = undefined;
    });
    return this.closing;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    await this.shutdownBrowser();
  }
}
