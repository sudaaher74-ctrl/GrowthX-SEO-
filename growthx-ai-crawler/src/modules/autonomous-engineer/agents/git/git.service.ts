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

    const authUrl = repoUrl.replace('https://', `https://${token}@`);
    const git: SimpleGit = simpleGit();
    
    this.logger.log(`Cloning ${repoUrl} to ${targetDir}...`);
    await git.clone(authUrl, targetDir);
    
    return targetDir;
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

