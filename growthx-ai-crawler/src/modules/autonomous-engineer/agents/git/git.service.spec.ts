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

import { simpleGit } from 'simple-git';
import { GitService } from './git.service';
import * as fs from 'fs/promises';
import * as os from 'os';

describe('GitService', () => {
  let service: GitService;
  const mockSimpleGit = simpleGit as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GIT_FORCE_IPV4;
    delete process.env.GIT_CLONE_TIMEOUT_MS;
    mockSimpleGit.mockImplementation(() => ({
      clone: jest.fn().mockResolvedValue(undefined),
      checkoutLocalBranch: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
      addConfig: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      push: jest.fn().mockResolvedValue(undefined),
    }));
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

  it('authenticates via ephemeral origin-scoped env config without embedding the token in the clone URL', async () => {
    const clone = jest.fn().mockResolvedValue(undefined);
    const env = jest.fn().mockReturnThis();
    mockSimpleGit.mockReturnValue({ clone, env });

    const url = 'https://github.com/o/r.git';
    const dir = await service.cloneRepository(url, 'ghp_supersecret', 'r');
    expect(url).toBe('https://github.com/o/r.git');
    // Clone URL must NEVER contain credentials so `.git/config` stays token-free.
    expect(clone.mock.calls[0][0]).toBe('https://github.com/o/r.git');
    expect(clone.mock.calls[0][0]).not.toContain('ghp_supersecret');
    expect(clone.mock.calls[0][0]).not.toContain('x-access-token');
    expect(env).toHaveBeenCalledWith('GIT_CONFIG_COUNT', '1');
    expect(env).toHaveBeenCalledWith('GIT_CONFIG_KEY_0', 'http.https://github.com/.extraHeader');
    expect(env).toHaveBeenCalledWith(
      'GIT_CONFIG_VALUE_0',
      expect.stringMatching(/^Authorization: Basic /),
    );
    await service.cleanupRepository(dir);
  });

  it('removes only its own temporary clone and refuses other directories', async () => {
    const dir = await service.cloneRepository('https://github.com/o/r.git', 'token', 'r');
    await service.cleanupRepository(dir);
    await expect(fs.access(dir)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(service.cleanupRepository(os.tmpdir())).rejects.toThrow('outside the Fix Engine');
  });

  it('configures HTTP/1.1, non-interactive prompts, and --progress on clone', async () => {
    const clone = jest.fn().mockResolvedValue(undefined);
    const env = jest.fn().mockReturnThis();
    mockSimpleGit.mockReturnValue({ clone, env });

    const dir = await service.cloneRepository('https://github.com/o/r.git', 'ghp_secret', 'r');

    expect(mockSimpleGit).toHaveBeenCalledWith(
      expect.objectContaining({
        timeout: { block: 300_000 },
        config: expect.arrayContaining(['http.version=HTTP/1.1', 'http.lowSpeedLimit=1000']),
      }),
    );
    const passedConfig = mockSimpleGit.mock.calls[0][0].config as string[];
    expect(passedConfig.some((entry) => entry.startsWith('credential.helper'))).toBe(false);
    expect(env).toHaveBeenCalledWith('GIT_TERMINAL_PROMPT', '0');
    expect(env).toHaveBeenCalledWith('GCM_INTERACTIVE', 'never');
    expect(clone).toHaveBeenCalledWith(
      expect.stringContaining('github.com/o/r.git'),
      dir,
      expect.arrayContaining(['--depth', '1', '--single-branch', '--no-tags', '--progress']),
    );
    await service.cleanupRepository(dir);
  });

  it('retries clone automatically with --ipv4 when the first attempt hits block timeout reached', async () => {
    const clone = jest
      .fn()
      .mockRejectedValueOnce(new Error('block timeout reached'))
      .mockResolvedValueOnce(undefined);
    mockSimpleGit.mockReturnValue({ clone });

    const dir = await service.cloneRepository('https://github.com/o/r.git', 'ghp_secret', 'r');

    expect(clone).toHaveBeenCalledTimes(2);
    expect(clone.mock.calls[0][2]).not.toContain('--ipv4');
    expect(clone.mock.calls[1][2]).toContain('--ipv4');
    await service.cleanupRepository(dir);
  });

  it('throws an actionable redacted error when both clone attempts time out', async () => {
    const clone = jest.fn().mockRejectedValue(new Error('block timeout reached for https://x-access-token:ghp_secret@github.com/o/r.git'));
    mockSimpleGit.mockReturnValue({ clone });

    await expect(
      service.cloneRepository('https://github.com/o/r.git', 'ghp_secret', 'r'),
    ).rejects.toThrow(/GitHub clone timed out for https:\/\/github\.com\/o\/r\.git/);

    try {
      await service.cloneRepository('https://github.com/o/r.git', 'ghp_secret', 'r');
    } catch (err: any) {
      expect(err.message).not.toContain('ghp_secret');
    }
  });
});
