"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AutomationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const fs = require("fs/promises");
const path = require("path");
const prisma_service_1 = require("../../database/prisma.service");
const git_service_1 = require("../autonomous-engineer/agents/git/git.service");
const patch_generation_service_1 = require("../autonomous-engineer/agents/patch-generation/patch-generation.service");
const repository_understanding_service_1 = require("../autonomous-engineer/agents/repository-understanding/repository-understanding.service");
const validation_service_1 = require("../autonomous-engineer/agents/validation/validation.service");
const auto_fix_service_1 = require("../ai/auto-fix.service");
const entitlements_service_1 = require("../billing/entitlements.service");
const plans_catalog_1 = require("../billing/plans.catalog");
const security_service_1 = require("../security/security.service");
const content_generation_service_1 = require("./content-generation.service");
/** How many fixes one run will attempt, so a PR stays reviewable. */
const MAX_FIXES_PER_RUN = 25;
let AutomationService = AutomationService_1 = class AutomationService {
    constructor(prisma, git, patcher, repoUnderstanding, validation, autoFix, content, security, entitlements) {
        this.prisma = prisma;
        this.git = git;
        this.patcher = patcher;
        this.repoUnderstanding = repoUnderstanding;
        this.validation = validation;
        this.autoFix = autoFix;
        this.content = content;
        this.security = security;
        this.entitlements = entitlements;
        this.logger = new common_1.Logger(AutomationService_1.name);
    }
    // ───────────────────────────────────────────────── repository connection
    /**
     * Stores how to reach a client's site code. The token is encrypted at rest
     * and never returned — every read goes through `decryptToken`.
     */
    async connectRepository(projectId, input) {
        if (!input.owner || !input.name || !input.accessToken) {
            throw new common_1.BadRequestException('owner, name and accessToken are required.');
        }
        const data = {
            owner: input.owner,
            name: input.name,
            accessTokenEncrypted: this.security.encryptCredentials(input.accessToken),
            defaultBranch: input.defaultBranch ?? 'main',
            framework: input.framework ?? 'unknown',
            contentDir: input.contentDir ?? null,
            autoMerge: input.autoMerge ?? false,
        };
        const repo = await this.prisma.siteRepository.upsert({
            where: { projectId },
            update: data,
            create: { projectId, ...data },
        });
        return this.redact(repo);
    }
    async getRepository(projectId) {
        const repo = await this.prisma.siteRepository.findUnique({ where: { projectId } });
        return repo ? this.redact(repo) : null;
    }
    /** The token must never leave the server. */
    redact(repo) {
        const { accessTokenEncrypted: _omitted, ...safe } = repo;
        return { ...safe, tokenConfigured: true };
    }
    // ───────────────────────────────────────────────────────────── the run
    /**
     * Applies approved SEO fixes to the client's repository and opens a pull
     * request.
     *
     * A PR is the default deliverable, not a deployment: the agency reviews the
     * diff, then merges. `autoMerge` on the repository is an explicit opt-in for
     * publishing straight to the live site.
     */
    async runFixes(projectId, organizationId, issueIds) {
        await this.entitlements.assertFeature(organizationId, plans_catalog_1.Feature.AUTO_FIX_DEPLOY);
        const repo = await this.requireRepository(projectId);
        const run = await this.startRun(repo.id, projectId, client_1.AutomationRunKind.FIXES);
        const steps = [];
        let workingDir = '';
        try {
            const token = this.security.decryptCredentials(repo.accessTokenEncrypted);
            const issues = await this.selectIssues(projectId, issueIds);
            if (issues.length === 0) {
                return this.finishRun(run.id, client_1.AutomationRunStatus.FAILED, steps, {
                    error: 'No open issues with a generated fix. Generate fixes first.',
                });
            }
            await this.entitlements.assertQuota(organizationId, client_1.UsageMetric.AUTO_FIXES, issues.length);
            workingDir = await this.git.cloneRepository(`https://github.com/${repo.owner}/${repo.name}.git`, token, repo.name);
            steps.push(this.step('clone', `${repo.owner}/${repo.name}`, true));
            const context = await this.repoUnderstanding.analyzeRepository(workingDir);
            steps.push(this.step('analyze', `package manager: ${context.packageManager}`, true));
            const branch = `growthx-ai/fixes-${Date.now()}`;
            await this.git.createFeatureBranch(workingDir, branch);
            steps.push(this.step('branch', branch, true));
            const changed = [];
            const skipped = [];
            for (const issue of issues) {
                const patch = this.parsePatch(issue.aiRecommendation?.recommendedFixPatch);
                if (!patch) {
                    skipped.push(`${issue.issueType}: no usable patch`);
                    continue;
                }
                const target = await this.resolveTargetFile(workingDir, issue.affectedUrl, repo.framework);
                if (!target) {
                    skipped.push(`${issue.issueType} (${issue.affectedUrl}): no matching file in the repo`);
                    continue;
                }
                const outcome = await this.patcher.applyFix(target, patch.fixType, patch.proposedValue);
                if (outcome.applied) {
                    changed.push(path.relative(workingDir, target));
                }
                else {
                    skipped.push(`${issue.issueType}: ${outcome.reason ?? 'not applied'}`);
                }
            }
            steps.push(this.step('patch', `${changed.length} file(s) changed, ${skipped.length} skipped`, true));
            if (changed.length === 0) {
                return this.finishRun(run.id, client_1.AutomationRunStatus.FAILED, steps, {
                    error: `Nothing could be applied. ${skipped.slice(0, 5).join('; ')}`,
                });
            }
            // A build that fails is never pushed — a broken site is worse than an
            // unfixed one.
            const validated = await this.validation.validateRepository(workingDir, context.packageManager);
            steps.push(this.step('validate', validated.success ? 'build passed' : 'build failed', validated.success));
            if (!validated.success) {
                return this.finishRun(run.id, client_1.AutomationRunStatus.FAILED, steps, {
                    error: `Validation failed, nothing was pushed. ${String(validated.output).slice(0, 400)}`,
                    filesChanged: changed,
                });
            }
            await this.git.commitAndPush(workingDir, branch, `fix(seo): apply ${changed.length} automated SEO fixes`);
            steps.push(this.step('push', branch, true));
            const prUrl = await this.git.createPullRequest(token, repo.owner, repo.name, `SEO fixes: ${changed.length} file(s)`, branch, repo.defaultBranch, this.fixPrBody(issues, changed, skipped));
            steps.push(this.step('pull_request', prUrl, true));
            await this.entitlements.recordUsage(organizationId, client_1.UsageMetric.AUTO_FIXES, issues.length);
            return this.finishRun(run.id, client_1.AutomationRunStatus.AWAITING_REVIEW, steps, {
                branch,
                pullRequestUrl: prUrl,
                filesChanged: changed,
            });
        }
        catch (error) {
            this.logger.error(`Fix run failed for project ${projectId}: ${error.message}`);
            steps.push(this.step('error', error.message, false));
            return this.finishRun(run.id, client_1.AutomationRunStatus.FAILED, steps, { error: error.message });
        }
        finally {
            await this.cleanup(workingDir);
        }
    }
    /**
     * Commits drafted content pages into the client's repository and opens a PR.
     * Only DRAFTED pieces are shipped — a plan without a written body is skipped.
     */
    async runContent(projectId, organizationId, pieceIds) {
        await this.entitlements.assertFeature(organizationId, plans_catalog_1.Feature.AUTO_FIX_DEPLOY);
        const repo = await this.requireRepository(projectId);
        const run = await this.startRun(repo.id, projectId, client_1.AutomationRunKind.CONTENT);
        const steps = [];
        let workingDir = '';
        try {
            const pieces = await this.prisma.contentPiece.findMany({
                where: {
                    projectId,
                    status: client_1.ContentPieceStatus.DRAFTED,
                    ...(pieceIds?.length ? { id: { in: pieceIds } } : {}),
                },
            });
            if (pieces.length === 0) {
                return this.finishRun(run.id, client_1.AutomationRunStatus.FAILED, steps, {
                    error: 'No drafted content to publish. Draft a planned piece first.',
                });
            }
            const token = this.security.decryptCredentials(repo.accessTokenEncrypted);
            workingDir = await this.git.cloneRepository(`https://github.com/${repo.owner}/${repo.name}.git`, token, repo.name);
            steps.push(this.step('clone', `${repo.owner}/${repo.name}`, true));
            const context = await this.repoUnderstanding.analyzeRepository(workingDir);
            const contentDir = repo.contentDir ?? (await this.guessContentDir(workingDir));
            steps.push(this.step('analyze', `content directory: ${contentDir}`, true));
            const branch = `growthx-ai/content-${Date.now()}`;
            await this.git.createFeatureBranch(workingDir, branch);
            const changed = [];
            for (const piece of pieces) {
                const relative = path.join(contentDir, `${piece.slug}.md`);
                const absolute = path.join(workingDir, relative);
                await fs.mkdir(path.dirname(absolute), { recursive: true });
                await fs.writeFile(absolute, this.content.toMarkdownFile({
                    title: piece.title,
                    metaDescription: piece.metaDescription,
                    body: piece.body ?? '',
                    targetQuery: piece.targetQuery,
                }), 'utf8');
                changed.push(relative);
                await this.prisma.contentPiece.update({
                    where: { id: piece.id },
                    data: { status: client_1.ContentPieceStatus.COMMITTED, filePath: relative, runId: run.id },
                });
            }
            steps.push(this.step('write', `${changed.length} page(s)`, true));
            const validated = await this.validation.validateRepository(workingDir, context.packageManager);
            steps.push(this.step('validate', validated.success ? 'build passed' : 'build failed', validated.success));
            if (!validated.success) {
                return this.finishRun(run.id, client_1.AutomationRunStatus.FAILED, steps, {
                    error: `Validation failed, nothing was pushed. ${String(validated.output).slice(0, 400)}`,
                    filesChanged: changed,
                });
            }
            await this.git.commitAndPush(workingDir, branch, `content: add ${changed.length} SEO page(s)`);
            const prUrl = await this.git.createPullRequest(token, repo.owner, repo.name, `New content: ${changed.length} page(s)`, branch, repo.defaultBranch, this.contentPrBody(pieces, changed));
            steps.push(this.step('pull_request', prUrl, true));
            return this.finishRun(run.id, client_1.AutomationRunStatus.AWAITING_REVIEW, steps, {
                branch,
                pullRequestUrl: prUrl,
                filesChanged: changed,
            });
        }
        catch (error) {
            this.logger.error(`Content run failed for project ${projectId}: ${error.message}`);
            steps.push(this.step('error', error.message, false));
            return this.finishRun(run.id, client_1.AutomationRunStatus.FAILED, steps, { error: error.message });
        }
        finally {
            await this.cleanup(workingDir);
        }
    }
    async listRuns(projectId) {
        return this.prisma.automationRun.findMany({
            where: { projectId },
            orderBy: { startedAt: 'desc' },
            take: 25,
        });
    }
    // ─────────────────────────────────────────────────────────────── helpers
    async requireRepository(projectId) {
        const repo = await this.prisma.siteRepository.findUnique({ where: { projectId } });
        if (!repo) {
            throw new common_1.BadRequestException('Connect this client\'s repository first — the agent needs somewhere to write the changes.');
        }
        return repo;
    }
    async selectIssues(projectId, issueIds) {
        return this.prisma.issue.findMany({
            where: {
                crawlJob: { website: { projectId } },
                status: 'OPEN',
                aiFixAvailable: true,
                ...(issueIds?.length ? { id: { in: issueIds } } : {}),
            },
            include: { aiRecommendation: true },
            orderBy: { severity: 'asc' },
            take: MAX_FIXES_PER_RUN,
        });
    }
    parsePatch(raw) {
        if (!raw)
            return null;
        try {
            const parsed = JSON.parse(raw);
            return parsed?.fixType && parsed?.proposedValue ? parsed : null;
        }
        catch {
            return null;
        }
    }
    /**
     * Maps a crawled URL onto a file in the repository.
     *
     * Returns null rather than guessing when nothing matches — writing to the
     * wrong file is far worse than skipping a fix.
     */
    async resolveTargetFile(repoDir, url, framework) {
        let segments;
        try {
            segments = new URL(url).pathname.split('/').filter(Boolean);
        }
        catch {
            return null;
        }
        const slug = segments[segments.length - 1] ?? 'index';
        const routePath = segments.join('/');
        const candidates = framework === 'static-html'
            ? [`${routePath || 'index'}.html`, path.join(routePath, 'index.html'), `${slug}.html`]
            : [
                path.join('src/app', routePath, 'page.tsx'),
                path.join('app', routePath, 'page.tsx'),
                path.join('src/pages', `${routePath || 'index'}.tsx`),
                path.join('pages', `${routePath || 'index'}.tsx`),
                `${routePath || 'index'}.html`,
                path.join(routePath, 'index.html'),
            ];
        for (const candidate of candidates) {
            const absolute = path.join(repoDir, candidate);
            // Never escape the clone directory, whatever the URL contained.
            if (!absolute.startsWith(repoDir))
                continue;
            try {
                await fs.access(absolute);
                return absolute;
            }
            catch {
                // try the next candidate
            }
        }
        return null;
    }
    /** Common content folders, checked in order of popularity. */
    async guessContentDir(repoDir) {
        for (const dir of ['content/blog', 'content/posts', 'content', 'src/content', 'posts', '_posts']) {
            try {
                await fs.access(path.join(repoDir, dir));
                return dir;
            }
            catch {
                // keep looking
            }
        }
        return 'content/blog';
    }
    fixPrBody(issues, changed, skipped) {
        return [
            '## Automated SEO fixes by GrowthX AI',
            '',
            `Applied **${changed.length}** change(s) from the latest crawl. The build was run before pushing.`,
            '',
            '### Files changed',
            ...changed.map((f) => `- \`${f}\``),
            '',
            '### Issues addressed',
            ...issues.slice(0, 20).map((i) => `- **${i.severity}** ${i.issueType} — ${i.affectedUrl}`),
            skipped.length ? `\n### Skipped\n${skipped.map((s) => `- ${s}`).join('\n')}` : '',
            '',
            '> Review the diff before merging. Nothing here has been published to the live site.',
        ]
            .filter(Boolean)
            .join('\n');
    }
    contentPrBody(pieces, changed) {
        return [
            '## New content by GrowthX AI',
            '',
            `Adds **${changed.length}** page(s), written against queries where competitors are currently cited.`,
            '',
            ...pieces.map((p) => `- **${p.title}** — targets \`${p.targetQuery ?? 'n/a'}\` (${p.generatedByModel ?? 'unknown model'})`),
            '',
            '> AI-written copy. Read it before merging — it is going on a client site.',
        ].join('\n');
    }
    step(step, detail, ok) {
        return { at: new Date().toISOString(), step, detail, ok };
    }
    async startRun(repositoryId, projectId, kind) {
        return this.prisma.automationRun.create({
            data: { repositoryId, projectId, kind, status: client_1.AutomationRunStatus.RUNNING },
        });
    }
    async finishRun(runId, status, steps, extra = {}) {
        return this.prisma.automationRun.update({
            where: { id: runId },
            data: {
                status,
                steps: steps,
                finishedAt: new Date(),
                error: extra.error ?? null,
                branch: extra.branch ?? null,
                pullRequestUrl: extra.pullRequestUrl ?? null,
                filesChanged: extra.filesChanged ?? [],
            },
        });
    }
    /** Clones contain a customer's source; remove them as soon as we are done. */
    async cleanup(dir) {
        if (!dir)
            return;
        try {
            await fs.rm(dir, { recursive: true, force: true });
        }
        catch (error) {
            this.logger.warn(`Could not clean up ${dir}: ${error.message}`);
        }
    }
};
exports.AutomationService = AutomationService;
exports.AutomationService = AutomationService = AutomationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        git_service_1.GitService,
        patch_generation_service_1.PatchGenerationService,
        repository_understanding_service_1.RepositoryUnderstandingService,
        validation_service_1.ValidationService,
        auto_fix_service_1.AutoFixService,
        content_generation_service_1.ContentGenerationService,
        security_service_1.SecurityService,
        entitlements_service_1.EntitlementsService])
], AutomationService);
//# sourceMappingURL=automation.service.js.map