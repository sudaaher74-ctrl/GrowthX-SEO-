import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiVisibilityModule } from '../ai-visibility/ai-visibility.module';
import { ContentIntelligenceModule } from '../content-intelligence/content-intelligence.module';
import { EvidenceRetrievalService } from './evidence-retrieval.service';
import { MarketResearchController } from './market-research.controller';
import { MarketResearchService } from './market-research.service';
import { ModelRouterService } from './model-router.service';
import { MarketActionService } from './market-action.service';
import { OutcomeMeasurementService } from './outcome-measurement.service';
import { WeeklyDeltaService } from './weekly-delta.service';
import { MarketResearchScheduler } from './market-research.scheduler';
import { BusinessProfileService } from './business-profile.service';
import { CompetitorVerificationService } from './competitor-verification.service';
import { WebSearchService } from './web-search.service';

/**
 * GrowthX Market Research.
 *
 * Uses ModelRouterService which standardises on the Chat Completions API,
 * with Sarvam AI as the primary provider. Deliberately separate from the
 * multi-AI router used elsewhere: this area has exactly one place that
 * decides which model serves which role.
 */
@Module({
  imports: [DatabaseModule, AiVisibilityModule, ContentIntelligenceModule],
  controllers: [MarketResearchController],
  providers: [ModelRouterService, EvidenceRetrievalService, BusinessProfileService, CompetitorVerificationService, WebSearchService, MarketResearchService, MarketActionService, OutcomeMeasurementService, WeeklyDeltaService, MarketResearchScheduler],
  exports: [MarketResearchService, BusinessProfileService, CompetitorVerificationService, WebSearchService, MarketActionService, OutcomeMeasurementService, WeeklyDeltaService, ModelRouterService],
})
export class MarketResearchModule {}

