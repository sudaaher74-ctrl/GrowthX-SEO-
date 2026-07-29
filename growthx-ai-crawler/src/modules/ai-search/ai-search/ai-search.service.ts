import { Injectable, Logger } from '@nestjs/common';
import { MultiAiRouterService, ModelType } from '../multi-ai-router/multi-ai-router.service';
import { InvestigationToolsService } from '../investigation-tools/investigation-tools.service';

export interface AiSearchResponse {
  answer: string;
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
  async askQuestion(projectId: string, question: string): Promise<AiSearchResponse> {
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

    // Step 3: Call the Reasoning Model (Gemini Pro) via Multi-Router
    const answer = await this.multiAiRouter.generateResponse(
      question, 
      ModelType.REASONING, 
      systemPrompt
    );

    // Step 4: Action Generation
    // We parse intent to attach a dynamic Auto-Fix payload if appropriate.
    let suggestedAction: AiSearchResponse['suggestedAction'] = undefined;
    if (question.toLowerCase().includes('traffic dropped') || knowledgeGraphData.includes('MISSING_CANONICAL')) {
      suggestedAction = {
        type: 'AUTO_FIX',
        payload: {
          issueId: 'mock-issue-id-123',
          targetFile: 'app/layout.tsx',
          property: 'canonical',
          value: 'https://growthx.ai/products/enterprise-crawler'
        }
      };
    }

    return {
      answer,
      suggestedAction
    };
  }
}

