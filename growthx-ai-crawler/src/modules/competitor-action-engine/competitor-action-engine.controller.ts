import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ActionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StrategyEngineService } from './strategy-engine.service';
import { StrategyReadService } from './strategy-read.service';

export class UpdateActionDto {
  @IsEnum(ActionStatus)
  status: ActionStatus;
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
  ) {}

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
