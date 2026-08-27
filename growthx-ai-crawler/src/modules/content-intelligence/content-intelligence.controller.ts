import {
  Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompetitorContentService } from './competitor-content.service';
import { ClassificationService } from './classification.service';
import { PatternDetectionService } from './pattern-detection.service';
import { GapAnalysisService } from './gap-analysis.service';
import { ContentStrategyService } from './content-strategy.service';
import { ContentCreationService } from './content-creation.service';
import { CreatorService } from './creator.service';
import { CampaignService } from './campaign.service';
import { SocialScraperService } from './social-scraper.service';
import { SocialDiscoveryService } from './social-discovery.service';
import { CompetitorCrawlService } from './competitor-crawl.service';
import { PrismaService } from '../../database/prisma.service';

/**
 * GrowthX Content Intelligence & Creative Engine REST API.
 *
 * Every route is project-scoped. organizationId is resolved by * and injected onto req.organizationId — matching the pattern used in
 * MarketResearchController.
 */
@Controller('api/projects/:projectId/content-intelligence')
@UseGuards(JwtAuthGuard)
// The whole surface is the paid content/social strategy layer. Read routes
// inherit this gate; the routes below that spend model tokens override it with
// @Metered so the work is also counted against the plan's allowance.
export class ContentIntelligenceController {
  constructor(
    private readonly competitorContent: CompetitorContentService,
    private readonly classification: ClassificationService,
    private readonly patternDetection: PatternDetectionService,
    private readonly gapAnalysis: GapAnalysisService,
    private readonly contentStrategy: ContentStrategyService,
    private readonly contentCreation: ContentCreationService,
    private readonly creator: CreatorService,
    private readonly campaign: CampaignService,
    private readonly socialScraper: SocialScraperService,
    private readonly socialDiscovery: SocialDiscoveryService,
    private readonly competitorCrawl: CompetitorCrawlService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard')
  async getDashboard(@Req() req: any, @Param('projectId') projectId: string) {
    const organizationId: string = req.organizationId;
    const [competitorStats, patterns, gaps, strategies, campaigns] = await Promise.all([
      this.competitorContent.getDashboardStats(organizationId, projectId),
      this.prisma.creativePattern.count({ where: { organizationId, projectId } }),
      this.prisma.contentGap.count({ where: { organizationId, projectId, status: 'OPEN' } }),
      this.prisma.contentStrategy.count({ where: { organizationId, projectId } }),
      this.prisma.campaign.count({ where: { organizationId, projectId } }),
    ]);

    const topOpportunities = await this.prisma.contentGap.findMany({
      where: { organizationId, projectId, status: 'OPEN' },
      orderBy: { opportunityScore: 'desc' },
      take: 5,
      include: { pattern: { select: { name: true } } },
    });

    const topPatterns = await this.prisma.creativePattern.findMany({
      where: { organizationId, projectId },
      orderBy: { opportunityScore: 'desc' },
      take: 5,
    });

    return {
      stats: {
        competitorsTracked: competitorStats.totalAccounts,
        contentAnalyzed: competitorStats.totalContent,
        classified: competitorStats.classified,
        creativePatterns: patterns,
        contentGaps: gaps,
        strategies,
        campaigns,
        platformBreakdown: competitorStats.platforms,
      },
      topOpportunities,
      topPatterns,
    };
  }

  // ── Config ───────────────────────────────────────────────────────────────

  @Get('config')
  async getConfig(@Req() req: any, @Param('projectId') projectId: string) {
    return this.prisma.contentIntelligenceConfig.findUnique({ where: { projectId } })
      ?? { projectId, industrySkill: 'GENERIC', automationLevel: 'MANUAL' };
  }

  @Post('config')
  async upsertConfig(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { industrySkill?: string; automationLevel?: string; postingFrequency?: string },
  ) {
    const organizationId: string = req.organizationId;
    return this.prisma.contentIntelligenceConfig.upsert({
      where: { projectId },
      update: body,
      create: { organizationId, projectId, ...body },
    });
  }

  // ── Competitor Accounts ──────────────────────────────────────────────────

  @Get('competitor-accounts')
  async listAccounts(@Req() req: any, @Param('projectId') projectId: string) {
    return this.competitorContent.listAccounts(req.organizationId, projectId);
  }

  @Post('competitor-accounts')
  async addAccount(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { competitorId: string; platform: string; handle: string; displayName?: string; followerCount?: number; profileUrl?: string },
  ) {
    return this.competitorContent.addAccount(req.organizationId, projectId, body.competitorId, body);
  }

  @Delete('competitor-accounts/:accountId')
  async removeAccount(@Req() req: any, @Param('accountId') accountId: string) {
    return this.competitorContent.removeAccount(req.organizationId, accountId);
  }

  @Patch('competitor-accounts/:accountId/toggle')
  async toggleAccount(
    @Req() req: any,
    @Param('accountId') accountId: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.competitorContent.toggleAccount(req.organizationId, accountId, body.isActive);
  }

  // ── Competitor Content ───────────────────────────────────────────────────

  @Get('competitor-content')
  async listContent(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('platform') platform?: string,
    @Query('contentType') contentType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.competitorContent.listContent(req.organizationId, projectId, {
      platform, contentType, limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Post('competitor-content')
  async ingestContent(@Req() req: any, @Param('projectId') projectId: string, @Body() body: any) {
    return this.competitorContent.ingestContent(req.organizationId, projectId, body.accountId, body);
  }

  @Post('competitor-accounts/:accountId/sync')
  async syncAccount(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('accountId') accountId: string,
  ) {
    return this.socialScraper.syncYoutubeAccountContent(req.organizationId, projectId, accountId);
  }

  // ── Classification ───────────────────────────────────────────────────────

  @Post('classify')
  async classifyContent(@Req() req: any, @Param('projectId') projectId: string) {
    return this.classification.classifyPending(projectId, req.organizationId);
  }

  // ── Pattern Detection ────────────────────────────────────────────────────

  @Post('detect-patterns')
  async detectPatterns(@Req() req: any, @Param('projectId') projectId: string) {
    return this.patternDetection.detectPatterns(projectId, req.organizationId);
  }

  @Get('patterns')
  async listPatterns(@Req() req: any, @Param('projectId') projectId: string) {
    return this.patternDetection.listPatterns(req.organizationId, projectId);
  }

  // ── Gap Analysis ─────────────────────────────────────────────────────────

  @Post('analyze-gaps')
  async analyzeGaps(@Req() req: any, @Param('projectId') projectId: string) {
    return this.gapAnalysis.analyzeGaps(projectId, req.organizationId);
  }

  @Get('gaps')
  async listGaps(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    return this.gapAnalysis.listGaps(req.organizationId, projectId, status);
  }

  @Patch('gaps/:gapId/status')
  async updateGapStatus(
    @Req() req: any,
    @Param('gapId') gapId: string,
    @Body() body: { status: string },
  ) {
    return this.gapAnalysis.updateGapStatus(req.organizationId, gapId, body.status);
  }

  /**
   * Reads a competitor's own site for the social profiles it publishes.
   *
   * Registering those accounts by hand is the step that stalls the whole
   * pipeline, and a brand lists its handles in its own footer.
   */
  @Post('competitors/:competitorId/discover-accounts')
  async discoverCompetitorAccounts(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('competitorId') competitorId: string,
  ) {
    const competitor = await this.prisma.competitorDomain.findFirst({
      where: { id: competitorId, projectId },
      select: { domain: true },
    });
    if (!competitor) throw new NotFoundException('Competitor not found for this project.');

    return this.socialDiscovery.discoverAccounts(
      req.organizationId,
      projectId,
      competitorId,
      competitor.domain,
    );
  }

  // ── Competitor Website Coverage ──────────────────────────────────────────

  /**
   * Crawls the competitor's public website so their page coverage can be
   * compared with the customer's.
   *
   * Returns as soon as the job is queued. A crawl of a few hundred pages at
   * one request per second takes minutes, and holding the request open for it
   * would time out long before it finished; the client polls `coverage`.
   */
  @Post('competitors/:competitorId/crawl')
  async crawlCompetitorSite(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('competitorId') competitorId: string,
  ) {
    return this.competitorCrawl.startCrawl(req.organizationId, projectId, competitorId);
  }

  /** What the last completed crawl found, by page kind. Null until one has. */
  @Get('competitors/:competitorId/coverage')
  async competitorCoverage(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('competitorId') competitorId: string,
  ) {
    return this.competitorCrawl.getCoverage(req.organizationId, projectId, competitorId);
  }

  /** Both sides of the coverage comparison, by page kind. */
  @Get('competitors/:competitorId/comparison')
  async competitorComparison(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('competitorId') competitorId: string,
  ) {
    return this.competitorCrawl.getComparison(req.organizationId, projectId, competitorId);
  }

  /** The crawled pages themselves, optionally of one kind. */
  @Get('competitors/:competitorId/pages')
  async competitorPages(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('competitorId') competitorId: string,
    @Query('pageType') pageType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.competitorCrawl.listPages(req.organizationId, projectId, competitorId, {
      pageType,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ── Content Strategy ─────────────────────────────────────────────────────

  @Post('strategy/generate')
  async generateStrategy(@Req() req: any, @Param('projectId') projectId: string) {
    return this.contentStrategy.generateStrategy(projectId, req.organizationId);
  }

  @Get('strategy')
  async listStrategies(@Req() req: any, @Param('projectId') projectId: string) {
    return this.contentStrategy.listStrategies(req.organizationId, projectId);
  }

  @Get('strategy/:strategyId')
  async getStrategy(@Req() req: any, @Param('strategyId') strategyId: string) {
    return this.contentStrategy.getStrategy(req.organizationId, strategyId);
  }

  @Post('strategy/:strategyId/approve')
  async approveStrategy(@Req() req: any, @Param('strategyId') strategyId: string) {
    return this.contentStrategy.approveStrategy(req.organizationId, strategyId);
  }

  // ── Content Calendar ─────────────────────────────────────────────────────

  @Post('generate-content')
  async generateContent(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { platform: string; contentType: string; contentPillar?: string; topic: string; campaignName?: string; gapContext?: string; visualDirection?: string },
  ) {
    return this.contentCreation.generateContent(projectId, req.organizationId, body);
  }

  @Get('calendar')
  async listCalendar(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('platform') platform?: string,
    @Query('campaignId') campaignId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.contentCreation.listCalendarItems(req.organizationId, projectId, {
      status, platform, campaignId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post('calendar')
  async createCalendarItem(@Req() req: any, @Param('projectId') projectId: string, @Body() body: any) {
    return this.contentCreation.createCalendarItem(req.organizationId, projectId, body);
  }

  @Patch('calendar/:itemId')
  async updateCalendarItem(@Req() req: any, @Param('itemId') itemId: string, @Body() body: any) {
    return this.contentCreation.updateCalendarItem(req.organizationId, itemId, body);
  }

  // ── Campaigns ────────────────────────────────────────────────────────────

  @Get('campaigns')
  async listCampaigns(@Req() req: any, @Param('projectId') projectId: string) {
    return this.campaign.listCampaigns(req.organizationId, projectId);
  }

  @Get('campaigns/:campaignId')
  async getCampaign(@Req() req: any, @Param('campaignId') campaignId: string) {
    return this.campaign.getCampaign(req.organizationId, campaignId);
  }

  @Post('campaigns')
  async createCampaign(@Req() req: any, @Param('projectId') projectId: string, @Body() body: any) {
    return this.campaign.createCampaign(req.organizationId, projectId, body);
  }

  @Patch('campaigns/:campaignId/status')
  async updateCampaignStatus(
    @Req() req: any,
    @Param('campaignId') campaignId: string,
    @Body() body: { status: string },
  ) {
    return this.campaign.updateCampaignStatus(req.organizationId, campaignId, body.status);
  }

  @Post('campaigns/:campaignId/match-creators')
  async matchCreators(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('campaignId') campaignId: string,
  ) {
    return this.creator.matchCreators(req.organizationId, projectId, campaignId);
  }

  // ── Creators ─────────────────────────────────────────────────────────────

  @Get('creators')
  async listCreators(@Req() req: any) {
    return this.creator.listCreators(req.organizationId);
  }

  @Post('creators')
  async addCreator(@Req() req: any, @Body() body: any) {
    return this.creator.addCreator(req.organizationId, body);
  }

  @Patch('creators/:creatorId')
  async updateCreator(@Req() req: any, @Param('creatorId') creatorId: string, @Body() body: any) {
    return this.creator.updateCreator(req.organizationId, creatorId, body);
  }

  @Post('creators/outreach')
  async generateOutreach(@Req() req: any, @Param('projectId') projectId: string, @Body() body: any) {
    return this.creator.generateOutreachMessage(req.organizationId, projectId, body);
  }

  @Get('creators/outreach')
  async listOutreach(@Req() req: any, @Param('projectId') projectId: string) {
    return this.creator.listOutreach(req.organizationId, projectId);
  }

  @Post('creators/outreach/:outreachId/approve')
  async approveOutreach(@Req() req: any, @Param('outreachId') outreachId: string) {
    return this.creator.approveAndSendOutreach(req.organizationId, outreachId);
  }

  @Patch('creators/outreach/:outreachId/stage')
  async updateOutreachStage(
    @Req() req: any,
    @Param('outreachId') outreachId: string,
    @Body() body: { stage: string },
  ) {
    return this.creator.updateOutreachStage(req.organizationId, outreachId, body.stage);
  }
}
