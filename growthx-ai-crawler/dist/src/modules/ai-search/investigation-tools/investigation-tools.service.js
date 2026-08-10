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
     * Tool: Google Search Console traffic. Not connected yet.
     *
     * Returns an explicit "unavailable" marker rather than throwing: this is one
     * of several evidence sources fed to the model, and a missing integration
     * must not take down the whole answer. The marker also tells the model not to
     * speculate about traffic it cannot see.
     */
    async getTrafficMetrics(projectId) {
        this.logger.debug(`getTrafficMetrics for ${projectId}: integration not connected.`);
        return JSON.stringify({
            available: false,
            reason: 'Google Search Console is not connected for this project.',
        });
    }
    /** Tool: competitor intelligence. Same contract as above. */
    async getCompetitorData(projectId) {
        const competitors = await this.prisma.competitorDomain.findMany({
            where: { projectId },
            select: { domain: true, label: true },
        });
        if (competitors.length === 0) {
            return JSON.stringify({
                available: false,
                reason: 'No competitors are being tracked for this project yet.',
            });
        }
        return JSON.stringify({ available: true, competitors });
    }
};
exports.InvestigationToolsService = InvestigationToolsService;
exports.InvestigationToolsService = InvestigationToolsService = InvestigationToolsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InvestigationToolsService);
//# sourceMappingURL=investigation-tools.service.js.map