import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UsageMetric } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { Metered, OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { EntitlementsService } from '../billing/entitlements.service';
import { Feature } from '../billing/plans.catalog';
import { MarketResearchService } from './market-research.service';
import { MarketActionService } from './market-action.service';
import { OutcomeMeasurementService } from './outcome-measurement.service';
import { WeeklyDeltaService } from './weekly-delta.service';
import { MarketWatchKind } from '@prisma/client';
import { MarketActionStatus } from '@prisma/client';

export class AskQuestionDto {
  question: string;
  threadId?: string;
  /** Opt in to the premium deep-research model. */
  deepResearch?: boolean;
}

export class CreateThreadDto {
  title: string;
}

/**
 * GrowthX Market Research.
 *
 * Every route is project scoped and resolves its organization through
 * EntitlementsGuard, and the service re-checks that the project belongs to that
 * organization before touching any row.
 */
@ApiTags('Market Research')
@ApiBearerAuth()
@Controller('api/projects/:projectId/market-research')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
// Market research is part of the paid strategy layer. `ask` overrides this with
// @Metered because it is the route that actually spends model tokens; the rest
// read or annotate what that route already produced.
@RequiresFeature(Feature.MARKET_STRATEGY)
export class MarketResearchController {
  constructor(
    private readonly research: MarketResearchService,
    private readonly actions: MarketActionService,
    private readonly outcomes: OutcomeMeasurementService,
    private readonly weekly: WeeklyDeltaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get('threads')
  @ApiOperation({ summary: 'Research threads for this project' })
  @ApiParam({ name: 'projectId' })
  listThreads(@Req() req: any, @Param('projectId') projectId: string) {
    return this.research.listThreads(req.organizationId, projectId);
  }

  @Post('threads')
  @ApiOperation({ summary: 'Start a new research thread' })
  @ApiParam({ name: 'projectId' })
  createThread(@Req() req: any, @Param('projectId') projectId: string, @Body() body: CreateThreadDto) {
    return this.research.createThread(req.organizationId, projectId, body?.title ?? 'New research');
  }

  @Get('threads/:threadId')
  @ApiOperation({ summary: 'One thread with its messages, runs and sources' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'threadId' })
  getThread(@Req() req: any, @Param('projectId') projectId: string, @Param('threadId') threadId: string) {
    return this.research.getThread(req.organizationId, projectId, threadId);
  }

  @Post('ask')
  @Metered(Feature.MARKET_STRATEGY, UsageMetric.AI_ANALYSES)
  @ApiOperation({ summary: 'Ask a market research question about this client' })
  @ApiParam({ name: 'projectId' })
  async ask(@Req() req: any, @Param('projectId') projectId: string, @Body() body: AskQuestionDto) {
    const result = await this.research.ask({
      organizationId: req.organizationId,
      projectId,
      threadId: body.threadId,
      question: body.question,
      deepResearch: body.deepResearch,
    });
    await this.entitlements.recordUsage(req.organizationId, UsageMetric.AI_ANALYSES);
    return result;
  }

  // ── action queue (Phase 2)

  @Get('opportunities')
  @ApiOperation({ summary: 'Citation and visibility gaps surfaced by research' })
  @ApiParam({ name: 'projectId' })
  listOpportunities(@Req() req: any, @Param('projectId') projectId: string) {
    return this.actions.listOpportunities(req.organizationId, projectId);
  }

  @Get('actions')
  @ApiOperation({ summary: 'Recommended actions awaiting a decision, with their evidence' })
  @ApiParam({ name: 'projectId' })
  listActions(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('status') status?: MarketActionStatus,
  ) {
    return this.actions.list(req.organizationId, projectId, status);
  }

  @Post('actions/:actionId/approve')
  @ApiOperation({ summary: 'Approve a recommended action' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'actionId' })
  approve(@Req() req: any, @Param('projectId') projectId: string, @Param('actionId') actionId: string) {
    return this.actions.approve(req.organizationId, projectId, actionId, req.user?.userId);
  }

  @Post('actions/:actionId/reject')
  @ApiOperation({ summary: 'Reject a recommended action' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'actionId' })
  reject(@Req() req: any, @Param('projectId') projectId: string, @Param('actionId') actionId: string) {
    return this.actions.reject(req.organizationId, projectId, actionId);
  }

  @Post('actions/:actionId/convert')
  @ApiOperation({ summary: 'Turn an approved action into real GrowthX work' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'actionId' })
  convert(@Req() req: any, @Param('projectId') projectId: string, @Param('actionId') actionId: string) {
    return this.actions.convert(req.organizationId, projectId, actionId);
  }

  // ── measurement and monitoring (Phase 3)

  @Get('outcomes')
  @ApiOperation({ summary: 'Before/after visibility for converted actions' })
  @ApiParam({ name: 'projectId' })
  listOutcomes(@Req() req: any, @Param('projectId') projectId: string) {
    return this.outcomes.list(req.organizationId, projectId);
  }

  @Post('actions/:actionId/measure')
  @ApiOperation({ summary: 'Re-measure one converted action now' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'actionId' })
  measure(@Req() req: any, @Param('projectId') projectId: string, @Param('actionId') actionId: string) {
    return this.outcomes.measure(req.organizationId, projectId, actionId);
  }

  @Get('weekly-delta')
  @ApiOperation({ summary: 'Recent weekly client deltas' })
  @ApiParam({ name: 'projectId' })
  listWeeklyDeltas(@Req() req: any, @Param('projectId') projectId: string) {
    return this.weekly.list(req.organizationId, projectId);
  }

  @Post('weekly-delta')
  @ApiOperation({ summary: 'Generate this week\'s client delta now' })
  @ApiParam({ name: 'projectId' })
  generateWeeklyDelta(@Req() req: any, @Param('projectId') projectId: string) {
    return this.weekly.generate(req.organizationId, projectId);
  }

  @Get('watches')
  @ApiOperation({ summary: 'Competitor and topic watches for this client' })
  @ApiParam({ name: 'projectId' })
  listWatches(@Req() req: any, @Param('projectId') projectId: string) {
    return this.weekly.listWatches(req.organizationId, projectId);
  }

  @Post('watches')
  @ApiOperation({ summary: 'Watch a competitor domain or topic' })
  @ApiParam({ name: 'projectId' })
  createWatch(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { kind: MarketWatchKind; value: string },
  ) {
    return this.weekly.createWatch(req.organizationId, projectId, body.kind, body.value);
  }

  @Post('watches/:watchId/deactivate')
  @ApiOperation({ summary: 'Stop watching' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'watchId' })
  deactivateWatch(@Req() req: any, @Param('projectId') projectId: string, @Param('watchId') watchId: string) {
    return this.weekly.deactivateWatch(req.organizationId, projectId, watchId);
  }

  @Get('runs/:runId/sources')
  @ApiOperation({ summary: 'Every source retrieved for one research run' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'runId' })
  getRunSources(@Req() req: any, @Param('projectId') projectId: string, @Param('runId') runId: string) {
    return this.research.getRunSources(req.organizationId, projectId, runId);
  }
}
