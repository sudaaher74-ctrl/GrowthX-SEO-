"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrawlController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma.service");
const crawler_service_1 = require("./crawler.service");
const security_service_1 = require("../security/security.service");
const history_service_1 = require("../history/history.service");
const graph_service_1 = require("../graph/graph.service");
const ai_service_1 = require("../ai/ai.service");
const auto_fix_service_1 = require("../ai/auto-fix.service");
const scheduler_service_1 = require("../scheduler/scheduler.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const entitlements_guard_1 = require("../billing/entitlements.guard");
const entitlements_service_1 = require("../billing/entitlements.service");
const org_context_service_1 = require("../billing/org-context.service");
const entitlements_decorator_1 = require("../billing/entitlements.decorator");
const plans_catalog_1 = require("../billing/plans.catalog");
let CrawlController = class CrawlController {
    constructor(prisma, crawlerService, securityService, historyService, graphService, aiService, autoFixService, schedulerService, entitlements, orgContext) {
        this.prisma = prisma;
        this.crawlerService = crawlerService;
        this.securityService = securityService;
        this.historyService = historyService;
        this.graphService = graphService;
        this.aiService = aiService;
        this.autoFixService = autoFixService;
        this.schedulerService = schedulerService;
        this.entitlements = entitlements;
        this.orgContext = orgContext;
    }
    async registerWebsiteRoute(req, body) {
        const organizationId = await this.orgContext.resolve(req);
        const existing = await this.prisma.website.findUnique({ where: { domain: body.domain } });
        // Only a genuinely new site counts against the plan's site allowance.
        if (!existing) {
            await this.entitlements.assertCanAddSite(organizationId);
        }
        return this.registerWebsite(body);
    }
    /** Shared by the route above and by auto-registration inside `startCrawlJob`. */
    async registerWebsite(body) {
        if (!body.url || !body.domain) {
            throw new common_1.BadRequestException('URL and domain are required.');
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
    async verifyDomain(id) {
        const website = await this.prisma.website.findUnique({ where: { id } });
        if (!website)
            throw new common_1.NotFoundException('Website not found');
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
    async startCrawlJob(body) {
        if (!body.websiteId && !body.domain)
            throw new common_1.BadRequestException('websiteId or domain is required');
        let websiteId = body.websiteId;
        if (!websiteId && body.domain) {
            const website = await this.prisma.website.findUnique({ where: { domain: body.domain } });
            if (!website) {
                // Auto-register if not found for demo purposes
                const newWeb = await this.registerWebsite({ url: `https://${body.domain}`, domain: body.domain });
                websiteId = newWeb.id;
            }
            else {
                websiteId = website.id;
            }
        }
        const jobId = await this.crawlerService.startCrawlJob(websiteId, body);
        return { success: true, jobId, message: 'Crawl job initiated and dispatched to BullMQ distributed workers.' };
    }
    async getCrawlJob(id) {
        const job = await this.prisma.crawlJob.findUnique({
            where: { id },
            include: { website: true },
        });
        if (!job)
            throw new common_1.NotFoundException('Crawl job not found');
        return job;
    }
    async getLatestCrawlJob(domain) {
        const website = await this.prisma.website.findUnique({
            where: { domain },
            include: {
                crawlJobs: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });
        if (!website)
            throw new common_1.NotFoundException('Website not found');
        if (website.crawlJobs.length === 0)
            return null;
        return this.getCrawlJob(website.crawlJobs[0].id);
    }
    async getCrawlIssues(id, severity, page = '1', limit = '50') {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
        const skip = (pageNum - 1) * limitNum;
        const where = { crawlJobId: id };
        if (severity)
            where.severity = severity.toUpperCase();
        const [issues, total] = await Promise.all([
            this.prisma.issue.findMany({ where, skip, take: limitNum, orderBy: { severity: 'asc' } }),
            this.prisma.issue.count({ where }),
        ]);
        return { data: issues, meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
    }
    async getGraphReport(id) {
        return this.graphService.generateGraphReport(id);
    }
    async getCrawlDiff(id, compareWith) {
        if (!compareWith)
            throw new common_1.BadRequestException('compareWith parameter is required');
        return this.historyService.compareCrawlJobs(id, compareWith);
    }
    async analyzeIssue(req, id) {
        const result = await this.aiService.analyzeIssue(id, req.organizationId);
        // Charged only once the analysis actually came back.
        await this.entitlements.recordUsage(req.organizationId, client_1.UsageMetric.AI_ANALYSES);
        return result;
    }
    async generateAutoFix(req, id) {
        const result = await this.autoFixService.generateFixPatch(id, req.organizationId);
        await this.entitlements.recordUsage(req.organizationId, client_1.UsageMetric.AUTO_FIXES);
        return result;
    }
    async approveFix(req, id, body) {
        return this.autoFixService.approveAndExecuteFix(id, body.userId || req.user?.userId || 'admin_user');
    }
    async triggerWebhook(body) {
        if (!body.domain)
            throw new common_1.BadRequestException('domain parameter is required');
        return this.schedulerService.handleWebhookTrigger(body.domain, body.secret);
    }
};
exports.CrawlController = CrawlController;
__decorate([
    (0, common_1.Post)('websites'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Register a new customer website for SEO auditing' }),
    (0, swagger_1.ApiBody)({ schema: { type: 'object', properties: { url: { type: 'string', example: 'https://growthx.ai' }, domain: { type: 'string', example: 'growthx.ai' }, projectId: { type: 'string' } } } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "registerWebsiteRoute", null);
__decorate([
    (0, common_1.Post)('websites/:id/verify'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Verify customer ownership of a domain via DNS TXT record' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Website ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "verifyDomain", null);
__decorate([
    (0, common_1.Post)('crawls/start'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, entitlements_guard_1.EntitlementsGuard),
    (0, entitlements_decorator_1.Metered)(plans_catalog_1.Feature.CRAWL, client_1.UsageMetric.CRAWL_PAGES, 1),
    (0, swagger_1.ApiOperation)({ summary: 'Initiate a new high-concurrency crawl job for a verified website' }),
    (0, swagger_1.ApiBody)({ schema: { type: 'object', properties: { websiteId: { type: 'string' }, domain: { type: 'string' }, maxConcurrency: { type: 'number', example: 10 }, maxDepth: { type: 'number', example: 10 }, useSitemap: { type: 'boolean', example: true } } } }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "startCrawlJob", null);
__decorate([
    (0, common_1.Get)('crawls/:id'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Retrieve progress, status, and summary metrics for a crawl job' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Crawl Job ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "getCrawlJob", null);
__decorate([
    (0, common_1.Get)('websites/:domain/latest-crawl'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Retrieve the most recent crawl job for a domain' }),
    (0, swagger_1.ApiParam)({ name: 'domain', description: 'Website Domain' }),
    __param(0, (0, common_1.Param)('domain')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "getLatestCrawlJob", null);
__decorate([
    (0, common_1.Get)('crawls/:id/issues'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get paginated list of Technical SEO issues detected during crawl' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Crawl Job ID' }),
    (0, swagger_1.ApiQuery)({ name: 'severity', required: false, enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: 'number', example: 1 }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: 'number', example: 50 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('severity')),
    __param(2, (0, common_1.Query)('page')),
    __param(3, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "getCrawlIssues", null);
__decorate([
    (0, common_1.Get)('crawls/:id/graph'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Retrieve directed internal link graph, crawl depth, and orphan page report' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Crawl Job ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "getGraphReport", null);
__decorate([
    (0, common_1.Get)('crawls/:id/diff'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Compare this crawl job against a previous audit report to see new vs resolved issues' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Current Crawl Job ID' }),
    (0, swagger_1.ApiQuery)({ name: 'compareWith', required: true, description: 'Previous Crawl Job ID' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('compareWith')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "getCrawlDiff", null);
__decorate([
    (0, common_1.Post)('issues/:id/analyze'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, entitlements_guard_1.EntitlementsGuard),
    (0, entitlements_decorator_1.OrgFrom)('issue', 'id'),
    (0, entitlements_decorator_1.Metered)(plans_catalog_1.Feature.AI_RECOMMENDATIONS, client_1.UsageMetric.AI_ANALYSES),
    (0, swagger_1.ApiOperation)({ summary: 'Trigger AI explanation (Why it matters, SEO/Business impact, Priority)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Issue ID' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "analyzeIssue", null);
__decorate([
    (0, common_1.Post)('issues/:id/autofix'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, entitlements_guard_1.EntitlementsGuard),
    (0, entitlements_decorator_1.OrgFrom)('issue', 'id'),
    (0, entitlements_decorator_1.Metered)(plans_catalog_1.Feature.AUTO_FIX_PATCH, client_1.UsageMetric.AUTO_FIXES),
    (0, swagger_1.ApiOperation)({ summary: 'Generate code snippet / text patch for an automated fix (Pro plan)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Issue ID' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "generateAutoFix", null);
__decorate([
    (0, common_1.Post)('issues/:id/approve'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, entitlements_guard_1.EntitlementsGuard),
    (0, entitlements_decorator_1.OrgFrom)('issue', 'id'),
    (0, entitlements_decorator_1.RequiresFeature)(plans_catalog_1.Feature.AUTO_FIX_DEPLOY),
    (0, swagger_1.ApiOperation)({ summary: 'Approve an AI patch and ship it to the customer repo (Pro plan)' }),
    (0, swagger_1.ApiParam)({ name: 'id', description: 'Issue ID' }),
    (0, swagger_1.ApiBody)({ schema: { type: 'object', properties: { userId: { type: 'string', example: 'user_123' } } } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "approveFix", null);
__decorate([
    (0, common_1.Post)('webhooks/crawl-trigger'),
    (0, swagger_1.ApiOperation)({ summary: 'Webhook endpoint to trigger automated crawl upon CI/CD deployment or sitemap change' }),
    (0, swagger_1.ApiBody)({ schema: { type: 'object', properties: { domain: { type: 'string', example: 'growthx.ai' }, secret: { type: 'string' } } } }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CrawlController.prototype, "triggerWebhook", null);
exports.CrawlController = CrawlController = __decorate([
    (0, swagger_1.ApiTags)('Crawlers & Audits'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        crawler_service_1.CrawlerService,
        security_service_1.SecurityService,
        history_service_1.HistoryService,
        graph_service_1.GraphService,
        ai_service_1.AiService,
        auto_fix_service_1.AutoFixService,
        scheduler_service_1.SchedulerService,
        entitlements_service_1.EntitlementsService,
        org_context_service_1.OrgContextService])
], CrawlController);
//# sourceMappingURL=crawl.controller.js.map