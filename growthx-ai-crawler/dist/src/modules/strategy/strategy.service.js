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
var StrategyService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma.service");
const multi_ai_router_service_1 = require("../ai-search/multi-ai-router/multi-ai-router.service");
const ai_visibility_service_1 = require("../ai-visibility/ai-visibility.service");
const entitlements_service_1 = require("../billing/entitlements.service");
const plans_catalog_1 = require("../billing/plans.catalog");
const strategy_evidence_1 = require("./strategy-evidence");
/** Enough context that a plan is about this business, not websites in general. */
const SAMPLE_PAGE_LIMIT = 15;
const LOST_PROMPT_LIMIT = 10;
let StrategyService = StrategyService_1 = class StrategyService {
    constructor(prisma, router, visibility, entitlements) {
        this.prisma = prisma;
        this.router = router;
        this.visibility = visibility;
        this.entitlements = entitlements;
        this.logger = new common_1.Logger(StrategyService_1.name);
    }
    /**
     * Assembles everything we know about a project from its crawl and its AI
     * visibility history. Exposed so the API can show a customer the basis for a
     * plan before paying a report against their allowance.
     */
    async gatherEvidence(projectId) {
        const project = await this.prisma.project.findUnique({
            where: { id: projectId },
            include: { websites: { select: { id: true, domain: true } }, competitors: true },
        });
        if (!project)
            throw new common_1.NotFoundException('Project not found');
        const websiteIds = project.websites.map((w) => w.id);
        const latestCrawl = websiteIds.length
            ? await this.prisma.crawlJob.findFirst({
                where: { websiteId: { in: websiteIds }, status: 'COMPLETED' },
                orderBy: { finishedAt: 'desc' },
            })
            : null;
        let criticalIssues = 0;
        let highIssues = 0;
        let topIssueTypes = [];
        let samplePages = [];
        if (latestCrawl) {
            const [critical, high, grouped, pages] = await Promise.all([
                this.prisma.issue.count({ where: { crawlJobId: latestCrawl.id, severity: client_1.IssueSeverity.CRITICAL } }),
                this.prisma.issue.count({ where: { crawlJobId: latestCrawl.id, severity: client_1.IssueSeverity.HIGH } }),
                this.prisma.issue.groupBy({
                    by: ['issueType'],
                    where: { crawlJobId: latestCrawl.id, status: 'OPEN' },
                    _count: { issueType: true },
                    orderBy: { _count: { issueType: 'desc' } },
                    take: 8,
                }),
                this.prisma.page.findMany({
                    where: { crawlJobId: latestCrawl.id },
                    select: { url: true, title: true, wordCount: true },
                    orderBy: { wordCount: 'desc' },
                    take: SAMPLE_PAGE_LIMIT,
                }),
            ]);
            criticalIssues = critical;
            highIssues = high;
            topIssueTypes = grouped.map((g) => ({ issueType: g.issueType, count: g._count.issueType }));
            samplePages = pages;
        }
        const trackedPromptCount = await this.prisma.trackedPrompt.count({
            where: { projectId, isActive: true },
        });
        let citationSharePct = null;
        let averagePosition = null;
        let byAssistant = [];
        let lostPrompts = [];
        if (trackedPromptCount > 0) {
            const report = await this.visibility.getReport(projectId, 28);
            citationSharePct = report.summary.citationSharePct;
            averagePosition = report.summary.averagePosition;
            byAssistant = report.byAssistant.map((a) => ({
                assistant: a.assistant,
                citationSharePct: a.citationSharePct,
            }));
            // The prompts worth writing content for: a rival is being recommended
            // and this business is not.
            const losses = await this.prisma.promptCheck.findMany({
                where: {
                    trackedPrompt: { projectId },
                    cited: false,
                    error: null,
                    NOT: { competitorsCited: { isEmpty: true } },
                },
                select: { competitorsCited: true, trackedPrompt: { select: { text: true } } },
                orderBy: { checkedAt: 'desc' },
                take: 50,
            });
            const seen = new Set();
            for (const loss of losses) {
                const text = loss.trackedPrompt.text;
                if (seen.has(text))
                    continue;
                seen.add(text);
                lostPrompts.push({ prompt: text, competitors: loss.competitorsCited });
                if (lostPrompts.length >= LOST_PROMPT_LIMIT)
                    break;
            }
        }
        return {
            business: { projectName: project.name, domains: project.websites.map((w) => w.domain) },
            site: {
                pagesCrawled: latestCrawl?.pagesCrawled ?? 0,
                lastCrawledAt: latestCrawl?.finishedAt?.toISOString() ?? null,
                criticalIssues,
                highIssues,
                topIssueTypes,
                samplePages,
            },
            aiVisibility: {
                citationSharePct,
                averagePosition,
                byAssistant,
                lostPrompts,
                trackedPromptCount,
            },
            competitors: project.competitors.map((c) => ({ domain: c.domain, label: c.label })),
        };
    }
    /**
     * Produces a market + SEO + content + social plan for a project.
     *
     * There is no heuristic fallback here on purpose. A crawl fix can be derived
     * from a URL, but a strategy cannot — a template would be generic advice
     * dressed up as analysis, which is exactly what the customer is paying us not
     * to send. If no model is reachable we say so.
     */
    async generate(projectId, organizationId) {
        await this.entitlements.assertFeature(organizationId, plans_catalog_1.Feature.MARKET_STRATEGY);
        await this.entitlements.assertQuota(organizationId, client_1.UsageMetric.STRATEGY_REPORTS);
        const evidence = await this.gatherEvidence(projectId);
        if (evidence.site.pagesCrawled === 0) {
            throw new common_1.BadRequestException('Run a crawl before generating a strategy — without site data the plan would be generic advice.');
        }
        const completion = await this.router.generate({
            prompt: (0, strategy_evidence_1.buildStrategyPrompt)(evidence),
            systemInstruction: strategy_evidence_1.STRATEGY_SYSTEM_PROMPT,
            task: multi_ai_router_service_1.AiTask.REASONING,
            organizationId,
            jsonSchema: strategy_evidence_1.STRATEGY_SCHEMA,
            // Strategy output is long; leave room for reasoning plus the plan itself.
            maxTokens: 16000,
        });
        if (completion.refused || !completion.text.trim()) {
            throw new common_1.ServiceUnavailableException('The model did not return a strategy. Please retry.');
        }
        const content = this.parseJson(completion.text);
        if (!content.seoRoadmap || !Array.isArray(content.seoRoadmap)) {
            throw new common_1.ServiceUnavailableException('The model returned an unusable strategy. Please retry.');
        }
        const report = await this.prisma.strategyReport.create({
            data: {
                projectId,
                evidence: evidence,
                content,
                generatedByModel: completion.model,
            },
        });
        await this.entitlements.recordUsage(organizationId, client_1.UsageMetric.STRATEGY_REPORTS);
        this.logger.log(`Strategy generated for project ${projectId} by ${completion.model}.`);
        return report;
    }
    async list(projectId) {
        return this.prisma.strategyReport.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            select: { id: true, createdAt: true, generatedByModel: true },
        });
    }
    async get(reportId) {
        const report = await this.prisma.strategyReport.findUnique({ where: { id: reportId } });
        if (!report)
            throw new common_1.NotFoundException('Strategy report not found');
        return report;
    }
    parseJson(text) {
        const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
        try {
            return JSON.parse(candidate);
        }
        catch {
            return {};
        }
    }
};
exports.StrategyService = StrategyService;
exports.StrategyService = StrategyService = StrategyService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        multi_ai_router_service_1.MultiAiRouterService,
        ai_visibility_service_1.AiVisibilityService,
        entitlements_service_1.EntitlementsService])
], StrategyService);
//# sourceMappingURL=strategy.service.js.map