import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
export interface CrawlJobPayload {
    jobId: string;
    websiteId: string;
    domain: string;
    startUrl: string;
    maxConcurrency: number;
    maxDepth: number;
    rateLimitDelayMs: number;
    useSitemap: boolean;
}
export interface PageFetchPayload {
    jobId: string;
    websiteId: string;
    domain: string;
    targetUrl: string;
    sourceUrl?: string;
    depth: number;
    maxDepth: number;
    rateLimitDelayMs: number;
}
export declare class QueueService implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private redisConnection?;
    crawlJobsQueue?: Queue<CrawlJobPayload>;
    pageFetchQueue?: Queue<PageFetchPayload>;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    addCrawlJob(payload: CrawlJobPayload): Promise<string>;
    addPageFetchTask(payload: PageFetchPayload, delayMs?: number): Promise<void>;
    getRedisClient(): IORedis | undefined;
}
