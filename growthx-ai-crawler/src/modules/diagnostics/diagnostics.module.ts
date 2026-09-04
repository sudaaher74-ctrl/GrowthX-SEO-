import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MarketResearchModule } from '../market-research/market-research.module';
import { DiagnosticsController } from './diagnostics.controller';
import { DataFeedsService } from './data-feeds.service';

@Module({
  imports: [DatabaseModule, MarketResearchModule],
  controllers: [DiagnosticsController],
  providers: [DataFeedsService],
  exports: [DataFeedsService],
})
export class DiagnosticsModule {}
