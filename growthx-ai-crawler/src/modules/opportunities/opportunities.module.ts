import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { OpportunitiesService } from './opportunities.service';
import { OpportunityDetectionService } from './opportunity-detection.service';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunityDetectionScheduler } from './opportunity-detection.scheduler';
import { ExecutiveSummaryService } from './executive-summary.service';
import { GrowthContextService } from './growth-context.service';
import { GrowthConsultantService } from './growth-consultant.service';
import { GrowthConsultantController } from './growth-consultant.controller';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { LifecycleService } from './lifecycle.service';
import { FindingsController } from './findings.controller';
import { FindingSyncService } from './finding-sync.service';
import { WebsiteAuditAdapter } from '../issues/website-audit.adapter';
import { GbpAdapter } from '../local-seo/gbp.adapter';
import { CompetitorAdapter } from '../market-intelligence/competitor.adapter';
import { AiVisibilityAdapter } from '../ai-visibility/ai-visibility.adapter';

/**
 * The unified opportunity surface.
 *
 * Not an engine — it owns no analysis. Detectors read what the existing
 * engines already collected (the crawler's pages, competitor crawls, Search
 * Console) and the join between them is what produces a finding worth acting
 * on.
 */
@Module({
  imports: [DatabaseModule, IntegrationsModule, AiSearchModule],
  providers: [
    OpportunitiesService,
    OpportunityDetectionService,
    OpportunityDetectionScheduler,
    ExecutiveSummaryService,
    GrowthContextService,
    GrowthConsultantService,
    LifecycleService,
    WebsiteAuditAdapter,
    GbpAdapter,
    CompetitorAdapter,
    AiVisibilityAdapter,
    FindingSyncService,
  ],
  controllers: [
    OpportunitiesController,
    GrowthConsultantController,
    FindingsController,
  ],
  exports: [
    OpportunitiesService,
    OpportunityDetectionService,
    ExecutiveSummaryService,
    GrowthContextService,
    LifecycleService,
    FindingSyncService,
    WebsiteAuditAdapter,
    GbpAdapter,
    CompetitorAdapter,
    AiVisibilityAdapter,
  ],
})
export class OpportunitiesModule {}
