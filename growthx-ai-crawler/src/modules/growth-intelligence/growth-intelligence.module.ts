import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { GrowthIntelligenceController } from './growth-intelligence.controller';
import { GrowthIntelligenceService } from './growth-intelligence.service';

@Module({
  imports: [DatabaseModule, IntegrationsModule],
  controllers: [GrowthIntelligenceController],
  providers: [GrowthIntelligenceService],
})
export class GrowthIntelligenceModule {}
