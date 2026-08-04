import { PrismaService } from '../../../database/prisma.service';
export declare class InvestigationToolsService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /**
     * Tool: Queries the SEO Knowledge Graph (Prisma database issues)
     */
    queryKnowledgeGraph(projectId: string): Promise<string>;
    /**
     * Tool: Google Search Console traffic. Not connected yet.
     *
     * Returns an explicit "unavailable" marker rather than throwing: this is one
     * of several evidence sources fed to the model, and a missing integration
     * must not take down the whole answer. The marker also tells the model not to
     * speculate about traffic it cannot see.
     */
    getTrafficMetrics(projectId: string): Promise<string>;
    /** Tool: competitor intelligence. Same contract as above. */
    getCompetitorData(projectId: string): Promise<string>;
}
