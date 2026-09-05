import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { ContentIntelligenceModule } from '../content-intelligence/content-intelligence.module';
import { MarketResearchModule } from '../market-research/market-research.module';
import { DiscoveryPipelineController } from './discovery-pipeline.controller';
import { DiscoveryPipelineService } from './discovery-pipeline.service';
import { DiscoveryStatusService } from './discovery-status.service';

/**
 * Chains the onboarding steps that were each waiting to be pressed.
 *
 * Depends on the modules that do the work and is depended on by none of them.
 * CrawlerModule is global and reaches this service through a handler it
 * registers rather than an import, which is what stops
 * crawler -> pipeline -> market research -> competitor crawl -> crawler from
 * being a cycle Nest cannot resolve.
 */
@Module({
  imports: [DatabaseModule, MarketResearchModule, ContentIntelligenceModule],
  controllers: [DiscoveryPipelineController],
  providers: [DiscoveryPipelineService, DiscoveryStatusService],
  exports: [DiscoveryPipelineService, DiscoveryStatusService],
})
export class DiscoveryPipelineModule {}
