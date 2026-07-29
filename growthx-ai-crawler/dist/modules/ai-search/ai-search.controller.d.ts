import { AiSearchService, AiSearchResponse } from './ai-search/ai-search.service';
export declare class AiSearchDto {
    question: string;
}
export declare class AiSearchController {
    private readonly aiSearchService;
    constructor(aiSearchService: AiSearchService);
    askQuestion(projectId: string, body: AiSearchDto): Promise<AiSearchResponse>;
}
