import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditReportService } from './audit-report.service';

@ApiTags('Website Audit Report')
@Controller('api/projects/:projectId/audit-report')
@UseGuards(JwtAuthGuard)
export class AuditReportController {
  constructor(private readonly reports: AuditReportService) {}

  @Post()
  @ApiOperation({
    summary: 'The whole Website Audit as one plain-language report, written by Sarvam',
    description: 'A POST because it spends model tokens. The facts are returned even when the analysis fails.',
  })
  generate(@Param('projectId') projectId: string, @Req() req: any) {
    return this.reports.generate(projectId, req.organizationId);
  }

  @Get('latest')
  @ApiOperation({ summary: 'The most recently generated Website Audit report, or null' })
  latest(@Param('projectId') projectId: string) {
    return this.reports.latest(projectId);
  }
}
