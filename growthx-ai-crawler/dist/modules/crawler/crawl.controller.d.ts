import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from './crawler.service';
import { SecurityService } from '../security/security.service';
import { HistoryService } from '../history/history.service';
import { GraphService } from '../graph/graph.service';
import { AiService } from '../ai/ai.service';
import { AutoFixService } from '../ai/auto-fix.service';
import { SchedulerService } from '../scheduler/scheduler.service';
export declare class CrawlController {
    private readonly prisma;
    private readonly crawlerService;
    private readonly securityService;
    private readonly historyService;
    private readonly graphService;
    private readonly aiService;
    private readonly autoFixService;
    private readonly schedulerService;
    constructor(prisma: PrismaService, crawlerService: CrawlerService, securityService: SecurityService, historyService: HistoryService, graphService: GraphService, aiService: AiService, autoFixService: AutoFixService, schedulerService: SchedulerService);
    registerWebsite(body: {
        url: string;
        domain: string;
    }): Promise<{
        id: string;
        domain: string;
        url: string;
        isVerified: boolean;
        verificationToken: string;
        instructions: string;
    }>;
    verifyDomain(id: string): Promise<{
        success: boolean;
        isVerified: boolean;
        message: string;
    }>;
    startCrawlJob(body: {
        websiteId: string;
        maxConcurrency?: number;
        maxDepth?: number;
        useSitemap?: boolean;
    }): Promise<{
        success: boolean;
        jobId: string;
        message: string;
    }>;
    getCrawlJob(id: string): Promise<{
        website: {
            url: string;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            domain: string;
            isVerified: boolean;
            verifiedAt: Date | null;
            verificationToken: string | null;
            webhookSecret: string | null;
            authCredentials: string | null;
            rateLimitDelayMs: number;
            maxConcurrency: number;
            maxDepth: number;
        };
    } & {
        status: import(".prisma/client").$Enums.JobStatus;
        websiteId: string;
        errorMessage: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        pagesCrawled: number;
        issuesFound: number;
        concurrency: number;
        depthLimit: number;
        startedAt: Date | null;
        finishedAt: Date | null;
    }>;
    getCrawlIssues(id: string, severity?: string, page?: string, limit?: string): Promise<{
        data: {
            status: import(".prisma/client").$Enums.IssueStatus;
            severity: import(".prisma/client").$Enums.IssueSeverity;
            issueType: string;
            id: string;
            pageId: string | null;
            crawlJobId: string;
            affectedUrl: string;
            description: string;
            recommendation: string;
            aiFixAvailable: boolean;
            createdAt: Date;
            updatedAt: Date;
        }[];
        meta: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
        };
    }>;
    getGraphReport(id: string): Promise<import("../graph/graph.service").GraphAnalysisReport>;
    getCrawlDiff(id: string, compareWith: string): Promise<import("../history/history.service").CrawlDiffReport>;
    analyzeIssue(id: string): Promise<import("../ai/ai.service").AIAnalysisResult>;
    generateAutoFix(id: string): Promise<import("../ai/auto-fix.service").GeneratedFixPatch>;
    approveFix(id: string, body: {
        userId?: string;
    }): Promise<{
        success: boolean;
        message: string;
        patch: any;
    }>;
    triggerWebhook(body: {
        domain: string;
        secret?: string;
    }): Promise<{
        success: boolean;
        jobId?: string;
        message: string;
    }>;
}
