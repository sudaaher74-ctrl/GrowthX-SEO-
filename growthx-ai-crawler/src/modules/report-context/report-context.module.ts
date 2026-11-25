import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { UnifiedReportContextService } from './unified-report-context.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [UnifiedReportContextService],
  exports: [UnifiedReportContextService],
})
export class ReportContextModule {}
