import { Injectable, Logger } from '@nestjs/common';
import { GitService } from '../agents/git/git.service';
import { RepositoryUnderstandingService } from '../agents/repository-understanding/repository-understanding.service';
import { PatchGenerationService } from '../agents/patch-generation/patch-generation.service';
import { ValidationService } from '../agents/validation/validation.service';
import * as path from 'path';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly gitAgent: GitService,
    private readonly repoAgent: RepositoryUnderstandingService,
    private readonly patchAgent: PatchGenerationService,
    private readonly validationAgent: ValidationService,
  ) {}

  /**
   * Executes the full Autonomous Website Engineer Workflow
   */
  async executeAutoFixWorkflow(
    githubToken: string,
    repoOwner: string,
    repoName: string,
    issueId: string,
    targetFilePath: string,
    propertyName: string,
    newValue: string
  ): Promise<string | null> {
    const repoUrl = `https://github.com/${repoOwner}/${repoName}.git`;
    let repoDir = '';

    try {
      this.logger.log(`[1/6] Starting Autonomous Engineer workflow for ${repoName}...`);

      // 1. Clone
      repoDir = await this.gitAgent.cloneRepository(repoUrl, githubToken, repoName);

      // 2. Repository Understanding
      this.logger.log(`[2/6] Understanding Repository...`);
      const repoContext = await this.repoAgent.analyzeRepository(repoDir);
      
      // 3. Create Feature Branch
      this.logger.log(`[3/6] Branching...`);
      const branchName = `growthx-ai/fix-${issueId}-${Date.now()}`;
      await this.gitAgent.createFeatureBranch(repoDir, branchName);

      // 4. Patch Generation (AST)
      this.logger.log(`[4/6] Patching AST...`);
      const absoluteTargetPath = path.join(repoDir, targetFilePath);
      const patched = await this.patchAgent.updateNextJsMetadata(absoluteTargetPath, propertyName, newValue);

      if (!patched) {
        throw new Error(`Failed to patch file at ${targetFilePath}`);
      }

      // 5. Validation
      this.logger.log(`[5/6] Validating Code...`);
      const validationResult = await this.validationAgent.validateRepository(repoDir, repoContext.packageManager);
      if (!validationResult.success) {
        throw new Error(`Validation failed. We must rollback or self-heal. Build output: ${validationResult.output}`);
      }

      // 6. Commit & PR
      this.logger.log(`[6/6] Submitting Pull Request...`);
      const commitMsg = `fix(seo): update ${propertyName} to improve SEO health`;
      await this.gitAgent.commitAndPush(repoDir, branchName, commitMsg);

      const prBody = `## 🤖 Automated SEO Fix by GrowthX AI\n\nThis PR automatically fixes an SEO issue detected by our crawler.\n\n### Changes Made:\n- Updated \`${propertyName}\` in \`${targetFilePath}\` to \`${newValue}\`\n\n✅ Validation Passed: The project builds successfully.`;
      const prUrl = await this.gitAgent.createPullRequest(githubToken, repoOwner, repoName, commitMsg, branchName, 'main', prBody);

      this.logger.log(`Workflow Complete! PR created at ${prUrl}`);
      return prUrl;

    } catch (e) {
      this.logger.error(`Orchestrator Workflow Failed: ${e.message}`);
      return null;
    }
  }
}

