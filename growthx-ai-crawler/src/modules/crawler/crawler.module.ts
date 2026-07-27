import { Global, Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { FetcherService } from './fetcher.service';
import { CrawlerProcessor } from './crawler.processor';
import { CrawlController } from './crawl.controller';

@Global()
@Module({
  controllers: [CrawlController],
  providers: [CrawlerService, FetcherService, CrawlerProcessor],
  exports: [CrawlerService, FetcherService],
})
export class CrawlerModule {}
