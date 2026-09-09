import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { BusinessProfileService } from './business-profile.service';
import { BusinessProfileInsightsService } from './business-profile-insights.service';

/**
 * The Google Business Profile tabs.
 *
 * Connecting, selecting a location and disconnecting are not here — those are
 * the same operations for every Google service and live on the shared OAuth
 * controller. `GET /locations` feeds that controller's `select` endpoint: the
 * `id` it returns is passed straight back as `resourceId`.
 *
 * Every read below serves from the synced tables, never from Google, and every
 * one carries the connection's state and the state of the source it came from.
 */
@ApiTags('Business Profile')
@ApiBearerAuth()
@Controller('api/projects/:projectId/business-profile')
@UseGuards(JwtAuthGuard)
export class BusinessProfileController {
  constructor(
    private readonly gbp: BusinessProfileService,
    private readonly insights: BusinessProfileInsightsService,
  ) {}

  /** Locations this Google account manages, for the picker. Reads Google live. */
  @Get('locations')
  @ApiOperation({ summary: 'List Business Profile locations available to the connection' })
  locations(@Param('projectId') projectId: string) {
    return this.gbp.listLocations(projectId);
  }

  /**
   * Pulls the selected location into the local tables and returns when done.
   *
   * Explicit rather than fire-and-forget so someone pressing Sync gets an
   * answer, including which sources refused. The daily refresh runs on the
   * scheduler, not here.
   */
  @Post('sync')
  @ApiOperation({ summary: 'Fetch the latest Business Profile data from Google' })
  async sync(@Param('projectId') projectId: string, @Query('days') days?: string) {
    const result = await this.gbp.sync(projectId, {
      metricDays: days ? parseInt(days, 10) : undefined,
    });
    return {
      syncedAt: result.syncedAt,
      counts: result.counts,
      // Which sources could not be read, so the client can say so rather than
      // showing four full tabs and one silently empty one.
      status: result.status,
      failedSources: result.failedSources,
    };
  }

  @Get('overview')
  @ApiOperation({ summary: 'The synced profile, with a completeness breakdown' })
  overview(@Param('projectId') projectId: string) {
    return this.insights.overview(projectId);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Daily views, calls, direction requests and clicks' })
  metrics(@Param('projectId') projectId: string, @Query('days') days?: string) {
    const requested = days ? parseInt(days, 10) : 28;
    const window = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 545) : 28;
    return this.insights.metrics(projectId, window);
  }

  @Get('reviews')
  @ApiOperation({ summary: 'Synced Google reviews' })
  reviews(@Param('projectId') projectId: string) {
    return this.insights.reviews(projectId);
  }

  @Get('photos')
  @ApiOperation({ summary: 'Synced Business Profile media' })
  photos(@Param('projectId') projectId: string) {
    return this.insights.photos(projectId);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Synced Google posts' })
  posts(@Param('projectId') projectId: string) {
    return this.insights.posts(projectId);
  }

  @Get('services')
  @ApiOperation({ summary: 'Services listed on the profile' })
  services(@Param('projectId') projectId: string) {
    return this.insights.services(projectId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Primary and additional categories' })
  categories(@Param('projectId') projectId: string) {
    return this.insights.categories(projectId);
  }
}
