import { PrismaService } from '../../database/prisma.service';
export interface GraphNode {
    url: string;
    crawlDepth: number;
    inDegree: number;
    outDegree: number;
    linkEquityScore: number;
    isOrphan: boolean;
    isExcessiveDepth: boolean;
}
export interface GraphAnalysisReport {
    jobId: string;
    totalNodes: number;
    totalEdges: number;
    orphanPages: string[];
    excessiveDepthPages: string[];
    nodes: GraphNode[];
}
export declare class GraphService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /**
     * Constructs the directed internal link graph and calculates BFS crawl depth, link equity, and orphan nodes.
     */
    generateGraphReport(crawlJobId: string): Promise<GraphAnalysisReport>;
}
