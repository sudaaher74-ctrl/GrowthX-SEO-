import { Injectable, Logger } from '@nestjs/common';
import { simpleGit, SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs/promises';
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
  async cloneRepository(repoUrl: string, token: string, repoName: string): Promise<string> {
    const targetDir = path.join('/tmp', 'growthx-auto-engineer', repoName, Date.now().toString());
    await fs.mkdir(targetDir, { recursive: true });

    // GitHub's documented form for a token over HTTPS. The token is URL-encoded, so a
    // character that is not valid in a URL cannot corrupt the address (git reports that
    // as "URL using bad/illegal format").
    const url = new URL(repoUrl);
    url.username = 'x-access-token';
    url.password = token.trim();
    const git: SimpleGit = simpleGit();

    this.logger.log(`Cloning ${repoUrl} to ${targetDir}...`);
    await git.clone(url.toString(), targetDir);

    return targetDir;
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
    const octokit = new Octokit({ auth: token });
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
    body: string
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
    });
    
    return response.data.html_url;
  }
}

