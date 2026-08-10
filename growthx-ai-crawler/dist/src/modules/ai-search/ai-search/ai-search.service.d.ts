import { AiProvider, MultiAiRouterService } from '../multi-ai-router/multi-ai-router.service';
import { InvestigationToolsService } from '../investigation-tools/investigation-tools.service';
export interface AiSearchResponse {
    answer: string;
    /** Which model actually answered, so the UI can show it and we can audit spend. */
    model: {
        provider: AiProvider;
        name: string;
        inputTokens: number;
        outputTokens: number;
        estimatedCostUsd: number | null;
    };
    suggestedAction?: {
        type: 'AUTO_FIX';
        payload: {
            issueId: string;
            targetFile: string;
            property: string;
            value: string;
        };
    };
}
export declare class AiSearchService {
    private readonly multiAiRouter;
    private readonly investigationTools;
    private readonly logger;
    constructor(multiAiRouter: MultiAiRouterService, investigationTools: InvestigationToolsService);
    /**
     * Main entry point for the "Perplexity for SEO" feature.
     */
    askQuestion(projectId: string, question: string, organizationId?: string): Promise<AiSearchResponse>;
}
