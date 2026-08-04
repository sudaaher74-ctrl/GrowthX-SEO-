import { AiAssistant } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { CompetitorRef } from './citation/citation-detector';
import { VisibilityReport } from './citation/visibility-report';
export declare const SUPPORTED_ASSISTANTS: AiAssistant[];
interface ProjectContext {
    organizationId: string;
    ownDomains: string[];
    ownBrandNames: string[];
    competitors: CompetitorRef[];
    competitorLabels: Record<string, string>;
}
export interface SweepResult {
    projectId: string;
    promptsChecked: number;
    checksRun: number;
    checksFailed: number;
    citations: number;
    skippedAssistants: AiAssistant[];
}
export declare class AiVisibilityService {
    private readonly prisma;
    private readonly router;
    private readonly entitlements;
    private readonly logger;
    constructor(prisma: PrismaService, router: MultiAiRouterService, entitlements: EntitlementsService);
    /** Resolves everything a citation check needs to know about the customer. */
    private loadContext;
    /**
     * Asks one assistant one prompt and records whether the customer was cited.
     *
     * A failure is persisted as a check with `error` set rather than swallowed,
     * so "we could not ask" never silently reads as "you were not cited".
     */
    runCheck(trackedPromptId: string, assistant: AiAssistant, context: ProjectContext): Promise<{
        error: string | null;
        id: string;
        model: string | null;
        cited: boolean;
        assistant: import(".prisma/client").$Enums.AiAssistant;
        checkedAt: Date;
        position: number | null;
        citedUrl: string | null;
        competitorsCited: string[];
        answerExcerpt: string | null;
        trackedPromptId: string;
    }>;
    /**
     * Runs every active prompt against every requested assistant.
     *
     * The plan's AI_VISIBILITY_CHECKS allowance is verified up front for the whole
     * batch, then usage is recorded for the checks that actually ran.
     */
    sweepProject(projectId: string, options?: {
        assistants?: AiAssistant[];
        skipEntitlementCheck?: boolean;
    }): Promise<SweepResult>;
    /** The AI Visibility dashboard payload for a project. */
    getReport(projectId: string, days?: number): Promise<VisibilityReport>;
    /** The prompt table beneath the dashboard: latest result per prompt/assistant. */
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
    addPrompts(projectId: string, prompts: {
        text: string;
        intent?: any;
        cluster?: string;
        estimatedVolume?: number;
    }[]): Promise<{
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
    addCompetitor(projectId: string, domain: string, label?: string): Promise<{
        id: string;
        createdAt: Date;
        domain: string;
        projectId: string;
        label: string | null;
    }>;
}
export {};
