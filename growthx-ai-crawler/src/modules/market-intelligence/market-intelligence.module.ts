import { Module } from '@nestjs/common';
import { MarketIntelligenceService } from './market-intelligence.service';
import { MarketIntelligenceController } from './market-intelligence.controller';
import { AiSearchModule } from '../ai-search/ai-search.module';

@Module({
  imports: [AiSearchModule],
  providers: [MarketIntelligenceService],
  controllers: [MarketIntelligenceController]
})
export class MarketIntelligenceModule {}
