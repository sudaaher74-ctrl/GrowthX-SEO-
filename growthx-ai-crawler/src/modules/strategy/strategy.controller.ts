import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StrategyService } from './strategy.service';
import { AgentRunService } from '../agents/agent-run.service';

/**
 * Market analysis, SEO roadmap, content plan, and social strategy — the
 * "what do we do about it" layer on top of the crawl and visibility data.
 * Pro-only.
 */
@ApiTags('Strategy')
@ApiBearerAuth()
@Controller('api/projects/:projectId/strategy')
@UseGuards(JwtAuthGuard)
export class StrategyController {
  constructor(
    private readonly strategy: StrategyService,
    private readonly agentRuns: AgentRunService,
  ) {}

  @Get('evidence')
  @ApiOperation({ summary: 'What a strategy would be built from, without spending an allowance' })
  @ApiParam({ name: 'projectId' })
  getEvidence(@Param('projectId') projectId: string) {
    return this.strategy.gatherEvidence(projectId);
  }

  @Get()
  @ApiOperation({ summary: 'Previously generated strategy reports' })
  @ApiParam({ name: 'projectId' })
  list(@Param('projectId') projectId: string) {
    return this.strategy.list(projectId);
  }

  @Get('plan')
  @ApiOperation({
    summary: 'The live 30/60/90 plan: recommendations grouped by horizon, each with its proof',
  })
  @ApiParam({ name: 'projectId' })
  plan(@Param('projectId') projectId: string) {
    return this.agentRuns.plan(projectId);
  }

  @Get(':reportId')
  @ApiOperation({ summary: 'One strategy report, with the evidence it was built from' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'reportId' })
  get(@Param('reportId') reportId: string) {
    return this.strategy.get(reportId);
  }

  @Post()
  @ApiOperation({ summary: 'Generate a new strategy (counts against the plan allowance)' })
  @ApiParam({ name: 'projectId' })
  generate(@Req() req: any, @Param('projectId') projectId: string) {
    // req.organizationId is set by .
    return this.strategy.generate(projectId, req.organizationId);
  }
}
