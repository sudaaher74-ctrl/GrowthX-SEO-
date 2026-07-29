import { GitService } from '../agents/git/git.service';
import { RepositoryUnderstandingService } from '../agents/repository-understanding/repository-understanding.service';
import { PatchGenerationService } from '../agents/patch-generation/patch-generation.service';
import { ValidationService } from '../agents/validation/validation.service';
export declare class OrchestratorService {
    private readonly gitAgent;
    private readonly repoAgent;
    private readonly patchAgent;
    private readonly validationAgent;
    private readonly logger;
    constructor(gitAgent: GitService, repoAgent: RepositoryUnderstandingService, patchAgent: PatchGenerationService, validationAgent: ValidationService);
    /**
     * Executes the full Autonomous Website Engineer Workflow
     */
    executeAutoFixWorkflow(githubToken: string, repoOwner: string, repoName: string, issueId: string, targetFilePath: string, propertyName: string, newValue: string): Promise<string | null>;
}
