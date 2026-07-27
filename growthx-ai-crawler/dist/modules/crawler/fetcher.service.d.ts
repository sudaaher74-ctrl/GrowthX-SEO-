import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
export declare class FetcherService implements OnModuleInit, OnModuleDestroy {
    private readonly metrics;
    private readonly logger;
    private browser?;
    private browserContext?;
    private isPlaywrightReady;
    constructor(metrics: MetricsService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    /**
     * Fetches a page using hybrid strategy: fast Cheerio first, dynamic Playwright SPA fallback
     */
    fetchPage(targetUrl: string, forcePlaywright?: boolean): Promise<FetchResult>;
    /**
     * Fetches and renders a page using Playwright Chromium
     */
    private fetchWithPlaywright;
    /**
     * Detects if HTML is a minimal SPA wrapper that requires JavaScript rendering
     */
    private needsDynamicRendering;
}
