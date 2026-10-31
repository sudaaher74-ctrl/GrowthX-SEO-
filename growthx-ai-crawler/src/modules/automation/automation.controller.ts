import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutomationService } from './automation.service';
import { ContentGenerationService } from './content-generation.service';
import { EngineerAgentService } from './engineer-agent.service';
import { ProofOfImpactService } from './proof-of-impact.service';
import { IsString, IsOptional, IsEnum, IsBoolean, MaxLength, MinLength, IsArray, ArrayMaxSize } from 'class-validator';

export class ConnectRepoDto {
  @IsString()
  owner: string;
  @IsString()
  name: string;
  @IsString()
  accessToken: string;
  @IsOptional()
  @IsString()
  defaultBranch?: string;
  @IsOptional()
  @IsEnum(['nextjs', 'static-html', 'unknown'])
  framework?: 'nextjs' | 'static-html' | 'unknown';
  @IsOptional()
  @IsString()
  contentDir?: string;
  @IsOptional()
  @IsBoolean()
  autoMerge?: boolean;
}

export class EngineerRunDto {
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  instruction: string;
}

export class PlanFixesDto {
  @IsOptional() @IsArray() @ArrayMaxSize(8) @IsString({ each: true })
  findingIds?: string[];
  @IsOptional() @IsString() @MaxLength(40)
  sourceModule?: string;
}

export class RunSelectionsDto {
  @IsOptional() @IsArray() @ArrayMaxSize(25) @IsString({ each: true })
  issueIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(25) @IsString({ each: true })
  pieceIds?: string[];
}

/**
 * The autonomous loop: crawl → analyse → plan content → edit the site's code →
 * open a pull request.
 *
 * A pull request is the only deliverable. Nothing is merged or published by the
 * platform; the customer reviews and merges.
 */
