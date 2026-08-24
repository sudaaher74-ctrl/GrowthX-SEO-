import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('api/projects/:projectId/integrations')
@UseGuards(JwtAuthGuard)
// Connecting GA/GSC/CRM data sources is a paid capability.
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get connected integrations for project' })
  @ApiParam({ name: 'projectId' })
  getIntegrations(@Param('projectId') projectId: string) {
    return this.integrationsService.getIntegrationConfig(projectId);
  }
}
