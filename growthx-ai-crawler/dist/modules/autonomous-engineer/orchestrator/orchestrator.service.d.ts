import { GitService } from '../agents/git/git.service';
import { RepositoryUnderstandingService } from '../agents/repository-understanding/repository-understanding.service';
import { PatchGenerationService } from '../agents/patch-generation/patch-generation.service';
import { ValidationService } from '../agents/validation/validation.service';
import { IssueAnalysisService } from '../agents/issue-analysis/issue-analysis.service';
import { FileSelectionService } from '../agents/file-selection/file-selection.service';
export declare class OrchestratorService {
    private readonly gitAgent;
    private readonly repoAgent;
    private readonly patchAgent;
    private readonly validationAgent;
    private readonly issueAnalysisAgent;
    private readonly fileSelectionAgent;
    private readonly logger;
    constructor(gitAgent: GitService, repoAgent: RepositoryUnderstandingService, patchAgent: PatchGenerationService, validationAgent: ValidationService, issueAnalysisAgent: IssueAnalysisService, fileSelectionAgent: FileSelectionService);
    /**
     * Executes the full Autonomous Website Engineer Workflow
     */
    executeAutoFixWorkflow(githubToken: string, repoOwner: string, repoName: string, issueId: string, issueDetails: string, organizationId?: string): Promise<string | null>;
}
