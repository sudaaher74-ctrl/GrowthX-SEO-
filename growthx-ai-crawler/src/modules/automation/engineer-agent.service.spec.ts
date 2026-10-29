jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('simple-git', () => ({ simpleGit: jest.fn() }));
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { AutomationRunStatus } from '@prisma/client';
import { EngineerAgentService, isUsableAction, parseAction } from './engineer-agent.service';

const REPO = { id: 'repo_1', projectId: 'proj_1', owner: 'acme', name: 'site', defaultBranch: 'main', framework: 'nextjs', accessTokenEncrypted: 'enc' };
const act = (a: object) => ({ text: JSON.stringify(a), refused: false });

describe('parseAction', () => {
  it('rejects truncated and incomplete edit/create arguments before provider acceptance', () => {
    expect(isUsableAction('{"tool":"edit","path":"page.jsx","old":"before","new":"after')).toBe(false);
    expect(isUsableAction('{"tool":"edit","path":"page.jsx","summary":"I will change it"}')).toBe(false);
    expect(isUsableAction('{"tool":"create","path":"page.jsx"}')).toBe(false);
    expect(isUsableAction('{"tool":"create","path":"page.jsx","content":""}')).toBe(false);
    expect(isUsableAction('{"tool":"edit","path":"page.jsx","old":"before","new":"after"}')).toBe(true);
    expect(isUsableAction('{"tool":"edit","path":"page.jsx","old":"before","new":""}')).toBe(true);
  });
  it('reads JSON from a reply with fences and chatter', () => {
    expect(parseAction('Sure!\n```json\n{"tool":"list","path":"src"}\n```')).toEqual({ tool: 'list', path: 'src' });
  });
  it('handles raw newlines inside string values and multiple JSON objects', () => {
    expect(parseAction('{"tool":"edit","path":"a.tsx","old":"line1\nline2","new":"line1\nline3"}\n{"tool":"finish","summary":"done"}')).toEqual({
      tool: 'edit',
      path: 'a.tsx',
      old: 'line1\nline2',
      new: 'line1\nline3',
    });
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

  it('reserves queued work under a database project lock, rather than an API-local set', async () => {
    const enqueue = jest.fn().mockResolvedValue(undefined);
    const tx = { $executeRaw: jest.fn(), automationRun: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'queued', status: 'PENDING' }) } };
    prisma.$transaction = jest.fn(cb => cb(tx));
    const queued = new EngineerAgentService(prisma, router, git, {} as any, validation, {} as any, { enqueue } as any);
    const { run } = await queued.start('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe('PENDING');
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith('queued');
    expect(git.cloneRepository).not.toHaveBeenCalled();
    tx.automationRun.findFirst.mockResolvedValue({ id: 'busy' });
    await expect(queued.start('proj_1', 'org_1', INSTRUCTION)).rejects.toThrow('already queued');
  });

  it('checks the workspace before a queued job can consume repository credentials', async () => {
    prisma.automationRun.findUnique = jest.fn().mockResolvedValue({ id: 'queued', projectId: 'proj_1', status: 'PENDING', steps: [{ step: 'engineer_request', request: { organizationId: 'other-org' } }] });
    prisma.project = { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org_1' }) };
    await expect(service.executeQueued('queued')).rejects.toThrow('workspace');
    expect(git.cloneRepository).not.toHaveBeenCalled();
  });

  it('executes the existing low-risk pipeline in the worker using the same reserved run', async () => {
    prisma.automationRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.automationRun.findUnique = jest.fn().mockResolvedValue({ id: 'queued', projectId: 'proj_1', status: 'PENDING', repository: REPO, steps: [{ step: 'engineer_request', request: { organizationId: 'org_1', operation: { type: 'approved_fixes', ids: ['issue'] } } }] });
    prisma.project = { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org_1' }) };
    const automation = { runFixes: jest.fn().mockResolvedValue({ id: 'queued', status: 'AWAITING_REVIEW' }) };
    const queued = new EngineerAgentService(prisma, router, git, {} as any, validation, {} as any, undefined, automation as any);
    expect((await queued.executeQueued('queued'))?.id).toBe('queued');
    expect(automation.runFixes).toHaveBeenCalledWith('proj_1', 'org_1', ['issue'], 'queued');
    expect(prisma.automationRun.create).not.toHaveBeenCalled();
  });

  it('rejects the placeholder creation used by old clients without pushing a PR', async () => {
    replies.push(
      act({ tool: 'create', path: 'app/seo-fix-test.js', content: "export const SEO_FIX_TEST = 'Fixed titles';" }),
      act({ tool: 'finish', summary: 'Applied fix.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
    expect(git.commitAndPush).not.toHaveBeenCalled();
    expect(git.createPullRequest).not.toHaveBeenCalled();
  });

  it('does not publish an unconnected new helper as a completed fix', async () => {
    replies.push(
      act({ tool: 'create', path: 'app/titles.js', content: "export const title = 'New title';" }),
      act({ tool: 'finish', summary: 'Added title.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
    expect(git.createPullRequest).not.toHaveBeenCalled();
  });

  it('requires reading the target before an edit', async () => {
    replies.push(
      act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'New title' }),
      act({ tool: 'finish', summary: 'Done.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
    expect(git.createPullRequest).not.toHaveBeenCalled();
  });

  it('does not accept a no-op edit as integration for a standalone helper', async () => {
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx' }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'Old title' }),
      act({ tool: 'create', path: 'app/titles.js', content: "export const title = 'New title';" }),
      act({ tool: 'finish', summary: 'Done.' }),
    );
    expect((await service.run('proj_1', 'org_1', INSTRUCTION)).status).toBe(AutomationRunStatus.FAILED);
    expect(git.createPullRequest).not.toHaveBeenCalled();
  });

  it('explores, edits, builds, and opens a pull request that is never merged', async () => {
    validation.validateRepository.mockResolvedValue({ success: true, output: 'Syntax checked; full build disabled.' });
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
    expect(body).toContain('Syntax checked; full build disabled.');
    expect(body).not.toContain('the build passed');
    // The clone holds customer source and is removed.
    await expect(fs.stat(dir)).rejects.toThrow();
  });

  it('refuses to change package.json even when the model tries, and reports it back to the model', async () => {
    replies.push(
      act({ tool: 'read', path: 'package.json' }),
      act({ tool: 'edit', path: 'package.json', old: '"x"', new: '"y"' }),
      act({ tool: 'finish', summary: 'Could not.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
    expect(run.error).toMatch(/without changing any files/);
    expect(git.commitAndPush).not.toHaveBeenCalled();
    const secondPrompt = router.generate.mock.calls[2][0].prompt;
    expect(secondPrompt).toMatch(/cannot be changed/);
  });

  it('never pushes a change that does not build', async () => {
    validation.validateRepository.mockResolvedValue({ success: false, output: 'Type error' });
    replies.push(act({ tool: 'read', path: 'app/page.tsx' }), act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'New' }), act({ tool: 'finish', summary: 'x' }));
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

  it('does not publish partial edits when the turn limit is reached', async () => {
    router.generate
      .mockResolvedValueOnce(act({ tool: 'read', path: 'app/page.tsx' }))
      .mockResolvedValueOnce(act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'New title' }))
      .mockResolvedValue(act({ tool: 'list', path: '' }));
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
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
    replies.push(act({ tool: 'read', path: 'app/page.tsx' }), act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'New' }), act({ tool: 'finish', summary: 'x' }));
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

  it('fixes cross-tab findings via startForFindings and records before/after change evidence', async () => {
    prisma.growthOpportunity = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'finding_traffic_1',
          source: 'SEARCH_CONSOLE',
          title: 'Zero search clicks in Pune — build local traffic plan',
          summary: 'Website Audit detected Pune as a target market, but Search Console recorded 0 clicks.',
          recommendedAction: 'Update the homepage title to include Pune A2 Milk Delivery.',
          affectedPages: ['https://acme.in/'],
        },
      ]),
      update: jest.fn().mockResolvedValue({}),
    };
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx' }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'Pune A2 Milk Delivery' }),
      act({ tool: 'finish', summary: 'Added Pune title.' }),
    );

    const { done } = await service.startForFindings('proj_1', 'org_1', { findingIds: ['finding_traffic_1'] });
    const finished: any = await done;

    expect(finished.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    const editStep = finished.steps.find((s: any) => s.change);
    expect(editStep).toBeDefined();
    expect(editStep.change).toMatchObject({
      issueId: 'finding_traffic_1',
      sourceModule: 'SEARCH_CONSOLE',
      findingTitle: 'Zero search clicks in Pune — build local traffic plan',
      before: 'Old title',
      after: 'Pune A2 Milk Delivery',
      file: 'app/page.tsx',
    });
    expect(prisma.growthOpportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'finding_traffic_1' },
        data: expect.objectContaining({ lifecycle: 'VERIFYING' }),
      }),
    );
  });
});
