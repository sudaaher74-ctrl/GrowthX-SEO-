import { Module } from '@nestjs/common';
import { AeoAnalysisService } from './aeo-analysis/aeo-analysis.service';
import { AiVisibilityService } from './ai-visibility.service';
import { AiVisibilityController } from './ai-visibility.controller';
import { AiVisibilityScheduler } from './ai-visibility.scheduler';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { ContentIntelligenceModule } from '../content-intelligence/content-intelligence.module';

@Module({
  imports: [DatabaseModule, AiSearchModule, ContentIntelligenceModule],
  controllers: [AiVisibilityController],
  providers: [AeoAnalysisService, AiVisibilityService, AiVisibilityScheduler],
  exports: [AeoAnalysisService, AiVisibilityService],
})
export class AiVisibilityModule {}
