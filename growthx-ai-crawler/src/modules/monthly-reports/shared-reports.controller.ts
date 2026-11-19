import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MonthlyReportsService } from './monthly-reports.service';

/**
 * Public read-only client portal endpoint backed by cryptographic share tokens.
 * Never returns internal IDs, credentials, or cross-tenant data.
 */
@ApiTags('Public Shared Reports')
@Controller(['api/public/reports', 'public/reports'])
export class SharedReportsController {
  constructor(private readonly monthlyReports: MonthlyReportsService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Fetch a frozen white-labeled monthly report by public share token' })
  getShared(@Param('token') token: string) {
    return this.monthlyReports.getPublicSharedReport(token);
  }
}
