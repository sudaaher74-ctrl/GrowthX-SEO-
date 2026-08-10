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
exports.ActivityService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
/**
 * A project's activity feed, assembled from tables that already exist rather
 * than a dedicated event log — every one of these actions already writes a
 * timestamped row somewhere, so this just reads and merges them.
 */
let ActivityService = class ActivityService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(projectId, limit = 30) {
        const [crawls, runs, strategies, shippedContent] = await Promise.all([
            this.prisma.crawlJob.findMany({
                where: { website: { projectId }, status: { in: ['COMPLETED', 'FAILED'] } },
                orderBy: { updatedAt: 'desc' },
                take: limit,
                select: { id: true, status: true, pagesCrawled: true, issuesFound: true, finishedAt: true, updatedAt: true, errorMessage: true },
            }),
            this.prisma.automationRun.findMany({
                where: { projectId, status: { in: ['AWAITING_REVIEW', 'FAILED', 'MERGED'] } },
                orderBy: { startedAt: 'desc' },
                take: limit,
                select: { id: true, kind: true, status: true, finishedAt: true, startedAt: true, error: true, filesChanged: true, pullRequestUrl: true },
            }),
            this.prisma.strategyReport.findMany({
                where: { projectId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: { id: true, createdAt: true, generatedByModel: true },
            }),
            this.prisma.contentPiece.findMany({
                where: { projectId, status: 'COMMITTED' },
                orderBy: { updatedAt: 'desc' },
                take: limit,
                select: { id: true, title: true, updatedAt: true },
            }),
        ]);
        const items = [];
        for (const c of crawls) {
            const at = c.finishedAt ?? c.updatedAt;
            items.push(c.status === 'COMPLETED'
                ? { id: `crawl-${c.id}`, status: 'success', message: `Crawl completed — ${c.pagesCrawled} pages, ${c.issuesFound} issue${c.issuesFound === 1 ? '' : 's'} found`, time: at.toISOString() }
                : { id: `crawl-${c.id}`, status: 'error', message: `Crawl failed${c.errorMessage ? `: ${c.errorMessage}` : ''}`, time: at.toISOString() });
        }
        for (const r of runs) {
            const at = r.finishedAt ?? r.startedAt;
            const kindLabel = r.kind === 'FIXES' ? 'SEO fixes' : 'content';
            if (r.status === 'AWAITING_REVIEW' || r.status === 'MERGED') {
                items.push({
                    id: `run-${r.id}`,
                    status: 'success',
                    message: r.status === 'MERGED'
                        ? `Automated ${kindLabel} pull request merged — ${r.filesChanged.length} file(s) changed`
                        : `Automated ${kindLabel} run opened a pull request — ${r.filesChanged.length} file(s) changed`,
                    time: at.toISOString(),
                });
            }
            else if (r.status === 'FAILED') {
                items.push({
                    id: `run-${r.id}`,
                    status: 'error',
                    message: `Automated ${kindLabel} run failed${r.error ? `: ${r.error}` : ''}`,
                    time: at.toISOString(),
                });
            }
            else {
                items.push({ id: `run-${r.id}`, status: 'pending', message: `Automated ${kindLabel} run in progress`, time: at.toISOString() });
            }
        }
        for (const s of strategies) {
            items.push({
                id: `strategy-${s.id}`,
                status: 'success',
                message: `Strategy report generated${s.generatedByModel ? ` by ${s.generatedByModel}` : ''}`,
                time: s.createdAt.toISOString(),
            });
        }
        for (const p of shippedContent) {
            items.push({ id: `content-${p.id}`, status: 'success', message: `Published content: ${p.title}`, time: p.updatedAt.toISOString() });
        }
        return items.sort((a, b) => (a.time < b.time ? 1 : -1)).slice(0, limit);
    }
};
exports.ActivityService = ActivityService;
exports.ActivityService = ActivityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ActivityService);
//# sourceMappingURL=activity.service.js.map