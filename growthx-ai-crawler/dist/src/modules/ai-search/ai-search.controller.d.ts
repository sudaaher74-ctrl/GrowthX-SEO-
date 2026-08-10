import { AiSearchService, AiSearchResponse } from './ai-search/ai-search.service';
import { EntitlementsService } from '../billing/entitlements.service';
export declare class AiSearchDto {
    question: string;
}
export declare class AiSearchController {
    private readonly aiSearchService;
    private readonly entitlements;
    constructor(aiSearchService: AiSearchService, entitlements: EntitlementsService);
    askQuestion(req: any, projectId: string, body: AiSearchDto): Promise<AiSearchResponse>;
}
