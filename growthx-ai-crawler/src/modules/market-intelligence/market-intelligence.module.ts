import { Module } from '@nestjs/common';
import { MarketIntelligenceService } from './market-intelligence.service';
import { MarketIntelligenceController } from './market-intelligence.controller';

@Module({
  providers: [MarketIntelligenceService],
  controllers: [MarketIntelligenceController]
})
export class MarketIntelligenceModule {}
