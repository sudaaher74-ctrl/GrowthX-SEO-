jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('simple-git', () => ({ simpleGit: jest.fn() }));
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { AutomationRunStatus } from '@prisma/client';
import { EngineerAgentService, parseAction } from './engineer-agent.service';

const REPO = { id: 'repo_1', projectId: 'proj_1', owner: 'acme', name: 'site', defaultBranch: 'main', framework: 'nextjs', accessTokenEncrypted: 'enc' };
const act = (a: object) => ({ text: JSON.stringify(a), refused: false });

describe('parseAction', () => {
  it('reads JSON from a reply with fences and chatter', () => {
    expect(parseAction('Sure!\n```json\n{"tool":"list","path":"src"}\n```')).toEqual({ tool: 'list', path: 'src' });
  });
  it('returns null for a reply with no JSON', () => {
    expect(parseAction('I will now edit the file')).toBeNull();
    expect(parseAction('{broken')).toBeNull();
  });
});

describe('EngineerAgentService', () => {
  let dir: string;
  let prisma: any;
  let router: any;
  let git: any;
  let validation: any;
  let service: EngineerAgentService;
  const replies: any[] = [];

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'eng-'));
    await fs.mkdir(path.join(dir, 'app'));
    await fs.writeFile(path.join(dir, 'app/page.tsx'), '<title>Old title</title>\n');
    await fs.writeFile(path.join(dir, 'package.json'), '{"name":"x"}');
    replies.length = 0;

    prisma = {
      siteRepository: { findUnique: jest.fn().mockResolvedValue(REPO) },
      automationRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'run_1' }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'run_1', ...data })),
      },
    };
    router = { generate: jest.fn().mockImplementation(async () => replies.shift() ?? act({ tool: 'finish', summary: 'done' })) };
    git = {
      cloneRepository: jest.fn().mockResolvedValue(dir),
      createFeatureBranch: jest.fn().mockResolvedValue(undefined),
      commitAndPush: jest.fn().mockResolvedValue(undefined),
      createPullRequest: jest.fn().mockResolvedValue('https://github.com/acme/site/pull/9'),
    };
    validation = { validateRepository: jest.fn().mockResolvedValue({ success: true, output: '' }) };
    service = new EngineerAgentService(
      prisma,
      router,
      git,
      { analyzeRepository: jest.fn().mockResolvedValue({ packageManager: 'npm' }) } as any,
      validation,
      { decryptCredentials: jest.fn().mockReturnValue('ghp_realtoken123') } as any,
    );
  });

  afterEach(() => fs.rm(dir, { recursive: true, force: true }).catch(() => undefined));

  const INSTRUCTION = 'Change the homepage title to New title';

  it('explores, edits, builds, and opens a pull request that is never merged', async () => {
    replies.push(
      act({ tool: 'search', pattern: 'Old title' }),
      act({ tool: 'read', path: 'app/page.tsx' }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'New title' }),
      act({ tool: 'finish', summary: 'Changed the title.' }),
    );

    let committed = '';
    git.commitAndPush.mockImplementation(async () => {
      committed = await fs.readFile(path.join(dir, 'app/page.tsx'), 'utf8');
    });

    const run = await service.run('proj_1', 'org_1', INSTRUCTION);

    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(run.pullRequestUrl).toBe('https://github.com/acme/site/pull/9');
    expect(run.filesChanged).toEqual(['app/page.tsx']);
    expect(committed).toContain('New title');
    const body = git.createPullRequest.mock.calls[0][6];
    expect(body).toContain(INSTRUCTION);
    expect(body).toContain('Nothing goes live until you merge');
    // The clone holds customer source and is removed.
    await expect(fs.stat(dir)).rejects.toThrow();
  });

  it('refuses to change package.json even when the model tries, and reports it back to the model', async () => {
    replies.push(
      act({ tool: 'edit', path: 'package.json', old: '"x"', new: '"y"' }),
      act({ tool: 'finish', summary: 'Could not.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
    expect(run.error).toMatch(/without changing any files/);
    expect(git.commitAndPush).not.toHaveBeenCalled();
    const secondPrompt = router.generate.mock.calls[1][0].prompt;
    expect(secondPrompt).toMatch(/cannot be changed/);
  });

  it('never pushes a change that does not build', async () => {
    validation.validateRepository.mockResolvedValue({ success: false, output: 'Type error' });
    replies.push(act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'New' }), act({ tool: 'finish', summary: 'x' }));
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
    expect(run.error).toMatch(/nothing was pushed/);
    expect(git.commitAndPush).not.toHaveBeenCalled();
    expect(git.createPullRequest).not.toHaveBeenCalled();
  });

  it('stops a model that never finishes', async () => {
    router.generate.mockResolvedValue(act({ tool: 'list', path: '' }));
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(router.generate).toHaveBeenCalledTimes(30);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
    expect(git.commitAndPush).not.toHaveBeenCalled();
  });

  it('gives up after repeated unusable replies rather than looping', async () => {
    router.generate.mockResolvedValue({ text: 'no json here', refused: false });
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(router.generate).toHaveBeenCalledTimes(3);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
  });

  it('never puts the token in a stored error', async () => {
    git.createPullRequest.mockRejectedValue(new Error('failed for ghp_realtoken123 on https://x-access-token:ghp_realtoken123@github.com/a/b'));
    replies.push(act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'New' }), act({ tool: 'finish', summary: 'x' }));
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.error).not.toContain('ghp_realtoken123');
  });

  it('rejects a too-short instruction and a missing repository', async () => {
    await expect(service.run('proj_1', 'org_1', 'fix')).rejects.toThrow(/sentence or two/);
    prisma.siteRepository.findUnique.mockResolvedValue(null);
    await expect(service.run('proj_1', 'org_1', INSTRUCTION)).rejects.toThrow(/Connect the website repository/);
  });

  it('returns at once with a running record while the work continues', async () => {
    replies.push(act({ tool: 'finish', summary: 'nothing to do' }));
    const { run, done } = await service.start('proj_1', 'org_1', INSTRUCTION);
    expect(run.id).toBe('run_1');
    const finished = await done;
    expect(finished.status).toBe(AutomationRunStatus.FAILED);
  });

  it('marks a run left running by a restart as interrupted', async () => {
    replies.push(act({ tool: 'finish', summary: 'x' }));
    await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(prisma.automationRun.updateMany.mock.calls[0][0].data.error).toMatch(/interrupted/);
  });

  it('allows one run per project at a time', async () => {
    let release: () => void = () => undefined;
    router.generate.mockImplementationOnce(() => new Promise((res) => { release = () => res(act({ tool: 'finish', summary: 'x' })); }));
    const first = service.run('proj_1', 'org_1', INSTRUCTION);
    await new Promise((r) => setTimeout(r, 20));
    await expect(service.run('proj_1', 'org_1', INSTRUCTION)).rejects.toThrow(/already working/);
    release();
    await first;
  });
});
