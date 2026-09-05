import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AutomationService } from './automation.service';
import { ContentGenerationService } from './content-generation.service';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

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

/**
 * The autonomous loop: crawl → analyse → plan content → edit the site's code →
 * open a pull request.
 *
 * Pro-only. A PR is the deliverable; publishing to the live site is a separate,
 * explicit opt-in on the repository.
 */
@ApiTags('Autonomous engineer')
@ApiBearerAuth()
@Controller('api/projects/:projectId/automation')
@UseGuards(JwtAuthGuard)
export class AutomationController {
  constructor(
    private readonly automation: AutomationService,
    private readonly content: ContentGenerationService,
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
  draft(@Req() req: any, @Param('pieceId') pieceId: string) {
    return this.content.draft(pieceId, req.organizationId);
  }

  // ── runs

  @Post('runs/fixes')
  @ApiOperation({ summary: 'Apply approved SEO fixes to the repo and open a PR' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ required: false, schema: { type: 'object', properties: { issueIds: { type: 'array', items: { type: 'string' } } } } })
  runFixes(@Req() req: any, @Param('projectId') projectId: string, @Body() body?: { issueIds?: string[] }) {
    return this.automation.runFixes(projectId, req.organizationId, body?.issueIds);
  }

  @Post('runs/content')
  @ApiOperation({ summary: 'Commit drafted pages to the repo and open a PR' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ required: false, schema: { type: 'object', properties: { pieceIds: { type: 'array', items: { type: 'string' } } } } })
  runContent(@Req() req: any, @Param('projectId') projectId: string, @Body() body?: { pieceIds?: string[] }) {
    return this.automation.runContent(projectId, req.organizationId, body?.pieceIds);
  }

  @Get('runs')
  @ApiOperation({ summary: 'History of automation runs, with per-step logs' })
  @ApiParam({ name: 'projectId' })
  listRuns(@Param('projectId') projectId: string) {
    return this.automation.listRuns(projectId);
  }
}
