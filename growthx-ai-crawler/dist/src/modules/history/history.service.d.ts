import { PrismaService } from '../../database/prisma.service';
export interface IssueSummaryItem {
    issueType: string;
    severity: string;
    affectedUrl: string;
    description: string;
}
export interface CrawlDiffReport {
    currentJobId: string;
    previousJobId: string;
    pageCountDiff: number;
    issuesCountDiff: number;
    newIssues: IssueSummaryItem[];
    resolvedIssues: IssueSummaryItem[];
    recurringIssues: IssueSummaryItem[];
    summaryMessage: string;
}
export declare class HistoryService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    /**
     * Compares two historical crawl jobs to identify new, resolved, and recurring SEO audit issues.
     */
    compareCrawlJobs(currentJobId: string, previousJobId: string): Promise<CrawlDiffReport>;
}
