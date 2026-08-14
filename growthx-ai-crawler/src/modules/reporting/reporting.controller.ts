import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('projects/:projectId/reporting')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get()
  async getReportingConfig(@Param('projectId') projectId: string) {
    return this.reportingService.getReportingConfig(projectId);
  }
}
