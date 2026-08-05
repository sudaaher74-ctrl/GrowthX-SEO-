import { Injectable, Logger } from '@nestjs/common';
import { AstParserService } from '../../../repository-graph/ast-parser/ast-parser.service';
import { MultiAiRouterService, AiTask } from '../../../ai-search/multi-ai-router/multi-ai-router.service';
import { IssueAnalysisResult } from '../issue-analysis/issue-analysis.service';

export interface FileSelectionResult {
  selectedFilePath: string | null;
  reasoning: string;
}

@Injectable()
export class FileSelectionService {
  private readonly logger = new Logger(FileSelectionService.name);

  constructor(
    private readonly astParser: AstParserService,
    private readonly aiRouter: MultiAiRouterService
  ) {}

  async selectTargetFile(
    repoPath: string, 
    issueAnalysis: IssueAnalysisResult,
    organizationId?: string
  ): Promise<FileSelectionResult> {
    this.logger.log(`Selecting target file for strategy: ${issueAnalysis.strategy}`);
    
    // First, ensure the repo is indexed
    await this.astParser.indexRepository(repoPath);

    // Formulate queries based on the issue analysis search keywords
    const searchResults = new Map<string, any>();
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
      task: AiTask.REASONING,
      organizationId,
      jsonSchema
    });

    try {
      const result: FileSelectionResult = JSON.parse(completion.text);
      this.logger.log(`AI Selected File: ${result.selectedFilePath} - ${result.reasoning}`);
      return result;
    } catch (e) {
      this.logger.error(`Failed to parse AI file selection: ${completion.text}`);
      throw new Error('AI returned invalid JSON for file selection.');
    }
  }
}

