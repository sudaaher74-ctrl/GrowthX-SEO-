import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from './crawler.service';
import { SecurityService } from '../security/security.service';
import { HistoryService } from '../history/history.service';
import { GraphService } from '../graph/graph.service';
import { AiService } from '../ai/ai.service';
import { AutoFixService } from '../ai/auto-fix.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { OrgContextService } from '../billing/org-context.service';
export declare class CrawlController {
    private readonly prisma;
    private readonly crawlerService;
    private readonly securityService;
    private readonly historyService;
    private readonly graphService;
    private readonly aiService;
    private readonly autoFixService;
    private readonly schedulerService;
    private readonly entitlements;
    private readonly orgContext;
    constructor(prisma: PrismaService, crawlerService: CrawlerService, securityService: SecurityService, historyService: HistoryService, graphService: GraphService, aiService: AiService, autoFixService: AutoFixService, schedulerService: SchedulerService, entitlements: EntitlementsService, orgContext: OrgContextService);
    registerWebsiteRoute(req: any, body: {
        url: string;
        domain: string;
        projectId?: string;
    }): Promise<{
        id: string;
        domain: string;
        url: string;
        isVerified: boolean;
        verificationToken: string;
        instructions: string;
    }>;
    /** Shared by the route above and by auto-registration inside `startCrawlJob`. */
    private registerWebsite;
    verifyDomain(id: string): Promise<{
        success: boolean;
        isVerified: boolean;
        message: string;
    }>;
    startCrawlJob(body: {
        websiteId?: string;
        domain?: string;
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
            id: string;
            domain: string;
            url: string;
            isVerified: boolean;
            verifiedAt: Date | null;
            verificationToken: string | null;
            webhookSecret: string | null;
            authCredentials: string | null;
            rateLimitDelayMs: number;
            maxConcurrency: number;
            maxDepth: number;
            createdAt: Date;
            updatedAt: Date;
            projectId: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.JobStatus;
        pagesCrawled: number;
        issuesFound: number;
        concurrency: number;
        depthLimit: number;
        startedAt: Date | null;
        finishedAt: Date | null;
        errorMessage: string | null;
        websiteId: string;
    }>;
    getLatestCrawlJob(domain: string): Promise<({
        website: {
            id: string;
            domain: string;
            url: string;
            isVerified: boolean;
            verifiedAt: Date | null;
            verificationToken: string | null;
            webhookSecret: string | null;
            authCredentials: string | null;
            rateLimitDelayMs: number;
            maxConcurrency: number;
            maxDepth: number;
            createdAt: Date;
            updatedAt: Date;
            projectId: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import(".prisma/client").$Enums.JobStatus;
        pagesCrawled: number;
        issuesFound: number;
        concurrency: number;
        depthLimit: number;
        startedAt: Date | null;
        finishedAt: Date | null;
        errorMessage: string | null;
        websiteId: string;
    }) | null>;
    getCrawlIssues(id: string, severity?: string, page?: string, limit?: string): Promise<{
        data: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: import(".prisma/client").$Enums.IssueStatus;
            crawlJobId: string;
            issueType: string;
            severity: import(".prisma/client").$Enums.IssueSeverity;
            affectedUrl: string;
            description: string;
            recommendation: string;
            aiFixAvailable: boolean;
            pageId: string | null;
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
    analyzeIssue(req: any, id: string): Promise<import("../ai/ai.service").AIAnalysisResult>;
    generateAutoFix(req: any, id: string): Promise<import("../ai/auto-fix.service").GeneratedFixPatch>;
    approveFix(req: any, id: string, body: {
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
