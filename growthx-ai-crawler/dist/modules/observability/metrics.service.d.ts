import { OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';
export declare class MetricsService implements OnModuleInit {
    private readonly registry;
    pagesCrawledTotal: client.Counter<string>;
    crawlDurationSeconds: client.Histogram<string>;
    activeCrawlJobs: client.Gauge<string>;
    issuesDetectedTotal: client.Counter<string>;
    pageFetchDurationSeconds: client.Histogram<string>;
    onModuleInit(): void;
    getMetrics(): Promise<string>;
    getContentType(): string;
}
