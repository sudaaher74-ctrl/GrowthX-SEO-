import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiVisibilityModule } from '../ai-visibility/ai-visibility.module';
import { EvidenceRetrievalService } from './evidence-retrieval.service';
import { MarketResearchController } from './market-research.controller';
import { MarketResearchService } from './market-research.service';
import { ModelRouterService } from './model-router.service';
import { MarketActionService } from './market-action.service';
import { OutcomeMeasurementService } from './outcome-measurement.service';
import { WeeklyDeltaService } from './weekly-delta.service';
import { MarketResearchScheduler } from './market-research.scheduler';

/**
 * GrowthX Market Research.
 *
 * Uses ModelRouterService which standardises on the Chat Completions API,
 * with Sarvam AI as the primary provider. Deliberately separate from the
 * multi-AI router used elsewhere: this area has exactly one place that
 * decides which model serves which role.
 */
@Module({
  imports: [DatabaseModule, AiVisibilityModule],
  controllers: [MarketResearchController],
  providers: [ModelRouterService, EvidenceRetrievalService, MarketResearchService, MarketActionService, OutcomeMeasurementService, WeeklyDeltaService, MarketResearchScheduler],
  exports: [MarketResearchService, MarketActionService, OutcomeMeasurementService, WeeklyDeltaService, ModelRouterService],
})
export class MarketResearchModule {}
