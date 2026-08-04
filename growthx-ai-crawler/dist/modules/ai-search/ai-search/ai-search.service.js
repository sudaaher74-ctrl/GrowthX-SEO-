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
var AiSearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiSearchService = void 0;
const common_1 = require("@nestjs/common");
const multi_ai_router_service_1 = require("../multi-ai-router/multi-ai-router.service");
const investigation_tools_service_1 = require("../investigation-tools/investigation-tools.service");
let AiSearchService = AiSearchService_1 = class AiSearchService {
    constructor(multiAiRouter, investigationTools) {
        this.multiAiRouter = multiAiRouter;
        this.investigationTools = investigationTools;
        this.logger = new common_1.Logger(AiSearchService_1.name);
    }
    /**
     * Main entry point for the "Perplexity for SEO" feature.
     */
    async askQuestion(projectId, question, organizationId) {
        this.logger.log(`Received question for project ${projectId}: "${question}"`);
        // Step 1: Investigation (RAG / Tool Calling Simulation)
        this.logger.log('Executing Investigation Phase...');
        // We fetch all context for the LLM to reason over
        const knowledgeGraphData = await this.investigationTools.queryKnowledgeGraph(projectId);
        const trafficData = await this.investigationTools.getTrafficMetrics(projectId);
        const competitorData = await this.investigationTools.getCompetitorData(projectId);
        // Step 2: Reasoning & Synthesis Prompt
        const systemPrompt = `
      You are GrowthX AI, an elite SEO Intelligence Platform and Autonomous Website Engineer.
      Analyze the provided evidence and answer the user's question like a Senior Technical SEO.
      
      Format your response exactly like this:
      ### 📊 Executive Summary
      ### 🔎 Key Findings & Evidence
      ### 💼 Business Impact
      ### 🚀 Recommended Fixes
      
      Evidence provided from Knowledge Graph (Issues): ${knowledgeGraphData}
      Evidence provided from Google Search Console (Traffic): ${trafficData}
      Evidence provided from Competitor Intelligence: ${competitorData}
    `;
        // Step 3: Reasoning. The router picks the strongest model the org's plan
        // allows — Claude on Pro, Gemini on Starter — and falls through on failure.
        const completion = await this.multiAiRouter.generate({
            prompt: question,
            systemInstruction: systemPrompt,
            task: multi_ai_router_service_1.AiTask.REASONING,
            organizationId,
        });
        const answer = completion.text;
        // Step 4: Action Generation
        // In production, the LLM will return a structured JSON block if it determines
        // an AUTO_FIX is appropriate. We parse that JSON here.
        let suggestedAction = undefined;
        try {
            const match = answer.match(/```json\n([\s\S]*?)\n```/);
            if (match) {
                const parsed = JSON.parse(match[1]);
                if (parsed.type === 'AUTO_FIX' && parsed.payload) {
                    suggestedAction = parsed;
                }
            }
        }
        catch (e) {
            this.logger.debug('No valid JSON action block found in AI response.');
        }
        return {
            answer,
            model: {
                provider: completion.provider,
                name: completion.model,
                inputTokens: completion.usage.inputTokens,
                outputTokens: completion.usage.outputTokens,
                estimatedCostUsd: completion.usage.estimatedCostUsd,
            },
            suggestedAction
        };
    }
};
exports.AiSearchService = AiSearchService;
exports.AiSearchService = AiSearchService = AiSearchService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [multi_ai_router_service_1.MultiAiRouterService,
        investigation_tools_service_1.InvestigationToolsService])
], AiSearchService);
//# sourceMappingURL=ai-search.service.js.map