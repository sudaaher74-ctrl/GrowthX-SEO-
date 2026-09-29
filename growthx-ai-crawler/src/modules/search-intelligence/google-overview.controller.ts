import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GoogleOverviewService, parseGoogleWindow } from './google-overview.service';

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
  constructor(private readonly google: GoogleOverviewService) {}

  @Get('overview')
  @ApiOperation({ summary: 'KPIs, trend series, funnel and plain-language headlines for a 7, 28 or 90 day window' })
  overview(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.google.overview(projectId, parseGoogleWindow(days));
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
}
