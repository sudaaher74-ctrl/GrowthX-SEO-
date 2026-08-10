"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var QueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const ioredis_1 = require("ioredis");
let QueueService = QueueService_1 = class QueueService {
    constructor() {
        this.logger = new common_1.Logger(QueueService_1.name);
    }
    async onModuleInit() {
        const redisUrl = process.env.REDIS_URL;
        const host = process.env.REDIS_HOST || 'localhost';
        const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
        try {
            if (redisUrl) {
                const isTls = redisUrl.startsWith('rediss://');
                this.redisConnection = new ioredis_1.default(redisUrl, {
                    maxRetriesPerRequest: null, // Required by BullMQ
                    lazyConnect: true,
                    tls: isTls ? { rejectUnauthorized: false } : undefined,
                });
            }
            else {
                this.redisConnection = new ioredis_1.default({
                    host,
                    port,
                    maxRetriesPerRequest: null,
                    lazyConnect: true,
                });
            }
            // ioredis emits 'error' asynchronously. Without a listener, Node treats it
            // as an unhandled EventEmitter error and kills the process — so a brief
            // Redis blip would take the whole API down.
            this.redisConnection.on('error', (err) => {
                this.logger.warn(`Redis connection error: ${err.message}`);
            });
            await this.redisConnection.connect();
            this.logger.log(`Connected to Redis at ${host}:${port} for BullMQ queues.`);
            this.crawlJobsQueue = new bullmq_1.Queue('crawl-jobs', { connection: this.redisConnection });
            this.pageFetchQueue = new bullmq_1.Queue('page-fetch', { connection: this.redisConnection });
        }
        catch (err) {
            this.logger.warn(`Could not connect to Redis at ${host}:${port}. Crawls will run synchronously. (${err?.message})`);
            // Drop the dead client. Leaving it set would hand a broken connection to
            // getRedisClient(), and CrawlerProcessor would start BullMQ workers on it.
            if (this.redisConnection) {
                this.redisConnection.removeAllListeners();
                this.redisConnection.disconnect();
                this.redisConnection = undefined;
            }
        }
    }
    async onModuleDestroy() {
        // Every step is guarded: shutdown must not throw, and quit() on an
        // already-closed connection rejects with "Connection is closed."
        try {
            if (this.crawlJobsQueue)
                await this.crawlJobsQueue.close();
            if (this.pageFetchQueue)
                await this.pageFetchQueue.close();
        }
        catch (err) {
            this.logger.warn(`Error closing queues: ${err?.message}`);
        }
        if (!this.redisConnection)
            return;
        try {
            if (this.redisConnection.status === 'ready') {
                await this.redisConnection.quit();
            }
            else {
                this.redisConnection.disconnect();
            }
        }
        catch (err) {
            this.logger.warn(`Error closing the Redis connection: ${err?.message}`);
        }
    }
    async addCrawlJob(payload) {
        if (!this.crawlJobsQueue) {
            this.logger.warn(`Redis queue inactive. Cannot dispatch job ${payload.jobId} asynchronously.`);
            return payload.jobId;
        }
        const job = await this.crawlJobsQueue.add('start-crawl', payload, {
            removeOnComplete: 1000,
            removeOnFail: 5000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
        });
        return job.id || payload.jobId;
    }
    async addPageFetchTask(payload, delayMs = 0) {
        if (!this.pageFetchQueue) {
            return;
        }
        await this.pageFetchQueue.add('fetch-url', payload, {
            delay: delayMs,
            removeOnComplete: true,
            removeOnFail: true,
            attempts: 2,
            backoff: { type: 'fixed', delay: 1000 },
        });
    }
    getRedisClient() {
        return this.redisConnection;
    }
};
exports.QueueService = QueueService;
exports.QueueService = QueueService = QueueService_1 = __decorate([
    (0, common_1.Injectable)()
], QueueService);
//# sourceMappingURL=queue.service.js.map