import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { AutonomousEngineerModule } from '../autonomous-engineer/autonomous-engineer.module';
import { SecurityModule } from '../security/security.module';
import { StrategyModule } from '../strategy/strategy.module';
import { ImpactModule } from '../impact/impact.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { EngineerAgentService } from './engineer-agent.service';
import { ContentGenerationService } from './content-generation.service';
import { ContentAgentController } from './content-agent.controller';
import { ContentAgentService } from './content-agent.service';

import { ProofOfImpactService } from './proof-of-impact.service';
import { EngineerQueueService } from './engineer-queue.service';
import { WordPressCmsService } from './wordpress-cms.service';

@Module({
  imports: [DatabaseModule, AiSearchModule, AutonomousEngineerModule, SecurityModule, StrategyModule, ImpactModule],
  controllers: [AutomationController, ContentAgentController],
  providers: [AutomationService, EngineerAgentService, EngineerQueueService, ContentGenerationService, ContentAgentService, ProofOfImpactService, WordPressCmsService],
  exports: [AutomationService, ContentGenerationService, ContentAgentService, ProofOfImpactService, WordPressCmsService],
})
export class AutomationModule {}
