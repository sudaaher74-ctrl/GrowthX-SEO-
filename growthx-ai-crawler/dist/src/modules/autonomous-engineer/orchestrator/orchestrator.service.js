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
var OrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const git_service_1 = require("../agents/git/git.service");
const repository_understanding_service_1 = require("../agents/repository-understanding/repository-understanding.service");
const patch_generation_service_1 = require("../agents/patch-generation/patch-generation.service");
const validation_service_1 = require("../agents/validation/validation.service");
const issue_analysis_service_1 = require("../agents/issue-analysis/issue-analysis.service");
const file_selection_service_1 = require("../agents/file-selection/file-selection.service");
const path = require("path");
let OrchestratorService = OrchestratorService_1 = class OrchestratorService {
    constructor(gitAgent, repoAgent, patchAgent, validationAgent, issueAnalysisAgent, fileSelectionAgent) {
        this.gitAgent = gitAgent;
        this.repoAgent = repoAgent;
        this.patchAgent = patchAgent;
        this.validationAgent = validationAgent;
        this.issueAnalysisAgent = issueAnalysisAgent;
        this.fileSelectionAgent = fileSelectionAgent;
        this.logger = new common_1.Logger(OrchestratorService_1.name);
    }
    /**
     * Executes the full Autonomous Website Engineer Workflow
     */
    async executeAutoFixWorkflow(githubToken, repoOwner, repoName, issueId, issueDetails, organizationId) {
        const repoUrl = `https://github.com/${repoOwner}/${repoName}.git`;
        let repoDir = '';
        try {
            this.logger.log(`[1/7] Starting Autonomous Engineer workflow for ${repoName}...`);
            // 1. Clone
            repoDir = await this.gitAgent.cloneRepository(repoUrl, githubToken, repoName);
            // 2. Repository Understanding
            this.logger.log(`[2/7] Understanding Repository...`);
            const repoContext = await this.repoAgent.analyzeRepository(repoDir);
            // 3. Issue Analysis (AI)
            this.logger.log(`[3/7] Analyzing Issue using AI...`);
            const issueAnalysis = await this.issueAnalysisAgent.analyzeIssue(issueDetails, repoContext, organizationId);
            // 4. File Selection (AI)
            this.logger.log(`[4/7] Selecting Target File using AI...`);
            const fileSelection = await this.fileSelectionAgent.selectTargetFile(repoDir, issueAnalysis, organizationId);
            if (!fileSelection.selectedFilePath) {
                throw new Error(`Failed to identify target file: ${fileSelection.reasoning}`);
            }
            // 5. Create Feature Branch
            this.logger.log(`[5/7] Branching...`);
            const branchName = `growthx-ai/fix-${issueId}-${Date.now()}`;
            await this.gitAgent.createFeatureBranch(repoDir, branchName);
            // 6. Patch Generation (AI)
            this.logger.log(`[6/7] Generating and Applying Patch using AI...`);
            // Use the exact path returned by the AI (assuming it might be relative or absolute)
            const absoluteTargetPath = path.isAbsolute(fileSelection.selectedFilePath)
                ? fileSelection.selectedFilePath
                : path.join(repoDir, fileSelection.selectedFilePath);
            const patchOutcome = await this.patchAgent.generatePatch(absoluteTargetPath, issueAnalysis, organizationId);
            if (!patchOutcome.applied) {
                throw new Error(`Failed to patch file at ${fileSelection.selectedFilePath}: ${patchOutcome.reason}`);
            }
            // 7. Validation
            this.logger.log(`[7/7] Validating Code...`);
            const validationResult = await this.validationAgent.validateRepository(repoDir, repoContext.packageManager);
            if (!validationResult.success) {
                throw new Error(`Validation failed. We must rollback or self-heal. Build output: ${validationResult.output}`);
            }
            // 8. Commit & PR
            this.logger.log(`[8/8] Submitting Pull Request...`);
            const commitMsg = `fix(seo): implement fix for ${issueId}`;
            await this.gitAgent.commitAndPush(repoDir, branchName, commitMsg);
            const prBody = `## 🤖 Automated SEO Fix by GrowthX AI\n\nThis PR automatically fixes an SEO issue detected by our crawler.\n\n### Issue Resolved:\n${issueDetails}\n\n### Fix Strategy:\n${issueAnalysis.strategy}\n\n✅ Validation Passed: The project builds successfully.`;
            const prUrl = await this.gitAgent.createPullRequest(githubToken, repoOwner, repoName, commitMsg, branchName, 'main', prBody);
            this.logger.log(`Workflow Complete! PR created at ${prUrl}`);
            return prUrl;
        }
        catch (e) {
            this.logger.error(`Orchestrator Workflow Failed: ${e.message}`);
            return null;
        }
    }
};
exports.OrchestratorService = OrchestratorService;
exports.OrchestratorService = OrchestratorService = OrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [git_service_1.GitService,
        repository_understanding_service_1.RepositoryUnderstandingService,
        patch_generation_service_1.PatchGenerationService,
        validation_service_1.ValidationService,
        issue_analysis_service_1.IssueAnalysisService,
        file_selection_service_1.FileSelectionService])
], OrchestratorService);
//# sourceMappingURL=orchestrator.service.js.map