import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DiscoveryPipelineService } from './discovery-pipeline.service';
import { DiscoveryStatusService } from './discovery-status.service';
import { AnalysisPipelineService } from './analysis-pipeline.service';

/**
 * The onboarding run, from "website added" through to "competitors tracked".
 *
 * Read-only apart from the re-run, because every step here happens by itself
 * off the crawl. The endpoint exists so the customer can see it happening
 * rather than watching a page that gives no sign anything is under way.
 */
@ApiTags('Discovery')
@ApiBearerAuth()
@Controller('api/projects/:projectId/discovery')
@UseGuards(JwtAuthGuard)
export class DiscoveryPipelineController {
  constructor(
    private readonly status: DiscoveryStatusService,
    private readonly pipeline: DiscoveryPipelineService,
    private readonly analysis: AnalysisPipelineService,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'How far this project has got from website to tracked competitors',
    description:
      'Each step reports what is stored. A step that has not run says so rather than reporting zero, ' +
      'because "not looked at yet" and "looked and found none" lead a reader to opposite conclusions.',
  })
  @ApiParam({ name: 'projectId' })
  getStatus(@Req() req: any, @Param('projectId') projectId: string) {
    return this.status.getStatus(req.user?.organizationId || req.organizationId, projectId);
  }

  @Post('analyze')
  @ApiOperation({
    summary: 'Run the competitor analysis now rather than waiting for tonight',
    description:
      'Classifies collected competitor content, detects creative patterns, finds content gaps, rebuilds ' +
      'the findings, and regenerates the action plan and content strategy — in that order, since each ' +
      'stage refuses to run without the one before it. Reports what each stage did, and a stage that had ' +
      'no input says so rather than being counted as done.',
  })
  @ApiParam({ name: 'projectId' })
  analyze(@Req() req: any, @Param('projectId') projectId: string) {
    return this.analysis.run(req.user?.organizationId || req.organizationId, projectId);
  }

  @Post('crawl-pending-competitors')
  @ApiOperation({
    summary: 'Start the first crawl of any competitor still waiting for one',
    description:
      'The same sweep that runs every ten minutes, for an operator who has just added a competitor ' +
      'and does not want to wait for it.',
  })
  @ApiParam({ name: 'projectId' })
  async crawlPending() {
    await this.pipeline.crawlUncrawledCompetitors();
    return { started: true };
  }
}
