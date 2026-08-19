import { Module } from '@nestjs/common';
import { LocalSeoService } from './local-seo.service';
import { LocalSeoController } from './local-seo.controller';
import { GbpAnalyzerService } from './gbp-analyzer.service';
import { GbpAutofixService } from './gbp-autofix.service';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [DatabaseModule, AiSearchModule, IntegrationsModule],
  controllers: [LocalSeoController],
  providers: [LocalSeoService, GbpAnalyzerService, GbpAutofixService],
  exports: [LocalSeoService, GbpAnalyzerService, GbpAutofixService],
})
export class LocalSeoModule {}
