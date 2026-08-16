import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('api/projects/:projectId/integrations')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
// Connecting GA/GSC/CRM data sources is a paid capability.
@RequiresFeature(Feature.API_ACCESS)
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get connected integrations for project' })
  @ApiParam({ name: 'projectId' })
  getIntegrations(@Param('projectId') projectId: string) {
    return this.integrationsService.getIntegrationConfig(projectId);
  }
}
