import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { StrategyService } from '../strategy/strategy.service';
export declare class ContentGenerationService {
    private readonly prisma;
    private readonly router;
    private readonly strategy;
    private readonly logger;
    constructor(prisma: PrismaService, router: MultiAiRouterService, strategy: StrategyService);
    /**
     * Turns the latest strategy's content plan into tracked ContentPiece rows.
     *
     * Nothing is written yet — this is the queue an agency reviews before any
     * page is drafted or committed.
     */
    planFromStrategy(projectId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        slug: string;
        status: import(".prisma/client").$Enums.ContentPieceStatus;
        title: string;
        metaDescription: string | null;
        generatedByModel: string | null;
        body: string | null;
        format: string | null;
        targetQuery: string | null;
        runId: string | null;
        rationale: string | null;
        filePath: string | null;
    }[]>;
    /**
     * Writes the actual page for one planned piece.
     *
     * The brief is built from the same evidence the strategy used, so the page is
     * about this business rather than generically about the topic.
     */
    draft(pieceId: string, organizationId?: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        slug: string;
        status: import(".prisma/client").$Enums.ContentPieceStatus;
        title: string;
        metaDescription: string | null;
        generatedByModel: string | null;
        body: string | null;
        format: string | null;
        targetQuery: string | null;
        runId: string | null;
        rationale: string | null;
        filePath: string | null;
    }>;
    /** Renders a drafted piece as the file that gets committed. */
    toMarkdownFile(piece: {
        title: string;
        metaDescription: string | null;
        body: string;
        targetQuery: string | null;
    }): string;
    list(projectId: string): Promise<{
        id: string;
        createdAt: Date;
        slug: string;
        status: import(".prisma/client").$Enums.ContentPieceStatus;
        title: string;
        metaDescription: string | null;
        generatedByModel: string | null;
        format: string | null;
        targetQuery: string | null;
        filePath: string | null;
    }[]>;
    private slugify;
    private parseJson;
}
