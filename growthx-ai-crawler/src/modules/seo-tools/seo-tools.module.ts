import { Module } from '@nestjs/common';
import { SeoToolsController } from './seo-tools.controller';
import { SchemaGeneratorService } from './schema-generator.service';
import { MetaOptimizerService } from './meta-optimizer.service';
import { ImageOptimizerService } from './image-optimizer.service';
import { InternalLinkingService } from './internal-linking.service';
import { SeoCompetitorsService } from './seo-competitors.service';
import { CrawlerModule } from '../crawler/crawler.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { DatabaseModule } from '../../database/database.module';
import { MarketResearchModule } from '../market-research/market-research.module';

@Module({
  // MarketResearchModule supplies WebSearchService: the gap matrix reads who
  // ranks for a term off a live search rather than guessing.
  imports: [CrawlerModule, AiSearchModule, DatabaseModule, MarketResearchModule],
  controllers: [SeoToolsController],
  providers: [
    SchemaGeneratorService,
    MetaOptimizerService,
    ImageOptimizerService,
    InternalLinkingService,
    SeoCompetitorsService,
  ],
  exports: [
    SchemaGeneratorService,
    MetaOptimizerService,
    ImageOptimizerService,
    InternalLinkingService,
    SeoCompetitorsService,
  ],
})
export class SeoToolsModule {}
