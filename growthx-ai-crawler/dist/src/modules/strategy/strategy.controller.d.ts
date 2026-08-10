import { StrategyService } from './strategy.service';
/**
 * Market analysis, SEO roadmap, content plan, and social strategy — the
 * "what do we do about it" layer on top of the crawl and visibility data.
 * Pro-only.
 */
export declare class StrategyController {
    private readonly strategy;
    constructor(strategy: StrategyService);
    getEvidence(projectId: string): Promise<import("./strategy-evidence").StrategyEvidence>;
    list(projectId: string): Promise<{
        id: string;
        createdAt: Date;
        generatedByModel: string | null;
    }[]>;
    get(reportId: string): Promise<{
        id: string;
        createdAt: Date;
        projectId: string;
        generatedByModel: string | null;
        content: import("@prisma/client/runtime/library").JsonValue;
        evidence: import("@prisma/client/runtime/library").JsonValue;
    }>;
    generate(req: any, projectId: string): Promise<{
        id: string;
        createdAt: Date;
        projectId: string;
        generatedByModel: string | null;
        content: import("@prisma/client/runtime/library").JsonValue;
        evidence: import("@prisma/client/runtime/library").JsonValue;
    }>;
}
