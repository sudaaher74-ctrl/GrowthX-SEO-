import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { AutonomousEngineerModule } from '../autonomous-engineer/autonomous-engineer.module';
import { SecurityModule } from '../security/security.module';
import { StrategyModule } from '../strategy/strategy.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { ContentGenerationService } from './content-generation.service';
import { ContentAgentController } from './content-agent.controller';
import { ContentAgentService } from './content-agent.service';

@Module({
  imports: [DatabaseModule, AiSearchModule, AutonomousEngineerModule, SecurityModule, StrategyModule],
  controllers: [AutomationController, ContentAgentController],
  providers: [AutomationService, ContentGenerationService, ContentAgentService],
  exports: [AutomationService, ContentGenerationService, ContentAgentService],
})
export class AutomationModule {}
