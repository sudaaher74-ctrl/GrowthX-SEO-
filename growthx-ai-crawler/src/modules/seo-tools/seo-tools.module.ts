import { Module } from '@nestjs/common';
import { SeoToolsController } from './seo-tools.controller';
import { SchemaGeneratorService } from './schema-generator.service';
import { MetaOptimizerService } from './meta-optimizer.service';
import { CrawlerModule } from '../crawler/crawler.module';
import { AiSearchModule } from '../ai-search/ai-search.module';

@Module({
  imports: [CrawlerModule, AiSearchModule],
  controllers: [SeoToolsController],
  providers: [SchemaGeneratorService, MetaOptimizerService],
  exports: [SchemaGeneratorService, MetaOptimizerService],
})
export class SeoToolsModule {}
