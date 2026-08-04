import { Injectable, Logger } from '@nestjs/common';
import { AiProvider, AiTask, MultiAiRouterService } from '../multi-ai-router/multi-ai-router.service';
import { InvestigationToolsService } from '../investigation-tools/investigation-tools.service';

export interface AiSearchResponse {
  answer: string;
  /** Which model actually answered, so the UI can show it and we can audit spend. */
  model: { provider: AiProvider; name: string; inputTokens: number; outputTokens: number; estimatedCostUsd: number | null };
  suggestedAction?: {
    type: 'AUTO_FIX';
    payload: { issueId: string; targetFile: string; property: string; value: string; }
  };
}

@Injectable()
export class AiSearchService {
  private readonly logger = new Logger(AiSearchService.name);

  constructor(
    private readonly multiAiRouter: MultiAiRouterService,
    private readonly investigationTools: InvestigationToolsService,
  ) {}

  /**
   * Main entry point for the "Perplexity for SEO" feature.
   */
  async askQuestion(projectId: string, question: string, organizationId?: string): Promise<AiSearchResponse> {
    this.logger.log(`Received question for project ${projectId}: "${question}"`);

    // Step 1: Investigation (RAG / Tool Calling Simulation)
    this.logger.log('Executing Investigation Phase...');
    
    // We fetch all context for the LLM to reason over
    const knowledgeGraphData = await this.investigationTools.queryKnowledgeGraph(projectId);
    const trafficData = await this.investigationTools.getTrafficMetrics(projectId);
    const competitorData = await this.investigationTools.getCompetitorData(projectId);

    // Step 2: Reasoning & Synthesis Prompt
    const systemPrompt = `
      You are GrowthX AI, an elite SEO Intelligence Platform and Autonomous Website Engineer.
      Analyze the provided evidence and answer the user's question like a Senior Technical SEO.
      
      Format your response exactly like this:
      ### 📊 Executive Summary
      ### 🔎 Key Findings & Evidence
      ### 💼 Business Impact
      ### 🚀 Recommended Fixes
      
      Evidence provided from Knowledge Graph (Issues): ${knowledgeGraphData}
      Evidence provided from Google Search Console (Traffic): ${trafficData}
      Evidence provided from Competitor Intelligence: ${competitorData}
    `;

    // Step 3: Reasoning. The router picks the strongest model the org's plan
    // allows — Claude on Pro, Gemini on Starter — and falls through on failure.
    const completion = await this.multiAiRouter.generate({
      prompt: question,
      systemInstruction: systemPrompt,
      task: AiTask.REASONING,
      organizationId,
    });
    const answer = completion.text;

    // Step 4: Action Generation
    // In production, the LLM will return a structured JSON block if it determines
    // an AUTO_FIX is appropriate. We parse that JSON here.
    let suggestedAction: AiSearchResponse['suggestedAction'] = undefined;
    
    try {
      const match = answer.match(/```json\n([\s\S]*?)\n```/);
      if (match) {
        const parsed = JSON.parse(match[1]);
        if (parsed.type === 'AUTO_FIX' && parsed.payload) {
          suggestedAction = parsed;
        }
      }
    } catch (e) {
      this.logger.debug('No valid JSON action block found in AI response.');
    }

    return {
      answer,
      model: {
        provider: completion.provider,
        name: completion.model,
        inputTokens: completion.usage.inputTokens,
        outputTokens: completion.usage.outputTokens,
        estimatedCostUsd: completion.usage.estimatedCostUsd,
      },
      suggestedAction
    };
  }
}

