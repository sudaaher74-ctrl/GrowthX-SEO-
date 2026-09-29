import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsInsightsService } from './analytics-insights.service';
import { AnalyticsReportService, parseGa4Range } from './analytics-report.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('api/projects/:projectId/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly ga4: AnalyticsService,
    private readonly insights: AnalyticsInsightsService,
    private readonly reports: AnalyticsReportService,
  ) {}

  @Get('properties')
  @ApiOperation({ summary: 'GA4 properties available to the connection' })
  properties(@Param('projectId') projectId: string) {
    return this.ga4.listProperties(projectId);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Fetch the latest GA4 data' })
  sync(@Param('projectId') projectId: string, @Query('days') days?: string, @Query('full') full?: string) {
    return this.ga4.sync(projectId, { days: days ? parseInt(days, 10) : undefined, full: full === 'true' });
  }

  /**
   * The cached GA4 report for the workspace's selected property: exact totals,
   * daily series, top landing pages, channels (Organic Search called out) and
   * countries. Always answers with a state and a reason — never an empty body.
   */
  @Get('report')
  @ApiOperation({ summary: 'Cached GA4 report for a 7d, 28d or 90d window' })
  report(@Param('projectId') projectId: string, @Query('range') range?: string) {
    return this.reports.read(projectId, parseGa4Range(range));
  }

  @Get('coverage')
  @ApiOperation({ summary: 'The date range of stored GA4 data' })
  coverage(@Param('projectId') projectId: string) {
    return this.insights.coverage(projectId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Users, sessions, engagement and — where configured — conversions' })
  summary(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.insights.summary(projectId, days ? parseInt(days, 10) : 28);
  }

  @Get('timeseries')
  @ApiOperation({ summary: 'Daily series for the analytics chart' })
  timeseries(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.insights.timeseries(projectId, days ? parseInt(days, 10) : 28);
  }

  /** Search performance and business outcome for the same pages. */
  @Get('page-value')
  @ApiOperation({ summary: 'Organic clicks joined to sessions and conversions per page' })
  pageValue(@Param('projectId') projectId: string, @Query('days') days?: string, @Query('limit') limit?: string) {
    return this.insights.pageValue(
      projectId,
      days ? parseInt(days, 10) : 28,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
