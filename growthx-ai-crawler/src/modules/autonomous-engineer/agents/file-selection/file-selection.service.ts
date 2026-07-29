import { Injectable, Logger } from '@nestjs/common';
import { AstParserService, SemanticSearchResult } from '../../../repository-graph/ast-parser/ast-parser.service';

@Injectable()
export class FileSelectionService {
  private readonly logger = new Logger(FileSelectionService.name);

  constructor(private readonly astParser: AstParserService) {}

  async selectTargetFiles(repoPath: string, issueType: string, recommendation: string): Promise<SemanticSearchResult[]> {
    this.logger.log(`Selecting target files for issue: ${issueType}`);
    
    // First, ensure the repo is indexed
    await this.astParser.indexRepository(repoPath);

    // Formulate a query based on the issue
    const query = `Find where ${issueType} is handled or needs to be applied based on: ${recommendation}`;
    
    // Use the semantic search from the Knowledge Graph
    const results = await this.astParser.semanticSearch(query, repoPath);
    
    this.logger.log(`Semantic Search returned ${results.length} files.`);
    return results;
  }
}

