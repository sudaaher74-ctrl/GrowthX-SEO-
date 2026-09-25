import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ActionStatus, FindingLifecycle, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StrategyEngineService } from './strategy-engine.service';
import { StrategyReadService } from './strategy-read.service';
import { CompetitorSetupService } from './competitor-setup.service';
import { WebsiteComparisonService } from './website-comparison.service';
import { CompetitorSeoReportService } from './competitor-seo-report.service';
import { CompetitorIntelReportService } from './competitor-intel-report.service';
import { CompetitorInterceptService } from './competitor-intercept.service';
import { ProgrammaticDecompilerService } from './programmatic-decompiler.service';
import { CompetitorStealthRadarService } from './competitor-stealth-radar.service';
import { PrismaService } from '../../database/prisma.service';

export class UpdateActionDto {
  @IsEnum(ActionStatus)
  status: ActionStatus;
}

export class GenerateBlueprintDto {
  @IsString()
  keyword: string;

  @IsString()
  competitorDomain: string;

  @IsString()
  @IsOptional()
  competitorUrl?: string;

  @IsString()
  @IsOptional()
  weaknessType?: string;
}

export class DispatchToQueueDto {
  @IsString()
  title: string;

  @IsString()
  summary: string;

  @IsString()
  recommendedAction: string;

  @IsString()
  @IsOptional()
  potential?: string;

  @IsString()
  @IsOptional()
  effort?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsOptional()
  evidence?: any;

  @IsOptional()
  actionPayload?: any;

  @IsOptional()
  affectedPages?: string[];
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
    private readonly interceptService: CompetitorInterceptService,
    private readonly decompiler: ProgrammaticDecompilerService,
    private readonly radar: CompetitorStealthRadarService,
    private readonly prisma: PrismaService,
    private readonly intelReport: CompetitorIntelReportService,
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

  @Get('rival-advantages')
  @ApiOperation({
    summary: "What each rival's site has that yours does not",
    description:
      'Topics, kinds of page, structured data, content depth, question headings, AI mentions and Google ' +
      'reviews, counted from the latest crawls. The measured half of the competitor report, without the model.',
  })
  rivalAdvantages(@Param('projectId') projectId: string) {
    return this.intelReport.gatherFacts(projectId);
  }

  @Post('competitor-report')
  @ApiOperation({
    summary: 'Full competitor report: crawl facts for you and each rival, analysed by Sarvam',
    description:
      'A POST because it spends model tokens. The facts are returned even when the analysis fails, ' +
      'with analysisError saying why, so the data can still be downloaded.',
  })
  competitorReport(@Param('projectId') projectId: string, @Req() req: any) {
    return this.intelReport.generate(projectId, req.organizationId);
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

  @Get('autonomous-plan')
  @ApiOperation({ summary: 'Status of the 30-day autonomous execution plan' })
  autonomousPlanStatus(@Param('projectId') projectId: string) {
    return this.read.getAutonomousPlanStatus(projectId);
  }

  @Post('autonomous-plan/approve')
  @ApiOperation({ summary: 'Approve the 30-day autonomous execution plan to put platform on autopilot' })
  approveAutonomousPlan(@Req() req: any, @Param('projectId') projectId: string) {
    return this.read.approveAutonomousPlan(
      req.user?.organizationId || req.organizationId || 'default-org',
      projectId,
    );
  }

  @Post('autonomous-plan/execute-sprint')
  @ApiOperation({ summary: 'Trigger autonomous execution batch for a sprint week or specific action IDs' })
  executeSprint(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { sprintWeek?: number; actionIds?: string[] },
  ) {
    return this.read.executeSprintBatch(
      req.user?.organizationId || req.organizationId || 'default-org',
      projectId,
      body.sprintWeek ?? 1,
      body.actionIds,
    );
  }

  @Get('intercepts')
  @ApiOperation({ summary: 'List competitor intercept and keyword poaching opportunities' })
  getIntercepts(
    @Param('projectId') projectId: string,
    @Query('competitorId') competitorId?: string,
  ) {
    return this.interceptService.getInterceptOpportunities(projectId, { competitorId });
  }

  @Post('intercepts/generate-blueprint')
  @ApiOperation({ summary: 'Generate a targeted counter-attack content blueprint for any keyword' })
  generateBlueprint(
    @Param('projectId') projectId: string,
    @Body() body: GenerateBlueprintDto,
  ) {
    return this.interceptService.generateBlueprint(projectId, body);
  }

  @Get('programmatic-matrix')
  @ApiOperation({ summary: 'Reverse-engineer competitor programmatic SEO directories and formulas' })
  getProgrammaticMatrix(
    @Param('projectId') projectId: string,
    @Query('competitorId') competitorId?: string,
  ) {
    return this.decompiler.getProgrammaticMatrix(projectId, competitorId);
  }

  @Get('stealth-radar')
  @ApiOperation({ summary: 'Real-time stealth radar detecting competitor DOM/Schema changes, title pivots, and broken 404 links' })
  getStealthRadar(
    @Param('projectId') projectId: string,
  ) {
    return this.radar.getStealthRadarEvents(projectId);
  }

  @Post('dispatch-to-queue')
  @ApiOperation({ summary: 'Dispatch competitor finding or blueprint to customer Action Queue' })
  async dispatchToQueue(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: DispatchToQueueDto,
  ) {
    const orgId = req.user?.organizationId || req.organizationId || 'default-org';
    const hashSeed = `${projectId}:${body.title}:${body.recommendedAction}`;
    const fingerprint = `comp_action_${crypto.createHash('sha256').update(hashSeed).digest('hex').slice(0, 16)}`;
    const now = new Date();

    const priorityScore = body.potential === 'HIGH' ? 85 : body.potential === 'LOW' ? 40 : 65;

    const opportunity = await this.prisma.growthOpportunity.upsert({
      where: {
        projectId_fingerprint: {
          projectId,
          fingerprint,
        },
      },
      create: {
        projectId,
        organizationId: orgId,
        fingerprint,
        source: body.source || 'COMPETITOR',
        category: body.category || 'COMPETITOR',
        title: body.title,
        summary: body.summary,
        recommendedAction: body.recommendedAction,
        evidence: (body.evidence || [
          { label: 'Source', value: 'Competitor Intelligence Weapon', source: 'COMPETITOR_ENGINE' },
        ]) as unknown as Prisma.InputJsonValue,
        potential: body.potential || 'HIGH',
        effort: body.effort || 'MEDIUM',
        confidence: 90,
        priority: priorityScore,
        impact: priorityScore,
        fixClass: 'APPROVAL',
        affectedPages: body.affectedPages || [],
        affectedCount: (body.affectedPages || []).length || 1,
        status: 'OPEN',
        lifecycle: FindingLifecycle.QUEUED,
        detectedAt: now,
        lastSeenAt: now,
        lastTransitionAt: now,
        transitions: [
          {
            from: 'DETECTED',
            to: 'QUEUED',
            at: now.toISOString(),
            actor: { type: 'USER' },
            reason: 'Dispatched manually from Competitor Intelligence Weapon',
          },
        ] as unknown as Prisma.InputJsonValue,
      },
      update: {
        title: body.title,
        summary: body.summary,
        recommendedAction: body.recommendedAction,
        potential: body.potential || 'HIGH',
        effort: body.effort || 'MEDIUM',
        lastSeenAt: now,
      },
    });

    return {
      success: true,
      message: 'Successfully dispatched to Action Queue',
      opportunityId: opportunity.id,
      fingerprint: opportunity.fingerprint,
      lifecycle: opportunity.lifecycle,
    };
  }
}

