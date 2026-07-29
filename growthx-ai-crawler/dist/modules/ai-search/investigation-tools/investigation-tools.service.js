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
var InvestigationToolsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvestigationToolsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma.service");
let InvestigationToolsService = InvestigationToolsService_1 = class InvestigationToolsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(InvestigationToolsService_1.name);
    }
    /**
     * Tool: Queries the SEO Knowledge Graph (Prisma database issues)
     */
    async queryKnowledgeGraph(projectId) {
        this.logger.log(`Tool Executing: queryKnowledgeGraph for ${projectId}`);
        // In reality, this would be a deep join on the graph representation.
        // For now, we query the standard issues table for this project's website.
        const issues = await this.prisma.issue.findMany({
            where: {
                crawlJob: { website: { projectId } },
                status: { not: 'RESOLVED' },
            },
            take: 10,
        });
        if (issues.length === 0) {
            return JSON.stringify({ status: 'healthy', issues_found: 0 });
        }
        return JSON.stringify(issues.map(i => ({
            url: i.affectedUrl,
            type: i.issueType,
            severity: i.severity,
            recommendation: i.recommendation
        })));
    }
    /**
     * Tool: Mocks Google Search Console data lookup
     */
    async getTrafficMetrics(projectId) {
        this.logger.log(`Tool Executing: getTrafficMetrics for ${projectId}`);
        // Mock GSC Data
        return JSON.stringify({
            clicks_last_7_days: 12450,
            clicks_previous_7_days: 14500,
            trend: 'down',
            percent_change: -14.1,
            top_declining_urls: [
                '/products/enterprise-crawler',
                '/blog/seo-tips-2026'
            ]
        });
    }
    /**
     * Tool: Mocks Competitor Intelligence lookup
     */
    async getCompetitorData(projectId) {
        this.logger.log(`Tool Executing: getCompetitorData for ${projectId}`);
        return JSON.stringify({
            competitors: ['screamingfrog.co.uk', 'semrush.com'],
            content_gaps: ['AI autonomous engineering', 'AST parsing for SEO'],
            backlink_gap: 450
        });
    }
};
exports.InvestigationToolsService = InvestigationToolsService;
exports.InvestigationToolsService = InvestigationToolsService = InvestigationToolsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvestigationToolsService);
//# sourceMappingURL=investigation-tools.service.js.map