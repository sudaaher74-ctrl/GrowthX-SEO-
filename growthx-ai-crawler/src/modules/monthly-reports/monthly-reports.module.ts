import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MonthlyReportsService } from './monthly-reports.service';
import { MonthlyReportsController } from './monthly-reports.controller';
import { SharedReportsController } from './shared-reports.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [MonthlyReportsController, SharedReportsController],
  providers: [MonthlyReportsService],
  exports: [MonthlyReportsService],
})
export class MonthlyReportsModule {}
