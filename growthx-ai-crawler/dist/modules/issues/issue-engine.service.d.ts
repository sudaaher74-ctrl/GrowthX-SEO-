import { PrismaService } from '../../database/prisma.service';
import { ExtractedHtmlData } from '../extractor/html-extractor.service';
import { ExtractedImage } from '../analyzer/image-analyzer.service';
import { LinkAnalysisResult } from '../analyzer/link-analyzer.service';
import { ContentMetrics } from '../analyzer/content-analyzer.service';
import { ValidatedSchema } from '../analyzer/schema-validator.service';
export interface DetectedIssueInput {
    issueType: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    affectedUrl: string;
    description: string;
    recommendation: string;
    aiFixAvailable: boolean;
}
export declare class IssueEngineService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /**
     * Executes 25+ automated Technical SEO checks for a crawled page and persists detected issues to PostgreSQL
     */
    evaluateAndPersistIssues(crawlJobId: string, pageId: string, pageUrl: string, statusCode: number, redirectChain: string[], html: string, htmlData: ExtractedHtmlData, images: ExtractedImage[], links: LinkAnalysisResult, content: ContentMetrics, schemas: ValidatedSchema[], inSitemap: boolean, robotsTxtExists: boolean): Promise<DetectedIssueInput[]>;
}
