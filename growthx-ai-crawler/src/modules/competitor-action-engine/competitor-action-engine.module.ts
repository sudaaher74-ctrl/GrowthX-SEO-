import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CompetitorActionEngineController } from './competitor-action-engine.controller';
import { FindingsCollectorService } from './findings-collector.service';
import { StrategyEngineService } from './strategy-engine.service';
import { StrategyReadService } from './strategy-read.service';

/**
 * The Competitor-to-Action Engine.
 *
 * Reads signal other modules already collect — crawls, Places, YouTube — and
 * turns it into evidence-backed actions. Deliberately depends on none of those
 * modules: it reads their stored output through Prisma, so a collector being
 * unavailable produces a stated coverage gap rather than a broken import.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [CompetitorActionEngineController],
  providers: [FindingsCollectorService, StrategyEngineService, StrategyReadService],
  exports: [FindingsCollectorService, StrategyEngineService, StrategyReadService],
})
export class CompetitorActionEngineModule {}
