import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GoogleAlertsService } from './google-alerts.service';
import { GoogleBreakdownService, parseBreakdownDimension } from './google-breakdown.service';
import { GoogleKeywordsService } from './google-keywords.service';
import { GoogleOverviewService, parseGoogleWindow } from './google-overview.service';
import { GoogleReportService } from './google-report.service';

/**
 * The Google section: Search Console, Google Analytics and the crawl read as
 * one. `JwtAuthGuard` checks the caller belongs to the project in the path, and
 * everything is read from that project's own stored data.
 */
@ApiTags('Google')
@ApiBearerAuth()
@Controller('api/projects/:projectId/google')
@UseGuards(JwtAuthGuard)
export class GoogleOverviewController {
  constructor(
    private readonly google: GoogleOverviewService,
    private readonly keywords: GoogleKeywordsService,
    private readonly breakdowns: GoogleBreakdownService,
    private readonly alertService: GoogleAlertsService,
    private readonly reportService: GoogleReportService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'KPIs, trend series, funnel and plain-language headlines for a 7, 28 or 90 day window' })
  overview(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.google.overview(projectId, parseGoogleWindow(days));
  }

  @Get('keywords')
  @ApiOperation({ summary: 'New and rising keywords, and queries answered by more than one page' })
  keywordsView(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.keywords.keywords(projectId, parseGoogleWindow(days));
  }

  @Get('breakdown')
  @ApiOperation({ summary: 'Search Console clicks and impressions by country or device' })
  breakdown(@Param('projectId') projectId: string, @Query('dimension') dimension?: string, @Query('days') days?: string) {
    return this.breakdowns.breakdown(projectId, parseGoogleWindow(days), parseBreakdownDimension(dimension));
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Traffic, ranking, CTR, page and conversion changes worth attention, with the rules used' })
  alerts(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.alertService.alerts(projectId, parseGoogleWindow(days));
  }

  @Get('pages')
  @ApiOperation({ summary: 'Organic pages with Search Console and Analytics side by side, optionally in one segment' })
  pages(
    @Param('projectId') projectId: string,
    @Query('days') days?: string,
    @Query('segment') segment?: string,
    @Query('limit') limit?: string,
  ) {
    return this.google.pages(projectId, parseGoogleWindow(days), {
      segment: segment || undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('page')
  @ApiOperation({ summary: 'Everything known about one page: search, visits, funnel, index, crawl and diagnosis' })
  page(@Param('projectId') projectId: string, @Query('url') url: string, @Query('days') days?: string) {
    return this.google.pageDetail(projectId, parseGoogleWindow(days), url);
  }

  @Post('report')
  @ApiOperation({ summary: 'Improvement report: Search Console and Analytics 4 read by Sarvam, with what to do first' })
  report(@Param('projectId') projectId: string, @Req() req: any, @Query('days') days?: string) {
    return this.reportService.generate(projectId, req.organizationId, parseGoogleWindow(days));
  }

  @Get('report/latest')
  @ApiOperation({ summary: 'The most recently generated Google improvement report, or null' })
  latestReport(@Param('projectId') projectId: string) {
    return this.reportService.latest(projectId);
  }
}
