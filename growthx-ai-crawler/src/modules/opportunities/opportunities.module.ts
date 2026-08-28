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
  ],
  controllers: [OpportunitiesController, GrowthConsultantController],
  exports: [OpportunitiesService, OpportunityDetectionService, ExecutiveSummaryService, GrowthContextService],
})
export class OpportunitiesModule {}
