import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';
import { ActivityService } from './activity.service';

@ApiTags('Activity')
@ApiBearerAuth()
@Controller('api/projects/:projectId/activity')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
// Every plan (including Free) has CRAWL — this feature check exists only to
// trigger the guard's organization-membership assertion, not to gate a tier.
@RequiresFeature(Feature.CRAWL)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get()
  @ApiOperation({ summary: "A project's recent activity, merged from crawls, automation runs, strategy and shipped content" })
  @ApiParam({ name: 'projectId' })
  list(@Param('projectId') projectId: string, @Query('limit') limit?: string) {
    return this.activity.list(projectId, limit ? Number(limit) : undefined);
  }
}
