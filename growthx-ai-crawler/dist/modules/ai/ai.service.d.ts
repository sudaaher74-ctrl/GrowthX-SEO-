import { PrismaService } from '../../database/prisma.service';
export interface AIAnalysisResult {
    whyItMatters: string;
    seoImpact: string;
    businessImpact: string;
    priorityScore: number;
    recommendedFix: string;
    expectedOutcome: string;
}
export declare class AiService {
    private readonly prisma;
    private readonly logger;
    private readonly provider;
    private openai?;
    constructor(prisma: PrismaService);
    /**
     * Analyzes a detected SEO issue using AI to explain root causes, SEO/business impacts, and priority grading.
     * Module 15 Requirement: Do NOT immediately modify the website.
     */
    analyzeIssue(issueId: string): Promise<AIAnalysisResult>;
    /**
     * Invokes configured LLM (OpenAI / Gemini)
     */
    private invokeLlmProvider;
    /**
     * High-quality deterministic SEO intelligence fallback
     */
    private generateDeterministicAnalysis;
}
