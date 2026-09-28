import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ChangeImpactService } from './change-impact.service';
import { ChangeRiskService } from './change-risk.service';
import { DataForSeoService } from './dataforseo.service';
import { IndexStatusService } from './index-status.service';
import { KeywordDiagnosisService } from './keyword-diagnosis.service';
import { KeywordGapService } from './keyword-gap.service';
import { RankTrackingService } from './rank-tracking.service';
import { SearchIntelligenceController } from './search-intelligence.controller';
import { SearchIntelligenceScheduler } from './search-intelligence.scheduler';

/**
 * What Google itself says about a site: index status (Search Console URL
 * Inspection), live results and rankings (DataForSEO), competitor keyword
 * gaps, and search results around a change. The crawler's FetcherService,
 * used to read ranking pages, comes from the global CrawlerModule.
 */
@Module({
  imports: [DatabaseModule, IntegrationsModule],
  controllers: [SearchIntelligenceController],
  providers: [
    DataForSeoService,
    IndexStatusService,
    RankTrackingService,
    KeywordDiagnosisService,
    KeywordGapService,
    ChangeImpactService,
    ChangeRiskService,
    SearchIntelligenceScheduler,
  ],
  exports: [DataForSeoService, IndexStatusService, RankTrackingService],
})
export class SearchIntelligenceModule {}
