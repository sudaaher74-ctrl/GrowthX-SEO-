import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { BacklinkQueue } from "./backlink-queue.service";
import {
  BacklinkPageDto,
  BacklinkAnalyticsDto,
  ExploreBacklinksDto,
  ImportBacklinksDto,
  PlanBacklinkDto,
  SyncBacklinkIntelligenceDto,
  UpdateOutreachDto,
  VerifyBacklinksDto,
} from "./backlinks.dto";
import { BacklinksService } from "./backlinks.service";
import { BacklinkAnalyticsService } from "./backlink-analytics.service";
import { BacklinkDiscovery } from "./backlink-discovery.service";
import { RecommendationService } from "./recommendation.service";
import { BacklinkIntelligenceService } from "./backlink-intelligence.service";

@ApiTags("Backlink intelligence")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("api/projects/:projectId/backlinks")
export class BacklinksController {
  constructor(
    private readonly backlinks: BacklinksService,
    private readonly queue: BacklinkQueue,
    private readonly analytics: BacklinkAnalyticsService,
    private readonly discovery: BacklinkDiscovery,
    private readonly recommendations: RecommendationService,
    private readonly intelligence: BacklinkIntelligenceService,
  ) {}

  private assertCanForceRefresh(req: any, forceRefresh: boolean) {
    if (forceRefresh && req?.membershipRole === "VIEWER") {
      throw new ForbiddenException("Viewers cannot trigger live provider refreshes.");
    }
  }

  // ── DataForSEO Backlink Intelligence

  @Get("intelligence")
  getIntelligenceOverview(
    @Param("projectId") projectId: string,
    @Query("domain") domain?: string,
    @Query("refresh") refresh?: string,
    @Req() req?: any,
  ) {
    const forceRefresh = refresh === "true";
    this.assertCanForceRefresh(req, forceRefresh);
    return this.intelligence.getOverview(projectId, domain, forceRefresh);
  }

  @Post("intelligence/sync")
  syncIntelligence(
    @Param("projectId") projectId: string,
    @Body() body?: SyncBacklinkIntelligenceDto,
  ) {
    return this.intelligence.syncDomainIntelligence(projectId, body?.domain, body?.targetKind);
  }

  @Get("intelligence/referring-domains")
  getReferringDomains(
    @Param("projectId") projectId: string,
    @Query("domain") domain?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("refresh") refresh?: string,
    @Req() req?: any,
  ) {
    const forceRefresh = refresh === "true";
    this.assertCanForceRefresh(req, forceRefresh);
    return this.intelligence.getReferringDomains(projectId, domain, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      forceRefresh,
    });
  }

  @Get("intelligence/links")
  getBacklinksList(
    @Param("projectId") projectId: string,
    @Query("domain") domain?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("mode") mode?: "as_is" | "one_per_domain",
    @Query("refresh") refresh?: string,
    @Req() req?: any,
  ) {
    const forceRefresh = refresh === "true";
    this.assertCanForceRefresh(req, forceRefresh);
    return this.intelligence.getBacklinksList(projectId, domain, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      mode,
      forceRefresh,
    });
  }

  @Get("intelligence/anchors")
  getAnchorAnalysis(
    @Param("projectId") projectId: string,
    @Query("domain") domain?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("refresh") refresh?: string,
    @Req() req?: any,
  ) {
    const forceRefresh = refresh === "true";
    this.assertCanForceRefresh(req, forceRefresh);
    return this.intelligence.getAnchors(projectId, domain, {
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      forceRefresh,
    });
  }

  @Get()
  async report(
    @Param("projectId") projectId: string,
    @Query() query: BacklinkPageDto,
  ) {
    const [report, queue] = await Promise.all([
      this.backlinks.report(projectId, query.offset),
      this.queue.status(),
    ]);
    return { ...report, queue };
  }

  @Post("import")
  import(
    @Param("projectId") projectId: string,
    @Body() body: ImportBacklinksDto,
  ) {
    return this.backlinks.import(projectId, body.text, body.discovery);
  }

  @Get("analytics")
  analyticsReport(
    @Param("projectId") projectId: string,
    @Query() query: BacklinkAnalyticsDto,
  ) {
    return this.analytics.profile(projectId, query.days);
  }

  @Get("explore")
  explore(
    @Param("projectId") projectId: string,
    @Query() query: ExploreBacklinksDto,
  ) {
    return this.analytics.explore(projectId, query);
  }

  @Get("export")
  export(
    @Param("projectId") projectId: string,
    @Query() query: ExploreBacklinksDto,
  ) {
    return this.analytics.export(projectId, query);
  }

  @Get("changes")
  changes(
    @Param("projectId") projectId: string,
    @Query() query: BacklinkPageDto,
  ) {
    return this.analytics.changes(projectId, query.offset);
  }

  @Post("discover")
  discover(@Param("projectId") projectId: string) {
    return this.backlinks.discover(projectId);
  }

  @Post("discovery")
  startDiscovery(@Param("projectId") projectId: string) {
    return this.discovery.start(projectId);
  }

  @Get("discovery")
  discoveryStatus(@Param("projectId") projectId: string) {
    return this.discovery.status(projectId);
  }

  @Post("verify")
  verify(
    @Param("projectId") projectId: string,
    @Body() body: VerifyBacklinksDto,
  ) {
    return this.queue.enqueue(projectId, body.sourceId);
  }

  @Post("reconcile")
  reconcile(@Param("projectId") projectId: string) {
    return this.backlinks.reconcile(projectId);
  }

  @Post("plan")
  plan(@Param("projectId") projectId: string, @Body() body: PlanBacklinkDto) {
    return this.backlinks.plan(projectId, body.sourceId, body.targetUrl);
  }

  @Get("recommendations/stats")
  recommendationStats(@Param("projectId") projectId: string) {
    return this.recommendations.stats(projectId);
  }

  @Get("recommendations")
  recommendationLeads(
    @Param("projectId") projectId: string,
    @Query() query: BacklinkPageDto,
  ) {
    return this.recommendations.candidates(projectId, query.offset);
  }

  @Get("recommendations/:sourceId")
  recommendationAnalysis(
    @Param("projectId") projectId: string,
    @Param("sourceId") sourceId: string,
  ) {
    return this.recommendations.analysis(projectId, sourceId);
  }

  @Post("recommendations/:sourceId/analyze")
  analyzeRecommendation(
    @Param("projectId") projectId: string,
    @Param("sourceId") sourceId: string,
  ) {
    return this.recommendations.analyze(projectId, sourceId);
  }

  @Post("recommendations/:sourceId/opportunity")
  pushRecommendationOpportunity(
    @Param("projectId") projectId: string,
    @Param("sourceId") sourceId: string,
  ) {
    return this.recommendations.pushToOpportunities(projectId, sourceId);
  }

  @Post("recommendations/:sourceId/outreach")
  updateRecommendationOutreach(
    @Param("projectId") projectId: string,
    @Param("sourceId") sourceId: string,
    @Body() body: UpdateOutreachDto,
  ) {
    return this.recommendations.updateOutreach(projectId, sourceId, body);
  }

  @Get("sources/:sourceId/history")
  history(
    @Param("projectId") projectId: string,
    @Param("sourceId") sourceId: string,
    @Query() query: BacklinkPageDto,
  ) {
    return this.backlinks.history(projectId, sourceId, query.offset);
  }

  @Delete("sources/:sourceId")
  remove(
    @Param("projectId") projectId: string,
    @Param("sourceId") sourceId: string,
  ) {
    return this.backlinks.remove(projectId, sourceId);
  }
}
