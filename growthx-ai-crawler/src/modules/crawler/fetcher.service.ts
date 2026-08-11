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

  constructor(private readonly metrics: MetricsService) {}

  async onModuleInit() {
    const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
    try {
      this.logger.log(`Initializing pooled Playwright Chromium browser (headless=${headless})...`);
      this.browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      
      this.browser.on('disconnected', async () => {
        this.logger.warn('Playwright browser disconnected or crashed. Attempting to restart pool...');
        this.isPlaywrightReady = false;
        await this.onModuleInit();
      });

      this.browserContext = await this.browser.newContext({
        userAgent: process.env.USER_AGENT || 'GrowthX-AI-Bot/1.0 (+https://growthx.ai/bot)',
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,
      });
      this.isPlaywrightReady = true;
      this.logger.log('Playwright Chromium pool ready.');
    } catch (err) {
      this.logger.warn('Failed to launch Playwright browser. Will operate in Cheerio-only static scraping mode.', err);
      this.isPlaywrightReady = false;
    }
  }

  async onModuleDestroy() {
    if (this.browserContext) await this.browserContext.close();
    if (this.browser) await this.browser.close();
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

    if (forcePlaywright && this.isPlaywrightReady) {
      return this.fetchWithPlaywright(targetUrl, startTime);
    }

    // 1. Try static fetch via Axios + Cheerio
    try {
      const response = await axios.get(targetUrl, {
        timeout: 10000,
        maxRedirects: 10,
        validateStatus: () => true,
        headers: {
          'User-Agent': process.env.USER_AGENT || 'GrowthX-AI-Bot/1.0 (+https://growthx.ai/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      const responseTimeMs = Date.now() - startTime;
      const finalUrl = response.request?.res?.responseUrl || targetUrl;
      if (finalUrl !== targetUrl && !redirectChain.includes(finalUrl)) {
        redirectChain.push(finalUrl);
      }
      const contentType = response.headers['content-type'] ? String(response.headers['content-type']) : undefined;
      const html = typeof response.data === 'string' ? response.data : '';

      this.metrics.pageFetchDurationSeconds.observe({ engine: 'cheerio' }, responseTimeMs / 1000);

      // Check if this looks like an unrendered SPA (e.g. empty #root / #app or very short text)
      if (this.isPlaywrightReady && this.needsDynamicRendering(html)) {
        this.logger.debug(`SPA detected on ${targetUrl}. Upgrading to Playwright rendering.`);
        return await this.fetchWithPlaywright(targetUrl, startTime);
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
      this.logger.warn(`Static Cheerio fetch failed for ${targetUrl}: ${error.message}. Attempting Playwright fallback...`);
      if (this.isPlaywrightReady) {
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

    const page = await this.browserContext.newPage();
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

      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      // Short delay for SPA frameworks to hydrate
      await page.waitForTimeout(1000);

      const html = await page.content();
      const finalUrl = page.url();
      const responseTimeMs = Date.now() - startTime;

      this.metrics.pageFetchDurationSeconds.observe({ engine: 'playwright' }, responseTimeMs / 1000);
      await page.close();

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
      await page.close();
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

    // If body has very few words and has #root or #app container, it's likely an SPA
    if (wordCount < 30) {
      if ($('#root').length > 0 || $('#app').length > 0 || $('div[id*="app"]').length > 0) {
        return true;
      }
    }
    return false;
  }
}
