import { Controller, Post, Get, Body, Param, Query, Req, UseGuards, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JobStatus, } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from './crawler.service';
import { SecurityService } from '../security/security.service';
import { HistoryService } from '../history/history.service';
import { GraphService } from '../graph/graph.service';
import { AiService } from '../ai/ai.service';
import { AutoFixService } from '../ai/auto-fix.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgContextService } from '../organizations/org-context.service';

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
    private readonly orgContext: OrgContextService,
  ) {}

  /**
   * Confirms the caller may act on a website, and returns it.
   *
   * These routes identify a resource by id or domain rather than by
   * organization, so `JwtAuthGuard` alone only proved the caller is *someone*.
   * Every one of them was readable by any logged-in user — and
   * `latest-crawl` takes a plain domain, so no id had to be guessed.
   */
  private async websiteForCaller(req: any, where: { id: string } | { domain: string }) {
    const website = await this.prisma.website.findUnique({
      where: where as any,
      select: { id: true, domain: true, verificationToken: true, project: { select: { organizationId: true } } },
    });
    if (!website) throw new NotFoundException('Website not found');

    const organizationId = website.project?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException(
        'This website is not attached to any organization, so access to it cannot be authorized.',
      );
    }

    // Resolving the owner proves who the record belongs to, not that the
    // caller is one of them. Both halves are the check.
    await this.orgContext.assertMembership(req.user?.userId, organizationId);
    return website;
  }

  /** Same, for a crawl job traced back through its website's project. */
  private async crawlJobForCaller(req: any, jobId: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
      include: { website: { include: { project: { select: { organizationId: true } } } } },
    });
    if (!job) throw new NotFoundException('Crawl job not found');

    const organizationId = job.website.project?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException(
        'This crawl job is not attached to any organization, so access to it cannot be authorized.',
      );
    }

    await this.orgContext.assertMembership(req.user?.userId, organizationId);
    return job;
  }

  @Post('websites')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register a new customer website for SEO auditing' })
  @ApiBody({ schema: { type: 'object', properties: { url: { type: 'string', example: 'https://growthx.ai' }, domain: { type: 'string', example: 'growthx.ai' }, projectId: { type: 'string' } } } })
  async registerWebsiteRoute(@Req() req: any, @Body() body: { url: string; domain: string; projectId?: string }) {
    const organizationId = req.organizationId || "default-org";
    const existing = await this.prisma.website.findUnique({
      where: { domain: body.domain },
      select: { id: true, project: { select: { organizationId: true } } },
    });

    // `Website.domain` is globally unique and `registerWebsite` upserts on it,
    // so re-registering a domain another tenant already owns used to reassign
    // its projectId — moving that site and its whole crawl history across the
    // tenant boundary. A domain stays with the organization that claimed it.
    const owner = existing?.project?.organizationId;
    if (owner && owner !== organizationId) {
      throw new ForbiddenException(
        `${body.domain} is already registered to another organization. If you own this domain, ask them to remove it first.`,
      );
    }

    // Only a genuinely new site counts against the plan's site allowance.
    if (!existing) {
    }

    // A project the caller does not belong to would park the site outside their
    // own organization, where the checks above cannot see it.
    if (body.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: body.projectId },
        select: { organizationId: true },
      });
      if (!project) throw new NotFoundException('Project not found');
          }

    return this.registerWebsite(body);
  }

  /** Shared by the route above and by auto-registration inside `startCrawlJob`. */
  private async registerWebsite(body: { url: string; domain: string; projectId?: string }) {
    if (!body.url && !body.domain) {
      throw new BadRequestException('URL or domain is required.');
    }
    let domain = (body.domain || body.url).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    let formattedUrl = (body.url || body.domain).trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const token = this.securityService.generateVerificationToken(domain);
    const website = await this.prisma.website.upsert({
      where: { domain },
      update: { url: formattedUrl, verificationToken: token, ...(body.projectId ? { projectId: body.projectId } : {}) },
      create: { url: formattedUrl, domain, verificationToken: token, isVerified: false, projectId: body.projectId },
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
  async verifyDomain(@Req() req: any, @Param('id') id: string) {
    const website = await this.websiteForCaller(req, { id });

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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Initiate a new high-concurrency crawl job for a verified website' })
  @ApiBody({ schema: { type: 'object', properties: { websiteId: { type: 'string' }, domain: { type: 'string' }, maxConcurrency: { type: 'number', example: 10 }, maxDepth: { type: 'number', example: 10 }, useSitemap: { type: 'boolean', example: true } } } })
  async startCrawlJob(@Req() req: any, @Body() body: { websiteId?: string; domain?: string; maxConcurrency?: number; maxDepth?: number; useSitemap?: boolean }) {
    if (!body.websiteId && !body.domain) throw new BadRequestException('websiteId or domain is required');

    // resolved an organization for the *caller*, but nothing
    // tied the website to it: any logged-in user could spend their own plan's
    // allowance crawling another tenant's site, and the pages would land in
    // that tenant's crawl history.
    const website = body.websiteId
      ? await this.websiteForCaller(req, { id: body.websiteId })
      : await this.websiteForCaller(req, { domain: body.domain as string });

    const jobId = await this.crawlerService.startCrawlJob(website.id, body);
    return { success: true, jobId, message: 'Crawl job initiated and dispatched to BullMQ distributed workers.' };
  }

  @Get('crawls/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve progress, status, and summary metrics for a crawl job' })
  @ApiParam({ name: 'id', description: 'Crawl Job ID' })
  async getCrawlJob(@Req() req: any, @Param('id') id: string) {
    return this.crawlJobForCaller(req, id);
  }

  @Get('websites/:domain/latest-crawl')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve the most recent crawl job for a domain' })
  @ApiParam({ name: 'domain', description: 'Website Domain' })
  async getLatestCrawlJob(@Req() req: any, @Param('domain') domain: string) {
    await this.websiteForCaller(req, { domain });

    const latest = await this.prisma.crawlJob.findFirst({
      where: { website: { domain } },
      orderBy: { createdAt: 'desc' },
      include: { website: true },
    });

    return latest ?? null;
  }

  @Get('websites/:domain/crawl-history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Completed crawls for a domain, oldest first, for trend lines' })
  @ApiParam({ name: 'domain', description: 'Website Domain' })
  async getCrawlHistory(
    @Req() req: any,
    @Param('domain') domain: string,
    @Query('limit') limit?: string,
  ) {
    await this.websiteForCaller(req, { domain });

    // Only finished crawls: a running or failed job has no meaningful page or
    // issue count, and plotting its zeros would draw a cliff that never
    // happened. Ascending so the caller can render it left to right without
    // reversing, and capped so a long-lived site cannot return thousands.
    const take = Math.min(Math.max(parseInt(limit ?? '12', 10) || 12, 2), 60);

    const runs = await this.prisma.crawlJob.findMany({
      where: { website: { domain }, status: JobStatus.COMPLETED, finishedAt: { not: null } },
      orderBy: { finishedAt: 'desc' },
      take,
      select: { id: true, pagesCrawled: true, issuesFound: true, startedAt: true, finishedAt: true },
    });

    return runs.reverse();
  }

  @Get('crawls/:id/issues')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get paginated list of Technical SEO issues detected during crawl' })
  @ApiParam({ name: 'id', description: 'Crawl Job ID' })
  @ApiQuery({ name: 'severity', required: false, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  async getCrawlIssues(
    @Req() req: any,
    @Param('id') id: string,
    @Query('severity') severity?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50'
  ) {
    await this.crawlJobForCaller(req, id);
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

  @Get('crawls/:id/pages')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get paginated list of Pages crawled and their performance metrics' })
  @ApiParam({ name: 'id', description: 'Crawl Job ID' })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  async getCrawlPages(
    @Req() req: any,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50'
  ) {
    await this.crawlJobForCaller(req, id);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { crawlJobId: id };

    const [pages, total] = await Promise.all([
      this.prisma.page.findMany({ 
        where, 
        skip, 
        take: limitNum, 
        orderBy: { crawledAt: 'desc' },
        include: { performance: true }
      }),
      this.prisma.page.count({ where }),
    ]);

    return { data: pages, meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
  }

  @Get('crawls/:id/graph')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retrieve directed internal link graph, crawl depth, and orphan page report' })
  @ApiParam({ name: 'id', description: 'Crawl Job ID' })
  async getGraphReport(@Req() req: any, @Param('id') id: string) {
    await this.crawlJobForCaller(req, id);
    return this.graphService.generateGraphReport(id);
  }

  @Get('crawls/:id/diff')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Compare this crawl job against a previous audit report to see new vs resolved issues' })
  @ApiParam({ name: 'id', description: 'Current Crawl Job ID' })
  @ApiQuery({ name: 'compareWith', required: true, description: 'Previous Crawl Job ID' })
  async getCrawlDiff(@Req() req: any, @Param('id') id: string, @Query('compareWith') compareWith: string) {
    if (!compareWith) throw new BadRequestException('compareWith parameter is required');
    // Both sides, or the diff becomes a read of someone else's audit through
    // the query string.
    await this.crawlJobForCaller(req, id);
    await this.crawlJobForCaller(req, compareWith);
    return this.historyService.compareCrawlJobs(id, compareWith);
  }

  @Post('issues/:id/analyze')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Trigger AI explanation (Why it matters, SEO/Business impact, Priority)' })
  @ApiParam({ name: 'id', description: 'Issue ID' })
  async analyzeIssue(@Req() req: any, @Param('id') id: string) {
    const result = await this.aiService.analyzeIssue(id, req.organizationId);
    // Charged only once the analysis actually came back.
    return result;
  }

  @Post('issues/:id/autofix')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate code snippet / text patch for an automated fix (Pro plan)' })
  @ApiParam({ name: 'id', description: 'Issue ID' })
  async generateAutoFix(@Req() req: any, @Param('id') id: string) {
    const result = await this.autoFixService.generateFixPatch(id, req.organizationId);
    return result;
  }

  @Post('issues/:id/approve')
  @UseGuards(JwtAuthGuard)
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
