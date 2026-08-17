import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';
import { OutreachService } from './outreach.service';

// Served under `api/` to match every other project-scoped resource; without it
// the dashboard's Outreach requests 404'd.
@Controller('api/projects/:projectId/outreach')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
// Digital PR and outreach sit with the strategy engine.
@RequiresFeature(Feature.MARKET_STRATEGY)
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Get()
  async getCampaigns(@Param('projectId') projectId: string) {
    return this.outreachService.getCampaigns(projectId);
  }
}
