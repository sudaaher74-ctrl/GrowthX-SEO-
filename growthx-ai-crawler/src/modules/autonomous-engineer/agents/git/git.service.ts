import { Injectable, Logger } from '@nestjs/common';
import { simpleGit, SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const DEFAULT_GIT_BLOCK_TIMEOUT_MS = 300_000;
const TRANSIENT_GIT_ERROR_RE =
  /block timeout reached|operation too slow|connection timed out|could not resolve|failed to connect|rpc failed|early eof|gnutls|ssl_error_syscall|recv failure|timed out|unable to access/i;

function resolveGitBlockTimeoutMs(): number {
  const raw = Number(process.env.GIT_CLONE_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 30_000 && raw <= 1_800_000) {
    return Math.floor(raw);
  }
  return DEFAULT_GIT_BLOCK_TIMEOUT_MS;
}

function redactToken(text: string, token?: string): string {
  let out = text.replace(/x-access-token:[^@\s]+@/gi, 'x-access-token:***@');
  if (token?.trim()) {
    out = out.split(token.trim()).join('***');
  }
  return out;
}

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);
  /**
   * Ephemeral per-checkout GitHub authentication held strictly in process memory
   * so credentials are never written to `.git/config` or any file inside the
   * checkout directory accessible to the engineer sandbox or build scripts.
   */
  private readonly checkoutAuth = new Map<string, { origin: string; token: string }>();

  /**
   * Builds a hardened SimpleGit instance for Docker / self-hosted PC servers:
   * - Forces HTTP/1.1 to avoid silent HTTP/2 stalls over Docker bridge / NAT / PPPoE MTUs.
   * - Disables interactive terminal prompts so bad tokens fail fast instead of hanging.
   * - Uses low-speed detection so truly dead sockets fail cleanly and trigger IPv4 retry.
   * - Supplies GitHub credentials exclusively via ephemeral `GIT_CONFIG_*` environment
   *   variables scoped to the verified origin, never embedding tokens in URLs or `.git/config`.
   */
  private createGit(
    baseDir?: string,
    timeoutMs = resolveGitBlockTimeoutMs(),
    auth?: { origin: string; token: string },
  ): SimpleGit {
    const git = simpleGit({
      ...(baseDir ? { baseDir } : {}),
      timeout: { block: timeoutMs },
      config: [
        'http.version=HTTP/1.1',
        'http.postBuffer=524288000',
        'http.lowSpeedLimit=1000',
        'http.lowSpeedTime=90',
        'protocol.version=2',
      ],
    });
    if (typeof git.env === 'function') {
      git.env('GIT_TERMINAL_PROMPT', '0');
      git.env('GCM_INTERACTIVE', 'never');
      if (auth?.token?.trim() && auth.origin) {
        const basic = Buffer.from(`x-access-token:${auth.token.trim()}`, 'utf8').toString('base64');
        const normalizedOrigin = auth.origin.replace(/\/+$/, '');
        git.env('GIT_CONFIG_COUNT', '1');
        git.env('GIT_CONFIG_KEY_0', `http.${normalizedOrigin}/.extraHeader`);
        git.env('GIT_CONFIG_VALUE_0', `Authorization: Basic ${basic}`);
      }
    }
    return git;
  }

  private formatGitError(operation: 'clone' | 'push', repoLabel: string, error: unknown, token?: string): Error {
    const raw = redactToken(error instanceof Error ? error.message : String(error ?? 'Unknown git error'), token);
    if (/authentication failed|could not read username|invalid username or password|returned error:\s*40[13]/i.test(raw)) {
      return new Error(
        `GitHub rejected the saved access token during ${operation} for ${repoLabel}. Reconnect the repository in Fix Engine with a valid token that has repo write access.`,
      );
    }
    if (/block timeout reached|operation too slow|timed out/i.test(raw)) {
      return new Error(
        `GitHub ${operation} timed out for ${repoLabel} on the server. Check outbound internet/DNS/firewall access to github.com from the worker container (or set GIT_FORCE_IPV4=true / higher GIT_CLONE_TIMEOUT_MS in .env and restart worker).`,
      );
    }
    return new Error(`GitHub ${operation} failed for ${repoLabel}: ${raw}`);
  }

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
   * Passes `--progress` so Git streams progress output to stderr in non-TTY Docker
   * containers (preventing false `block timeout reached` kills on active clones) and
   * automatically retries once with `--ipv4` if IPv6/NAT stalls on a self-hosted PC.
   */
  async cloneRepository(repoUrl: string, token: string, _repoName: string): Promise<string> {
    // Strip any credentials from the remote URL so `.git/config` inside the
    // checkout never stores access tokens. Authentication is supplied solely via
    // ephemeral origin-scoped `GIT_CONFIG_*` environment variables.
    const cleanUrl = new URL(repoUrl);
    cleanUrl.username = '';
    cleanUrl.password = '';
    const trimmedToken = token.trim();
    const auth = trimmedToken ? { origin: cleanUrl.origin, token: trimmedToken } : undefined;

    const forceIpv4 = process.env.GIT_FORCE_IPV4 === 'true';
    const baseArgs = ['--depth', '1', '--single-branch', '--no-tags', '--progress'];
    const attempts: string[][] = forceIpv4
      ? [[...baseArgs, '--ipv4']]
      : [baseArgs, [...baseArgs, '--ipv4']];

    let lastError: unknown;
    for (let i = 0; i < attempts.length; i++) {
      const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'growthx-auto-engineer-'));
      const args = attempts[i];
      const git = this.createGit(undefined, resolveGitBlockTimeoutMs(), auth);

      this.logger.log(
        `Cloning ${cleanUrl.toString()} to ${targetDir}${args.includes('--ipv4') ? ' (IPv4)' : ''} (attempt ${i + 1}/${attempts.length})...`,
      );

      try {
        await git.clone(cleanUrl.toString(), targetDir, args);
        if (auth) {
          this.checkoutAuth.set(path.resolve(targetDir), auth);
        }
        return targetDir;
      } catch (error) {
        lastError = error;
        await this.cleanupRepository(targetDir).catch(() => null);
        const msg = redactToken(error instanceof Error ? error.message : String(error), token);
        const canRetry = i + 1 < attempts.length && TRANSIENT_GIT_ERROR_RE.test(msg);
        if (canRetry) {
          this.logger.warn(`Clone of ${cleanUrl.toString()} stalled (${msg}); retrying over IPv4...`);
          continue;
        }
        throw this.formatGitError('clone', cleanUrl.toString(), error, token);
      }
    }

    throw this.formatGitError('clone', cleanUrl.toString(), lastError, token);
  }

  /** Remove only workspaces this service created under the host temp directory. */
  async cleanupRepository(repoDir: string): Promise<void> {
    const resolved = path.resolve(repoDir);
    this.checkoutAuth.delete(resolved);
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
    const git = this.createGit(repoDir, 60_000);
    this.logger.log(`Checking out new branch: ${branchName}`);
    await git.checkoutLocalBranch(branchName);
  }

  /**
   * Commits the changes and pushes to the remote.
   * Supplies credentials strictly via ephemeral env config for the push call so
   * `.git/config` inside the checkout never contains credentials.
   */
  async commitAndPush(
    repoDir: string,
    branchName: string,
    commitMessage: string,
    token?: string,
  ): Promise<void> {
    const storedAuth = this.checkoutAuth.get(path.resolve(repoDir));
    const auth = token?.trim()
      ? { origin: storedAuth?.origin || 'https://github.com', token: token.trim() }
      : storedAuth;

    const git = this.createGit(repoDir);

    this.logger.log(`Committing changes: "${commitMessage}"`);
    await git.add('.');

    // Setup git config for commit
    await git.addConfig('user.name', 'GrowthX AI Engineer');
    await git.addConfig('user.email', 'engineer@growthx.ai');

    await git.commit(commitMessage);

    this.logger.log(`Pushing branch ${branchName} to remote...`);
    const pushGit = this.createGit(repoDir, resolveGitBlockTimeoutMs(), auth);
    const forceIpv4 = process.env.GIT_FORCE_IPV4 === 'true';
    const pushArgs = forceIpv4 ? ['--progress', '--ipv4'] : ['--progress'];
    try {
      await pushGit.push('origin', branchName, pushArgs);
    } catch (error) {
      const msg = redactToken(error instanceof Error ? error.message : String(error), auth?.token);
      if (!forceIpv4 && TRANSIENT_GIT_ERROR_RE.test(msg)) {
        this.logger.warn(`Push of ${branchName} stalled (${msg}); retrying over IPv4...`);
        try {
          await pushGit.push('origin', branchName, ['--progress', '--ipv4']);
          return;
        } catch (retryError) {
          throw this.formatGitError('push', branchName, retryError, auth?.token);
        }
      }
      throw this.formatGitError('push', branchName, error, auth?.token);
    }
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
      const git = this.createGit(repoDir);
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

      await git.push('origin', revertBranch, ['--progress']);
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

