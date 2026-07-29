import { AstParserService, SemanticSearchResult } from '../../../repository-graph/ast-parser/ast-parser.service';
export declare class FileSelectionService {
    private readonly astParser;
    private readonly logger;
    constructor(astParser: AstParserService);
    selectTargetFiles(repoPath: string, issueType: string, recommendation: string): Promise<SemanticSearchResult[]>;
}
