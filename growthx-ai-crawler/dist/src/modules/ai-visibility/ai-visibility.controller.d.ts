import { AiAssistant, SearchIntent } from '@prisma/client';
import { AiVisibilityService } from './ai-visibility.service';
import { AeoAnalysisService } from './aeo-analysis/aeo-analysis.service';
export declare class AddPromptsDto {
    prompts: {
        text: string;
        intent?: SearchIntent;
        cluster?: string;
        estimatedVolume?: number;
    }[];
}
export declare class AddCompetitorDto {
    domain: string;
    label?: string;
}
/**
 * AI Visibility (AEO/GEO) — whether ChatGPT, Claude, and Gemini cite the
 * customer when answering the questions their buyers actually ask.
 *
 * Every route is Pro-only: the whole surface sits behind Feature.AI_VISIBILITY.
 */
export declare class AiVisibilityController {
    private readonly visibility;
    private readonly aeo;
    constructor(visibility: AiVisibilityService, aeo: AeoAnalysisService);
    getReport(projectId: string, days?: string): Promise<{
        measurableAssistants: import(".prisma/client").$Enums.AiAssistant[];
        periodStart: string;
        periodEnd: string;
        summary: {
            checked: number;
            cited: number;
            citationSharePct: number;
            averagePosition: number | null;
            previousCitationSharePct: number | null;
            deltaPt: number | null;
            failedChecks: number;
        };
        byAssistant: import("./citation/visibility-report").AssistantBreakdown[];
        shareOfVoice: import("./citation/visibility-report").ShareOfVoiceRow[];
        trend: import("./citation/visibility-report").TrendPoint[];
    }>;
    listPrompts(projectId: string): Promise<{
        id: string;
        text: string;
        intent: import(".prisma/client").$Enums.SearchIntent | null;
        cluster: string | null;
        estimatedVolume: number | null;
        isActive: boolean;
        latestChecks: {
            assistant: import(".prisma/client").$Enums.AiAssistant;
            checkedAt: Date;
            cited: boolean;
            position: number | null;
            citedUrl: string | null;
            competitorsCited: string[];
            error: string | null;
        }[];
    }[]>;
    addPrompts(projectId: string, body: AddPromptsDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        text: string;
        intent: import(".prisma/client").$Enums.SearchIntent | null;
        cluster: string | null;
        estimatedVolume: number | null;
        isActive: boolean;
    }[]>;
    addCompetitor(projectId: string, body: AddCompetitorDto): Promise<{
        id: string;
        domain: string;
        createdAt: Date;
        projectId: string;
        label: string | null;
    }>;
    sweep(projectId: string, body?: {
        assistants?: AiAssistant[];
    }): Promise<import("./ai-visibility.service").SweepResult>;
    getAeo(projectId: string): Promise<import("./aeo-analysis/aeo-analysis.service").AeoReport | null>;
}
