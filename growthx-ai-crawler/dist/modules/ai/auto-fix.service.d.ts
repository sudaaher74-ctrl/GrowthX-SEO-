import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { FixType } from './fix-generator';
export interface GeneratedFixPatch {
    fixType: FixType;
    targetUrl: string;
    originalValue?: string | null;
    proposedValue: string;
    codeSnippet: string;
    /** Whether a model wrote this or the deterministic fallback did. */
    source: 'model' | 'heuristic';
    model?: string;
}
export declare class AutoFixService {
    private readonly prisma;
    private readonly router;
    private readonly logger;
    constructor(prisma: PrismaService, router: MultiAiRouterService);
    /**
     * Proposes a concrete patch for an issue, written from the customer's own
     * page content. Nothing is applied here — Module 16 requires approval first.
     *
     * If no model is reachable, a deterministic fallback derived from the page is
     * used instead. Both paths are grounded in the customer's page: a patch must
     * never carry our product name, an invented price, or a made-up claim.
     */
    generateFixPatch(issueId: string, organizationId?: string): Promise<GeneratedFixPatch>;
    /** Tolerates a model that wraps JSON in prose or a code fence. */
    private parseJson;
    /**
     * User approves the AI recommendation.
     * Module 16: Every change requires user approval before execution.
     */
    approveAndExecuteFix(issueId: string, approvedByUserId: string): Promise<{
        success: boolean;
        message: string;
        patch: any;
    }>;
    rejectFix(issueId: string, rejectedByUserId: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
