import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { AiVisibilityService } from './ai-visibility.service';
import { PromptEngineService } from './prompt-engine.service';
import { AiProviderAbstractionService } from './ai-provider-abstraction.service';
import { ResponseAnalyzerService } from './response-analyzer.service';
import { MetricsEngineService } from './metrics-engine.service';
import { AiVisibilityController } from './ai-visibility.controller';
import { SearchIntelligenceModule } from '../search-intelligence/search-intelligence.module';
import { CompetitorActionEngineModule } from '../competitor-action-engine/competitor-action-engine.module';
import { VisibilityContextService } from './visibility-context.service';
import { VisibilityWorkflowService } from './visibility-workflow.service';

@Module({
  imports: [DatabaseModule, AiSearchModule, SearchIntelligenceModule, CompetitorActionEngineModule],
  controllers: [AiVisibilityController],
  providers: [
    AiVisibilityService, 
    PromptEngineService, 
    AiProviderAbstractionService, 
    ResponseAnalyzerService,
    MetricsEngineService,
    VisibilityContextService,
    VisibilityWorkflowService,
  ],
  exports: [AiVisibilityService],
})
export class AiVisibilityModule {}
