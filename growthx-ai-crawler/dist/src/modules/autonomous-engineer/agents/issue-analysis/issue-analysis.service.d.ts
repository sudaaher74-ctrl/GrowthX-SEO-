import { MultiAiRouterService } from '../../../ai-search/multi-ai-router/multi-ai-router.service';
import { RepositoryContext } from '../repository-understanding/repository-understanding.service';
export interface IssueAnalysisResult {
    strategy: string;
    targetComponentType: string;
    searchKeywords: string[];
}
export declare class IssueAnalysisService {
    private readonly aiRouter;
    private readonly logger;
    constructor(aiRouter: MultiAiRouterService);
    analyzeIssue(issueDetails: string, repoContext: RepositoryContext, organizationId?: string): Promise<IssueAnalysisResult>;
}
