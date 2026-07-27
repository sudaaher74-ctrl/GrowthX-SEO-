"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CrawlerProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlerProcessor = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const queue_service_1 = require("../queue/queue.service");
const crawler_service_1 = require("./crawler.service");
let CrawlerProcessor = CrawlerProcessor_1 = class CrawlerProcessor {
    constructor(queue, crawlerService) {
        this.queue = queue;
        this.crawlerService = crawlerService;
        this.logger = new common_1.Logger(CrawlerProcessor_1.name);
    }
    onModuleInit() {
        const redisConnection = this.queue.getRedisClient();
        if (!redisConnection) {
            this.logger.warn('Redis connection unavailable. BullMQ workers will not start; operating in synchronous fallback mode.');
            return;
        }
        const maxConcurrency = process.env.MAX_CRAWL_CONCURRENCY ? parseInt(process.env.MAX_CRAWL_CONCURRENCY, 10) : 10;
        // Worker for orchestrating crawl jobs
        this.crawlJobWorker = new bullmq_1.Worker('crawl-jobs', async (job) => {
            this.logger.log(`Processing BullMQ crawl-jobs item: Job ${job.data.jobId}`);
            await this.crawlerService.processCrawlJob(job.data);
        }, { connection: redisConnection, concurrency: 5 });
        this.crawlJobWorker.on('failed', (job, err) => {
            this.logger.error(`Crawl job worker failed for job ${job?.id}`, err);
        });
        // Worker for fetching individual pages horizontally
        this.pageFetchWorker = new bullmq_1.Worker('page-fetch', async (job) => {
            await this.crawlerService.processPageFetch(job.data);
        }, { connection: redisConnection, concurrency: maxConcurrency });
        this.pageFetchWorker.on('failed', (job, err) => {
            this.logger.error(`Page fetch worker failed for url ${job?.data?.targetUrl}`, err);
        });
        this.logger.log(`BullMQ crawler workers started with concurrency limit ${maxConcurrency}.`);
    }
    async onModuleDestroy() {
        if (this.crawlJobWorker)
            await this.crawlJobWorker.close();
        if (this.pageFetchWorker)
            await this.pageFetchWorker.close();
    }
};
exports.CrawlerProcessor = CrawlerProcessor;
exports.CrawlerProcessor = CrawlerProcessor = CrawlerProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [queue_service_1.QueueService,
        crawler_service_1.CrawlerService])
], CrawlerProcessor);
//# sourceMappingURL=crawler.processor.js.map