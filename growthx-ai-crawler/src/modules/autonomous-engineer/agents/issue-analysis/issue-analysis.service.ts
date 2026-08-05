import { Injectable, Logger } from '@nestjs/common';
import { MultiAiRouterService, AiTask } from '../../../ai-search/multi-ai-router/multi-ai-router.service';
import { RepositoryContext } from '../repository-understanding/repository-understanding.service';

export interface IssueAnalysisResult {
  strategy: string;
  targetComponentType: string;
  searchKeywords: string[];
}

@Injectable()
export class IssueAnalysisService {
  private readonly logger = new Logger(IssueAnalysisService.name);

  constructor(private readonly aiRouter: MultiAiRouterService) {}

  async analyzeIssue(issueDetails: string, repoContext: RepositoryContext, organizationId?: string): Promise<IssueAnalysisResult> {
    this.logger.log(`Analyzing issue using AI: ${issueDetails}`);

    const prompt = `
You are an expert technical SEO engineer. Analyze the following SEO issue and formulate a strategy to fix it.
The target repository uses the following framework and tools:
Framework: ${repoContext.framework}
Package Manager: ${repoContext.packageManager}
Monorepo: ${repoContext.isMonorepo}

SEO Issue:
${issueDetails}

Provide your analysis structured strictly as a JSON object matching the following schema.
The strategy should detail step-by-step how to modify the code.
The targetComponentType should describe what kind of file needs changing (e.g., "Next.js page component", "HTML layout file", "Vue component").
The searchKeywords should be a list of code snippets or semantic concepts to search for to find the file that needs fixing.
`;

    const jsonSchema = {
      type: 'object',
      properties: {
        strategy: { type: 'string' },
        targetComponentType: { type: 'string' },
        searchKeywords: { type: 'array', items: { type: 'string' } }
      },
      required: ['strategy', 'targetComponentType', 'searchKeywords']
    };

    const completion = await this.aiRouter.generate({
      prompt,
      systemInstruction: 'You are a technical SEO expert and software engineer.',
      task: AiTask.REASONING,
      organizationId,
      jsonSchema
    });

    try {
      const result: IssueAnalysisResult = JSON.parse(completion.text);
      this.logger.log(`AI Strategy: ${result.strategy}`);
      return result;
    } catch (e) {
      this.logger.error(`Failed to parse AI issue analysis: ${completion.text}`);
      throw new Error('AI returned invalid JSON for issue analysis.');
    }
  }
}
