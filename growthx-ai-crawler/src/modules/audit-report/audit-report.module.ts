import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { AuditReportController } from './audit-report.controller';
import { AuditReportService } from './audit-report.service';

// IssueCountService and IssueGroupService come from the global IssuesModule.
@Module({
  imports: [DatabaseModule, AiSearchModule],
  controllers: [AuditReportController],
  providers: [AuditReportService],
  exports: [AuditReportService],
})
export class AuditReportModule {}
