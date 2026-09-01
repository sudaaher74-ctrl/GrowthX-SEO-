import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { VoiceAgentController } from './voice-agent.controller';
import { VoiceAgentService } from './voice-agent.service';
import { VoiceToolsService } from './voice-tools.service';

@Module({
  imports: [DatabaseModule, AiSearchModule, OrganizationsModule],
  controllers: [VoiceAgentController],
  providers: [VoiceAgentService, VoiceToolsService],
  exports: [VoiceAgentService],
})
export class VoiceAgentModule {}
