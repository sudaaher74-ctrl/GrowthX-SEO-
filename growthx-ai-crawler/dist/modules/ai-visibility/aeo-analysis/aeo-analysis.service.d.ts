import { PrismaService } from '../../../database/prisma.service';
export interface AeoReport {
    overallCitationScore: number;
    missingStructuredDataUrls: string[];
    crawlerActivity: {
        openai: number;
        anthropic: number;
        perplexity: number;
    };
}
export declare class AeoAnalysisService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /**
     * Analyzes a website for AI Engine Optimization (AEO).
     * It queries the AeoMetrics table to evaluate optimization for AI citations.
     */
    analyzeWebsiteAeo(projectId: string): Promise<AeoReport | null>;
}
