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
import { FixPreviewService } from '../ai/fix-preview.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { calculateHealthScore, HealthScoreCalculator } from '../issues/health-score.util';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgContextService } from '../organizations/org-context.service';
import { VerificationEngineService } from './verification-engine.service';
import { UrlInventoryService } from './inventory/url-inventory.service';

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
    private readonly fixPreviewService: FixPreviewService,
    private readonly schedulerService: SchedulerService,
    private readonly orgContext: OrgContextService,
    private readonly verificationEngine: VerificationEngineService,
    private readonly urlInventory: UrlInventoryService,
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

  /**
   * Same, for an issue traced back through its crawl job. The issue routes
   * below loaded the issue by id alone, so any signed-in user could run a paid
   * analysis on, preview the repository behind, or approve a fix for another
   * customer's issue.
   */
  private async issueForCaller(req: any, issueId: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id: issueId }, select: { crawlJobId: true } });
    if (!issue) throw new NotFoundException('Issue not found');
    await this.crawlJobForCaller(req, issue.crawlJobId);
  }

  @Post('websites')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Register a new customer website for SEO auditing' })
  @ApiBody({ schema: { type: 'object', properties: { url: { type: 'string', example: 'https://growthx.ai' }, domain: { type: 'string', example: 'growthx.ai' }, projectId: { type: 'string' } } } })
  async registerWebsiteRoute(@Req() req: any, @Body() body: { url: string; domain: string; projectId?: string }) {
    const organizationId: string = req.organizationId;
    // The same normalisation `registerWebsite` saves under. Checking ownership
    // against the raw input let "Example.com" or "https://example.com" miss
    // the existing row here, then overwrite it there — moving another
    // tenant's site and its crawl history into the caller's project.
    const domain = normalizeWebsiteDomain(body.domain || body.url);
    if (!domain) throw new BadRequestException('URL or domain is required.');

    const existing = await this.prisma.website.findUnique({
      where: { domain },
      select: { id: true, project: { select: { organizationId: true } } },
    });

    // `Website.domain` is globally unique and `registerWebsite` upserts on it,
    // so re-registering a domain another tenant already owns used to reassign
    // its projectId — moving that site and its whole crawl history across the
    // tenant boundary. A domain stays with the organization that claimed it.
    const owner = existing?.project?.organizationId;
    if (owner && owner !== organizationId) {
      throw new ForbiddenException(
        `${domain} is already registered to another organization. If you own this domain, ask them to remove it first.`,
      );
    }

    // A project the caller does not belong to would park the site outside their
    // own organization, where the checks above cannot see it.
    if (body.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: body.projectId },
        select: { organizationId: true },
      });
      if (!project) throw new NotFoundException('Project not found');
      await this.orgContext.assertMembership(req.user?.userId, project.organizationId);
      if (owner && owner !== project.organizationId) {
        throw new ForbiddenException(`${domain} is already registered to another organization.`);
      }
    }

    return this.registerWebsite({ ...body, domain });
  }

  /** Shared by the route above and by auto-registration inside `startCrawlJob`. */
  private async registerWebsite(body: { url: string; domain: string; projectId?: string }) {
    if (!body.url && !body.domain) {
      throw new BadRequestException('URL or domain is required.');
    }
    const domain = normalizeWebsiteDomain(body.domain || body.url);
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

    if (latest && latest.status === 'COMPLETED' && latest.healthScore === null) {
      try {
        const uniqueKeys = new Set<string>();
        const calculator = new HealthScoreCalculator(latest.pagesCrawled);
        let cursorId: string | null = null;
        let hasMore = true;
        const batchSize = 10000;

        while (hasMore) {
          const queryOptions: any = {
            where: { crawlJobId: latest.id },
            select: { id: true, severity: true, confidence: true, affectedUrl: true, dedupKey: true, issueType: true },
            take: batchSize,
            orderBy: { id: 'asc' },
          };
          if (cursorId) {
            queryOptions.skip = 1;
            queryOptions.cursor = { id: cursorId };
          }
          const issuesBatch: any[] = await this.prisma.issue.findMany(queryOptions);

          for (const i of issuesBatch) {
            const key = i.dedupKey || `${i.affectedUrl}::${i.issueType}`;
            if (!uniqueKeys.has(key)) {
              uniqueKeys.add(key);
              calculator.addIssue({
                severity: i.severity,
                confidence: i.confidence || 'CONFIRMED',
                affectedUrl: i.affectedUrl,
                issueType: i.issueType,
              });
            }
          }

          if (issuesBatch.length < batchSize) {
            hasMore = false;
          } else {
            cursorId = issuesBatch[issuesBatch.length - 1].id;
          }
        }

        const scoreRes = calculator.getScore();
        latest.healthScore = scoreRes.healthScore;
        latest.uniqueIssuesCount = uniqueKeys.size;
        await this.prisma.crawlJob
          .update({
            where: { id: latest.id },
            data: { healthScore: scoreRes.healthScore, uniqueIssuesCount: uniqueKeys.size },
          })
          .catch(() => {});
      } catch (err) {}
    }

    // The URL reconciliation stored with a finished crawl is a snapshot of how
    // it was counted then. Counting changed — one page per page rather than one
    // per spelling, files apart — so it is re-read from the crawl's own URL
    // rows, which do not change once the crawl is done. Otherwise a crawl run
    // before the change would keep reporting "72 discovered, 37 not crawled"
    // for a 35-page site it had crawled in full, until someone re-ran it.
    const diagnostics = latest?.qualityDiagnostics as Record<string, unknown> | null | undefined;
    if (latest && latest.status === 'COMPLETED' && diagnostics && typeof diagnostics === 'object' && diagnostics.inventory) {
      try {
        const inventory = await this.urlInventory.metrics(latest.id);
        if (inventory.urlsDiscovered > 0) {
          latest.qualityDiagnostics = { ...diagnostics, inventory } as any;
        }
      } catch {
        // The stored snapshot is still a valid answer.
      }
    }

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
  @ApiQuery({ name: 'severity', required: false, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'ALL'] })
  @ApiQuery({ name: 'category', required: false, type: 'string' })
  @ApiQuery({ name: 'confidence', required: false, enum: ['CONFIRMED', 'LIKELY', 'ADVISORY', 'ALL'] })
  @ApiQuery({ name: 'search', required: false, type: 'string' })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  async getCrawlIssues(
    @Req() req: any,
    @Param('id') id: string,
    @Query('severity') severity?: string,
    @Query('category') category?: string,
    @Query('confidence') confidence?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const job = await this.crawlJobForCaller(req, id);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { crawlJobId: id };
    if (severity && severity.toUpperCase() !== 'ALL') where.severity = severity.toUpperCase();
    if (category && category.toUpperCase() !== 'ALL') where.category = category.toUpperCase();
    if (confidence && confidence.toUpperCase() !== 'ALL') where.confidence = confidence.toUpperCase();
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { affectedUrl: { contains: q, mode: 'insensitive' } },
        { issueType: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { explanation: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [issues, total, severityGroups, categoryGroups, confidenceGroups] = await Promise.all([
      this.prisma.issue.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        include: {
          page: { select: { url: true, pageType: true, statusCode: true } },
        },
      }),
      this.prisma.issue.count({ where }),
      this.prisma.issue.groupBy({
        by: ['severity'],
        where: { crawlJobId: id },
        _count: { id: true },
      }),
      this.prisma.issue.groupBy({
        by: ['category'],
        where: { crawlJobId: id },
        _count: { id: true },
      }),
      this.prisma.issue.groupBy({
        by: ['confidence'],
        where: { crawlJobId: id },
        _count: { id: true },
      }),
    ]);

    const countsBySeverity: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const g of severityGroups) {
      if (g.severity) countsBySeverity[g.severity] = g._count.id;
    }

    const countsByCategory: Record<string, number> = {};
    for (const g of categoryGroups) {
      if (g.category) countsByCategory[g.category] = g._count.id;
    }

    const countsByConfidence: Record<string, number> = { CONFIRMED: 0, LIKELY: 0, ADVISORY: 0 };
    for (const g of confidenceGroups) {
      if (g.confidence) countsByConfidence[g.confidence] = g._count.id;
    }

    const totalFindings = job.issuesFound || Object.values(countsBySeverity).reduce((a, b) => a + b, 0);

    return {
      data: issues,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        totalFindings,
        uniqueOpenIssues: job.uniqueIssuesCount || totalFindings,
        resolvedIssues: job.resolvedIssuesCount || 0,
        healthScore: job.healthScore ?? null,
        countsBySeverity,
        countsByCategory,
        countsByConfidence,
        qualityDiagnostics: job.qualityDiagnostics ?? null,
      },
    };
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

  /**
   * Every URL this crawl knows about, and what became of each one.
   *
   * The dashboard's totals are sums over these rows, so a reader who does not
   * believe a number can page through the URLs behind it. That is the point of
   * the endpoint: the old surface could report "32 of 32, 100%" with no way to
   * ask which 32, and a coverage figure nobody can audit is a claim rather than
   * a measurement.
   */
  @Get('crawls/:id/urls')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'The crawl URL inventory: every discovered URL, its sources and its outcome' })
  @ApiParam({ name: 'id', description: 'Crawl Job ID' })
  @ApiQuery({ name: 'page', required: false, type: 'number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', example: 50 })
  @ApiQuery({ name: 'state', required: false, description: 'PENDING | IN_PROGRESS | DONE | SKIPPED | FAILED' })
  @ApiQuery({ name: 'source', required: false, description: 'sitemap | internal_link | javascript_dom | seed | ...' })
  @ApiQuery({ name: 'reason', required: false, description: 'Exclusion reason, e.g. robots_blocked' })
  async getCrawlUrls(
    @Req() req: any,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('state') state?: string,
    @Query('source') source?: string,
    @Query('reason') reason?: string,
  ) {
    await this.crawlJobForCaller(req, id);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));

    const where: any = { crawlJobId: id };
    if (state) where.state = state.toUpperCase();
    if (source) where.sources = { has: source };
    if (reason) where.reason = reason;

    const [rows, total] = await Promise.all([
      this.prisma.crawlFrontier.findMany({
        where,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        orderBy: [{ discoveredAt: 'asc' }],
        select: {
          url: true,
          normalizedUrl: true,
          state: true,
          reason: true,
          sources: true,
          discoverySource: true,
          sourceUrl: true,
          httpStatus: true,
          contentType: true,
          indexability: true,
          canonicalUrl: true,
          redirectTarget: true,
          robotsAllowed: true,
          rendered: true,
          depth: true,
          attempts: true,
          discoveredAt: true,
          queuedAt: true,
          crawledAt: true,
        },
      }),
      this.prisma.crawlFrontier.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        ...row,
        // A row written before `sources` existed still knows the one source it
        // was created with.
        sources: row.sources.length > 0 ? row.sources : [row.discoverySource],
        crawlStatus: row.state === 'DONE' ? 'crawled' : row.state === 'FAILED' ? 'failed' : row.state === 'SKIPPED' ? 'excluded' : 'not_crawled',
        // Stored on `reason`; named for what it means to a reader.
        exclusionReason: row.state === 'DONE' ? null : row.reason || 'queued',
      })),
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    };
  }

  @Get('crawls/:id/urls/reconciliation')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Crawl reconciliation: discovered, crawled and not-crawled with reasons, which must balance' })
  @ApiParam({ name: 'id', description: 'Crawl Job ID' })
  async getCrawlReconciliation(@Req() req: any, @Param('id') id: string) {
    await this.crawlJobForCaller(req, id);
    const metrics = await this.urlInventory.metrics(id);
    return {
      ...metrics,
      // Stated rather than assumed, so a caller can assert it.
      balances: metrics.urlsCrawled + metrics.notCrawled === metrics.urlsDiscovered,
      coveragePercent: metrics.urlsDiscovered > 0 ? Math.round((metrics.urlsCrawled / metrics.urlsDiscovered) * 1000) / 10 : null,
    };
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
    await this.issueForCaller(req, id);
    const result = await this.aiService.analyzeIssue(id, req.organizationId);
    // Charged only once the analysis actually came back.
    return result;
  }

  @Post('issues/:id/autofix')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Generate code snippet / text patch for an automated fix (Pro plan)' })
  @ApiParam({ name: 'id', description: 'Issue ID' })
  async generateAutoFix(@Req() req: any, @Param('id') id: string) {
    await this.issueForCaller(req, id);
    const result = await this.autoFixService.generateFixPatch(id, req.organizationId);
    return result;
  }

  /**
   * Everything the fix modal shows: the page's real current state, the patch
   * written from its own content, the file to edit, and which surface the fix
   * changes. Separate from `autofix` because it also reads the repository and
   * the page's stored schemas, which the patch generator has no view of.
   */
  @Post('issues/:id/fix-preview')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Real before/after, file location and evidence type for an issue fix' })
  @ApiParam({ name: 'id', description: 'Issue ID' })
  async fixPreview(@Req() req: any, @Param('id') id: string) {
    await this.issueForCaller(req, id);
    return this.fixPreviewService.buildPreview(id, req.organizationId);
  }

  @Post('issues/:id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Approve an AI patch and ship it to the customer repo (Pro plan)' })
  @ApiParam({ name: 'id', description: 'Issue ID' })
  @ApiBody({ schema: { type: 'object', properties: { userId: { type: 'string', example: 'user_123' } } } })
  async approveFix(@Req() req: any, @Param('id') id: string) {
    await this.issueForCaller(req, id);
    // The approver is whoever is signed in — never a user id from the body,
    // which let a caller record the approval under someone else's name.
    return this.autoFixService.approveAndExecuteFix(id, req.user.userId);
  }

  @Post('webhooks/crawl-trigger')
  @ApiOperation({ summary: 'Webhook endpoint to trigger automated crawl upon CI/CD deployment or sitemap change' })
  @ApiBody({ schema: { type: 'object', properties: { domain: { type: 'string', example: 'growthx.ai' }, secret: { type: 'string' } } } })
  async triggerWebhook(@Body() body: { domain: string; secret?: string }) {
    if (!body.domain) throw new BadRequestException('domain parameter is required');
    return this.schedulerService.handleWebhookTrigger(body.domain, body.secret);
  }

  @Post('projects/:projectId/verification/run')
  // Had no guard at all, and the membership check below swallowed its own
  // failure: anyone could run or read verification for any project.
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Run live re-crawl verification pipeline and generate signed certificate' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  async runVerification(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { issueIds?: string[]; urls?: string[]; sprintWeek?: number },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const orgId = project.organizationId;
    await this.orgContext.assertMembership(req.user?.userId, orgId);

    return this.verificationEngine.runVerification(orgId, projectId, body);
  }

  @Get('projects/:projectId/verification/latest')
  // Had no guard at all, and the membership check below swallowed its own
  // failure: anyone could run or read verification for any project.
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get latest verification certificate for project' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  async getLatestVerification(@Req() req: any, @Param('projectId') projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const orgId = project.organizationId;
    await this.orgContext.assertMembership(req.user?.userId, orgId);

    return this.verificationEngine.getLatestCertificate(orgId, projectId);
  }
}

/** The form a website's domain is stored and looked up under. */
function normalizeWebsiteDomain(input?: string): string {
  return (input ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
}
