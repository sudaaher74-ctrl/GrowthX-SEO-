import { AstParserService } from '../../../repository-graph/ast-parser/ast-parser.service';
import { MultiAiRouterService } from '../../../ai-search/multi-ai-router/multi-ai-router.service';
import { IssueAnalysisResult } from '../issue-analysis/issue-analysis.service';
export interface FileSelectionResult {
    selectedFilePath: string | null;
    reasoning: string;
}
export declare class FileSelectionService {
    private readonly astParser;
    private readonly aiRouter;
    private readonly logger;
    constructor(astParser: AstParserService, aiRouter: MultiAiRouterService);
    selectTargetFile(repoPath: string, issueAnalysis: IssueAnalysisResult, organizationId?: string): Promise<FileSelectionResult>;
}
