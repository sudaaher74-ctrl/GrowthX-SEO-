import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AiAssistant, SearchIntent } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';
import { AiVisibilityService, SUPPORTED_ASSISTANTS } from './ai-visibility.service';
import { AeoAnalysisService } from './aeo-analysis/aeo-analysis.service';

export class AddPromptsDto {
  prompts: { text: string; intent?: SearchIntent; cluster?: string; estimatedVolume?: number }[];
}

export class AddCompetitorDto {
  domain: string;
  label?: string;
}

/**
 * AI Visibility (AEO/GEO) — whether ChatGPT, Claude, and Gemini cite the
 * customer when answering the questions their buyers actually ask.
 *
 * Every route is Pro-only: the whole surface sits behind Feature.AI_VISIBILITY.
 */
@ApiTags('AI Visibility')
@ApiBearerAuth()
@Controller('api/projects/:projectId/ai-visibility')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
@RequiresFeature(Feature.AI_VISIBILITY)
export class AiVisibilityController {
  constructor(
    private readonly visibility: AiVisibilityService,
    private readonly aeo: AeoAnalysisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Citation share, per-assistant breakdown, share of voice, and weekly trend' })
  @ApiParam({ name: 'projectId' })
  @ApiQuery({ name: 'days', required: false, example: 28 })
  async getReport(@Param('projectId') projectId: string, @Query('days') days?: string) {
    const window = Math.min(180, Math.max(7, parseInt(days ?? '28', 10) || 28));
    const report = await this.visibility.getReport(projectId, window);
    return {
      ...report,
      // Stated explicitly so the dashboard never implies we measured an
      // assistant we cannot actually query.
      measurableAssistants: SUPPORTED_ASSISTANTS,
    };
  }

  @Get('prompts')
  @ApiOperation({ summary: 'Tracked prompts with their most recent result per assistant' })
  @ApiParam({ name: 'projectId' })
  listPrompts(@Param('projectId') projectId: string) {
    return this.visibility.listPrompts(projectId);
  }

  @Post('prompts')
  @ApiOperation({ summary: 'Add or update the prompts tracked for this project' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        prompts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', example: 'best insulated jacket for winter hiking' },
              intent: { type: 'string', enum: Object.values(SearchIntent) },
              cluster: { type: 'string', example: 'buying guides' },
              estimatedVolume: { type: 'number', example: 4400 },
            },
          },
        },
      },
    },
  })
  addPrompts(@Param('projectId') projectId: string, @Body() body: AddPromptsDto) {
    return this.visibility.addPrompts(projectId, body?.prompts ?? []);
  }

  @Post('competitors')
  @ApiOperation({ summary: 'Track a competitor for share-of-voice comparison' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        domain: { type: 'string', example: 'trailheadco.com' },
        // Without this, an answer saying "Trailhead Co" rather than the domain
        // is missed, so the label is worth setting.
        label: { type: 'string', example: 'Trailhead Co' },
      },
    },
  })
  addCompetitor(@Param('projectId') projectId: string, @Body() body: AddCompetitorDto) {
    return this.visibility.addCompetitor(projectId, body?.domain, body?.label);
  }

  @Post('sweep')
  @ApiOperation({ summary: 'Run every active prompt against every measurable assistant now' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        assistants: { type: 'array', items: { type: 'string', enum: Object.values(AiAssistant) } },
      },
    },
  })
  sweep(@Param('projectId') projectId: string, @Body() body?: { assistants?: AiAssistant[] }) {
    // The service checks the AI_VISIBILITY_CHECKS allowance for the whole batch
    // before spending anything, then bills only the checks that succeeded.
    return this.visibility.sweepProject(projectId, { assistants: body?.assistants });
  }

  @Get('aeo')
  @ApiOperation({ summary: 'On-page answer-engine readiness (structured data, semantic HTML)' })
  @ApiParam({ name: 'projectId' })
  getAeo(@Param('projectId') projectId: string) {
    return this.aeo.analyzeWebsiteAeo(projectId);
  }
}
