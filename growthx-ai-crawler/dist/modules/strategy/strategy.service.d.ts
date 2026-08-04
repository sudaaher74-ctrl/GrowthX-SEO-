import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { StrategyEvidence } from './strategy-evidence';
export declare class StrategyService {
    private readonly prisma;
    private readonly router;
    private readonly visibility;
    private readonly entitlements;
    private readonly logger;
    constructor(prisma: PrismaService, router: MultiAiRouterService, visibility: AiVisibilityService, entitlements: EntitlementsService);
    /**
     * Assembles everything we know about a project from its crawl and its AI
     * visibility history. Exposed so the API can show a customer the basis for a
     * plan before paying a report against their allowance.
     */
    gatherEvidence(projectId: string): Promise<StrategyEvidence>;
    /**
     * Produces a market + SEO + content + social plan for a project.
     *
     * There is no heuristic fallback here on purpose. A crawl fix can be derived
     * from a URL, but a strategy cannot — a template would be generic advice
     * dressed up as analysis, which is exactly what the customer is paying us not
     * to send. If no model is reachable we say so.
     */
    generate(projectId: string, organizationId: string): Promise<{
        content: import("@prisma/client/runtime/library").JsonValue;
        id: string;
        createdAt: Date;
        projectId: string;
        generatedByModel: string | null;
        evidence: import("@prisma/client/runtime/library").JsonValue;
    }>;
    list(projectId: string): Promise<{
        id: string;
        createdAt: Date;
        generatedByModel: string | null;
    }[]>;
    get(reportId: string): Promise<{
        content: import("@prisma/client/runtime/library").JsonValue;
        id: string;
        createdAt: Date;
        projectId: string;
        generatedByModel: string | null;
        evidence: import("@prisma/client/runtime/library").JsonValue;
    }>;
    private parseJson;
}
