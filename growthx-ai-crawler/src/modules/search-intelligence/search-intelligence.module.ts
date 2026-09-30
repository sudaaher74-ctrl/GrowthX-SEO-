import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ChangeImpactService } from './change-impact.service';
import { ChangeRiskService } from './change-risk.service';
import { DataForSeoService } from './dataforseo.service';
import { GoogleAlertsService } from './google-alerts.service';
import { GoogleBreakdownService } from './google-breakdown.service';
import { GoogleKeywordsService } from './google-keywords.service';
import { GoogleOverviewController } from './google-overview.controller';
import { GoogleOverviewService } from './google-overview.service';
import { GoogleReportService } from './google-report.service';
import { IndexStatusService } from './index-status.service';
import { KeywordDiagnosisService } from './keyword-diagnosis.service';
import { KeywordGapService } from './keyword-gap.service';
import { RankTrackingService } from './rank-tracking.service';
import { SearchIntelligenceController } from './search-intelligence.controller';
import { SearchIntelligenceScheduler } from './search-intelligence.scheduler';
import { SearchRankingsService } from './search-rankings.service';

/**
 * What Google itself says about a site: index status (Search Console URL
 * Inspection), rankings and keyword diagnosis from the customer's own Search
 * Console and Analytics, and, where the platform has a paid source for it,
 * live results (DataForSEO) and competitor keyword gaps. Also search results
 * around a change. The crawler's FetcherService, used to read ranking pages,
 * comes from the global CrawlerModule.
 */
@Module({
  imports: [DatabaseModule, IntegrationsModule, AiSearchModule],
  controllers: [SearchIntelligenceController, GoogleOverviewController],
  providers: [
    GoogleOverviewService,
    GoogleKeywordsService,
    GoogleBreakdownService,
    GoogleAlertsService,
    GoogleReportService,
    DataForSeoService,
    IndexStatusService,
    RankTrackingService,
    SearchRankingsService,
    KeywordDiagnosisService,
    KeywordGapService,
    ChangeImpactService,
    ChangeRiskService,
    SearchIntelligenceScheduler,
  ],
  exports: [DataForSeoService, IndexStatusService, RankTrackingService],
})
export class SearchIntelligenceModule {}
