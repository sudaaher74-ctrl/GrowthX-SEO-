import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarketResearchService } from './market-research.service';
import { MarketActionService } from './market-action.service';
import { OutcomeMeasurementService } from './outcome-measurement.service';
import { WeeklyDeltaService } from './weekly-delta.service';
import { MarketWatchKind } from '@prisma/client';
import { MarketActionStatus } from '@prisma/client';
import { IsString, IsOptional, IsBoolean, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class AskQuestionDto {
  @IsString()
  question: string;

  @IsString()
  @IsOptional()
  threadId?: string;

  /** Opt in to the premium deep-research model. */
  @IsBoolean()
  @IsOptional()
  deepResearch?: boolean;
}

export class CreateThreadDto {
  // Optional: the route defaults an absent title to 'New research'. Requiring
  // it here would turn that documented default into a 400.
  @IsString()
  @IsOptional()
  title?: string;
}

export class AutoIdentifyCompetitorsDto {
  @IsString()
  @IsOptional()
  websiteUrl?: string;

  @IsString()
  @IsOptional()
  domain?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  region?: string;
}

export class SelectedCompetitorItemDto {
  @IsString()
  domain: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsNumber()
  @IsOptional()
  confidenceScore?: number;
}

export class AddSelectedCompetitorsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedCompetitorItemDto)
  competitors: SelectedCompetitorItemDto[];
}

/**
 * GrowthX Market Research.
 *
 * Every route is project scoped and resolves its organization through
 *  and the service re-checks that the project belongs to that
 * organization before touching any row.
 */
@ApiTags('Market Research')
@ApiBearerAuth()
@Controller('api/projects/:projectId/market-research')
@UseGuards(JwtAuthGuard)
// Market research is part of the paid strategy layer. `ask` overrides this with
// @Metered because it is the route that actually spends model tokens; the rest
// read or annotate what that route already produced.
export class MarketResearchController {
  constructor(
    private readonly research: MarketResearchService,
    private readonly actions: MarketActionService,
    private readonly outcomes: OutcomeMeasurementService,
    private readonly weekly: WeeklyDeltaService,
  ) {}

  @Post('auto-identify-competitors')
  @ApiOperation({ summary: 'Automatically identify top 5 competitors for this project website' })
  @ApiParam({ name: 'projectId' })
  autoIdentifyCompetitors(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: AutoIdentifyCompetitorsDto,
  ) {
    return this.research.autoIdentifyCompetitors(
      req.user?.organizationId || req.organizationId,
      projectId,
      body,
    );
  }

  @Post('add-selected-competitors')
  @ApiOperation({ summary: 'Add selected competitors (e.g. 3 of 5) to project tracking' })
  @ApiParam({ name: 'projectId' })
  addSelectedCompetitors(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: AddSelectedCompetitorsDto,
  ) {
    return this.research.addSelectedCompetitors(
      req.user?.organizationId || req.organizationId,
      projectId,
      body.competitors,
    );
  }

  @Get('suggested-questions')
  @ApiOperation({ summary: "Opening questions written around this client's own business" })
  @ApiParam({ name: 'projectId' })
  suggestedQuestions(@Req() req: any, @Param('projectId') projectId: string) {
    return this.research.suggestedQuestions(req.user?.organizationId || req.organizationId, projectId);
  }

  @Get('threads')
  @ApiOperation({ summary: 'Research threads for this project' })
  @ApiParam({ name: 'projectId' })
  listThreads(@Req() req: any, @Param('projectId') projectId: string) {
    return this.research.listThreads(req.user?.organizationId || req.organizationId, projectId);
  }

  @Post('threads')
  @ApiOperation({ summary: 'Start a new research thread' })
  @ApiParam({ name: 'projectId' })
  createThread(@Req() req: any, @Param('projectId') projectId: string, @Body() body: CreateThreadDto) {
    return this.research.createThread(req.user?.organizationId || req.organizationId, projectId, body?.title ?? 'New research');
  }

  @Get('threads/:threadId')
  @ApiOperation({ summary: 'One thread with its messages, runs and sources' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'threadId' })
  getThread(@Req() req: any, @Param('projectId') projectId: string, @Param('threadId') threadId: string) {
    return this.research.getThread(req.user?.organizationId || req.organizationId, projectId, threadId);
  }

  @Post('ask')
  @ApiOperation({ summary: 'Ask a market research question about this client' })
  @ApiParam({ name: 'projectId' })
  async ask(@Req() req: any, @Param('projectId') projectId: string, @Body() body: AskQuestionDto) {
    const result = await this.research.ask({
      organizationId: req.user?.organizationId || req.organizationId,
      projectId,
      threadId: body.threadId,
      question: body.question,
      deepResearch: body.deepResearch,
    });
    return result;
  }

