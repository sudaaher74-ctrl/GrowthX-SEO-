import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { GrowthIntelligenceController } from './growth-intelligence.controller';
import { GrowthIntelligenceService } from './growth-intelligence.service';
import { SeoImpactController } from './seo-impact.controller';
import { SeoImpactService } from './seo-impact.service';

@Module({
  imports: [DatabaseModule, IntegrationsModule],
  controllers: [GrowthIntelligenceController, SeoImpactController],
  providers: [GrowthIntelligenceService, SeoImpactService],
})
export class GrowthIntelligenceModule {}
