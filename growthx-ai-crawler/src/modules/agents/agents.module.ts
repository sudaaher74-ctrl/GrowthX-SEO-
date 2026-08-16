import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AgentRunService } from './agent-run.service';

/**
 * The runtime shared by all five agents (SEO auditor, local SEO, market
 * intelligence, strategy, content). Global so an agent can record evidence
 * without every feature module re-importing this one.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [AgentRunService],
  exports: [AgentRunService],
})
export class AgentsModule {}
