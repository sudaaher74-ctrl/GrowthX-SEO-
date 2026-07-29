export declare class GitService {
    private readonly logger;
    /**
     * Clones a repository to a local temporary directory.
     */
    cloneRepository(repoUrl: string, token: string, repoName: string): Promise<string>;
    /**
     * Creates a new feature branch for the automated fix.
     */
    createFeatureBranch(repoDir: string, branchName: string): Promise<void>;
    /**
     * Commits the changes and pushes to the remote.
     */
    commitAndPush(repoDir: string, branchName: string, commitMessage: string): Promise<void>;
    /**
     * Opens a Pull Request using GitHub API.
     */
    createPullRequest(token: string, owner: string, repo: string, title: string, headBranch: string, baseBranch: string, body: string): Promise<string>;
}
