import { Injectable, Logger } from '@nestjs/common';
import { GitService } from '../agents/git/git.service';
import { RepositoryUnderstandingService } from '../agents/repository-understanding/repository-understanding.service';
import { PatchGenerationService } from '../agents/patch-generation/patch-generation.service';
import { ValidationService } from '../agents/validation/validation.service';
import { IssueAnalysisService } from '../agents/issue-analysis/issue-analysis.service';
import { FileSelectionService } from '../agents/file-selection/file-selection.service';
import * as path from 'path';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly gitAgent: GitService,
    private readonly repoAgent: RepositoryUnderstandingService,
    private readonly patchAgent: PatchGenerationService,
    private readonly validationAgent: ValidationService,
    private readonly issueAnalysisAgent: IssueAnalysisService,
    private readonly fileSelectionAgent: FileSelectionService,
  ) {}

  /**
   * Executes the full Autonomous Website Engineer Workflow
   */
  async executeAutoFixWorkflow(
    githubToken: string,
    repoOwner: string,
    repoName: string,
    issueId: string,
    issueDetails: string,
    organizationId?: string
  ): Promise<string | null> {
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

    } catch (e) {
      this.logger.error(`Orchestrator Workflow Failed: ${e.message}`);
      return null;
    }
  }
}

