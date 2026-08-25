import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiVisibilityModule } from '../ai-visibility/ai-visibility.module';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [DatabaseModule, AiVisibilityModule, OrganizationsModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
