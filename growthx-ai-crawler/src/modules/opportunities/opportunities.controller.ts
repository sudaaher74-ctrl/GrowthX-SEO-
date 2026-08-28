import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OpportunitiesService } from './opportunities.service';
import { OpportunityDetectionService } from './opportunity-detection.service';
import { ExecutiveSummaryService } from './executive-summary.service';

@ApiTags('Growth Opportunities')
@ApiBearerAuth()
@Controller('api/projects/:projectId/opportunities')
@UseGuards(JwtAuthGuard)
export class OpportunitiesController {
  constructor(
    private readonly opportunities: OpportunitiesService,
    private readonly detection: OpportunityDetectionService,
    private readonly executive: ExecutiveSummaryService,
  ) {}

  /**
   * The executive dashboard's figures — only the ones that are real.
   *
   * Lives here rather than in its own module because it is the same question
   * the opportunity list answers, asked at a summary level.
   */
  @Get('executive-summary')
  @ApiOperation({ summary: 'Headline measurements, with an honest reason wherever there is none' })
  executiveSummary(@Req() req: any, @Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.executive.summary(req.organizationId, projectId, days ? parseInt(days, 10) : 28);
  }

  @Get()
  @ApiOperation({ summary: 'The unified opportunity list' })
  list(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('category') category?: string,
    @Query('source') source?: string,
    @Query('status') status?: string,
  ) {
    return this.opportunities.list(req.organizationId, projectId, { category, source, status });
  }

  /**
   * Re-runs detection now.
   *
   * Also runs on a schedule after each sync; this is for a customer who has
   * just connected something and does not want to wait until tomorrow.
   */
  @Post('detect')
  @ApiOperation({ summary: 'Re-run opportunity detection for the project' })
  detect(@Req() req: any, @Param('projectId') projectId: string) {
    return this.detection.detect(req.organizationId, projectId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Mark an opportunity actioned or dismissed' })
  setStatus(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { status: 'OPEN' | 'ACTIONED' | 'DISMISSED' },
  ) {
    return this.opportunities.setStatus(req.organizationId, projectId, id, body.status);
  }
}
