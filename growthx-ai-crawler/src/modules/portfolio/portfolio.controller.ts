import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PortfolioService } from './portfolio.service';
import { OrgContextService } from '../organizations/org-context.service';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class SetRetainerDto {
  @IsOptional()
  @IsString()
  tier?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  retainerMonthlyMinor?: number | null;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  retainerCurrency?: string;
}

export class BulkDeliverReportsDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
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
  @ApiOperation({ summary: 'Every client with AI share, health, criticals, regressions, pipeline status, and retainer' })
  @ApiParam({ name: 'orgId' })
  @ApiQuery({ name: 'days', required: false, example: 28 })
  async getPortfolio(@Req() req: any, @Param('orgId') orgId: string, @Query('days') days?: string) {
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
    await this.orgContext.assertManager(req.user?.userId, orgId);
    return this.portfolio.setRetainer(orgId, projectId, body);
  }

  @Post('bulk-deliver')
  @ApiOperation({ summary: 'Freeze monthly report snapshots and mint zero-login share links for all clients' })
  @ApiParam({ name: 'orgId' })
  async bulkDeliver(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Body() body?: BulkDeliverReportsDto,
  ) {
    await this.orgContext.assertCanWrite(req.user?.userId, orgId);
    return this.portfolio.bulkDeliverMonthlyReports(orgId, body?.month, body?.expiresInDays ?? 30);
  }
}
