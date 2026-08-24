import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OutreachService } from './outreach.service';

@Controller('api/projects/:projectId/outreach')
@UseGuards(JwtAuthGuard)
// Digital PR and outreach sit with the strategy engine.
export class OutreachController {
  constructor(private readonly outreachService: OutreachService) {}

  @Get()
  async getCampaigns(@Param('projectId') projectId: string) {
    return this.outreachService.getCampaigns(projectId);
  }
}
