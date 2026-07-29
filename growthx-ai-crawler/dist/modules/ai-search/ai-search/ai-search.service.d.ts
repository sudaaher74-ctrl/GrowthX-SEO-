import { MultiAiRouterService } from '../multi-ai-router/multi-ai-router.service';
import { InvestigationToolsService } from '../investigation-tools/investigation-tools.service';
export interface AiSearchResponse {
    answer: string;
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
    askQuestion(projectId: string, question: string): Promise<AiSearchResponse>;
}
