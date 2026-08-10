"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricsService = void 0;
const common_1 = require("@nestjs/common");
const client = require("prom-client");
let MetricsService = class MetricsService {
    constructor() {
        this.registry = new client.Registry();
    }
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
    getMetrics() {
        return this.registry.metrics();
    }
    getContentType() {
        return this.registry.contentType;
    }
};
exports.MetricsService = MetricsService;
exports.MetricsService = MetricsService = __decorate([
    (0, common_1.Injectable)()
], MetricsService);
//# sourceMappingURL=metrics.service.js.map