@ApiTags('Autonomous engineer')
@ApiBearerAuth()
@Controller('api/projects/:projectId/automation')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(
    private readonly automation: AutomationService,
    private readonly content: ContentGenerationService,
    private readonly engineer: EngineerAgentService,
    private readonly proofOfImpact: ProofOfImpactService,
  ) {}

  // ── repository

  @Get('repository')
  @ApiOperation({ summary: 'The connected repository (never returns the token)' })
  @ApiParam({ name: 'projectId' })
  getRepository(@Param('projectId') projectId: string) {
    return this.automation.getRepository(projectId);
  }

  @Post('repository')
  @ApiOperation({ summary: "Connect the client's website repository" })
  @ApiParam({ name: 'projectId' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', example: 'acme-inc' },
        name: { type: 'string', example: 'website' },
        accessToken: { type: 'string', description: 'GitHub PAT with Contents: Read and write' },
        defaultBranch: { type: 'string', example: 'main' },
        framework: { type: 'string', enum: ['nextjs', 'static-html', 'unknown'] },
        contentDir: { type: 'string', example: 'content/blog' },
        autoMerge: { type: 'boolean', example: false },
      },
    },
  })
  connectRepository(@Param('projectId') projectId: string, @Body() body: ConnectRepoDto) {
    return this.automation.connectRepository(projectId, body);
  }

  // ── content pipeline

  @Post('content/plan')
  @ApiOperation({ summary: "Turn the latest strategy's content plan into tracked pieces" })
  @ApiParam({ name: 'projectId' })
  planContent(@Param('projectId') projectId: string) {
    return this.content.planFromStrategy(projectId);
  }

  @Post('content/custom')
  @ApiOperation({ summary: 'Create a custom planned content piece' })
  @ApiParam({ name: 'projectId' })
  createCustom(
    @Param('projectId') projectId: string,
    @Body() body: { title: string; targetQuery?: string; format?: string; rationale?: string },
  ) {
    return this.content.createCustomPiece(projectId, body);
  }

  @Get('content')
  @ApiOperation({ summary: 'Planned, drafted and shipped content for this client' })
  @ApiParam({ name: 'projectId' })
  listContent(@Param('projectId') projectId: string) {
    return this.content.list(projectId);
  }

  @Post('content/:pieceId/draft')
  @ApiOperation({ summary: 'Write the actual page for a planned piece' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'pieceId' })
  draft(@Req() req: any, @Param('projectId') projectId: string, @Param('pieceId') pieceId: string) {
    return this.content.draft(projectId, pieceId, req.organizationId);
  }

  // ── runs

  @Post('runs/fixes')
  @ApiOperation({ summary: 'Apply approved SEO fixes to the repo and open a PR' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ required: false, schema: { type: 'object', properties: { issueIds: { type: 'array', items: { type: 'string' } } } } })
  runFixes(@Req() req: any, @Param('projectId') projectId: string, @Body() body?: RunSelectionsDto) {
    return this.engineer.startApprovedFixes(projectId, req.organizationId, body?.issueIds).then(r => r.run);
  }

  @Post('runs/engineer')
  @ApiOperation({ summary: 'Describe a change in words; the engineer edits the repo and opens a pull request' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ schema: { type: 'object', required: ['instruction'], properties: { instruction: { type: 'string', example: 'Change the homepage title to "Fresh A2 milk delivered in Pune"' } } } })
  runEngineer(@Req() req: any, @Param('projectId') projectId: string, @Body() body: EngineerRunDto) {
    // Returns at once with the run (RUNNING); it finishes in the background and shows in GET runs.
    return this.engineer.start(projectId, req.organizationId, body.instruction).then((r) => r.run);
  }

  @Post('runs/plan-fixes')
  @ApiOperation({ summary: 'Apply selected Fix Engine findings across all tabs via GitHub and open a pull request' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        findingIds: { type: 'array', items: { type: 'string' } },
        sourceModule: { type: 'string', example: 'ALL' },
      },
    },
  })
  runPlanFixes(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body?: PlanFixesDto,
  ) {
    return this.engineer.startForFindings(projectId, req.organizationId, body).then((r) => r.run);
  }

  @Post('runs/content')
  @ApiOperation({ summary: 'Commit drafted pages to the repo and open a PR' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ required: false, schema: { type: 'object', properties: { pieceIds: { type: 'array', items: { type: 'string' } } } } })
  runContent(@Req() req: any, @Param('projectId') projectId: string, @Body() body?: RunSelectionsDto) {
    return this.engineer.startContent(projectId, req.organizationId, body?.pieceIds).then(r => r.run);
  }

  @Get('runs')
  @ApiOperation({ summary: 'History of automation runs, with per-step logs' })
  @ApiParam({ name: 'projectId' })
  listRuns(@Param('projectId') projectId: string) {
    return this.automation.listRuns(projectId);
  }

  @Get('engineer/status')
  engineerStatus() { return this.engineer.queueStatus(); }

  @Get('changes')
  @ApiOperation({ summary: 'Saved before/after fix evidence and subsequent crawl measurements' })
  listChanges(@Param('projectId') projectId: string) {
    return this.automation.listChanges(projectId);
  }

  // ── Proof of Impact (Fix Engine 2.0)

  @Get('impact/overview')
  @ApiOperation({ summary: 'Fix Engine 2.0 Overview dashboard metrics' })
  @ApiParam({ name: 'projectId' })
  getImpactOverview(@Param('projectId') projectId: string) {
    return this.proofOfImpact.getOverview(projectId);
  }

  @Get('impact/history')
  @ApiOperation({ summary: 'Searchable fix history with status and impact' })
  @ApiParam({ name: 'projectId' })
  getImpactHistory(@Param('projectId') projectId: string) {
    return this.proofOfImpact.getFixHistory(projectId);
  }

  @Get('impact/fixes/:runId')
  @ApiOperation({ summary: 'Comprehensive before & after fix detail, comparisons, and attribution' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'runId' })
  getFixDetail(@Param('projectId') projectId: string, @Param('runId') runId: string) {
    return this.proofOfImpact.getFixDetail(projectId, runId);
  }

  @Post('impact/fixes/:runId/verify')
  @ApiOperation({ summary: 'Trigger live deployment verification crawl and check for regressions' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'runId' })
  verifyFixDeployment(
    @Param('projectId') projectId: string,
    @Param('runId') runId: string,
  ) {
    return this.proofOfImpact.verifyDeployment(projectId, runId);
  }

  @Get('impact/ledger')
  @ApiOperation({ summary: 'Append-only chronological audit ledger of fix engine events' })
  @ApiParam({ name: 'projectId' })
  getImpactLedger(@Param('projectId') projectId: string) {
    return this.proofOfImpact.getImpactLedger(projectId);
  }

  @Get('impact/proof-cards')
  @ApiOperation({ summary: 'Visual before 30/90 days vs now proof cards for website changes' })
  @ApiParam({ name: 'projectId' })
  getImpactProofCards(@Param('projectId') projectId: string) {
    return this.proofOfImpact.get30d90dProof(projectId);
  }

  @Post('impact/loop/trigger')
  @ApiOperation({ summary: 'Evaluate 14-30 day search lift and trigger closed-loop feedback pivots if flat' })
  @ApiParam({ name: 'projectId' })
  triggerImpactLoop(
    @Param('projectId') projectId: string,
    @Body() body?: { runId?: string },
  ) {
    return this.proofOfImpact.evaluateAndTriggerLoop(projectId, body?.runId);
  }

  @Get('impact/analytics')
  @ApiOperation({ summary: 'Technical, Search (GSC), AI Visibility, and GA4 Business impact analytics' })
  @ApiParam({ name: 'projectId' })
  getImpactAnalytics(@Param('projectId') projectId: string) {
    return this.proofOfImpact.getImpactAnalytics(projectId);
  }

  @Get('impact/report')
  @ApiOperation({ summary: 'Generate structured evidence-based impact report for a fix or monthly summary' })
  @ApiParam({ name: 'projectId' })
  getImpactReport(
    @Param('projectId') projectId: string,
    @Req() req: any,
  ) {
    const runId = req.query?.runId as string | undefined;
    return this.proofOfImpact.generateImpactReport(projectId, runId);
  }
}
