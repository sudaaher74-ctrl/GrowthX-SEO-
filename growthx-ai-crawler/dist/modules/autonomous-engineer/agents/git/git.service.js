"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GitService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitService = void 0;
const common_1 = require("@nestjs/common");
const simple_git_1 = require("simple-git");
const rest_1 = require("@octokit/rest");
const fs = require("fs/promises");
const path = require("path");
let GitService = GitService_1 = class GitService {
    constructor() {
        this.logger = new common_1.Logger(GitService_1.name);
    }
    /**
     * Clones a repository to a local temporary directory.
     */
    async cloneRepository(repoUrl, token, repoName) {
        const targetDir = path.join('/tmp', 'growthx-auto-engineer', repoName, Date.now().toString());
        await fs.mkdir(targetDir, { recursive: true });
        const authUrl = repoUrl.replace('https://', `https://${token}@`);
        const git = (0, simple_git_1.simpleGit)();
        this.logger.log(`Cloning ${repoUrl} to ${targetDir}...`);
        await git.clone(authUrl, targetDir);
        return targetDir;
    }
    /**
     * Creates a new feature branch for the automated fix.
     */
    async createFeatureBranch(repoDir, branchName) {
        const git = (0, simple_git_1.simpleGit)(repoDir);
        this.logger.log(`Checking out new branch: ${branchName}`);
        await git.checkoutLocalBranch(branchName);
    }
    /**
     * Commits the changes and pushes to the remote.
     */
    async commitAndPush(repoDir, branchName, commitMessage) {
        const git = (0, simple_git_1.simpleGit)(repoDir);
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
    async createPullRequest(token, owner, repo, title, headBranch, baseBranch, body) {
        const octokit = new rest_1.Octokit({ auth: token });
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
};
exports.GitService = GitService;
exports.GitService = GitService = GitService_1 = __decorate([
    (0, common_1.Injectable)()
], GitService);
//# sourceMappingURL=git.service.js.map