import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  AutomationRunKind,
  AutomationRunStatus,
  ContentPieceStatus,
  } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
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
    private readonly security: SecurityService,) {}

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

    try {
      const token = this.security.decryptCredentials(repo.accessTokenEncrypted);
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
      const validated = await this.validation.validateRepository(workingDir, context.packageManager);
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

      return this.finishRun(run.id, AutomationRunStatus.AWAITING_REVIEW, steps, {
        branch,
        pullRequestUrl: prUrl,
        filesChanged: changed,
      });
    } catch (error: any) {
      this.logger.error(`Fix run failed for project ${projectId}: ${error.message}`);
      steps.push(this.step('error', error.message, false));
      return this.finishRun(run.id, AutomationRunStatus.FAILED, steps, { error: error.message });
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

      const token = this.security.decryptCredentials(repo.accessTokenEncrypted);
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

      const validated = await this.validation.validateRepository(workingDir, context.packageManager);
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
      this.logger.error(`Content run failed for project ${projectId}: ${error.message}`);
      steps.push(this.step('error', error.message, false));
      return this.finishRun(run.id, AutomationRunStatus.FAILED, steps, { error: error.message });
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

  private parsePatch(raw?: string | null): { fixType: string; proposedValue: string } | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.fixType && parsed?.proposedValue ? parsed : null;
    } catch {
      return null;
    }
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

    const candidates =
      framework === 'static-html'
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
      if (!absolute.startsWith(repoDir)) continue;
      try {
        await fs.access(absolute);
        return absolute;
      } catch {
        // try the next candidate
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
