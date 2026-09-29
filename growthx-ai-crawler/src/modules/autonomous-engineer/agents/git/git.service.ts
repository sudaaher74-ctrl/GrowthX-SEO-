import { Injectable, Logger } from '@nestjs/common';
import { simpleGit, SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class GitService {
  private readonly logger = new Logger(GitService.name);

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

