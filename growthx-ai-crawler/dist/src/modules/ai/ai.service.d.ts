import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
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
    private readonly router;
    private readonly logger;
    constructor(prisma: PrismaService, router: MultiAiRouterService);
    /**
     * Explains an SEO issue: why it matters, its SEO and business impact, and how
     * to fix it. Which model answers depends on the organization's plan — Gemini
     * on Starter, Claude or GPT on Pro — and is enforced by the router.
     *
     * With no provider configured (or on any model failure) this falls back to a
     * deterministic SEO rules engine, so the product still returns real guidance
     * rather than an error.
     */
    analyzeIssue(issueId: string, organizationId?: string): Promise<AIAnalysisResult>;
    private buildPrompt;
    /** Tolerates a model that wraps its JSON in prose or a code fence. */
    private parseAnalysis;
    private severityScore;
    /**
     * High-quality deterministic SEO intelligence fallback
     */
    private generateDeterministicAnalysis;
}
