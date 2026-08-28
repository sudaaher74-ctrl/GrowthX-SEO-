import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsInsightsService } from './analytics-insights.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('api/projects/:projectId/analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly ga4: AnalyticsService,
    private readonly insights: AnalyticsInsightsService,
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
