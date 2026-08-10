import { PrismaService } from '../../database/prisma.service';
import { GitService } from '../autonomous-engineer/agents/git/git.service';
import { PatchGenerationService } from '../autonomous-engineer/agents/patch-generation/patch-generation.service';
import { RepositoryUnderstandingService } from '../autonomous-engineer/agents/repository-understanding/repository-understanding.service';
import { ValidationService } from '../autonomous-engineer/agents/validation/validation.service';
import { AutoFixService } from '../ai/auto-fix.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { SecurityService } from '../security/security.service';
import { ContentGenerationService } from './content-generation.service';
export declare class AutomationService {
    private readonly prisma;
    private readonly git;
    private readonly patcher;
    private readonly repoUnderstanding;
    private readonly validation;
    private readonly autoFix;
    private readonly content;
    private readonly security;
    private readonly entitlements;
    private readonly logger;
    constructor(prisma: PrismaService, git: GitService, patcher: PatchGenerationService, repoUnderstanding: RepositoryUnderstandingService, validation: ValidationService, autoFix: AutoFixService, content: ContentGenerationService, security: SecurityService, entitlements: EntitlementsService);
    /**
     * Stores how to reach a client's site code. The token is encrypted at rest
     * and never returned — every read goes through `decryptToken`.
     */
    connectRepository(projectId: string, input: {
        owner: string;
        name: string;
        accessToken: string;
        defaultBranch?: string;
        framework?: string;
        contentDir?: string;
        autoMerge?: boolean;
    }): Promise<Omit<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        name: string;
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
    getRepository(projectId: string): Promise<(Omit<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        projectId: string;
        name: string;
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
    /** The token must never leave the server. */
    private redact;
    /**
     * Applies approved SEO fixes to the client's repository and opens a pull
     * request.
     *
     * A PR is the default deliverable, not a deployment: the agency reviews the
     * diff, then merges. `autoMerge` on the repository is an explicit opt-in for
     * publishing straight to the live site.
     */
    runFixes(projectId: string, organizationId: string, issueIds?: string[]): Promise<{
        error: string | null;
        id: string;
        projectId: string;
        status: import(".prisma/client").$Enums.AutomationRunStatus;
        startedAt: Date;
        finishedAt: Date | null;
        kind: import(".prisma/client").$Enums.AutomationRunKind;
        branch: string | null;
        pullRequestUrl: string | null;
        steps: import("@prisma/client/runtime/library").JsonValue;
        filesChanged: string[];
        repositoryId: string;
    }>;
    /**
     * Commits drafted content pages into the client's repository and opens a PR.
     * Only DRAFTED pieces are shipped — a plan without a written body is skipped.
     */
    runContent(projectId: string, organizationId: string, pieceIds?: string[]): Promise<{
        error: string | null;
        id: string;
        projectId: string;
        status: import(".prisma/client").$Enums.AutomationRunStatus;
        startedAt: Date;
        finishedAt: Date | null;
        kind: import(".prisma/client").$Enums.AutomationRunKind;
        branch: string | null;
        pullRequestUrl: string | null;
        steps: import("@prisma/client/runtime/library").JsonValue;
        filesChanged: string[];
        repositoryId: string;
    }>;
    listRuns(projectId: string): Promise<{
        error: string | null;
        id: string;
        projectId: string;
        status: import(".prisma/client").$Enums.AutomationRunStatus;
        startedAt: Date;
        finishedAt: Date | null;
        kind: import(".prisma/client").$Enums.AutomationRunKind;
        branch: string | null;
        pullRequestUrl: string | null;
        steps: import("@prisma/client/runtime/library").JsonValue;
        filesChanged: string[];
        repositoryId: string;
    }[]>;
    private requireRepository;
    private selectIssues;
    private parsePatch;
    /**
     * Maps a crawled URL onto a file in the repository.
     *
     * Returns null rather than guessing when nothing matches — writing to the
     * wrong file is far worse than skipping a fix.
     */
    private resolveTargetFile;
    /** Common content folders, checked in order of popularity. */
    private guessContentDir;
    private fixPrBody;
    private contentPrBody;
    private step;
    private startRun;
    private finishRun;
    /** Clones contain a customer's source; remove them as soon as we are done. */
    private cleanup;
}
