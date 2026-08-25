import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortfolioService } from './portfolio.service';
import { OrgContextService } from '../organizations/org-context.service';

import { IsOptional, IsString, IsNumber } from 'class-validator';

export class SetRetainerDto {
  @IsOptional()
  @IsString()
  tier?: string | null;

  @IsOptional()
  @IsNumber()
  retainerMonthlyMinor?: number | null;

  @IsOptional()
  @IsString()
  retainerCurrency?: string;
}

/** The agency-level view: all clients in one organization. */
@ApiTags('Agency portfolio')
@ApiBearerAuth()
@Controller('api/organizations/:orgId/portfolio')
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(
    private readonly portfolio: PortfolioService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Every client with AI share, health, criticals and retainer' })
  @ApiParam({ name: 'orgId' })
  @ApiQuery({ name: 'days', required: false, example: 28 })
  async getPortfolio(@Req() req: any, @Param('orgId') orgId: string, @Query('days') days?: string) {
    // orgId comes straight off the URL: without this, one agency reads every
    // other agency's client list, health scores and retainer revenue.
    await this.orgContext.assertMembership(req.user?.userId, orgId);
    const window = Math.min(180, Math.max(7, parseInt(days ?? '28', 10) || 28));
    return this.portfolio.getPortfolio(orgId, window);
  }

  @Patch('clients/:projectId/retainer')
  @ApiOperation({ summary: 'Record what a client pays, so MRR is real rather than assumed' })
  @ApiParam({ name: 'orgId' })
  @ApiParam({ name: 'projectId' })
  async setRetainer(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Body() body: SetRetainerDto,
  ) {
    await this.orgContext.assertMembership(req.user?.userId, orgId);
    return this.portfolio.setRetainer(projectId, body);
  }
}
