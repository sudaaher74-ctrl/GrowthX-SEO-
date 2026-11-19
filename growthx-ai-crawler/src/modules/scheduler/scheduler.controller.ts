import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CrawlFrequency } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsInt, IsObject, IsOptional, Max, Min } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AgentAutonomyConfig, SchedulerService } from './scheduler.service';

export class UpdateAutomationSettingsDto {
  @IsOptional()
  @IsEnum(CrawlFrequency)
  crawlFrequency?: CrawlFrequency;

  @IsOptional()
  @IsIn(['CRAWL_ONLY', 'FULL_PIPELINE'])
  pipelineMode?: 'CRAWL_ONLY' | 'FULL_PIPELINE';

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(25000)
  maxDepth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxConcurrency?: number;

  @IsOptional()
  @IsBoolean()
  useSitemap?: boolean;

  @IsOptional()
  @IsBoolean()
  autoStageLowRisk?: boolean;

  @IsOptional()
  @IsObject()
  agentAutonomy?: AgentAutonomyConfig;
}

@ApiTags('Automation Settings & Scheduler')
@ApiBearerAuth()
@Controller('api/projects/:projectId/automation-settings')
@UseGuards(JwtAuthGuard)
export class SchedulerController {
  constructor(private readonly scheduler: SchedulerService) {}

  @Get()
  @ApiOperation({ summary: 'Get persisted crawl schedule, pipeline mode, autonomy settings, and next run time' })
  @ApiParam({ name: 'projectId' })
  getSettings(@Req() req: any, @Param('projectId') projectId: string) {
    return this.scheduler.getAutomationSettings(projectId, req.user?.userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Persist crawl schedule, pipeline mode, and autonomy settings to Postgres' })
  @ApiParam({ name: 'projectId' })
  updateSettings(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: UpdateAutomationSettingsDto,
  ) {
    return this.scheduler.updateAutomationSettings(projectId, req.user?.userId, body);
  }

  @Post('run-now')
  @ApiOperation({ summary: 'Dispatch the configured scheduled crawl or full pipeline immediately' })
  @ApiParam({ name: 'projectId' })
  runNow(@Req() req: any, @Param('projectId') projectId: string) {
    return this.scheduler.triggerScheduledWorkloadNow(projectId, req.user?.userId);
  }
}
