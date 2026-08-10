import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { CrawlerService } from './crawler.service';
export declare class CrawlerProcessor implements OnModuleInit, OnModuleDestroy {
    private readonly queue;
    private readonly crawlerService;
    private readonly logger;
    private crawlJobWorker?;
    private pageFetchWorker?;
    constructor(queue: QueueService, crawlerService: CrawlerService);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
}
