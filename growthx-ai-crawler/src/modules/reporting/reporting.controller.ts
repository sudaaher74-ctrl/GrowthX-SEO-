import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/projects/:projectId/reporting')
@UseGuards(JwtAuthGuard)
// Client-ready and white-label reporting is a paid capability.
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get()
  async getReportingConfig(@Param('projectId') projectId: string) {
    return this.reportingService.getReportingConfig(projectId);
  }
}
