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
var HistoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma.service");
let HistoryService = HistoryService_1 = class HistoryService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(HistoryService_1.name);
    }
    /**
     * Compares two historical crawl jobs to identify new, resolved, and recurring SEO audit issues.
     */
    async compareCrawlJobs(currentJobId, previousJobId) {
        this.logger.log(`Comparing Crawl Job ${currentJobId} against ${previousJobId}...`);
        const [currJob, prevJob] = await Promise.all([
            this.prisma.crawlJob.findUnique({ where: { id: currentJobId } }),
            this.prisma.crawlJob.findUnique({ where: { id: previousJobId } }),
        ]);
        if (!currJob || !prevJob) {
            throw new common_1.NotFoundException('One or both specified crawl jobs were not found');
        }
        const [currIssues, prevIssues] = await Promise.all([
            this.prisma.issue.findMany({ where: { crawlJobId: currentJobId } }),
            this.prisma.issue.findMany({ where: { crawlJobId: previousJobId } }),
        ]);
        // Create lookup keys: issueType:affectedUrl
        const prevMap = new Map();
        for (const issue of prevIssues) {
            prevMap.set(`${issue.issueType}:${issue.affectedUrl}`, issue);
        }
        const currMap = new Map();
        for (const issue of currIssues) {
            currMap.set(`${issue.issueType}:${issue.affectedUrl}`, issue);
        }
        const newIssues = [];
        const recurringIssues = [];
        const resolvedIssues = [];
        // Detect new and recurring issues
        for (const [key, issue] of currMap.entries()) {
            const item = {
                issueType: issue.issueType,
                severity: issue.severity,
                affectedUrl: issue.affectedUrl,
                description: issue.description,
            };
            if (prevMap.has(key)) {
                recurringIssues.push(item);
            }
            else {
                newIssues.push(item);
            }
        }
        // Detect resolved issues
        for (const [key, issue] of prevMap.entries()) {
            if (!currMap.has(key)) {
                resolvedIssues.push({
                    issueType: issue.issueType,
                    severity: issue.severity,
                    affectedUrl: issue.affectedUrl,
                    description: issue.description,
                });
            }
        }
        const pageCountDiff = currJob.pagesCrawled - prevJob.pagesCrawled;
        const issuesCountDiff = currIssues.length - prevIssues.length;
        return {
            currentJobId,
            previousJobId,
            pageCountDiff,
            issuesCountDiff,
            newIssues,
            resolvedIssues,
            recurringIssues,
            summaryMessage: `Comparison complete: ${newIssues.length} new issues detected, ${resolvedIssues.length} issues resolved, and ${recurringIssues.length} issues remain open.`,
        };
    }
};
exports.HistoryService = HistoryService;
exports.HistoryService = HistoryService = HistoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HistoryService);
//# sourceMappingURL=history.service.js.map