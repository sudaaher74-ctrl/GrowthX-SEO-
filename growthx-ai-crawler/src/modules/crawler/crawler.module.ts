import { Global, Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { FetcherService } from './fetcher.service';
import { CrawlerProcessor } from './crawler.processor';
import { CrawlController } from './crawl.controller';
import { VerificationEngineService } from './verification-engine.service';
import { OrganizationsModule } from '../organizations/organizations.module';
import { BrowserPoolService } from './fetch/browser-pool.service';
import { FetchService } from './fetch/fetch.service';
import { DiscoveryService } from './discovery/discovery.service';
import { FrontierService } from './frontier/frontier.service';
import { UrlInventoryService } from './inventory/url-inventory.service';

@Global()
@Module({
  imports: [OrganizationsModule],
  controllers: [CrawlController],
  providers: [
    CrawlerService,
    // The v1 fetcher stays registered: competitor crawling and the
    // verification engine still call it, and moving those is separate work
    // with its own tests. New crawls go through FetchService.
    FetcherService,
    BrowserPoolService,
    FetchService,
    DiscoveryService,
    FrontierService,
    UrlInventoryService,
    CrawlerProcessor,
    VerificationEngineService,
  ],
  // CrawlerProcessor is exported so the health endpoint can report whether
  // the BullMQ workers actually started in this process.
  exports: [CrawlerService, FetcherService, FetchService, DiscoveryService, FrontierService, UrlInventoryService, VerificationEngineService, CrawlerProcessor],
})
export class CrawlerModule {}
