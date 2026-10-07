import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { LocalSeoService } from './local-seo.service';
import { GeoGridService, GeoGridScanRequest } from './geo-grid.service';
import { PlacesListingService } from '../integrations/google/places-listing.service';

@Controller('api/projects/:projectId/local-seo')
@UseGuards(JwtAuthGuard)
// Local SEO auditing & rank tracking is part of the core crawl / local capability.
export class LocalSeoController {
  constructor(
    private readonly localSeoService: LocalSeoService,
    private readonly geoGridService: GeoGridService,
    private readonly placesListing: PlacesListingService,
  ) {}

  @Get()
  async getLocalSeo(@Param('projectId') projectId: string) {
    return this.localSeoService.getLocalSeo(projectId);
  }

  @Post('search')
  async searchBusiness(@Body() body: { query: string }) {
    return this.localSeoService.searchBusiness(body.query);
  }

  @Post('connect')
  async connectBusiness(
    @Param('projectId') projectId: string,
    @Body() body: {
      businessName: string;
      address: string;
      rating: number;
      reviewCount: number;
      placeId?: string;
      latitude?: number;
      longitude?: number;
    }
  ) {
    const location = await this.localSeoService.connectBusiness(projectId, body);
    // Read the public listing now, so the Business Profile tabs have it on the
    // first render after connecting instead of on some later one.
    if (location.placeId) {
      await this.placesListing.refreshOnce(projectId).catch(() => undefined);
    }
    return location;
  }

  /**
   * Who shows up in Google Maps for a search, around this project's listing.
   * Public Places data: no Business Profile approval involved.
   */
  @Post('places/competitors')
  async placesCompetitors(
    @Param('projectId') projectId: string,
    @Body() body: { keyword: string; radiusKm?: number },
  ) {
    return this.placesListing.competitors(projectId, body?.keyword, body?.radiusKm);
  }

  /** Every location on the project. Projects may hold many. */
  @Get('locations')
  async listLocations(@Param('projectId') projectId: string) {
    return this.localSeoService.listLocations(projectId);
  }

  /** Previous geo-grid runs, newest first. A single grid is a snapshot. */
  @Get('geo-grid/history')
  async geoGridHistory(
    @Param('projectId') projectId: string,
    @Query('keyword') keyword?: string,
    @Query('limit') limit?: string,
  ) {
    return this.geoGridService.history(projectId, keyword, limit ? Number(limit) : undefined);
  }

  /** One stored run, with every coordinate and the businesses seen there. */
  @Get('geo-grid/run/:runId')
  async geoGridRun(@Param('projectId') projectId: string, @Param('runId') runId: string) {
    return this.geoGridService.run(projectId, runId);
  }

  @Post('geo-grid/run')
  async runGeoGridScan(
    @Param('projectId') projectId: string,
    @Body() body: GeoGridScanRequest,
    @Req() req: any,
  ) {
    const orgId = req.user?.organizationId || req.organizationId;
    return this.geoGridService.runGeoGridScan(projectId, orgId, body);
  }

}
