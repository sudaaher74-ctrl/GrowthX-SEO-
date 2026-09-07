import { Module } from '@nestjs/common';
import { AiSearchController } from './ai-search.controller';
import { MultiAiRouterService } from './multi-ai-router/multi-ai-router.service';
import { AiUsageService } from './multi-ai-router/ai-usage.service';
import { InvestigationToolsService } from './investigation-tools/investigation-tools.service';
import { AiSearchService } from './ai-search/ai-search.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AiSearchController],
  providers: [AiUsageService, MultiAiRouterService, InvestigationToolsService, AiSearchService],
  exports: [AiSearchService, MultiAiRouterService, AiUsageService]
})
export class AiSearchModule {}
