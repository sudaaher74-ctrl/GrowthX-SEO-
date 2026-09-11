import { Global, Module } from '@nestjs/common';
import { CrawlerService } from './crawler.service';
import { FetcherService } from './fetcher.service';
import { CrawlerProcessor } from './crawler.processor';
import { CrawlController } from './crawl.controller';
import { VerificationEngineService } from './verification-engine.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Global()
@Module({
  imports: [OrganizationsModule],
  controllers: [CrawlController],
  providers: [CrawlerService, FetcherService, CrawlerProcessor, VerificationEngineService],
  exports: [CrawlerService, FetcherService, VerificationEngineService],
})
export class CrawlerModule {}
