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
     * Tool: Mocks Google Search Console data lookup
     */
    getTrafficMetrics(projectId: string): Promise<string>;
    /**
     * Tool: Mocks Competitor Intelligence lookup
     */
    getCompetitorData(projectId: string): Promise<string>;
}
