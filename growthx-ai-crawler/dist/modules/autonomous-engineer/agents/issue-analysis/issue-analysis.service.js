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
var IssueAnalysisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssueAnalysisService = void 0;
const common_1 = require("@nestjs/common");
const multi_ai_router_service_1 = require("../../../ai-search/multi-ai-router/multi-ai-router.service");
let IssueAnalysisService = IssueAnalysisService_1 = class IssueAnalysisService {
    constructor(aiRouter) {
        this.aiRouter = aiRouter;
        this.logger = new common_1.Logger(IssueAnalysisService_1.name);
    }
    async analyzeIssue(issueDetails, repoContext, organizationId) {
        this.logger.log(`Analyzing issue using AI: ${issueDetails}`);
        const prompt = `
You are an expert technical SEO engineer. Analyze the following SEO issue and formulate a strategy to fix it.
The target repository uses the following framework and tools:
Framework: ${repoContext.framework}
Package Manager: ${repoContext.packageManager}
Monorepo: ${repoContext.isMonorepo}

SEO Issue:
${issueDetails}

Provide your analysis structured strictly as a JSON object matching the following schema.
The strategy should detail step-by-step how to modify the code.
The targetComponentType should describe what kind of file needs changing (e.g., "Next.js page component", "HTML layout file", "Vue component").
The searchKeywords should be a list of code snippets or semantic concepts to search for to find the file that needs fixing.
`;
        const jsonSchema = {
            type: 'object',
            properties: {
                strategy: { type: 'string' },
                targetComponentType: { type: 'string' },
                searchKeywords: { type: 'array', items: { type: 'string' } }
            },
            required: ['strategy', 'targetComponentType', 'searchKeywords']
        };
        const completion = await this.aiRouter.generate({
            prompt,
            systemInstruction: 'You are a technical SEO expert and software engineer.',
            task: multi_ai_router_service_1.AiTask.REASONING,
            organizationId,
            jsonSchema
        });
        try {
            const result = JSON.parse(completion.text);
            this.logger.log(`AI Strategy: ${result.strategy}`);
            return result;
        }
        catch (e) {
            this.logger.error(`Failed to parse AI issue analysis: ${completion.text}`);
            throw new Error('AI returned invalid JSON for issue analysis.');
        }
    }
};
exports.IssueAnalysisService = IssueAnalysisService;
exports.IssueAnalysisService = IssueAnalysisService = IssueAnalysisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [multi_ai_router_service_1.MultiAiRouterService])
], IssueAnalysisService);
//# sourceMappingURL=issue-analysis.service.js.map