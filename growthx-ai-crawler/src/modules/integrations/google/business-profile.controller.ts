import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { BusinessProfileService } from './business-profile.service';
import { BusinessProfileInsightsService } from './business-profile-insights.service';
import { PlacesListingService } from './places-listing.service';

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
    private readonly places: PlacesListingService,
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
   *
   * The public Google Maps listing is refreshed alongside it. While Business
   * Profile access waits on Google's approval, that listing is what the tabs
   * show — so a Business Profile refusal is reported in the result rather than
   * failing a sync that did refresh something.
   */
  @Post('sync')
  @ApiOperation({ summary: 'Fetch the latest Business Profile data from Google' })
  async sync(@Param('projectId') projectId: string, @Query('days') days?: string) {
    const places = await this.places.refreshOnce(projectId);
    const placesResult = {
      state: places.state,
      fetchedAt: places.fetchedAt,
      error: places.error,
    };
    const placesRefreshed = places.state === 'READY' && !places.error;

    try {
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
        places: placesResult,
      };
    } catch (error: any) {
      if (!placesRefreshed) throw error;
      return {
        syncedAt: places.fetchedAt,
        counts: { reviews: 0, photos: 0, posts: 0, services: 0, metricDays: 0 },
        status: 'PLACES_ONLY',
        failedSources: [],
        // Why Business Profile itself could not be read — usually the pending
        // approval — in the same words the connection notice uses.
        businessProfileError: error?.message ?? null,
        places: placesResult,
      };
    }
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
