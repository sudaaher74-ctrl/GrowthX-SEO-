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

import { GitService } from './git.service';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('GitService', () => {
  let service: GitService;

  beforeEach(() => {
    service = new GitService();
  });

  it('is constructible without dependencies', () => {
    expect(service).toBeDefined();
  });

  it('exposes the clone → branch → commit → PR workflow the orchestrator drives', () => {
    for (const method of ['cloneRepository', 'createFeatureBranch', 'commitAndPush', 'createPullRequest']) {
      expect(typeof (service as any)[method]).toBe('function');
    }
  });

  it('never puts the access token in the returned directory path', async () => {
    // The path is logged and appears in error messages, so a token leaking
    // into it would leak into the customer's logs.
    const dir = await service.cloneRepository('https://github.com/o/r.git', 'ghp_supersecret', 'r');

    expect(dir).not.toContain('ghp_supersecret');
    expect(dir.startsWith(os.tmpdir())).toBe(true);
    await service.cleanupRepository(dir);
  });

  it('authenticates the clone URL without mutating the caller\'s input', async () => {
    const url = 'https://github.com/o/r.git';
    const dir = await service.cloneRepository(url, 'ghp_supersecret', 'r');
    expect(url).toBe('https://github.com/o/r.git');
    await service.cleanupRepository(dir);
  });

  it('removes only its own temporary clone and refuses other directories', async () => {
    const dir = await service.cloneRepository('https://github.com/o/r.git', 'token', 'r');
    await service.cleanupRepository(dir);
    await expect(fs.access(dir)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(service.cleanupRepository(os.tmpdir())).rejects.toThrow('outside the Fix Engine');
  });
});
