import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SearchConsoleService } from './search-console.service';
import { SearchConsoleInsightsService } from './search-console-insights.service';

@ApiTags('Search Console')
@ApiBearerAuth()
@Controller('api/projects/:projectId/search-console')
@UseGuards(JwtAuthGuard)
export class SearchConsoleController {
  constructor(
    private readonly gsc: SearchConsoleService,
    private readonly insights: SearchConsoleInsightsService,
  ) {}

  /** Properties the connected Google account can read, for the picker. */
  @Get('properties')
  @ApiOperation({ summary: 'List Search Console properties available to the connection' })
  properties(@Param('projectId') projectId: string) {
    return this.gsc.listProperties(projectId);
  }

  /**
   * Starts a sync and returns when it finishes.
   *
   * Kept explicit rather than fire-and-forget so a customer pressing Sync gets
   * a result. Scheduled syncing runs on the worker, not here — a page request
   * is the wrong place to paginate through months of data.
   */
  @Post('sync')
  @ApiOperation({ summary: 'Fetch the latest Search Console data' })
  sync(@Param('projectId') projectId: string, @Query('days') days?: string, @Query('full') full?: string) {
    return this.gsc.sync(projectId, {
      days: days ? parseInt(days, 10) : undefined,
      full: full === 'true',
    });
  }

  /**
   * What data is actually held.
   *
   * Read before rendering a date filter: asking for twelve months when three
   * weeks have been synced should say so rather than draw an empty chart.
   */
  @Get('coverage')
  @ApiOperation({ summary: 'The date range of stored Search Console data' })
  coverage(@Param('projectId') projectId: string) {
    return this.insights.coverage(projectId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Clicks, impressions, CTR and position with real period-over-period change' })
  summary(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.insights.summary(projectId, days ? parseInt(days, 10) : 28);
  }

  @Get('timeseries')
  @ApiOperation({ summary: 'Daily series for the performance chart' })
  timeseries(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.insights.timeseries(projectId, days ? parseInt(days, 10) : 28);
  }

  @Get('queries')
  @ApiOperation({ summary: 'Top search queries' })
  queries(@Param('projectId') projectId: string, @Query('days') days?: string, @Query('limit') limit?: string) {
    return this.insights.top(projectId, 'QUERY', {
      days: days ? parseInt(days, 10) : 28,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('pages')
  @ApiOperation({ summary: 'Top organic pages' })
  pages(@Param('projectId') projectId: string, @Query('days') days?: string, @Query('limit') limit?: string) {
    return this.insights.top(projectId, 'PAGE', {
      days: days ? parseInt(days, 10) : 28,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  /** The queries that land on one page — the page detail drawer. */
  @Get('page-queries')
  @ApiOperation({ summary: 'Queries that bring traffic to a given page' })
  pageQueries(@Param('projectId') projectId: string, @Query('page') page: string, @Query('days') days?: string) {
    return this.insights.queriesForPage(projectId, page, { days: days ? parseInt(days, 10) : 28 });
  }

  @Get('striking-distance')
  @ApiOperation({ summary: 'Queries ranking just outside where clicks happen' })
  strikingDistance(
    @Param('projectId') projectId: string,
    @Query('days') days?: string,
    @Query('minPosition') minPosition?: string,
    @Query('maxPosition') maxPosition?: string,
    @Query('minImpressions') minImpressions?: string,
  ) {
    return this.insights.strikingDistance(projectId, {
      days: days ? parseInt(days, 10) : undefined,
      minPosition: minPosition ? parseFloat(minPosition) : undefined,
      maxPosition: maxPosition ? parseFloat(maxPosition) : undefined,
      minImpressions: minImpressions ? parseInt(minImpressions, 10) : undefined,
    });
  }

  @Get('ctr-opportunities')
  @ApiOperation({ summary: 'Pages seen often and clicked rarely for where they rank' })
  ctrOpportunities(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.insights.ctrOpportunities(projectId, { days: days ? parseInt(days, 10) : undefined });
  }

  @Get('declining')
  @ApiOperation({ summary: 'Queries whose position fell between two equal periods' })
  declining(@Param('projectId') projectId: string, @Query('days') days?: string) {
    return this.insights.declining(projectId, { days: days ? parseInt(days, 10) : undefined });
  }
}
