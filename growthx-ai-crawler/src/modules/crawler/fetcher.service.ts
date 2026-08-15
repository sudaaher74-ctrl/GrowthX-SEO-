import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { chromium, Browser, BrowserContext } from 'playwright';
import { MetricsService } from '../observability/metrics.service';

export interface FetchResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  responseTimeMs: number;
  contentType?: string;
  html: string;
  redirectChain: string[];
  engine: 'cheerio' | 'playwright';
  errorMessage?: string;
}

@Injectable()
export class FetcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FetcherService.name);
  private browser?: Browser;
  private browserContext?: BrowserContext;
  private isPlaywrightReady = false;
  private isInitializingPlaywright = false;

  constructor(private readonly metrics: MetricsService) {}

  async onModuleInit() {
    // On low memory instances (e.g. Render 512MB free tier), defer Chromium launch
    // until explicitly needed by an SPA page to save 250MB+ base RAM.
    const autoLaunch = process.env.ENABLE_PLAYWRIGHT_STARTUP === 'true';
    if (autoLaunch) {
      await this.ensurePlaywrightInitialized();
    } else {
      this.logger.log('FetcherService initialized in lazy-Playwright mode (saves RAM on 512MB containers).');
    }
  }

  private async ensurePlaywrightInitialized(): Promise<boolean> {
    if (this.isPlaywrightReady && this.browserContext) return true;
    if (this.isInitializingPlaywright) return false;

    this.isInitializingPlaywright = true;
    const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
    try {
      this.logger.log(`Launching memory-optimized Playwright Chromium (headless=${headless})...`);
      this.browser = await chromium.launch({
        headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process',
          '--no-zygote',
          '--disable-software-rasterizer',
          '--js-flags=--max-old-space-size=128',
        ],
      });

      this.browser.on('disconnected', () => {
        this.logger.warn('Playwright browser instance disconnected.');
        this.isPlaywrightReady = false;
        this.browserContext = undefined;
        this.browser = undefined;
      });

      this.browserContext = await this.browser.newContext({
        userAgent: process.env.USER_AGENT || 'GrowthX-AI-Bot/1.0 (+https://growthx.ai/bot)',
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
      });
      this.isPlaywrightReady = true;
      this.logger.log('Playwright Chromium pool ready.');
      return true;
    } catch (err: any) {
      this.logger.warn(`Failed to launch Playwright browser (${err.message}). Cheerio static mode active.`);
      this.isPlaywrightReady = false;
      return false;
    } finally {
      this.isInitializingPlaywright = false;
    }
  }

  async onModuleDestroy() {
    if (this.browserContext) await this.browserContext.close().catch(() => {});
    if (this.browser) await this.browser.close().catch(() => {});
  }

  /**
   * Fetches a page using hybrid strategy: fast Cheerio first, dynamic Playwright SPA fallback
   */
  async fetchPage(targetUrl: string, forcePlaywright: boolean = false): Promise<FetchResult> {
    const startTime = Date.now();
    const redirectChain: string[] = [targetUrl];

    // Basic SSRF protection
    try {
      const urlObj = new URL(targetUrl);
      const hostname = urlObj.hostname;
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('172.') ||
        hostname.startsWith('169.254.')
      ) {
        throw new Error('SSRF Protection: Cannot crawl internal or reserved IP addresses.');
      }
    } catch (e: any) {
      return {
        url: targetUrl,
        finalUrl: targetUrl,
        statusCode: 403,
        responseTimeMs: Date.now() - startTime,
        html: '',
        redirectChain,
        engine: 'cheerio',
        errorMessage: e.message || 'Invalid URL',
      };
    }

    if (forcePlaywright) {
      const ready = await this.ensurePlaywrightInitialized();
      if (ready) return this.fetchWithPlaywright(targetUrl, startTime);
    }

    // 1. Try static fetch via Axios + Cheerio with simple retry for rate limits/transient errors
    let response;
    let retries = 0;
    while (retries < 3) {
      try {
        response = await axios.get(targetUrl, {
          timeout: 15000,
          maxRedirects: 10,
          validateStatus: () => true,
          headers: {
            'User-Agent': process.env.USER_AGENT || 'GrowthX-AI-Bot/1.0 (+https://growthx.ai/bot)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });

        if ([429, 500, 502, 503, 504].includes(response.status) && retries < 2) {
          retries++;
          await new Promise((r) => setTimeout(r, 1500 * retries));
          continue;
        }
        break;
      } catch (err: any) {
        if (retries < 2) {
          retries++;
          await new Promise((r) => setTimeout(r, 1500 * retries));
          continue;
        }
        throw err;
      }
    }

    try {
      if (!response) {
        throw new Error('Response undefined after retries');
      }

      const responseTimeMs = Date.now() - startTime;
      const finalUrl = response.request?.res?.responseUrl || targetUrl;
      if (finalUrl !== targetUrl && !redirectChain.includes(finalUrl)) {
        redirectChain.push(finalUrl);
      }
      const contentType = response.headers['content-type'] ? String(response.headers['content-type']) : undefined;
      const html = typeof response.data === 'string' ? response.data : '';

      this.metrics.pageFetchDurationSeconds.observe({ engine: 'cheerio' }, responseTimeMs / 1000);

      // Check if this looks like an unrendered SPA (e.g. empty #root / #app or very short text)
      if (this.needsDynamicRendering(html)) {
        this.logger.debug(`SPA detected on ${targetUrl}. Attempting lazy Playwright rendering...`);
        const ready = await this.ensurePlaywrightInitialized();
        if (ready) {
          return await this.fetchWithPlaywright(targetUrl, startTime);
        }
      }

      return {
        url: targetUrl,
        finalUrl,
        statusCode: response.status,
        responseTimeMs,
        contentType,
        html,
        redirectChain,
        engine: 'cheerio',
      };
    } catch (error: any) {
      this.logger.warn(`Static Cheerio fetch failed for ${targetUrl}: ${error.message}.`);
      const ready = await this.ensurePlaywrightInitialized();
      if (ready) {
        return await this.fetchWithPlaywright(targetUrl, startTime);
      }
      return {
        url: targetUrl,
        finalUrl: targetUrl,
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        html: '',
        redirectChain,
        engine: 'cheerio',
        errorMessage: error.message,
      };
    }
  }

  /**
   * Fetches and renders a page using Playwright Chromium
   */
  private async fetchWithPlaywright(targetUrl: string, startTime: number): Promise<FetchResult> {
    if (!this.browserContext) {
      throw new Error('Playwright browser context not initialized');
    }

    let page;
    try {
      page = await this.browserContext.newPage();
    } catch {
      // Re-initialize context if needed
      await this.ensurePlaywrightInitialized();
      page = await this.browserContext!.newPage();
    }

    const redirectChain: string[] = [targetUrl];
    let statusCode = 200;
    let contentType = 'text/html';

    try {
      page.on('response', (res) => {
        if (res.url() === targetUrl || res.url() === page.url()) {
          statusCode = res.status();
          contentType = res.headers()['content-type'] || 'text/html';
        }
        if (res.status() >= 300 && res.status() < 400) {
          const loc = res.headers()['location'];
          if (loc) redirectChain.push(loc);
        }
      });

      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(1000);

      const html = await page.content();
      const finalUrl = page.url();
      const responseTimeMs = Date.now() - startTime;

      this.metrics.pageFetchDurationSeconds.observe({ engine: 'playwright' }, responseTimeMs / 1000);
      await page.close().catch(() => {});

      return {
        url: targetUrl,
        finalUrl,
        statusCode,
        responseTimeMs,
        contentType,
        html,
        redirectChain,
        engine: 'playwright',
      };
    } catch (err: any) {
      if (page) await page.close().catch(() => {});
      this.logger.error(`Playwright fetch failed for ${targetUrl}: ${err.message}`);
      return {
        url: targetUrl,
        finalUrl: targetUrl,
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        html: '',
        redirectChain,
        engine: 'playwright',
        errorMessage: err.message,
      };
    }
  }

  /**
   * Detects if HTML is a minimal SPA wrapper that requires JavaScript rendering
   */
  private needsDynamicRendering(html: string): boolean {
    if (!html || html.length < 200) return true;
    const $ = cheerio.load(html);
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const wordCount = bodyText.split(' ').filter(Boolean).length;

    if (wordCount < 30) {
      if ($('#root').length > 0 || $('#app').length > 0 || $('div[id*="app"]').length > 0) {
        return true;
      }
    }
    return false;
  }
}
