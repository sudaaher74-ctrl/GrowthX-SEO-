import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { OpportunitiesService } from './opportunities.service';
import { OpportunityDetectionService } from './opportunity-detection.service';
import { OpportunitiesController } from './opportunities.controller';

/**
 * The unified opportunity surface.
 *
 * Not an engine — it owns no analysis. Detectors read what the existing
 * engines already collected (the crawler's pages, competitor crawls, Search
 * Console) and the join between them is what produces a finding worth acting
 * on.
 */
@Module({
  imports: [DatabaseModule, IntegrationsModule],
  providers: [OpportunitiesService, OpportunityDetectionService],
  controllers: [OpportunitiesController],
  exports: [OpportunitiesService, OpportunityDetectionService],
})
export class OpportunitiesModule {}
