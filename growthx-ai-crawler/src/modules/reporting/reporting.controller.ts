import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';

@Controller('projects/:projectId/reporting')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
// Client-ready and white-label reporting is a paid capability.
@RequiresFeature(Feature.WHITE_LABEL_REPORTS)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get()
  async getReportingConfig(@Param('projectId') projectId: string) {
    return this.reportingService.getReportingConfig(projectId);
  }
}
