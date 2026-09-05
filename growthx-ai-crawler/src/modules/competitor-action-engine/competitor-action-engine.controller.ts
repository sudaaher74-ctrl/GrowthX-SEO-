import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ActionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StrategyEngineService } from './strategy-engine.service';
import { StrategyReadService } from './strategy-read.service';
import { CompetitorSetupService } from './competitor-setup.service';
import { WebsiteComparisonService } from './website-comparison.service';
import { CompetitorSeoReportService } from './competitor-seo-report.service';

export class UpdateActionDto {
  @IsEnum(ActionStatus)
  status: ActionStatus;
}

export class CompetitorDto {
  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  websiteUrl: string;

  @IsString()
  @IsOptional()
  mapsName?: string;

  @IsString()
  @IsOptional()
  youtubeUrl?: string;

  @IsString()
  @IsOptional()
  instagramHandle?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  city?: string;
}

export class UpdateCompetitorDto {
  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsOptional()
  websiteUrl?: string;

  @IsString()
  @IsOptional()
  mapsName?: string;

  @IsString()
  @IsOptional()
  youtubeUrl?: string;

  @IsString()
  @IsOptional()
  instagramHandle?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  city?: string;
}

export class SetGoalDto {
  @IsString()
  businessGoal: string;

  @IsString()
  @IsOptional()
  targetAudience?: string;
}

@ApiTags('Competitor-to-Action Engine')
@ApiBearerAuth()
@Controller('api/projects/:projectId/action-engine')
@UseGuards(JwtAuthGuard)
export class CompetitorActionEngineController {
  constructor(
    private readonly engine: StrategyEngineService,
    private readonly read: StrategyReadService,
    private readonly setup: CompetitorSetupService,
    private readonly comparison: WebsiteComparisonService,
    private readonly seoReport: CompetitorSeoReportService,
  ) {}

  @Get('website-comparison')
  @ApiOperation({
    summary: 'Your site against each competitor, row by row',
    description:
      'Counted from pages the crawler actually fetched. A site never crawled reports null rather than zero, ' +
      'because "not looked at" and "has none" lead a reader to opposite conclusions.',
  })
  websiteComparison(@Param('projectId') projectId: string) {
    return this.comparison.compare(projectId);
  }

  @Get('competitors/:competitorId/seo-report')
  @ApiOperation({
    summary: "Everything the crawler found on one competitor's site, beside your own",
    description:
      'The health score, the problems behind it grouped by kind with example URLs, page coverage by ' +
      'kind, and a row-by-row comparison with your site. A competitor with no crawl reports nulls and ' +
      'says why, rather than rendering zeros that would read as a perfect record.',
  })
  competitorSeoReport(
    @Param('projectId') projectId: string,
    @Param('competitorId') competitorId: string,
  ) {
    return this.seoReport.report(projectId, competitorId);
  }

  @Get('competitors')
  @ApiOperation({ summary: 'The competitors this project tracks, and how each is reachable' })
  listCompetitors(@Param('projectId') projectId: string) {
    return this.setup.list(projectId);
  }

  @Post('competitors')
  @ApiOperation({ summary: 'Track a competitor', description: 'Up to five per project.' })
  addCompetitor(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: CompetitorDto,
  ) {
    return this.setup.create(req.user?.organizationId || req.organizationId, projectId, body);
  }

  @Patch('competitors/:competitorId')
  @ApiOperation({
    summary: 'Edit a tracked competitor',
    description:
      'Everything except the website, which identifies the competitor and anchors its crawl history.',
  })
  updateCompetitor(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('competitorId') competitorId: string,
    @Body() body: UpdateCompetitorDto,
  ) {
    return this.setup.update(
      req.user?.organizationId || req.organizationId,
      projectId,
      competitorId,
      body,
    );
  }

  @Delete('competitors/:competitorId')
  @ApiOperation({ summary: 'Stop tracking a competitor' })
  removeCompetitor(
    @Param('projectId') projectId: string,
    @Param('competitorId') competitorId: string,
  ) {
    return this.setup.remove(projectId, competitorId);
  }

  @Get('strategy/status')
  @ApiOperation({
    summary: 'Where the latest run has got to',
    description: 'Polled by the page after Generate, since the run returns before it finishes.',
  })
  runStatus(@Param('projectId') projectId: string) {
    return this.engine.runStatus(projectId);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Who is ahead, where, and what to do this week',
    description:
      'The four questions the Overview exists to answer, computed from stored findings and the latest plan. ' +
      'Returns an explicit needs-data state rather than an empty shell when nothing has been collected.',
  })
  @ApiParam({ name: 'projectId' })
  overview(@Param('projectId') projectId: string) {
    return this.read.overview(projectId);
  }

  @Get('findings')
  @ApiOperation({ summary: 'Evidence collected, newest first' })
  findings(@Param('projectId') projectId: string, @Query('category') category?: string) {
    return this.read.findings(projectId, category);
  }

  @Get('strategy')
  @ApiOperation({ summary: 'The current 30-day plan, with the evidence behind each action' })
  strategy(@Param('projectId') projectId: string) {
    return this.read.currentStrategy(projectId);
  }

  @Post('strategy/generate')
  @ApiOperation({
    summary: 'Collect fresh evidence and write a new plan',
    description:
      'Reads what has already been crawled and ingested; it does not start a crawl. A surface with no data ' +
      'becomes a stated coverage gap on the run rather than a silently missing section.',
  })
  generate(@Req() req: any, @Param('projectId') projectId: string) {
    return this.engine.generate(req.user?.organizationId || req.organizationId, projectId);
  }

  @Patch('actions/:actionId')
  @ApiOperation({ summary: 'Move an action between Not started, In progress and Done' })
  updateAction(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('actionId') actionId: string,
    @Body() body: UpdateActionDto,
  ) {
    return this.read.setActionStatus(
      req.user?.organizationId || req.organizationId,
      projectId,
      actionId,
      body.status,
    );
  }

  @Patch('business-goal')
  @ApiOperation({
    summary: "Set what the business is optimising for",
    description:
      'Changes how every future action is ranked. Never detected from the site: the same business can be run ' +
      'for leads or for awareness and only its owner knows which.',
  })
  setGoal(@Param('projectId') projectId: string, @Body() body: SetGoalDto) {
    return this.read.setBusinessGoal(projectId, body.businessGoal, body.targetAudience);
  }
}
