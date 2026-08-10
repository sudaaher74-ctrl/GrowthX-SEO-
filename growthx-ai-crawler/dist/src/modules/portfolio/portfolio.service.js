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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PortfolioService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma.service");
const ai_visibility_service_1 = require("../ai-visibility/ai-visibility.service");
/**
 * The agency portfolio view: every client in one organization, side by side.
 *
 * Anything we cannot measure is returned as `null`, never as a zero. A client
 * with no tracked prompts has unknown AI share, not 0% — showing 0 would tell
 * an agency they are losing when they simply have not started measuring.
 */
let PortfolioService = class PortfolioService {
    constructor(prisma, visibility) {
        this.prisma = prisma;
        this.visibility = visibility;
    }
    async getPortfolio(organizationId, days = 28) {
        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            include: {
                projects: {
                    include: { websites: { select: { id: true, domain: true } } },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!organization)
            throw new common_1.NotFoundException('Organization not found');
        const clients = [];
        for (const project of organization.projects) {
            const websiteIds = project.websites.map((w) => w.id);
            const latestCrawl = websiteIds.length
                ? await this.prisma.crawlJob.findFirst({
                    where: { websiteId: { in: websiteIds }, status: 'COMPLETED' },
                    orderBy: { finishedAt: 'desc' },
                    select: { id: true, finishedAt: true, pagesCrawled: true },
                })
                : null;
            let criticalIssues = 0;
            let health = null;
            if (latestCrawl) {
                const [critical, high, medium, low] = await Promise.all([
                    this.countIssues(latestCrawl.id, client_1.IssueSeverity.CRITICAL),
                    this.countIssues(latestCrawl.id, client_1.IssueSeverity.HIGH),
                    this.countIssues(latestCrawl.id, client_1.IssueSeverity.MEDIUM),
                    this.countIssues(latestCrawl.id, client_1.IssueSeverity.LOW),
                ]);
                criticalIssues = critical;
                health = this.healthScore({ critical, high, medium, low, pages: latestCrawl.pagesCrawled });
            }
            const trackedPrompts = await this.prisma.trackedPrompt.count({
                where: { projectId: project.id, isActive: true },
            });
            let aiCitationSharePct = null;
            let aiDeltaPt = null;
            let averagePosition = null;
            let trend = [];
            if (trackedPrompts > 0) {
                const report = await this.visibility.getReport(project.id, days);
                // A report with zero completed checks is still "unmeasured".
                if (report.summary.checked > 0) {
                    aiCitationSharePct = report.summary.citationSharePct;
                    aiDeltaPt = report.summary.deltaPt;
                    averagePosition = report.summary.averagePosition;
                    trend = report.trend.map((t) => t.citationSharePct);
                }
            }
            clients.push({
                projectId: project.id,
                name: project.name,
                domain: project.websites[0]?.domain ?? null,
                initials: this.initials(project.name),
                tier: project.tier,
                retainerMonthlyMinor: project.retainerMonthlyMinor,
                retainerCurrency: project.retainerCurrency,
                aiCitationSharePct,
                aiDeltaPt,
                health,
                trackedPrompts,
                averagePosition,
                criticalIssues,
                trend,
                lastCrawledAt: latestCrawl?.finishedAt?.toISOString() ?? null,
            });
        }
        return {
            clients,
            summary: this.summarise(clients),
            alerts: this.buildAlerts(clients),
        };
    }
    countIssues(crawlJobId, severity) {
        return this.prisma.issue.count({ where: { crawlJobId, severity, status: 'OPEN' } });
    }
    /**
     * 100 minus a severity-weighted penalty per crawled page. Deliberately simple
     * and explainable — an agency has to defend this number to a client.
     */
    healthScore(input) {
        const pages = Math.max(1, input.pages);
        const weighted = input.critical * 10 + input.high * 4 + input.medium * 1.5 + input.low * 0.5;
        const penalty = Math.min(100, (weighted / pages) * 100);
        return Math.max(0, Math.round(100 - penalty));
    }
    initials(name) {
        const words = name.trim().split(/\s+/).filter(Boolean);
        if (words.length === 0)
            return '?';
        if (words.length === 1)
            return words[0].slice(0, 2).toUpperCase();
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    summarise(clients) {
        const measured = clients.filter((c) => c.aiCitationSharePct !== null);
        const portfolioAiSharePct = measured.length
            ? Number((measured.reduce((sum, c) => sum + c.aiCitationSharePct, 0) / measured.length).toFixed(1))
            : null;
        const withDelta = measured.filter((c) => c.aiDeltaPt !== null);
        const portfolioAiDeltaPt = withDelta.length
            ? Number((withDelta.reduce((sum, c) => sum + c.aiDeltaPt, 0) / withDelta.length).toFixed(1))
            : null;
        const withRetainer = clients.filter((c) => c.retainerMonthlyMinor !== null);
        return {
            portfolioAiSharePct,
            portfolioAiDeltaPt,
            promptsTracked: clients.reduce((sum, c) => sum + c.trackedPrompts, 0),
            clientsImproving: withDelta.filter((c) => c.aiDeltaPt > 0).length,
            clientsDeclining: withDelta.filter((c) => c.aiDeltaPt < 0).length,
            clientCount: clients.length,
            openCriticals: clients.reduce((sum, c) => sum + c.criticalIssues, 0),
            mrrMinor: withRetainer.reduce((sum, c) => sum + c.retainerMonthlyMinor, 0),
            mrrCurrency: withRetainer[0]?.retainerCurrency ?? 'INR',
            clientsWithoutRetainer: clients.length - withRetainer.length,
        };
    }
    /** The "needs your attention" feed: what an agency owner should act on. */
    buildAlerts(clients) {
        const alerts = [];
        for (const client of clients) {
            if (client.aiDeltaPt !== null && client.aiDeltaPt <= -2) {
                alerts.push({
                    projectId: client.projectId,
                    title: `${client.name} lost ${Math.abs(client.aiDeltaPt)}pt of AI citation share`,
                    detail: 'Citation share fell versus the previous period.',
                    tag: 'AI',
                    severity: 'critical',
                });
            }
            if (client.criticalIssues >= 5) {
                alerts.push({
                    projectId: client.projectId,
                    title: `${client.name} has ${client.criticalIssues} critical issues open`,
                    detail: 'Unresolved critical issues from the latest crawl.',
                    tag: 'CRAWL',
                    severity: 'warning',
                });
            }
            if (client.trackedPrompts === 0) {
                alerts.push({
                    projectId: client.projectId,
                    title: `${client.name} has no prompts tracked`,
                    detail: 'AI visibility cannot be reported until prompts are added.',
                    tag: 'SETUP',
                    severity: 'info',
                });
            }
            if (client.lastCrawledAt === null) {
                alerts.push({
                    projectId: client.projectId,
                    title: `${client.name} has never been crawled`,
                    detail: 'Run an audit to populate health and issue counts.',
                    tag: 'SETUP',
                    severity: 'info',
                });
            }
        }
        const rank = { critical: 0, warning: 1, info: 2 };
        return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
    }
    /** Lets an agency record what a client pays, so MRR is real rather than mocked. */
    async setRetainer(projectId, data) {
        return this.prisma.project.update({
            where: { id: projectId },
            data: {
                tier: data.tier,
                retainerMonthlyMinor: data.retainerMonthlyMinor,
                ...(data.retainerCurrency ? { retainerCurrency: data.retainerCurrency } : {}),
            },
        });
    }
};
exports.PortfolioService = PortfolioService;
exports.PortfolioService = PortfolioService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        ai_visibility_service_1.AiVisibilityService])
], PortfolioService);
//# sourceMappingURL=portfolio.service.js.map