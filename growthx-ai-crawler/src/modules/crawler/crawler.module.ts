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
import { CrawlRetentionService } from './crawl-retention.service';

@Global()
@Module({
  imports: [OrganizationsModule],
  controllers: [CrawlController],
  providers: [
    CrawlerService,
    // FetcherService is retained for backwards compatibility with tests and
    // legacy consumers; competitor crawling, verification engine, autopilot,
    // and SEO tools have been migrated to FetchService.
    FetcherService,
    BrowserPoolService,
    FetchService,
    DiscoveryService,
    FrontierService,
    UrlInventoryService,
    CrawlerProcessor,
    VerificationEngineService,
    // Nightly pruning of old crawls' HTML and detail; see the service.
    CrawlRetentionService,
  ],
  // CrawlerProcessor is exported so the health endpoint can report whether
  // the BullMQ workers actually started in this process.
  exports: [CrawlerService, FetcherService, FetchService, DiscoveryService, FrontierService, UrlInventoryService, VerificationEngineService, CrawlerProcessor],
})
export class CrawlerModule {}
