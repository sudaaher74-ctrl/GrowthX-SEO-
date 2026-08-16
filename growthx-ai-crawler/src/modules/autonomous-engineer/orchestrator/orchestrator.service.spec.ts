// @octokit/rest and simple-git are ESM-only and cannot be parsed by Jest's
// CommonJS transform, so they are mocked before the module under test loads.
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    pulls: { create: jest.fn().mockResolvedValue({ data: { html_url: 'https://github.com/o/r/pull/1' } }) },
  })),
}));
jest.mock('simple-git', () => ({
  simpleGit: jest.fn(() => ({
    clone: jest.fn().mockResolvedValue(undefined),
    checkoutLocalBranch: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    addConfig: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    push: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { GitService } from '../agents/git/git.service';
import { RepositoryUnderstandingService } from '../agents/repository-understanding/repository-understanding.service';
import { PatchGenerationService } from '../agents/patch-generation/patch-generation.service';
import { ValidationService } from '../agents/validation/validation.service';
import { IssueAnalysisService } from '../agents/issue-analysis/issue-analysis.service';
import { FileSelectionService } from '../agents/file-selection/file-selection.service';
import { OrchestratorService } from './orchestrator.service';

describe('OrchestratorService', () => {
  let service: OrchestratorService;
  let git: any;
  let repo: any;
  let patch: any;
  let validation: any;

  beforeEach(async () => {
    git = {
      cloneRepository: jest.fn().mockResolvedValue('/tmp/repo'),
      createFeatureBranch: jest.fn().mockResolvedValue(undefined),
      commitAndPush: jest.fn().mockResolvedValue(undefined),
      createPullRequest: jest.fn().mockResolvedValue('https://github.com/o/r/pull/1'),
    };
    repo = { analyzeRepository: jest.fn().mockResolvedValue({ packageManager: 'npm' }) };
    patch = { generatePatch: jest.fn().mockResolvedValue({ applied: true, reason: null }) };
    validation = { validateRepository: jest.fn().mockResolvedValue({ success: true, output: '' }) };

    const issueAnalysis = { analyzeIssue: jest.fn().mockResolvedValue({ targetFileHint: 'app/layout.tsx', proposedFixDescription: 'New title' }) };
    const fileSelection = { selectTargetFile: jest.fn().mockResolvedValue({ selectedFilePath: 'app/layout.tsx' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrchestratorService,
        { provide: GitService, useValue: git },
        { provide: RepositoryUnderstandingService, useValue: repo },
        { provide: PatchGenerationService, useValue: patch },
        { provide: ValidationService, useValue: validation },
        { provide: IssueAnalysisService, useValue: issueAnalysis },
        { provide: FileSelectionService, useValue: fileSelection },
      ],
    }).compile();
    service = module.get(OrchestratorService);
  });

  const run = () =>
    service.executeAutoFixWorkflow('ghp_token', 'owner', 'repo', 'issue_1', 'Missing title tag');

  it('runs clone → branch → patch → validate → PR and returns the PR url', async () => {
    await expect(run()).resolves.toBe('https://github.com/o/r/pull/1');

    expect(git.cloneRepository).toHaveBeenCalled();
    expect(git.createFeatureBranch).toHaveBeenCalled();
    expect(patch.generatePatch).toHaveBeenCalled();
    expect(validation.validateRepository).toHaveBeenCalled();
    expect(git.createPullRequest).toHaveBeenCalled();
  });

  it('branches before patching so the default branch is never written to', async () => {
    await run();
    const branchOrder = git.createFeatureBranch.mock.invocationCallOrder[0];
    const patchOrder = patch.generatePatch.mock.invocationCallOrder[0];
    expect(branchOrder).toBeLessThan(patchOrder);
  });

  it('does not open a PR when the build fails validation', async () => {
    validation.validateRepository.mockResolvedValue({ success: false, output: 'tsc error' });

    await expect(run()).resolves.toBeNull();
    expect(git.commitAndPush).not.toHaveBeenCalled();
    expect(git.createPullRequest).not.toHaveBeenCalled();
  });

  it('does not open a PR when the file could not be patched', async () => {
    patch.generatePatch.mockResolvedValue({ applied: false, reason: 'could not apply' });

    await expect(run()).resolves.toBeNull();
    expect(git.createPullRequest).not.toHaveBeenCalled();
  });

  it('returns null rather than throwing when cloning fails', async () => {
    git.cloneRepository.mockRejectedValue(new Error('auth failed'));
    await expect(run()).resolves.toBeNull();
  });
});
