import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AiAssistant, SearchIntent } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiVisibilityService, SUPPORTED_ASSISTANTS } from './ai-visibility.service';
import { AeoAnalysisService } from './aeo-analysis/aeo-analysis.service';

import { IsArray, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PromptItemDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsEnum(SearchIntent)
  intent?: SearchIntent;

  @IsOptional()
  @IsString()
  cluster?: string;

  @IsOptional()
  @IsNumber()
  estimatedVolume?: number;
}

export class AddPromptsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromptItemDto)
  prompts: PromptItemDto[];
}

export class AddCompetitorDto {
  @IsString()
  domain: string;

  @IsOptional()
  @IsString()
  label?: string;
}

/**
 * AI Visibility (AEO/GEO) — whether ChatGPT, Claude, and Gemini cite the
 * customer when answering the questions their buyers actually ask.
 *
 * Every route is Pro-only: the whole surface sits behind.
 */
@ApiTags('AI Visibility')
@ApiBearerAuth()
@Controller('api/projects/:projectId/ai-visibility')
@UseGuards(JwtAuthGuard)
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

  @Get('competitors')
  @ApiOperation({ summary: 'Competitors tracked for this project, cited or not' })
  @ApiParam({ name: 'projectId' })
  listCompetitors(@Param('projectId') projectId: string) {
    return this.visibility.listCompetitors(projectId);
  }

  @Delete('competitors/:competitorId')
  @ApiOperation({ summary: 'Stop tracking a competitor' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'competitorId' })
  removeCompetitor(@Param('projectId') projectId: string, @Param('competitorId') competitorId: string) {
    return this.visibility.removeCompetitor(projectId, competitorId);
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

  @Get('council')
  @ApiOperation({ summary: 'Tri-engine AI council discussion between Claude, ChatGPT, and Gemini' })
  @ApiParam({ name: 'projectId' })
  @ApiQuery({ name: 'topic', required: false, example: 'How to increase enterprise conversions' })
  getCouncil(@Param('projectId') projectId: string, @Query('topic') topic?: string) {
    return this.visibility.getCouncilDiscussion(projectId, topic);
  }

  @Post('council')
  @ApiOperation({ summary: 'Ask custom question to the Tri-engine AI council' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        topic: { type: 'string', example: 'How do we beat our biggest competitor?' },
      },
    },
  })
  askCouncil(@Param('projectId') projectId: string, @Body() body?: { topic?: string }) {
    return this.visibility.getCouncilDiscussion(projectId, body?.topic);
  }

  @Get('specialized')
  @ApiOperation({ summary: 'Specialized deep AI intelligence appointed to Claude (Market/Demographics), OpenAI (Commercial/Conquesting), or Gemini (Google Ecosystem/AIO)' })
  @ApiParam({ name: 'projectId' })
  @ApiQuery({ name: 'engine', required: false, enum: ['CLAUDE', 'OPENAI', 'GEMINI'] })
  @ApiQuery({ name: 'location', required: false, example: 'Navi Mumbai' })
  getSpecialized(
    @Param('projectId') projectId: string,
    @Query('engine') engine?: 'CLAUDE' | 'OPENAI' | 'GEMINI',
    @Query('location') location?: string,
  ) {
    return this.visibility.getSpecializedAiIntelligence(projectId, engine, location);
  }

  @Post('specialized')
  @ApiOperation({ summary: 'Query specialized deep AI intelligence with target location or parameters' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        engine: { type: 'string', enum: ['CLAUDE', 'OPENAI', 'GEMINI'] },
        location: { type: 'string', example: 'Navi Mumbai' },
      },
    },
  })
  querySpecialized(
    @Param('projectId') projectId: string,
    @Body() body?: { engine?: 'CLAUDE' | 'OPENAI' | 'GEMINI'; location?: string },
  ) {
    return this.visibility.getSpecializedAiIntelligence(projectId, body?.engine, body?.location);
  }
}

