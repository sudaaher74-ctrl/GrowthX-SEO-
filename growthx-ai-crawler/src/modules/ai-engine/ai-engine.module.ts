import { Global, Module } from '@nestjs/common';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { UnifiedAiService } from './unified-ai.service';
import { UnifiedAiController } from './unified-ai.controller';
import { MammouthSeoService } from './mammouth-seo.service';
import { MammouthSeoController } from './mammouth-seo.controller';

/**
 * The intelligence tasks (market research, competitor teardown, SEO analysis).
 *
 * There is no provider abstraction here any more. This module used to carry a
 * second one — AiProviderFactory over four vendor classes — chosen by an env
 * var with a fixed fallback chain and no task routing, no budget enforcement
 * and no spend ledger. Two routers meant the most expensive calls in the
 * product were the ones nobody could account for. Everything now goes through
 * MultiAiRouterService.
 */
@Global()
@Module({
  imports: [AiSearchModule],
  controllers: [UnifiedAiController, MammouthSeoController],
  providers: [UnifiedAiService, MammouthSeoService],
  exports: [UnifiedAiService, MammouthSeoService],
})
export class AiEngineModule {}
