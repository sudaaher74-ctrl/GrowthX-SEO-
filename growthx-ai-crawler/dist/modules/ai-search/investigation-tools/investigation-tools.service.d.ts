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
     * Tool: Fetches Google Search Console data lookup (Pending Integration)
     */
    getTrafficMetrics(projectId: string): Promise<string>;
    /**
     * Tool: Fetches Competitor Intelligence lookup (Pending Integration)
     */
    getCompetitorData(projectId: string): Promise<string>;
}
