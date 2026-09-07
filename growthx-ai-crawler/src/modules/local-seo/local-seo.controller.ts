import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LocalSeoService } from './local-seo.service';
import { GbpAnalyzerService } from './gbp-analyzer.service';
import { GbpAutofixService } from './gbp-autofix.service';
import { GeoGridService, GeoGridScanRequest } from './geo-grid.service';
import { ReviewsService } from './reviews.service';

@Controller('api/projects/:projectId/local-seo')
@UseGuards(JwtAuthGuard)
// Local SEO auditing & rank tracking is part of the core crawl / local capability.
export class LocalSeoController {
  constructor(
    private readonly localSeoService: LocalSeoService,
    private readonly gbpAnalyzer: GbpAnalyzerService,
    private readonly gbpAutofix: GbpAutofixService,
    private readonly geoGridService: GeoGridService,
    private readonly reviewsService: ReviewsService,
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
    return this.localSeoService.connectBusiness(projectId, body);
  }

  /** Every location on the project. Projects may hold many. */
  @Get('locations')
  async listLocations(@Param('projectId') projectId: string) {
    return this.localSeoService.listLocations(projectId);
  }

  @Post('gbp/analyze')
  async analyzeGbp(@Param('projectId') projectId: string, @Req() req: any) {
    return this.gbpAnalyzer.analyzeProfile(projectId, req.user?.organizationId || req.organizationId);
  }

  @Post('gbp/fix/:proposalId/approve')
  async approveFix(@Param('projectId') projectId: string, @Param('proposalId') proposalId: string) {
    return this.gbpAutofix.approveAndPushFix(proposalId, projectId);
  }

  @Post('gbp/fix/:proposalId/reject')
  async rejectFix(@Param('projectId') projectId: string, @Param('proposalId') proposalId: string) {
    return this.gbpAutofix.rejectFix(proposalId, projectId);
  }

  @Get('gbp/proposals')
  async getProposals(@Param('projectId') projectId: string) {
    return this.localSeoService.getProposals(projectId);
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
  async geoGridRun(@Param('runId') runId: string) {
    return this.geoGridService.run(runId);
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

  @Get('reviews')
  async getReviews(@Param('projectId') projectId: string) {
    return this.reviewsService.getReviews(projectId);
  }

  @Post('reviews/sync')
  async syncReviews(@Param('projectId') projectId: string) {
    return this.reviewsService.syncReviews(projectId);
  }

  @Post('reviews/:reviewId/draft')
  async draftReviewReply(
    @Param('projectId') projectId: string,
    @Param('reviewId') reviewId: string,
    @Body() body?: { tone?: string },
  ) {
    return this.reviewsService.draftReply(projectId, reviewId, body?.tone);
  }

  @Post('reviews/:reviewId/publish')
  async publishReviewReply(
    @Param('projectId') projectId: string,
    @Param('reviewId') reviewId: string,
    @Body() body: { replyText: string }
  ) {
    return this.reviewsService.publishReply(projectId, reviewId, body.replyText);
  }
}
