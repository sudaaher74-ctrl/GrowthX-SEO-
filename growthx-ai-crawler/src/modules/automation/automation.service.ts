import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import {
  AutomationRunKind,
  AutomationRunStatus,
  ContentPieceStatus,
  } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { ImpactService } from '../impact/impact.service';
import { changeClassForFixType } from '../impact/change-class';
import { GitService } from '../autonomous-engineer/agents/git/git.service';
import { PatchGenerationService } from '../autonomous-engineer/agents/patch-generation/patch-generation.service';
import { RepositoryUnderstandingService } from '../autonomous-engineer/agents/repository-understanding/repository-understanding.service';
import { ValidationService } from '../autonomous-engineer/agents/validation/validation.service';
import { AutoFixService } from '../ai/auto-fix.service';
import { SecurityService } from '../security/security.service';
import { ContentGenerationService } from './content-generation.service';

interface RunStep {
  at: string;
  step: string;
  detail?: string;
  ok: boolean;
}

/** How many fixes one run will attempt, so a PR stays reviewable. */
const MAX_FIXES_PER_RUN = 25;

/** Fix types whose proposedValue is a display label, not the value to apply. */
const JSON_LD_FIX_TYPES = new Set(['FAQ_SCHEMA', 'PRODUCT_SCHEMA', 'ORGANIZATION_SCHEMA', 'BREADCRUMB_SCHEMA']);

/** Page file extensions the resolver will match, most specific first. */
const PAGE_EXTENSIONS = ['tsx', 'jsx', 'ts', 'js', 'mdx'] as const;

/** `page.tsx` and friends, the App Router's route entry point. */
const PAGE_FILE = new RegExp(`^page\\.(${PAGE_EXTENSIONS.join('|')})$`);

/** Never treated as an application workspace. */
const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', 'public', 'static']);

