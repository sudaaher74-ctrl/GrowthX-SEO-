import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';
import { MonitoringService } from './monitoring.service';

@ApiTags('Monitoring')
@ApiBearerAuth()
@Controller('api/projects/:projectId/monitoring')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
// Continuous monitoring is the scheduled-checks capability.
@RequiresFeature(Feature.SCHEDULED_CRAWLS)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get()
  @ApiOperation({ summary: 'Get Uptime and Performance monitoring configuration/status' })
  @ApiParam({ name: 'projectId' })
  getMonitoring(@Param('projectId') projectId: string) {
    return this.monitoringService.getMonitoringConfig(projectId);
  }
}
