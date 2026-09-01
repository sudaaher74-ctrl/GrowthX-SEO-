import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ContentIntelligenceModule } from '../content-intelligence/content-intelligence.module';
import { SeoToolsModule } from '../seo-tools/seo-tools.module';
import { VoiceAgentController } from './voice-agent.controller';
import { VoiceAgentService } from './voice-agent.service';
import { VoiceToolsService } from './voice-tools.service';

@Module({
  imports: [DatabaseModule, AiSearchModule, OrganizationsModule, ContentIntelligenceModule, SeoToolsModule],
  controllers: [VoiceAgentController],
  providers: [VoiceAgentService, VoiceToolsService],
  exports: [VoiceAgentService],
})
export class VoiceAgentModule {}
