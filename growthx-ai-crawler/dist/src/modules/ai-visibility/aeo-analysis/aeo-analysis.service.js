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
var AeoAnalysisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AeoAnalysisService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma.service");
let AeoAnalysisService = AeoAnalysisService_1 = class AeoAnalysisService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(AeoAnalysisService_1.name);
    }
    /**
     * Analyzes a website for AI Engine Optimization (AEO).
     * It queries the AeoMetrics table to evaluate optimization for AI citations.
     */
    async analyzeWebsiteAeo(projectId) {
        this.logger.log(`Analyzing AEO for Project: ${projectId}`);
        // Find all pages belonging to the project and check their AeoMetrics
        const metrics = await this.prisma.aeoMetrics.findMany({
            where: {
                page: {
                    crawlJob: { website: { projectId } }
                }
            }
        });
        if (metrics.length === 0) {
            return null;
        }
        // Aggregate real data
        const totalPages = metrics.length;
        const missingStructuredDataUrls = await this.prisma.page.findMany({
            where: {
                crawlJob: { website: { projectId } },
                aeoMetrics: { hasStructuredJsonLd: false }
            },
            select: { url: true },
            take: 10
        });
        const avgCitationScore = metrics.reduce((acc, m) => acc + m.citationProbability, 0) / totalPages;
        const totalLlmHits = metrics.reduce((acc, m) => acc + m.llmCrawlerHits, 0);
        return {
            overallCitationScore: avgCitationScore,
            missingStructuredDataUrls: missingStructuredDataUrls.map(p => p.url),
            crawlerActivity: {
                openai: totalLlmHits,
                anthropic: 0,
                perplexity: 0
            }
        };
    }
};
exports.AeoAnalysisService = AeoAnalysisService;
exports.AeoAnalysisService = AeoAnalysisService = AeoAnalysisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AeoAnalysisService);
//# sourceMappingURL=aeo-analysis.service.js.map