/** Bounds the App Router walk on a pathological tree. */
const MAX_ROUTE_DEPTH = 12;

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly git: GitService,
    private readonly patcher: PatchGenerationService,
    private readonly repoUnderstanding: RepositoryUnderstandingService,
    private readonly validation: ValidationService,
    private readonly autoFix: AutoFixService,
    private readonly content: ContentGenerationService,
    private readonly security: SecurityService,
    /**
     * Optional so the fix engine still runs where the impact module is not
     * wired in. A run that cannot record its interventions is worse off, not
     * broken — but it is worth knowing about, so it warns.
     */
    @Optional() private readonly impact?: ImpactService,
  ) {}

  // ───────────────────────────────────────────────── repository connection

  /**
   * Stores how to reach a client's site code. The token is encrypted at rest
   * and never returned — every read goes through `decryptToken`.
   */
  async connectRepository(
    projectId: string,
    input: {
      owner: string;
      name: string;
      accessToken: string;
      defaultBranch?: string;
      framework?: string;
      contentDir?: string;
      autoMerge?: boolean;
    },
  ) {
    if (!input.owner || !input.name || !input.accessToken) {
      throw new BadRequestException('owner, name and accessToken are required.');
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

  async getRepository(projectId: string) {
    const repo = await this.prisma.siteRepository.findUnique({ where: { projectId } });
    return repo ? this.redact(repo) : null;
  }

  /** The token must never leave the server. */
  private redact<T extends { accessTokenEncrypted: string }>(repo: T) {
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
  async runFixes(projectId: string, organizationId: string, issueIds?: string[]) {

    const repo = await this.requireRepository(projectId);
    const run = await this.startRun(repo.id, projectId, AutomationRunKind.FIXES);
    const steps: RunStep[] = [];
    let workingDir = '';

    // Hoisted so the catch can strip it out of a git error.
    let token = '';

    try {
      token = this.security.decryptCredentials(repo.accessTokenEncrypted);
      const issues = await this.selectIssues(projectId, issueIds);

      if (issues.length === 0) {
        return this.finishRun(run.id, AutomationRunStatus.FAILED, steps, {
          error: 'No open issues with a generated fix. Generate fixes first.',
        });
      }

      workingDir = await this.git.cloneRepository(
        `https://github.com/${repo.owner}/${repo.name}.git`,
        token,
        repo.name,
      );
      steps.push(this.step('clone', `${repo.owner}/${repo.name}`, true));

      const context = await this.repoUnderstanding.analyzeRepository(workingDir);
      steps.push(this.step('analyze', `package manager: ${context.packageManager}`, true));

      const branch = `growthx-ai/fixes-${Date.now()}`;
      await this.git.createFeatureBranch(workingDir, branch);
      steps.push(this.step('branch', branch, true));

      const changed: string[] = [];
      const skipped: string[] = [];
      /** What was applied to which page, for the intervention ledger. */
      const applied: { url: string; fixType: string; issueType: string }[] = [];

      for (const issue of issues) {
        // Two different writers use recommendedFixPatch. The crawl's analysis
        // stores prose there, which cannot be applied; only AutoFixService
        // writes the {fixType, proposedValue} JSON this needs. Nothing called
        // it before a run, so every issue arrived unusable and every run
        // reported "no usable patch" while doing nothing. Generate it here
        // when it is missing, rather than requiring the caller to know.
        let patch = this.parsePatch(issue.aiRecommendation?.recommendedFixPatch);
        // Whether `patch` came from the DB as-is, rather than being generated
        // fresh just now. A cached patch can predate a fix-generation or
        // patcher change (e.g. a schema issue that used to be mis-typed as
        // META_TITLE) and keep failing forever on stale data even after the
        // bug that produced it is fixed — so a failing cached patch gets one
        // regenerate-and-retry before being reported as unfixable.
        let patchIsCached = Boolean(patch);
        if (!patch) {
          try {
            await this.autoFix.generateFixPatch(issue.id, organizationId);
            const refreshed = await this.prisma.aIRecommendation.findUnique({
              where: { issueId: issue.id },
              select: { recommendedFixPatch: true },
            });
            patch = this.parsePatch(refreshed?.recommendedFixPatch);
          } catch (error: any) {
            skipped.push(
              `${issue.issueType}: could not generate a fix (${this.describeRunFailure(error)})`,
            );
            continue;
          }
        }
        if (!patch) {
          skipped.push(`${issue.issueType}: no usable patch could be generated`);
          continue;
        }

        const attemptApply = async (p: NonNullable<typeof patch>) => {
          // An orphan page is fixed by linking to it from elsewhere, not by
          // editing the page itself — so INTERNAL_LINKING patches a different
          // file (the homepage) than every other fix type.
          const isInternalLinking = p.fixType === 'INTERNAL_LINKING';
          const attemptTarget = isInternalLinking
            ? await this.resolveInternalLinkSource(workingDir, issue.affectedUrl, repo.framework)
            : await this.resolveTargetFile(workingDir, issue.affectedUrl, repo.framework);
          if (!attemptTarget) {
            return { target: null, outcome: { applied: false, reason: 'no matching file in the repo' } };
          }

          // JSON-LD fix types carry only a human label ("Product JSON-LD") in
          // proposedValue for display; the real object lives inside the
          // <script> tag in codeSnippet. The patcher needs the real object.
          const patchValue = JSON_LD_FIX_TYPES.has(p.fixType)
            ? this.extractJsonLd(p.codeSnippet) ?? p.proposedValue
            : p.proposedValue;

          const outcome = await this.patcher.applyFix(attemptTarget, p.fixType, patchValue, {
            href: isInternalLinking ? issue.affectedUrl : undefined,
          });
          return { target: attemptTarget, outcome };
        };

        let { target, outcome } = await attemptApply(patch);

        if (!outcome.applied && patchIsCached) {
          try {
            await this.autoFix.generateFixPatch(issue.id, organizationId);
            const refreshed = await this.prisma.aIRecommendation.findUnique({
              where: { issueId: issue.id },
              select: { recommendedFixPatch: true },
            });
            const retried = this.parsePatch(refreshed?.recommendedFixPatch);
            if (retried) {
              patch = retried;
              patchIsCached = false;
              ({ target, outcome } = await attemptApply(patch));
            }
          } catch {
            // Keep the original (cached-patch) outcome — it is still more
            // informative than the regeneration failure.
          }
        }

        if (!target) {
          skipped.push(`${issue.issueType} (${issue.affectedUrl}): no matching file in the repo`);
          continue;
        }

        if (outcome.applied) {
          changed.push(path.relative(workingDir, target));
          if (issue.affectedUrl) {
            applied.push({
              url: issue.affectedUrl,
              fixType: patch.fixType,
              issueType: String(issue.issueType),
            });
          }
        } else {
          skipped.push(`${issue.issueType}: ${outcome.reason ?? 'not applied'}`);
        }
      }

      steps.push(this.step('patch', `${changed.length} file(s) changed, ${skipped.length} skipped`, true));

      if (changed.length === 0) {
        return this.finishRun(run.id, AutomationRunStatus.FAILED, steps, {
          error: `Nothing could be applied. ${skipped.slice(0, 5).join('; ')}`,
        });
      }

      // A build that fails is never pushed — a broken site is worse than an
      // unfixed one.
      const validated = await this.validation.validateRepository(workingDir, context.packageManager, changed);
      steps.push(this.step('validate', validated.success ? 'build passed' : 'build failed', validated.success));

      if (!validated.success) {
        return this.finishRun(run.id, AutomationRunStatus.FAILED, steps, {
          error: `Validation failed, nothing was pushed. ${String(validated.output).slice(0, 400)}`,
          filesChanged: changed,
        });
      }

      await this.git.commitAndPush(workingDir, branch, `fix(seo): apply ${changed.length} automated SEO fixes`);
      steps.push(this.step('push', branch, true));

      const prUrl = await this.git.createPullRequest(
        token,
        repo.owner,
        repo.name,
        `SEO fixes: ${changed.length} file(s)`,
        branch,
        repo.defaultBranch,
        this.fixPrBody(issues, changed, skipped),
      );
      steps.push(this.step('pull_request', prUrl, true));

      await this.recordInterventions(projectId, run.id, prUrl, applied);

      return this.finishRun(run.id, AutomationRunStatus.AWAITING_REVIEW, steps, {
        branch,
        pullRequestUrl: prUrl,
        filesChanged: changed,
      });
    } catch (error: any) {
      const reason = this.describeRunFailure(error, token);
      this.logger.error(`Fix run failed for project ${projectId}: ${reason}`);
      steps.push(this.step('error', reason, false));
      return this.finishRun(run.id, AutomationRunStatus.FAILED, steps, { error: reason });
    } finally {
      await this.cleanup(workingDir);
    }
  }

  /**
   * Commits drafted content pages into the client's repository and opens a PR.
   * Only DRAFTED pieces are shipped — a plan without a written body is skipped.
   */
  async runContent(projectId: string, organizationId: string, pieceIds?: string[]) {

    const repo = await this.requireRepository(projectId);
    const run = await this.startRun(repo.id, projectId, AutomationRunKind.CONTENT);
    const steps: RunStep[] = [];
    let workingDir = '';

    // Hoisted so the catch can strip it out of a git error.
    let token = '';

    try {
      const pieces = await this.prisma.contentPiece.findMany({
        where: {
          projectId,
          status: ContentPieceStatus.DRAFTED,
          ...(pieceIds?.length ? { id: { in: pieceIds } } : {}),
        },
      });

      if (pieces.length === 0) {
        return this.finishRun(run.id, AutomationRunStatus.FAILED, steps, {
          error: 'No drafted content to publish. Draft a planned piece first.',
        });
      }

      token = this.security.decryptCredentials(repo.accessTokenEncrypted);
      workingDir = await this.git.cloneRepository(
        `https://github.com/${repo.owner}/${repo.name}.git`,
        token,
        repo.name,
      );
      steps.push(this.step('clone', `${repo.owner}/${repo.name}`, true));

      const context = await this.repoUnderstanding.analyzeRepository(workingDir);
      const contentDir = repo.contentDir ?? (await this.guessContentDir(workingDir));
      steps.push(this.step('analyze', `content directory: ${contentDir}`, true));

      const branch = `growthx-ai/content-${Date.now()}`;
      await this.git.createFeatureBranch(workingDir, branch);

      const changed: string[] = [];
      for (const piece of pieces) {
        const relative = path.join(contentDir, `${piece.slug}.md`);
        const absolute = path.join(workingDir, relative);
        await fs.mkdir(path.dirname(absolute), { recursive: true });
        await fs.writeFile(
          absolute,
          this.content.toMarkdownFile({
            title: piece.title,
            metaDescription: piece.metaDescription,
            body: piece.body ?? '',
            targetQuery: piece.targetQuery,
          }),
          'utf8',
        );
        changed.push(relative);

        await this.prisma.contentPiece.update({
          where: { id: piece.id },
          data: { status: ContentPieceStatus.COMMITTED, filePath: relative, runId: run.id },
        });
      }
      steps.push(this.step('write', `${changed.length} page(s)`, true));

      const validated = await this.validation.validateRepository(workingDir, context.packageManager, changed);
      steps.push(this.step('validate', validated.success ? 'build passed' : 'build failed', validated.success));

      if (!validated.success) {
        return this.finishRun(run.id, AutomationRunStatus.FAILED, steps, {
          error: `Validation failed, nothing was pushed. ${String(validated.output).slice(0, 400)}`,
          filesChanged: changed,
        });
      }

      await this.git.commitAndPush(workingDir, branch, `content: add ${changed.length} SEO page(s)`);
      const prUrl = await this.git.createPullRequest(
        token,
        repo.owner,
        repo.name,
        `New content: ${changed.length} page(s)`,
        branch,
        repo.defaultBranch,
        this.contentPrBody(pieces, changed),
      );
      steps.push(this.step('pull_request', prUrl, true));

      return this.finishRun(run.id, AutomationRunStatus.AWAITING_REVIEW, steps, {
        branch,
        pullRequestUrl: prUrl,
        filesChanged: changed,
      });
    } catch (error: any) {
      const reason = this.describeRunFailure(error, token);
      this.logger.error(`Content run failed for project ${projectId}: ${reason}`);
      steps.push(this.step('error', reason, false));
      return this.finishRun(run.id, AutomationRunStatus.FAILED, steps, { error: reason });
    } finally {
      await this.cleanup(workingDir);
    }
  }

  async listRuns(projectId: string) {
    return this.prisma.automationRun.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 25,
    });
  }

  // ─────────────────────────────────────────────────────────────── helpers

  private async requireRepository(projectId: string) {
    const repo = await this.prisma.siteRepository.findUnique({ where: { projectId } });
    if (!repo) {
      throw new BadRequestException(
        'Connect this client\'s repository first — the agent needs somewhere to write the changes.',
      );
    }
    return repo;
  }

  private async selectIssues(projectId: string, issueIds?: string[]) {
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

  /**
   * Files every applied fix in the intervention ledger.
   *
   * `shippedAt` is deliberately left null. A pull request is not production, and
   * the measurement clock has to start when the change reached users, not when
   * it was proposed — a PR that sits unreviewed for three weeks would otherwise
   * have three weeks of unrelated citation movement counted as its "after".
   * ImpactService.markShipped sets it when the PR merges.
   *
   * Recording is best-effort: a ledger write must not fail a fix run whose PR
   * is already open, because the customer's change is real either way and the
   * run's own record already holds the PR URL.
   */
  private async recordInterventions(
    projectId: string,
    runId: string,
    pullRequestUrl: string,
    applied: { url: string; fixType: string; issueType: string }[],
  ): Promise<void> {
    if (applied.length === 0) return;
    if (!this.impact) {
      this.logger.warn(
        `${applied.length} fix(es) shipped to a PR without being recorded: the impact ledger is not wired in, ` +
          'so their effect on citation cannot be measured later.',
      );
      return;
    }

    for (const fix of applied) {
      try {
        await this.impact.recordIntervention({
          projectId,
          url: fix.url,
          changeClass: changeClassForFixType(fix.fixType),
          summary: `${fix.issueType}: ${fix.fixType}`,
          automationRunId: runId,
          pullRequestUrl,
        });
      } catch (error: any) {
        this.logger.warn(
          `Could not record intervention for ${fix.url} (${fix.fixType}): ${error.message}`,
        );
      }
    }
  }

  private parsePatch(raw?: string | null): { fixType: string; proposedValue: string; codeSnippet?: string } | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.fixType && parsed?.proposedValue ? parsed : null;
    } catch {
      return null;
    }
  }

  /** Pulls the raw JSON-LD object out of a `<script type="application/ld+json">` code snippet. */
  private extractJsonLd(codeSnippet?: string): string | null {
    if (!codeSnippet) return null;
    const match = codeSnippet.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i);
    return match ? match[1].trim() : null;
  }

  /**
   * Maps a crawled URL onto a file in the repository.
   *
   * Returns null rather than guessing when nothing matches — writing to the
   * wrong file is far worse than skipping a fix.
   */
  private async resolveTargetFile(
    repoDir: string,
    url: string,
    framework: string,
  ): Promise<string | null> {
    let segments: string[];
    try {
      segments = new URL(url).pathname.split('/').filter(Boolean);
    } catch {
      return null;
    }

    const slug = segments[segments.length - 1] ?? 'index';
    const routePath = segments.join('/');

    // A client's site is often one workspace inside a monorepo, so the app is
    // not necessarily at the clone root.
    const appRoots = await this.candidateAppRoots(repoDir);

    const htmlCandidates = [
      `${routePath || 'index'}.html`,
      path.join(routePath, 'index.html'),
      `${slug}.html`,
    ];

    if (framework === 'static-html') {
      for (const appRoot of appRoots) {
        const found = await this.firstExisting(repoDir, path.join(repoDir, appRoot), htmlCandidates);
        if (found) return found;
      }
      return null;
    }

    // Two passes, ordered by how well the match is evidenced rather than by
    // directory order: a real route in the last workspace still beats a bare
    // index.html in the first. Without this, a monorepo's `admin/index.html`
    // shadowed the Next.js page that actually serves `/`.
    for (const appRoot of appRoots) {
      const base = path.join(repoDir, appRoot);

      // App Router needs a walk rather than a join: route groups `(marketing)`
      // and parallel routes `@modal` sit in the path on disk but not in the
      // URL, so `/` can live at `src/app/(public)/page.jsx`.
      for (const appDir of ['src/app', 'app']) {
        const resolved = await this.findAppRouterPage(repoDir, path.join(base, appDir), segments);
        if (resolved) return resolved;
      }

      const pagesRouter: string[] = [];
      for (const ext of PAGE_EXTENSIONS) {
        pagesRouter.push(path.join('src/pages', `${routePath || 'index'}.${ext}`));
        pagesRouter.push(path.join('pages', `${routePath || 'index'}.${ext}`));
      }
      const found = await this.firstExisting(repoDir, base, pagesRouter);
      if (found) return found;
    }

    for (const appRoot of appRoots) {
      const found = await this.firstExisting(repoDir, path.join(repoDir, appRoot), htmlCandidates);
      if (found) return found;
    }

    return null;
  }

  /**
   * Finds the file to add an internal link *from*, for an orphan page.
   *
   * The homepage is the one page on any site guaranteed to already be
   * crawled, so it is the safe, unambiguous place to add the link — picking
   * some other "related" page would mean guessing, and a wrong guess here
   * means a link inserted into an unrelated customer page.
   */
  private async resolveInternalLinkSource(
    repoDir: string,
    affectedUrl: string,
    framework: string,
  ): Promise<string | null> {
    let origin: string;
    try {
      origin = new URL(affectedUrl).origin;
    } catch {
      return null;
    }

    const homepageUrl = `${origin}/`;
    const normalizedAffected = affectedUrl.endsWith('/') ? affectedUrl : `${affectedUrl}/`;
    // The homepage cannot fix its own orphan status by linking to itself.
    if (normalizedAffected === homepageUrl) return null;

    return this.resolveTargetFile(repoDir, homepageUrl, framework);
  }

  /**
   * Turns a run failure into something safe to store and useful to read.
   *
   * The clone URL carries the customer's access token, and git quotes the
   * remote back on failure — "could not read Password for
   * 'https://<token>@github.com'" — so the raw message would put a live
   * credential in the run record, in the logs and on the dashboard. Redact
   * first, then translate the failures an operator can act on.
   */
  private describeRunFailure(error: any, token?: string): string {
    let message = String(error?.message ?? error ?? 'Unknown error');

    if (token && token.length >= 8) {
      message = message.split(token).join('[REDACTED]');
    }
    // Any other credential embedded in a URL, and bearer-shaped tokens.
    message = message
      .replace(/\/\/[^/@\s]+@/g, '//[REDACTED]@')
      .replace(/\b(gh[pousr]|github_pat)_[A-Za-z0-9_]{8,}/g, '[REDACTED]');

    if (/spawn git ENOENT/i.test(message)) {
      return 'git is not available on the server, so the repository could not be cloned. This is a deployment problem, not a problem with your repository.';
    }
    if (/could not read (Password|Username)|Authentication failed|invalid username or password/i.test(message)) {
      return 'GitHub rejected the access token. Check that it has not expired and still grants Contents and Pull requests read and write access.';
    }
    if (/Repository not found|remote: Not Found|fatal: repository .* not found/i.test(message)) {
      return 'GitHub could not find that repository. Check the owner and repository name, and that the token can see it.';
    }
    if (/\b403\b|Resource not accessible|permission denied/i.test(message)) {
      return 'GitHub refused the request. The token is missing Contents or Pull requests write access for this repository.';
    }

    return message;
  }

  /** Resolves the first candidate that exists, without escaping the clone. */
  private async firstExisting(
    repoDir: string,
    base: string,
    candidates: string[],
  ): Promise<string | null> {
    for (const candidate of candidates) {
      const absolute = path.join(base, candidate);
      // Never escape the clone directory, whatever the URL contained.
      if (!absolute.startsWith(repoDir)) continue;
      try {
        await fs.access(absolute);
        const dirEntries = await fs.readdir(path.dirname(absolute));
        if (!dirEntries.includes(path.basename(absolute))) continue;
        return absolute;
      } catch {
        // try the next candidate
      }
    }
    return null;
  }

  /**
   * The clone root, plus any first-level workspace that holds a web app.
   * Ordered so the root always wins a tie.
   */
  private async candidateAppRoots(repoDir: string): Promise<string[]> {
    const roots = [''];
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(repoDir, { withFileTypes: true });
    } catch {
      return roots;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
      for (const marker of ['src/app', 'app', 'src/pages', 'pages', 'index.html']) {
        try {
          await fs.access(path.join(repoDir, entry.name, marker));
          roots.push(entry.name);
          break;
        } catch {
          // keep looking
        }
      }
    }
    return roots;
  }

  /**
   * Walks an App Router tree for the page serving `segments`, ignoring route
   * groups and parallel-route folders. An exact route wins; a dynamic segment
   * (`[slug]`) is only accepted when nothing matches literally.
   */
  private async findAppRouterPage(
    repoDir: string,
    appDir: string,
    segments: string[],
  ): Promise<string | null> {
    if (!appDir.startsWith(repoDir)) return null;
    try {
      const stat = await fs.stat(appDir);
      if (!stat.isDirectory()) return null;
    } catch {
      return null;
    }

    const exact = await this.walkRoute(appDir, segments, false);
    return exact ?? (await this.walkRoute(appDir, segments, true));
  }

  private async walkRoute(
    dir: string,
    remaining: string[],
    allowDynamic: boolean,
    depth = 0,
  ): Promise<string | null> {
    if (depth > MAX_ROUTE_DEPTH) return null;

    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }

    if (remaining.length === 0) {
      for (const entry of entries) {
        if (entry.isFile() && PAGE_FILE.test(entry.name)) return path.join(dir, entry.name);
      }
    }

    const passthrough = entries.filter(
      (e) => e.isDirectory() && (/^\(.+\)$/.test(e.name) || e.name.startsWith('@')),
    );
    for (const entry of passthrough) {
      const found = await this.walkRoute(path.join(dir, entry.name), remaining, allowDynamic, depth + 1);
      if (found) return found;
    }

    if (remaining.length === 0) return null;
    const [head, ...tail] = remaining;

    const literal = entries.find((e) => e.isDirectory() && e.name === head);
    if (literal) {
      const found = await this.walkRoute(path.join(dir, head), tail, allowDynamic, depth + 1);
      if (found) return found;
    }

    if (allowDynamic) {
      const dynamic = entries.filter((e) => e.isDirectory() && /^\[.+\]$/.test(e.name));
      for (const entry of dynamic) {
        // A catch-all consumes the rest of the path.
        const rest = /^\[\.\.\./.test(entry.name) ? [] : tail;
        const found = await this.walkRoute(path.join(dir, entry.name), rest, allowDynamic, depth + 1);
        if (found) return found;
      }
    }

    return null;
  }

  /** Common content folders, checked in order of popularity. */
  private async guessContentDir(repoDir: string): Promise<string> {
    for (const dir of ['content/blog', 'content/posts', 'content', 'src/content', 'posts', '_posts']) {
      try {
        await fs.access(path.join(repoDir, dir));
        return dir;
      } catch {
        // keep looking
      }
    }
    return 'content/blog';
  }

  private fixPrBody(issues: any[], changed: string[], skipped: string[]): string {
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

  private contentPrBody(pieces: any[], changed: string[]): string {
    return [
      '## New content by GrowthX AI',
      '',
      `Adds **${changed.length}** page(s), written against queries where competitors are currently cited.`,
      '',
      ...pieces.map(
        (p) => `- **${p.title}** — targets \`${p.targetQuery ?? 'n/a'}\` (${p.generatedByModel ?? 'unknown model'})`,
      ),
      '',
      '> AI-written copy. Read it before merging — it is going on a client site.',
    ].join('\n');
  }

  private step(step: string, detail: string, ok: boolean): RunStep {
    return { at: new Date().toISOString(), step, detail, ok };
  }

  private async startRun(repositoryId: string, projectId: string, kind: AutomationRunKind) {
    return this.prisma.automationRun.create({
      data: { repositoryId, projectId, kind, status: AutomationRunStatus.RUNNING },
    });
  }

  private async finishRun(
    runId: string,
    status: AutomationRunStatus,
    steps: RunStep[],
    extra: { error?: string; branch?: string; pullRequestUrl?: string; filesChanged?: string[] } = {},
  ) {
    return this.prisma.automationRun.update({
      where: { id: runId },
      data: {
        status,
        steps: steps as any,
        finishedAt: new Date(),
        error: extra.error ?? null,
        branch: extra.branch ?? null,
        pullRequestUrl: extra.pullRequestUrl ?? null,
        filesChanged: extra.filesChanged ?? [],
      },
    });
  }

  /** Clones contain a customer's source; remove them as soon as we are done. */
  private async cleanup(dir: string) {
    if (!dir) return;
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error: any) {
      this.logger.warn(`Could not clean up ${dir}: ${error.message}`);
    }
  }
}
