import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { AiVisibilityService } from './ai-visibility.service';
import { PromptEngineService } from './prompt-engine.service';
import { AiProviderAbstractionService } from './ai-provider-abstraction.service';
import { ResponseAnalyzerService } from './response-analyzer.service';
import { MetricsEngineService } from './metrics-engine.service';
import { AiVisibilityController } from './ai-visibility.controller';

@Module({
  imports: [DatabaseModule, AiSearchModule],
  controllers: [AiVisibilityController],
  providers: [
    AiVisibilityService, 
    PromptEngineService, 
    AiProviderAbstractionService, 
    ResponseAnalyzerService,
    MetricsEngineService,
  ],
  exports: [AiVisibilityService],
})
export class AiVisibilityModule {}
