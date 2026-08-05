import { AutomationService } from './automation.service';
import { ContentGenerationService } from './content-generation.service';
export declare class ConnectRepoDto {
    owner: string;
    name: string;
    accessToken: string;
    defaultBranch?: string;
    framework?: 'nextjs' | 'static-html' | 'unknown';
    contentDir?: string;
    autoMerge?: boolean;
}
/**
 * The autonomous loop: crawl → analyse → plan content → edit the site's code →
 * open a pull request.
 *
 * Pro-only. A PR is the deliverable; publishing to the live site is a separate,
 * explicit opt-in on the repository.
 */
export declare class AutomationController {
    private readonly automation;
    private readonly content;
    constructor(automation: AutomationService, content: ContentGenerationService);
    getRepository(projectId: string): Promise<(Omit<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        provider: string;
        owner: string;
        defaultBranch: string;
        accessTokenEncrypted: string;
        framework: string;
        contentDir: string | null;
        autoMerge: boolean;
        lastRunAt: Date | null;
    }, "accessTokenEncrypted"> & {
        tokenConfigured: boolean;
    }) | null>;
    connectRepository(projectId: string, body: ConnectRepoDto): Promise<Omit<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        provider: string;
        owner: string;
        defaultBranch: string;
        accessTokenEncrypted: string;
        framework: string;
        contentDir: string | null;
        autoMerge: boolean;
        lastRunAt: Date | null;
    }, "accessTokenEncrypted"> & {
        tokenConfigured: boolean;
    }>;
    planContent(projectId: string): Promise<{
        status: import(".prisma/client").$Enums.ContentPieceStatus;
        body: string | null;
        title: string;
        id: string;
        metaDescription: string | null;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        format: string | null;
        generatedByModel: string | null;
        slug: string;
        targetQuery: string | null;
        runId: string | null;
        rationale: string | null;
        filePath: string | null;
    }[]>;
    listContent(projectId: string): Promise<{
        status: import(".prisma/client").$Enums.ContentPieceStatus;
        title: string;
        id: string;
        metaDescription: string | null;
        createdAt: Date;
        format: string | null;
        generatedByModel: string | null;
        slug: string;
        targetQuery: string | null;
        filePath: string | null;
    }[]>;
    draft(req: any, pieceId: string): Promise<{
        status: import(".prisma/client").$Enums.ContentPieceStatus;
        body: string | null;
        title: string;
        id: string;
        metaDescription: string | null;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        format: string | null;
        generatedByModel: string | null;
        slug: string;
        targetQuery: string | null;
        runId: string | null;
        rationale: string | null;
        filePath: string | null;
    }>;
    runFixes(req: any, projectId: string, body?: {
        issueIds?: string[];
    }): Promise<{
        status: import(".prisma/client").$Enums.AutomationRunStatus;
        error: string | null;
        id: string;
        startedAt: Date;
        finishedAt: Date | null;
        projectId: string;
        kind: import(".prisma/client").$Enums.AutomationRunKind;
        branch: string | null;
        pullRequestUrl: string | null;
        steps: import("@prisma/client/runtime/library").JsonValue;
        filesChanged: string[];
        repositoryId: string;
    }>;
    runContent(req: any, projectId: string, body?: {
        pieceIds?: string[];
    }): Promise<{
        status: import(".prisma/client").$Enums.AutomationRunStatus;
        error: string | null;
        id: string;
        startedAt: Date;
        finishedAt: Date | null;
        projectId: string;
        kind: import(".prisma/client").$Enums.AutomationRunKind;
        branch: string | null;
        pullRequestUrl: string | null;
        steps: import("@prisma/client/runtime/library").JsonValue;
        filesChanged: string[];
        repositoryId: string;
    }>;
    listRuns(projectId: string): Promise<{
        status: import(".prisma/client").$Enums.AutomationRunStatus;
        error: string | null;
        id: string;
        startedAt: Date;
        finishedAt: Date | null;
        projectId: string;
        kind: import(".prisma/client").$Enums.AutomationRunKind;
        branch: string | null;
        pullRequestUrl: string | null;
        steps: import("@prisma/client/runtime/library").JsonValue;
        filesChanged: string[];
        repositoryId: string;
    }[]>;
}
