import { ConfigService } from '@nestjs/config';
export declare enum ModelType {
    REASONING = "REASONING",// Gemini Pro / Claude
    CODE_GEN = "CODE_GEN",// GPT-4o / Gemini
    INDEXING = "INDEXING"
}
export declare class MultiAiRouterService {
    private configService;
    private readonly logger;
    constructor(configService: ConfigService);
    generateResponse(prompt: string, modelType: ModelType, systemInstruction?: string): Promise<string>;
    private callGemini;
    private callOpenAiMock;
    private callFastModelMock;
}
