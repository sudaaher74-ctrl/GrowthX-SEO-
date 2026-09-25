import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ContentIntelligenceModule } from '../content-intelligence/content-intelligence.module';
import { CompetitorActionEngineModule } from '../competitor-action-engine/competitor-action-engine.module';
import { AutopilotController } from './autopilot.controller';
import { AutopilotService } from './autopilot.service';
import { AutopilotScheduler } from './autopilot.scheduler';

// CrawlerService and FetcherService come from the global CrawlerModule.
@Module({
  imports: [DatabaseModule, AiSearchModule, OrganizationsModule, ContentIntelligenceModule, CompetitorActionEngineModule],
  controllers: [AutopilotController],
  providers: [AutopilotService, AutopilotScheduler],
  exports: [AutopilotService],
})
export class AutopilotModule {}
