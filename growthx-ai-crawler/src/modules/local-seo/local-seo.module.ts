import { Module } from '@nestjs/common';
import { LocalSeoService } from './local-seo.service';
import { LocalSeoController } from './local-seo.controller';
import { GeoGridService } from './geo-grid.service';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [DatabaseModule, AiSearchModule, IntegrationsModule, TokensModule],
  controllers: [LocalSeoController],
  providers: [LocalSeoService, GeoGridService],
  exports: [LocalSeoService, GeoGridService],
})
export class LocalSeoModule {}
