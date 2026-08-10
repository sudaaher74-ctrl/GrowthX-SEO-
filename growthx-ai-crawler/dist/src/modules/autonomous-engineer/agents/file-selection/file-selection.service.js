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
var FileSelectionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSelectionService = void 0;
const common_1 = require("@nestjs/common");
const ast_parser_service_1 = require("../../../repository-graph/ast-parser/ast-parser.service");
const multi_ai_router_service_1 = require("../../../ai-search/multi-ai-router/multi-ai-router.service");
let FileSelectionService = FileSelectionService_1 = class FileSelectionService {
    constructor(astParser, aiRouter) {
        this.astParser = astParser;
        this.aiRouter = aiRouter;
        this.logger = new common_1.Logger(FileSelectionService_1.name);
    }
    async selectTargetFile(repoPath, issueAnalysis, organizationId) {
        this.logger.log(`Selecting target file for strategy: ${issueAnalysis.strategy}`);
        // First, ensure the repo is indexed
        await this.astParser.indexRepository(repoPath);
        // Formulate queries based on the issue analysis search keywords
        const searchResults = new Map();
        for (const keyword of issueAnalysis.searchKeywords) {
            const results = await this.astParser.semanticSearch(keyword, repoPath);
            for (const res of results) {
                if (!searchResults.has(res.filePath)) {
                    searchResults.set(res.filePath, res);
                }
            }
        }
        const candidateFiles = Array.from(searchResults.values()).slice(0, 10);
        this.logger.log(`Semantic Search returned ${candidateFiles.length} candidate files.`);
        if (candidateFiles.length === 0) {
            return { selectedFilePath: null, reasoning: 'No files matched the search keywords.' };
        }
        const candidateFilesList = candidateFiles.map(c => `- ${c.filePath}\n  Excerpt: ${c.contentExcerpt}`).join('\n\n');
        const prompt = `
You are an expert technical SEO engineer. You need to select the ONE correct file from a list of candidates to apply an SEO fix.

Fix Strategy:
${issueAnalysis.strategy}

Target Component Type:
${issueAnalysis.targetComponentType}

Candidate Files:
${candidateFilesList}

Analyze the candidates and pick the one file path that is the most appropriate target for this fix.
Respond with a JSON object.
`;
        const jsonSchema = {
            type: 'object',
            properties: {
                selectedFilePath: { type: 'string', description: 'The exact file path chosen, or null if none are appropriate.' },
                reasoning: { type: 'string' }
            },
            required: ['selectedFilePath', 'reasoning']
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
            this.logger.log(`AI Selected File: ${result.selectedFilePath} - ${result.reasoning}`);
            return result;
        }
        catch (e) {
            this.logger.error(`Failed to parse AI file selection: ${completion.text}`);
            throw new Error('AI returned invalid JSON for file selection.');
        }
    }
};
exports.FileSelectionService = FileSelectionService;
exports.FileSelectionService = FileSelectionService = FileSelectionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ast_parser_service_1.AstParserService,
        multi_ai_router_service_1.MultiAiRouterService])
], FileSelectionService);
//# sourceMappingURL=file-selection.service.js.map