import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom } from '../billing/entitlements.decorator';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('api/projects/:projectId/integrations')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get connected integrations for project' })
  @ApiParam({ name: 'projectId' })
  getIntegrations(@Param('projectId') projectId: string) {
    return this.integrationsService.getIntegrationConfig(projectId);
  }
}
