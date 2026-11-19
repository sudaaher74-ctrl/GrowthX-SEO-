import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiVisibilityModule } from '../ai-visibility/ai-visibility.module';
import { MonthlyReportsModule } from '../monthly-reports/monthly-reports.module';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [DatabaseModule, AiVisibilityModule, OrganizationsModule, MonthlyReportsModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
