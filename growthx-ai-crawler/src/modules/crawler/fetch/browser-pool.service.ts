import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

/** Caps concurrent renders. Chromium pages are the expensive resource here. */
class Semaphore {
  private inFlight = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.inFlight < this.max) {
      this.inFlight++;
      return;
    }
    await new Promise<void>((resolve) => this.waiting.push(resolve));
    this.inFlight++;
  }

  release(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const next = this.waiting.shift();
    if (next) next();
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

  constructor() {
    const max = Number(process.env.MAX_RENDER_CONCURRENCY || process.env.MAX_PLAYWRIGHT_CONCURRENCY || 3);
    this.semaphore = new Semaphore(Math.max(1, max));
  }

  /** The reason the browser is unavailable, or undefined if it is fine. */
  get unavailableReason(): string | undefined {
    return this.launchFailure;
  }

  private async ensureContext(userAgent: string): Promise<BrowserContext | undefined> {
    if (this.context && this.browser?.isConnected()) return this.context;
    if (this.launchFailure) return undefined;
    if (this.launching) return this.launching;

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

    await this.semaphore.acquire();
    let page: Page | undefined;
    try {
      page = await context.newPage();
      return await work(page);
    } finally {
      if (page) await page.close().catch(() => {});
      this.semaphore.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.context?.close().catch(() => {});
    await this.browser?.close().catch(() => {});
  }
}
