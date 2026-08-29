import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { CompetitorContentService } from './competitor-content.service';
import { ClassificationService } from './classification.service';
import { PatternDetectionService } from './pattern-detection.service';
import { GapAnalysisService } from './gap-analysis.service';
import { ContentStrategyService } from './content-strategy.service';
import { ContentCreationService } from './content-creation.service';
import { CreatorService } from './creator.service';
import { CampaignService } from './campaign.service';
import { SocialScraperService } from './social-scraper.service';
import { SocialDiscoveryService } from './social-discovery.service';
import { CompetitorCrawlService } from './competitor-crawl.service';
import { VideoIntelligenceService } from './video-intelligence.service';
import { CrossCompetitorMatrixService } from './cross-competitor-matrix.service';
import { KeywordBusinessBridgeService } from './keyword-business-bridge.service';
import { VideoScriptGeneratorService } from './video-script-generator.service';
import { CompetitorMonitorService } from './competitor-monitor.service';
import { ContentIntelligenceController } from './content-intelligence.controller';

/**
 * GrowthX Content Intelligence & Competitor Social Video Intelligence Engine.
 *
 * Competitor Social Discovery → Video Intelligence & Multi-modal Analysis
 * → Pattern Detection → Cross-Competitor Matrix → Gap Analysis → AI Strategy
 * → Content Script Studio → Creator Discovery → Monitoring & Learning Loop.
 */
@Module({
  imports: [DatabaseModule, AiSearchModule],
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
    SocialDiscoveryService,
    CompetitorCrawlService,
    VideoIntelligenceService,
    CrossCompetitorMatrixService,
    KeywordBusinessBridgeService,
    VideoScriptGeneratorService,
    CompetitorMonitorService,
  ],
  exports: [
    ContentStrategyService,
    ContentCreationService,
    SocialScraperService,
    SocialDiscoveryService,
    CompetitorCrawlService,
    VideoIntelligenceService,
    CrossCompetitorMatrixService,
    KeywordBusinessBridgeService,
    VideoScriptGeneratorService,
    CompetitorMonitorService,
  ],
})
export class ContentIntelligenceModule {}
