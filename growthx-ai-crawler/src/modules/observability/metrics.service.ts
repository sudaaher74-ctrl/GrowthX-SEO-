import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry = new client.Registry();

  public pagesCrawledTotal!: client.Counter<string>;
  public crawlDurationSeconds!: client.Histogram<string>;
  public activeCrawlJobs!: client.Gauge<string>;
  public issuesDetectedTotal!: client.Counter<string>;
  public pageFetchDurationSeconds!: client.Histogram<string>;

  onModuleInit() {
    client.collectDefaultMetrics({ register: this.registry, prefix: 'growthx_' });

    this.pagesCrawledTotal = new client.Counter({
      name: 'growthx_pages_crawled_total',
      help: 'Total number of web pages crawled',
      labelNames: ['jobId', 'status', 'contentType'],
      registers: [this.registry],
    });

    this.crawlDurationSeconds = new client.Histogram({
      name: 'growthx_crawl_job_duration_seconds',
      help: 'Duration of website crawl jobs in seconds',
      labelNames: ['jobId', 'websiteId', 'status'],
      buckets: [10, 30, 60, 120, 300, 600, 1800, 3600],
      registers: [this.registry],
    });

    this.activeCrawlJobs = new client.Gauge({
      name: 'growthx_active_crawl_jobs',
      help: 'Number of currently active crawl jobs running across workers',
      labelNames: ['workerId'],
      registers: [this.registry],
    });

    this.issuesDetectedTotal = new client.Counter({
      name: 'growthx_issues_detected_total',
      help: 'Total number of technical SEO issues detected',
      labelNames: ['jobId', 'severity', 'issueType'],
      registers: [this.registry],
    });

    this.pageFetchDurationSeconds = new client.Histogram({
      name: 'growthx_page_fetch_duration_seconds',
      help: 'Latency of individual page fetches in seconds',
      labelNames: ['engine'], // 'cheerio' or 'playwright'
      buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20],
      registers: [this.registry],
    });
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
