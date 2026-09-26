import { Module } from '@nestjs/common';
import { ContentIntelligenceModule } from '../content-intelligence/content-intelligence.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { BusinessController } from './business.controller';
import { BusinessCatalogService } from './business-catalog.service';
import { BusinessGapsService } from './business-gaps.service';
import { BusinessMarketingService } from './business-marketing.service';

@Module({
  // ContentIntelligenceModule exports CompetitorCrawlService — Catalog (Them)
  // reuses the exact crawl job Competitor Intelligence already queues rather
  // than standing up a second crawler. AiSearchModule exports
  // MultiAiRouterService, for the Marketing Signals tab.
  imports: [ContentIntelligenceModule, AiSearchModule],
  controllers: [BusinessController],
  providers: [BusinessCatalogService, BusinessGapsService, BusinessMarketingService],
})
export class BusinessModule {}