  // ── action queue (Phase 2)

  @Get('opportunities')
  @ApiOperation({ summary: 'Citation and visibility gaps surfaced by research' })
  @ApiParam({ name: 'projectId' })
  listOpportunities(@Req() req: any, @Param('projectId') projectId: string) {
    return this.actions.listOpportunities(req.user?.organizationId || req.organizationId, projectId);
  }

  @Get('actions')
  @ApiOperation({ summary: 'Recommended actions awaiting a decision, with their evidence' })
  @ApiParam({ name: 'projectId' })
  listActions(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('status') status?: MarketActionStatus,
  ) {
    return this.actions.list(req.user?.organizationId || req.organizationId, projectId, status);
  }

  @Post('actions/:actionId/approve')
  @ApiOperation({ summary: 'Approve a recommended action' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'actionId' })
  approve(@Req() req: any, @Param('projectId') projectId: string, @Param('actionId') actionId: string) {
    return this.actions.approve(req.user?.organizationId || req.organizationId, projectId, actionId, req.user?.userId);
  }

  @Post('actions/:actionId/reject')
  @ApiOperation({ summary: 'Reject a recommended action' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'actionId' })
  reject(@Req() req: any, @Param('projectId') projectId: string, @Param('actionId') actionId: string) {
    return this.actions.reject(req.user?.organizationId || req.organizationId, projectId, actionId);
  }

  @Post('actions/:actionId/convert')
  @ApiOperation({ summary: 'Turn an approved action into real GrowthX work' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'actionId' })
  convert(@Req() req: any, @Param('projectId') projectId: string, @Param('actionId') actionId: string) {
    return this.actions.convert(req.user?.organizationId || req.organizationId, projectId, actionId);
  }

  // ── measurement and monitoring (Phase 3)

  @Get('outcomes')
  @ApiOperation({ summary: 'Before/after visibility for converted actions' })
  @ApiParam({ name: 'projectId' })
  listOutcomes(@Req() req: any, @Param('projectId') projectId: string) {
    return this.outcomes.list(req.user?.organizationId || req.organizationId, projectId);
  }

  @Post('actions/:actionId/measure')
  @ApiOperation({ summary: 'Re-measure one converted action now' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'actionId' })
  measure(@Req() req: any, @Param('projectId') projectId: string, @Param('actionId') actionId: string) {
    return this.outcomes.measure(req.user?.organizationId || req.organizationId, projectId, actionId);
  }

  @Get('weekly-delta')
  @ApiOperation({ summary: 'Recent weekly client deltas' })
  @ApiParam({ name: 'projectId' })
  listWeeklyDeltas(@Req() req: any, @Param('projectId') projectId: string) {
    return this.weekly.list(req.user?.organizationId || req.organizationId, projectId);
  }

  @Post('weekly-delta')
  @ApiOperation({ summary: 'Generate this week\'s client delta now' })
  @ApiParam({ name: 'projectId' })
  generateWeeklyDelta(@Req() req: any, @Param('projectId') projectId: string) {
    return this.weekly.generate(req.user?.organizationId || req.organizationId, projectId);
  }

  @Get('watches')
  @ApiOperation({ summary: 'Competitor and topic watches for this client' })
  @ApiParam({ name: 'projectId' })
  listWatches(@Req() req: any, @Param('projectId') projectId: string) {
    return this.weekly.listWatches(req.user?.organizationId || req.organizationId, projectId);
  }

  @Post('watches')
  @ApiOperation({ summary: 'Watch a competitor domain or topic' })
  @ApiParam({ name: 'projectId' })
  createWatch(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { kind: MarketWatchKind; value: string },
  ) {
    return this.weekly.createWatch(req.user?.organizationId || req.organizationId, projectId, body.kind, body.value);
  }

  @Post('watches/:watchId/deactivate')
  @ApiOperation({ summary: 'Stop watching' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'watchId' })
  deactivateWatch(@Req() req: any, @Param('projectId') projectId: string, @Param('watchId') watchId: string) {
    return this.weekly.deactivateWatch(req.user?.organizationId || req.organizationId, projectId, watchId);
  }

  @Get('runs/:runId/sources')
  @ApiOperation({ summary: 'Every source retrieved for one research run' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'runId' })
  getRunSources(@Req() req: any, @Param('projectId') projectId: string, @Param('runId') runId: string) {
    return this.research.getRunSources(req.user?.organizationId || req.organizationId, projectId, runId);
  }
}
