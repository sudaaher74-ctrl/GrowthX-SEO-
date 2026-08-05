import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { AutonomousEngineerModule } from '../autonomous-engineer/autonomous-engineer.module';
import { SecurityModule } from '../security/security.module';
import { StrategyModule } from '../strategy/strategy.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';
import { ContentGenerationService } from './content-generation.service';

@Module({
  imports: [DatabaseModule, AiSearchModule, AutonomousEngineerModule, SecurityModule, StrategyModule],
  controllers: [AutomationController],
  providers: [AutomationService, ContentGenerationService],
  exports: [AutomationService, ContentGenerationService],
})
export class AutomationModule {}
