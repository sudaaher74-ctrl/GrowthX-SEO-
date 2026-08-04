import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';
import { StrategyService } from './strategy.service';

/**
 * Market analysis, SEO roadmap, content plan, and social strategy — the
 * "what do we do about it" layer on top of the crawl and visibility data.
 * Pro-only.
 */
@ApiTags('Strategy')
@ApiBearerAuth()
@Controller('api/projects/:projectId/strategy')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
@RequiresFeature(Feature.MARKET_STRATEGY)
export class StrategyController {
  constructor(private readonly strategy: StrategyService) {}

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
    // req.organizationId is set by EntitlementsGuard.
    return this.strategy.generate(projectId, req.organizationId);
  }
}
