import { Injectable, Logger } from '@nestjs/common';
import { simpleGit, SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);

  /** Read immutable PR revisions. Never follow arbitrary URLs with the customer's token. */
  async readPullRequestEvidence(token: string, owner: string, repo: string, number: number) {
    const octokit = new Octokit({ auth: token, request: { timeout: 10000 } });
    const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: number });
    const { data: comparison } = await octokit.rest.repos.compareCommitsWithBasehead({ owner, repo, basehead: `${pr.base.sha}...${pr.head.sha}` });
    const baseSha = comparison.merge_base_commit.sha;
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, { owner, repo, pull_number: number, per_page: 100 });
    const read = async (file: string, ref: string): Promise<string | null> => {
      try {
        const { data } = await octokit.rest.repos.getContent({ owner, repo, path: file, ref });
        if (Array.isArray(data) || data.type !== 'file' || !('content' in data) || data.size > 256000) return null;
        return Buffer.from(data.content, 'base64').toString('utf8');
      } catch (error: any) {
        if (error.status === 404) return null;
        throw error;
      }
    };
    const snapshots: { file: string; before: string | null; after: string | null }[] = [];
    for (const file of files.filter(file => /\.(jsx|tsx|html)$/.test(file.filename)).slice(0, 50)) {
      const [before, after] = await Promise.all([read(file.previous_filename || file.filename, baseSha), read(file.filename, pr.head.sha)]);
      snapshots.push({ file: file.filename, before, after });
    }
    const roots = [...new Set(snapshots.filter(file => file.file.includes('/src/')).map(file => file.file.split('/src/')[0]))];
    const routers: { file: string; content: string }[] = [];
    for (const root of roots) {
      for (const name of ['router', 'routes', 'App']) {
        for (const ext of ['jsx', 'tsx']) {
          const file = `${root}/src/${name}.${ext}`;
          const content = await read(file, pr.head.sha);
          if (content) routers.push({ file, content });
        }
      }
    }
    return { state: pr.merged_at ? 'MERGED' : pr.state === 'closed' ? 'CLOSED' : 'OPEN', mergedAt: pr.merged_at,
      baseSha, headSha: pr.head.sha, files: snapshots, routers };
  }

  /**
   * Clones a repository to a local temporary directory.
   */
  async cloneRepository(repoUrl: string, token: string, _repoName: string): Promise<string> {
    // Retry only transient transport failures. Authentication, permission, and missing-repo
    // errors should fail immediately so users can correct their GitHub connection.
    const maxAttempts = 3;
    const url = new URL(repoUrl);
    url.username = 'x-access-token';
    url.password = token.trim();
    const git: SimpleGit = simpleGit({ timeout: { block: 120000 } });

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'growthx-auto-engineer-'));
      this.logger.log(`Cloning ${repoUrl} to ${targetDir} (attempt ${attempt}/${maxAttempts})...`);
      try {
        await git.clone(url.toString(), targetDir, ['--depth', '1', '--single-branch', '--no-tags']);
        return targetDir;
      } catch (error) {
        await this.cleanupRepository(targetDir);
        const message = error instanceof Error ? error.message : String(error);
        const transientNetworkFailure =
          /Failed to connect|Could not resolve host|Couldn't connect to server|Connection timed out|Connection reset|Connection refused|Operation timed out|Recv failure|TLS connection was non-properly terminated|HTTP\/\/[12].*\b5\d\d\b|\bHTTP 5\d\d\b|early EOF/i.test(message);

        if (!transientNetworkFailure || attempt === maxAttempts) {
          throw error;
        }

        const delayMs = 1000 * (2 ** (attempt - 1));
        this.logger.warn(`Transient GitHub network error while cloning (attempt ${attempt}/${maxAttempts}); retrying in ${delayMs}ms.`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('Repository clone failed after retry attempts.');
  }

  /** Remove only workspaces this service created under the host temp directory. */
  async cleanupRepository(repoDir: string): Promise<void> {
    const resolved = path.resolve(repoDir);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) ||
        !path.basename(resolved).startsWith('growthx-auto-engineer-')) {
      throw new Error('Refusing to remove a directory outside the Fix Engine temporary workspace.');
    }
    await fs.rm(resolved, { recursive: true, force: true });
  }

  /**
   * Checks a token against GitHub before it is saved: that it is accepted, that it can
   * see the repository, and that it can write to it. Returns the repository's real
   * default branch. A failure is worded for the person who pasted the token.
   */
  async verifyAccess(
    token: string,
    owner: string,
    repo: string,
  ): Promise<{ defaultBranch: string; canPush: boolean }> {
    const octokit = new Octokit({ auth: token, request: { timeout: 30000 } });
    try {
      const { data } = await octokit.rest.repos.get({ owner, repo });
      return { defaultBranch: data.default_branch, canPush: Boolean(data.permissions?.push) };
    } catch (error: any) {
      if (error?.status === 401) {
        throw new Error('GitHub did not accept this token. Check it was copied completely, and has not expired or been revoked.');
      }
      if (error?.status === 404 || error?.status === 403) {
        throw new Error(`This token cannot see ${owner}/${repo}. Check the owner and repository name, and that the token was given access to this repository.`);
      }
      throw new Error(`Could not reach GitHub to check the token (${error?.message ?? 'unknown error'}). Try again.`);
    }
  }

  /**
   * Creates a new feature branch for the automated fix.
   */
  async createFeatureBranch(repoDir: string, branchName: string): Promise<void> {
    const git: SimpleGit = simpleGit(repoDir);
    this.logger.log(`Checking out new branch: ${branchName}`);
    await git.checkoutLocalBranch(branchName);
  }

  /**
   * Commits the changes and pushes to the remote.
   */
  async commitAndPush(repoDir: string, branchName: string, commitMessage: string): Promise<void> {
    const git: SimpleGit = simpleGit(repoDir);
    
    this.logger.log(`Committing changes: "${commitMessage}"`);
    await git.add('.');
    
    // Setup git config for commit
    await git.addConfig('user.name', 'GrowthX AI Engineer');
    await git.addConfig('user.email', 'engineer@growthx.ai');
    
    await git.commit(commitMessage);
    
    this.logger.log(`Pushing branch ${branchName} to remote...`);
    await git.push('origin', branchName);
  }

  /**
   * Opens a Pull Request using GitHub API.
   */
  async createPullRequest(
    token: string,
    owner: string,
    repo: string,
    title: string,
    headBranch: string,
    baseBranch: string,
    body: string,
    draft = true,
  ): Promise<string> {
    const octokit = new Octokit({ auth: token });
    
    this.logger.log(`Creating PR on ${owner}/${repo} from ${headBranch} to ${baseBranch}`);
    const response = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      head: headBranch,
      base: baseBranch,
      body,
      draft,
    });
    
    return response.data.html_url;
  }

  /**
   * Safely rolls back an automated pull request:
   * - If the PR is still open (unmerged), closes it cleanly without touching the default branch.
   * - If the PR is already merged, creates a revert branch from the default branch,
   *   runs `git revert` against the merge commit, pushes it, and opens a Revert Pull Request.
   */
  async rollbackPullRequest(
    token: string,
    owner: string,
    repo: string,
    pullNumber: number,
    defaultBranch: string,
    runId: string,
  ): Promise<{
    action: 'CLOSED_UNMERGED' | 'REVERT_PR_OPENED';
    revertPullRequestUrl?: string;
    revertBranch?: string;
    message: string;
  }> {
    const octokit = new Octokit({ auth: token });
    const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: pullNumber });

    if (!pr.merged) {
      if (pr.state === 'open') {
        await octokit.rest.issues
          .createComment({
            owner,
            repo,
            issue_number: pullNumber,
            body: 'Closed via GrowthX Fix Engine 1-click rollback before merge.',
          })
          .catch(() => null);
        await octokit.rest.pulls.update({
          owner,
          repo,
          pull_number: pullNumber,
          state: 'closed',
        });
      }
      if (pr.head?.ref && pr.head.ref !== defaultBranch) {
        await octokit.rest.git
          .deleteRef({ owner, repo, ref: `heads/${pr.head.ref}` })
          .catch(() => null);
      }
      return {
        action: 'CLOSED_UNMERGED',
        message: `Closed unmerged pull request #${pullNumber} without altering ${defaultBranch}.`,
      };
    }

    const mergeSha = pr.merge_commit_sha;
    if (!mergeSha) {
      throw new Error(`Pull request #${pullNumber} is merged but has no merge commit SHA to revert.`);
    }

    const baseBranch = pr.base?.ref || defaultBranch;
    const revertBranch = `revert/fix-engine-${runId.slice(0, 8)}-${Date.now()}`;
    const repoUrl = `https://github.com/${owner}/${repo}.git`;
    const repoDir = await this.cloneRepository(repoUrl, token, repo);

    try {
      const git: SimpleGit = simpleGit(repoDir);
      await git.checkout(baseBranch);
      await git.checkoutLocalBranch(revertBranch);
      await git.addConfig('user.name', 'GrowthX AI Engineer');
      await git.addConfig('user.email', 'engineer@growthx.ai');

      try {
        // Merge commits require -m 1 to select the mainline parent.
        await git.raw(['revert', '-m', '1', '--no-edit', mergeSha]);
      } catch {
        // Squash or rebase merges have a single parent.
        await git.raw(['revert', '--abort']).catch(() => null);
        await git.raw(['revert', '--no-edit', mergeSha]);
      }

      await git.push('origin', revertBranch);
      const revertPullRequestUrl = await this.createPullRequest(
        token,
        owner,
        repo,
        `Revert "${pr.title}" (#${pullNumber})`,
        revertBranch,
        baseBranch,
        `Automated 1-click rollback created by GrowthX Fix Engine for PR #${pullNumber} (commit \`${mergeSha.slice(0, 10)}\`).`,
        false,
      );

      return {
        action: 'REVERT_PR_OPENED',
        revertPullRequestUrl,
        revertBranch,
        message: `Opened revert pull request for merged PR #${pullNumber}.`,
      };
    } finally {
      await this.cleanupRepository(repoDir);
    }
  }
}

