import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Optional, ServiceUnavailableException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';
import { LocalSeoService } from './local-seo.service';
import { GeoGridService, GeoGridScanRequest } from './geo-grid.service';
import { PlacesListingService } from '../integrations/google/places-listing.service';
import { LocalOffpageService } from './local-offpage.service';

@Controller('api/projects/:projectId/local-seo')
@UseGuards(JwtAuthGuard)
// Local SEO auditing & rank tracking is part of the core crawl / local capability.
export class LocalSeoController {
  constructor(
    private readonly localSeoService: LocalSeoService,
    private readonly geoGridService: GeoGridService,
    private readonly placesListing: PlacesListingService,
    @Optional() private readonly localOffpage?: LocalOffpageService,
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

  /**
   * Public Google Maps listing snapshot + deterministic 0–100 health audit +
   * 1-tap Review Link & UTM website builder (powered by Places API New).
   */
  @Get('profile')
  async getProfileAudit(@Param('projectId') projectId: string) {
    if (!this.localOffpage) throw new ServiceUnavailableException('Local off-page service unavailable.');
    return this.localOffpage.getProfileAudit(projectId, false);
  }

  @Post('profile/refresh')
  async refreshProfileAudit(@Param('projectId') projectId: string) {
    if (!this.localOffpage) throw new ServiceUnavailableException('Local off-page service unavailable.');
    return this.localOffpage.getProfileAudit(projectId, true);
  }

  /**
   * Off-page local directories & citations checklist cross-referenced against
   * discovered Backlink Intelligence sources + canonical NAP copy card.
   */
  @Get('citations')
  async getCitationsAudit(@Param('projectId') projectId: string) {
    if (!this.localOffpage) throw new ServiceUnavailableException('Local off-page service unavailable.');
    return this.localOffpage.getCitationsAudit(projectId);
  }

  /**
   * AI GBP Co-Pilot: ready-to-paste weekly posts (with UTMs), 750-char business
   * description, local Q&As, review replies, and WhatsApp review script.
   */
  @Post('copilot')
  async generateCopilotPack(
    @Param('projectId') projectId: string,
    @Body('forceRefresh') forceRefresh?: boolean,
    @Req() req?: any,
  ) {
    if (!this.localOffpage) throw new ServiceUnavailableException('Local off-page service unavailable.');
    return this.localOffpage.generateCopilotPack(projectId, {
      forceRefresh: Boolean(forceRefresh),
      organizationId: req?.user?.organizationId || req?.organizationId,
    });
  }

}
