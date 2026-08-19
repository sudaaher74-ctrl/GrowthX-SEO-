import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { BillingModule } from '../billing/billing.module';
import { CompetitorContentService } from './competitor-content.service';
import { ClassificationService } from './classification.service';
import { PatternDetectionService } from './pattern-detection.service';
import { GapAnalysisService } from './gap-analysis.service';
import { ContentStrategyService } from './content-strategy.service';
import { ContentCreationService } from './content-creation.service';
import { CreatorService } from './creator.service';
import { CampaignService } from './campaign.service';
import { SocialScraperService } from './social-scraper.service';
import { ContentIntelligenceController } from './content-intelligence.controller';

/**
 * GrowthX Content Intelligence & Creative Engine.
 *
 * Competitor Intelligence → Pattern Detection → Gap Analysis → AI Strategy
 * → Content Generation → Creator Discovery → Collaboration → Publishing
 * → Performance Analytics → Company Brain Learning.
 *
 * Uses MultiAiRouterService (via AiSearchModule) for all AI calls so model
 * selection, cost tracking, and fallbacks are handled centrally.
 * BillingModule provides EntitlementsGuard used on the controller.
 */
@Module({
  imports: [DatabaseModule, AiSearchModule, BillingModule],
  controllers: [ContentIntelligenceController],
  providers: [
    CompetitorContentService,
    ClassificationService,
    PatternDetectionService,
    GapAnalysisService,
    ContentStrategyService,
    ContentCreationService,
    CreatorService,
    CampaignService,
    SocialScraperService,
  ],
  exports: [ContentStrategyService, ContentCreationService, SocialScraperService],
})
export class ContentIntelligenceModule {}
