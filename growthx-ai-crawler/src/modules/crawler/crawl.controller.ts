import { Controller, Post, Get, Body, Param, Query, Req, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { UsageMetric } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from './crawler.service';
import { SecurityService } from '../security/security.service';
import { HistoryService } from '../history/history.service';
import { GraphService } from '../graph/graph.service';
import { AiService } from '../ai/ai.service';
import { AutoFixService } from '../ai/auto-fix.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { EntitlementsService } from '../billing/entitlements.service';
import { OrgContextService } from '../billing/org-context.service';
import { Metered, OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';

@ApiTags('Crawlers & Audits')
@ApiBearerAuth()
@Controller('api')
export class CrawlController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crawlerService: CrawlerService,
    private readonly securityService: SecurityService,
    private readonly historyService: HistoryService,
    private readonly graphService: GraphService,
    private readonly aiService: AiService,
    private readonly autoFixService: AutoFixService,
    private readonly schedulerService: SchedulerService,
    private readonly entitlements: EntitlementsService,
    private readonly orgContext: OrgContextService
  ) {}

  @Post('websites')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register a new customer website for SEO auditing' })
  @ApiBody({ schema: { type: 'object', properties: { url: { type: 'string', example: 'https://growthx.ai' }, domain: { type: 'string', example: 'growthx.ai' }, projectId: { type: 'string' } } } })
  async registerWebsiteRoute(@Req() req: any, @Body() body: { url: string; domain: string; projectId?: string }) {
    const organizationId = await this.orgContext.resolve(req);
    const existing = await this.prisma.website.findUnique({ where: { domain: body.domain } });

    // Only a genuinely new site counts against the plan's site allowance.
    if (!existing) {
      await this.entitlements.assertCanAddSite(organizationId);
    }

    return this.registerWebsite(body);
  }

  /** Shared by the route above and by auto-registration inside `startCrawlJob`. */
  private async registerWebsite(body: { url: string; domain: string; projectId?: string }) {
    if (!body.url || !body.domain) {
      throw new BadRequestException('URL and domain are required.');
    }
    const token = this.securityService.generateVerificationToken(body.domain);
    const website = await this.prisma.website.upsert({
      where: { domain: body.domain },
      update: { url: body.url, verificationToken: token, ...(body.projectId ? { projectId: body.projectId } : {}) },
      create: { url: body.url, domain: body.domain, verificationToken: token, isVerified: false, projectId: body.projectId },
    });
    return {
      id: website.id,
      domain: website.domain,
      url: website.url,
      isVerified: website.isVerified,
      verificationToken: token,
      instructions: `Add a DNS TXT record for _growthx-challenge.${website.domain} with value: ${token}`,
    };
  }

  @Post('websites/:id/verify')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Verify customer ownership of a domain via DNS TXT record' })
  @ApiParam({ name: 'id', description: 'Website ID' })
  async verifyDomain(@Param('id') id: string) {
    const website = await this.prisma.website.findUnique({ where: { id } });
    if (!website) throw new NotFoundException('Website not found');

    const isVerified = await this.securityService.verifyDomainOwnership(website.domain, website.verificationToken || 'verified');

    // Auto-verify is an explicit opt-in, never an inference from NODE_ENV.
    // Keying it on `NODE_ENV !== 'production'` meant any host that did not set
    // NODE_ENV (the default on several PaaS providers) would let anyone claim
    // and crawl a domain they do not own.
    const autoVerify = process.env.ALLOW_UNVERIFIED_DOMAINS === 'true';
    if (isVerified || autoVerify) {
      const updated = await this.prisma.website.update({
        where: { id },
        data: { isVerified: true, verifiedAt: new Date() },
      });
      return { success: true, isVerified: updated.isVerified, message: `Domain ${updated.domain} verified successfully.` };
    }
    return { success: false, isVerified: false, message: 'DNS TXT verification record not found yet. Please allow DNS propagation.' };
  }

  @Post('crawls/start')
  @UseGuards(JwtAuthGuard, EntitlementsGuard)
  @Metered(Feature.CRAWL, UsageMetric.CRAWL_PAGES, 1)
  @ApiOperation({ summary: 'Initiate a new high-concurrency crawl job for a verified website' })
  @ApiBody({ schema: { type: 'object', properties: { websiteId: { type: 'string' }, domain: { type: 'string' }, maxConcurrency: { type: 'number', example: 10 }, maxDepth: { type: 'number', example: 10 }, useSitemap: { type: 'boolean', example: true } } } })
  async startCrawlJob(@Body() body: { websiteId?: string; domain?: string; maxConcurrency?: number; maxDepth?: number; useSitemap?: boolean }) {
    if (!body.websiteId && !body.domain) throw new BadRequestException('websiteId or domain is required');
    
    let websiteId = body.websiteId;
    if (!websiteId && body.domain) {
      const website = await this.prisma.website.findUnique({ where: { domain: body.domain } });
      if (!website) {
        // Auto-register if not found for demo purposes
        const newWeb = await this.registerWebsite({ url: `https://${body.domain}`, domain: body.domain });
        websiteId = newWeb.id;
      } else {
        websiteId = website.id;
      }
    }
    
    const jobId = await this.crawlerService.startCrawlJob(websiteId as string, body);
    return { success: true, jobId, message: 'Crawl job initiated and dispatched to BullMQ distributed workers.' };
  }

  @Get('crawls/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve progress, status, and summary metrics for a crawl job' })
  @ApiParam({ name: 'id', description: 'Crawl Job ID' })
  async getCrawlJob(@Param('id') id: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id },
      include: { website: true },
    });
    if (!job) throw new NotFoundException('Crawl job not found');
    return job;
  }

  @Get('websites/:domain/latest-crawl')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve the most recent crawl job for a domain' })
  @ApiParam({ name: 'domain', description: 'Website Domain' })
  async getLatestCrawlJob(@Param('domain') domain: string) {
    const website = await this.prisma.website.findUnique({
      where: { domain },
      include: {
        crawlJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (!website) throw new NotFoundException('Website not found');
    if (website.crawlJobs.length === 0) return null;
    
    return this.getCrawlJob(website.crawlJobs[0].id);
  }

  @Get('crawls/:id/issues')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get paginated list of Technical SEO issues detected during crawl' })
  @ApiParam({ name: 'id', description: 'Crawl Job ID' })
  @ApiQuery({ name: 'severity', required: false, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  async getCrawlIssues(
    @Param('id') id: string,
    @Query('severity') severity?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50'
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { crawlJobId: id };
    if (severity) where.severity = severity.toUpperCase();

    const [issues, total] = await Promise.all([
      this.prisma.issue.findMany({ where, skip, take: limitNum, orderBy: { severity: 'asc' } }),
      this.prisma.issue.count({ where }),
    ]);

    return { data: issues, meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
  }

  @Get('crawls/:id/graph')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve directed internal link graph, crawl depth, and orphan page report' })
  @ApiParam({ name: 'id', description: 'Crawl Job ID' })
  async getGraphReport(@Param('id') id: string) {
    return this.graphService.generateGraphReport(id);
  }

  @Get('crawls/:id/diff')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Compare this crawl job against a previous audit report to see new vs resolved issues' })
  @ApiParam({ name: 'id', description: 'Current Crawl Job ID' })
  @ApiQuery({ name: 'compareWith', required: true, description: 'Previous Crawl Job ID' })
  async getCrawlDiff(@Param('id') id: string, @Query('compareWith') compareWith: string) {
    if (!compareWith) throw new BadRequestException('compareWith parameter is required');
    return this.historyService.compareCrawlJobs(id, compareWith);
  }

  @Post('issues/:id/analyze')
  @UseGuards(JwtAuthGuard, EntitlementsGuard)
  @OrgFrom('issue', 'id')
  @Metered(Feature.AI_RECOMMENDATIONS, UsageMetric.AI_ANALYSES)
  @ApiOperation({ summary: 'Trigger AI explanation (Why it matters, SEO/Business impact, Priority)' })
  @ApiParam({ name: 'id', description: 'Issue ID' })
  async analyzeIssue(@Req() req: any, @Param('id') id: string) {
    const result = await this.aiService.analyzeIssue(id, req.organizationId);
    // Charged only once the analysis actually came back.
    await this.entitlements.recordUsage(req.organizationId, UsageMetric.AI_ANALYSES);
    return result;
  }

  @Post('issues/:id/autofix')
  @UseGuards(JwtAuthGuard, EntitlementsGuard)
  @OrgFrom('issue', 'id')
  @Metered(Feature.AUTO_FIX_PATCH, UsageMetric.AUTO_FIXES)
  @ApiOperation({ summary: 'Generate code snippet / text patch for an automated fix (Pro plan)' })
  @ApiParam({ name: 'id', description: 'Issue ID' })
  async generateAutoFix(@Req() req: any, @Param('id') id: string) {
    const result = await this.autoFixService.generateFixPatch(id, req.organizationId);
    await this.entitlements.recordUsage(req.organizationId, UsageMetric.AUTO_FIXES);
    return result;
  }

  @Post('issues/:id/approve')
  @UseGuards(JwtAuthGuard, EntitlementsGuard)
  @OrgFrom('issue', 'id')
  @RequiresFeature(Feature.AUTO_FIX_DEPLOY)
  @ApiOperation({ summary: 'Approve an AI patch and ship it to the customer repo (Pro plan)' })
  @ApiParam({ name: 'id', description: 'Issue ID' })
  @ApiBody({ schema: { type: 'object', properties: { userId: { type: 'string', example: 'user_123' } } } })
  async approveFix(@Req() req: any, @Param('id') id: string, @Body() body: { userId?: string }) {
    return this.autoFixService.approveAndExecuteFix(id, body.userId || req.user?.userId || 'admin_user');
  }

  @Post('webhooks/crawl-trigger')
  @ApiOperation({ summary: 'Webhook endpoint to trigger automated crawl upon CI/CD deployment or sitemap change' })
  @ApiBody({ schema: { type: 'object', properties: { domain: { type: 'string', example: 'growthx.ai' }, secret: { type: 'string' } } } })
  async triggerWebhook(@Body() body: { domain: string; secret?: string }) {
    if (!body.domain) throw new BadRequestException('domain parameter is required');
    return this.schedulerService.handleWebhookTrigger(body.domain, body.secret);
  }
}
