import { Module } from '@nestjs/common';
import { AiSearchController } from './ai-search.controller';
import { MultiAiRouterService } from './multi-ai-router/multi-ai-router.service';
import { AiUsageService } from './multi-ai-router/ai-usage.service';
import { InvestigationToolsService } from './investigation-tools/investigation-tools.service';
import { AiSearchService } from './ai-search/ai-search.service';
import { DatabaseModule } from '../../database/database.module';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  // TokensModule is what makes the router charge for its calls. The router
  // takes the service as an optional dependency, so leaving this out would
  // not fail to boot — it would quietly stop metering. ai-search.module.spec.ts
  // pins it.
  imports: [DatabaseModule, TokensModule],
  controllers: [AiSearchController],
  providers: [AiUsageService, MultiAiRouterService, InvestigationToolsService, AiSearchService],
  exports: [AiSearchService, MultiAiRouterService, AiUsageService]
})
export class AiSearchModule {}
