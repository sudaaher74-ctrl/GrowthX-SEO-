import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiVisibilityModule } from '../ai-visibility/ai-visibility.module';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';

@Module({
  imports: [DatabaseModule, AiVisibilityModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
