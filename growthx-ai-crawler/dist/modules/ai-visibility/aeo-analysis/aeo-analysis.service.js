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
     * It checks for structured data, semantic HTML, and logs LLM crawler hits.
     */
    async analyzeWebsiteAeo(projectId) {
        this.logger.log(`Analyzing AEO for Project: ${projectId}`);
        // In production, this would query the newly created AeoMetrics table.
        // For PoC, we will simulate a deep analysis.
        // Mock simulation:
        // "We found that 20% of your pages lack JSON-LD product schemas, meaning Perplexity 
        // is less likely to cite your pricing page as a source."
        return {
            overallCitationScore: 68.5,
            missingStructuredDataUrls: [
                '/pricing',
                '/features/autonomous-engineer'
            ],
            crawlerActivity: {
                openai: 45,
                anthropic: 12,
                perplexity: 89
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