import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { OpportunitiesModule } from '../opportunities/opportunities.module';
import { SearchIntelligenceModule } from '../search-intelligence/search-intelligence.module';
import { CompetitorActionEngineModule } from '../competitor-action-engine/competitor-action-engine.module';
import { AiVisibilityService } from './ai-visibility.service';
import { PromptEngineService } from './prompt-engine.service';
import { AiProviderAbstractionService } from './ai-provider-abstraction.service';
import { ResponseAnalyzerService } from './response-analyzer.service';
import { MetricsEngineService } from './metrics-engine.service';
import { AiVisibilityAdapter } from './ai-visibility.adapter';
import { AiVisibilityController } from './ai-visibility.controller';
import { VisibilityContextService } from './visibility-context.service';
import { VisibilityWorkflowService } from './visibility-workflow.service';
import { AiVisibilityInsightsService } from './ai-visibility-insights.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    DatabaseModule,
    AiSearchModule,
    SearchIntelligenceModule,
    CompetitorActionEngineModule,
    OrganizationsModule,
    forwardRef(() => OpportunitiesModule),
  ],
  controllers: [AiVisibilityController],
  providers: [
    AiVisibilityService,
    PromptEngineService,
    AiProviderAbstractionService,
    ResponseAnalyzerService,
    MetricsEngineService,
    VisibilityContextService,
    VisibilityWorkflowService,
    AiVisibilityInsightsService,
    AiVisibilityAdapter,
  ],
  exports: [AiVisibilityService, AiVisibilityAdapter, VisibilityWorkflowService, AiVisibilityInsightsService],
})
export class AiVisibilityModule {}
