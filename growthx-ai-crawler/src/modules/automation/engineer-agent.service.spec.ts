jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('simple-git', () => ({ simpleGit: jest.fn() }));
jest.mock('../security/security.service', () => ({ SecurityService: class {} }));
jest.mock('./automation.service', () => ({ AutomationService: class {} }));
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { AutomationRunStatus } from '@prisma/client';
import { ValidationService } from '../autonomous-engineer/agents/validation/validation.service';
import { EngineerAgentService, isUsableAction, parseAction } from './engineer-agent.service';

const REPO = { id: 'repo_1', projectId: 'proj_1', owner: 'acme', name: 'site', defaultBranch: 'main', framework: 'nextjs', accessTokenEncrypted: 'enc' };
const act = (a: object) => ({ text: JSON.stringify(a), refused: false });

describe('parseAction', () => {
  it('accepts only complete line replacements with ordered integer bounds', () => {
    expect(isUsableAction(JSON.stringify({ tool: 'replace_lines', path: 'src/a.jsx', start: 2, end: 3, new: '' }))).toBe(true);
    for (const over of [{ end: undefined }, { start: 4, end: 2 }, { start: 1.2 }, { new: undefined }]) {
      expect(isUsableAction(JSON.stringify({ tool: 'replace_lines', path: 'src/a.jsx', start: 2, end: 3, new: 'source', ...over }))).toBe(false);
    }
  });
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
  it('strips null optional fields emitted by JSON-schema models like Gemini', () => {
    expect(isUsableAction('{"tool":"list","path":null,"start":null,"end":null}')).toBe(true);
    expect(parseAction('{"tool":"read","path":"src/App.jsx","start":null,"end":null}')).toEqual({
      tool: 'read',
      path: 'src/App.jsx',
    });
    expect(isUsableAction('{"tool":"replace_lines","path":"src/a.jsx","start":null,"end":3,"new":"x"}')).toBe(false);
    expect(parseAction('{"tool":"replace_lines","path":"src/a.jsx","start":"2","end":"4","new":"","content":"const x = 1;"}')).toMatchObject({
      tool: 'replace_lines',
      path: 'src/a.jsx',
      start: 2,
      end: 4,
      new: 'const x = 1;',
    });
    expect(isUsableAction('{"tool":"replace_lines","path":"src/a.jsx","start":"2","end":"4","content":"const x = 1;"}')).toBe(true);
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

  it('searches a page file, reads it, edits it and produces a reviewable PR', async () => {
    replies.push(
      act({ tool: 'search', pattern: 'Old title', path: 'app/page.tsx' }),
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 2 }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'New title' }),
      act({ tool: 'finish', summary: 'Updated the homepage.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect((run.steps as any[]).find((s: any) => s.step === 'search').ok).toBe(true);
    expect(router.generate.mock.calls[1][0].prompt).toContain('app/page.tsx:1: <title>Old title</title>');
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
  });

  it('recovers from an exact-edit mismatch via a fresh bounded line replacement and opens a PR', async () => {
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 2 }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'model copied the wrong source', new: 'New title' }),
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 1 }),
      act({ tool: 'replace_lines', path: 'app/page.tsx', start: 1, end: 1, new: '<title>New title</title>' }),
      act({ tool: 'finish', summary: 'Updated the homepage title.' }),
    );
    let committed = '';
    git.commitAndPush.mockImplementation(async () => { committed = await fs.readFile(path.join(dir, 'app/page.tsx'), 'utf8'); });
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(committed).toContain('<title>New title</title>');
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
    const steps = Array.isArray(run.steps) ? (run.steps as Array<{ step?: string; change?: any }>) : [];
    const change = steps.find((s) => s.step === 'replace_lines')?.change;
    expect(change.before).toBe('<title>Old title</title>');
    expect(change.after).toBe('<title>New title</title>');
    expect(router.generate.mock.calls[2][0].prompt).toContain('use replace_lines');
  });

  it('does not publish a line replacement beyond the actual read range', async () => {
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 1 }),
      act({ tool: 'replace_lines', path: 'app/page.tsx', start: 1, end: 2, new: '<title>New title</title>' }),
      act({ tool: 'finish', summary: 'Unable to edit.' }),
    );
    expect((await service.run('proj_1', 'org_1', INSTRUCTION)).status).toBe(AutomationRunStatus.FAILED);
    expect(git.createPullRequest).not.toHaveBeenCalled();
  });

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

  it('requires a fresh read after a failed edit before allowing another edit', async () => {
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx' }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'Non-existent text', new: 'New title' }),
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 2 }),
      act({ tool: 'edit', path: 'app/page.tsx', old: '<title>Old title</title>', new: '<title>New title</title>' }),
      act({ tool: 'finish', summary: 'Gave up.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
    const thirdPrompt = router.generate.mock.calls[2][0].prompt;
    expect(thirdPrompt).toMatch(/Read the exact target lines/);
    expect(thirdPrompt).toContain('then use replace_lines');
    expect(run.filesChanged).toEqual(['app/page.tsx']);
  });

  it('requires a fresh read after a successful edit before another change to the same file', async () => {
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx' }),
      act({ tool: 'edit', path: 'app/page.tsx', old: '<title>Old title</title>', new: '<title>First title</title>' }),
      act({ tool: 'read', path: 'app/page.tsx' }),
      act({ tool: 'edit', path: 'app/page.tsx', old: '<title>First title</title>', new: '<title>Second title</title>' }),
      act({ tool: 'finish', summary: 'Updated the title.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(router.generate.mock.calls[2][0].prompt).toMatch(/Read the relevant section of app\/page.tsx again/);
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects repeated identical failed edit attempts with clear guidance', async () => {
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx' }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'Non-existent text', new: 'New title' }),
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 10 }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'Non-existent text', new: 'Different title' }),
      act({ tool: 'finish', summary: 'Could not find text.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
    expect(router.generate).toHaveBeenCalledTimes(4);
    expect(run.error).toMatch(/stopped before completing/);
  });

  it('delivers read file content to model prompt without silent 6000-char truncation', async () => {
    const longContent = 'A'.repeat(80) + '\n';
    await fs.writeFile(path.join(dir, 'app/long.tsx'), longContent.repeat(100));
    replies.push(
      act({ tool: 'read', path: 'app/long.tsx', start: 1, end: 100 }),
      act({ tool: 'finish', summary: 'done' }),
    );
    await service.run('proj_1', 'org_1', INSTRUCTION);
    const secondPrompt = router.generate.mock.calls[1][0].prompt;
    expect(secondPrompt).toContain('app/long.tsx:1-100');
    expect(secondPrompt).toContain('100: AAAAA');
  });

  it('provides urgent turn budget guidance when turns are running low', async () => {
    for (let i = 0; i < 24; i++) {
      replies.push(act({ tool: 'list', path: '' }));
    }
    replies.push(act({ tool: 'finish', summary: 'Finished near limit' }));
    await service.run('proj_1', 'org_1', INSTRUCTION);
    const turn25Prompt = router.generate.mock.calls[24][0].prompt;
    expect(turn25Prompt).toMatch(/URGENT: Turn 25 of 30/);
  });

  it('blocks repeated edit attempts on a file after multiple failures', async () => {
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx' }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'bad1', new: 'n1' }),
      act({ tool: 'read', path: 'app/page.tsx' }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'bad2', new: 'n2' }),
      act({ tool: 'search', path: '', pattern: 'anything' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
    expect(router.generate).toHaveBeenCalledTimes(4);
    expect(run.error).toMatch(/stopped before completing/);
  });

  it('stops after the second failed edit instead of spending the remaining model turn budget', async () => {
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 10 }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'bad1', new: 'n1' }),
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 10 }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'bad2', new: 'n2' }),
      ...Array.from({ length: 26 }, () => act({ tool: 'search', path: '', pattern: 'anything' })),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.FAILED);
    expect(router.generate).toHaveBeenCalledTimes(4);
    const savedSteps = prisma.automationRun.update.mock.calls.at(-1)[0].data.steps;
    expect(savedSteps.some((step: any) => step.step === 'stopped' && /recovery limit reached after two failed edits/.test(step.detail))).toBe(true);
    expect(git.createPullRequest).not.toHaveBeenCalled();
  });

  it('resets per-file failure count after a successful edit recovery so later work is not discarded', async () => {
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 2 }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'wrong-text', new: 'New title' }),
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 1 }),
      act({ tool: 'replace_lines', path: 'app/page.tsx', start: 1, end: 1, new: '<title>First fix</title>' }),
      // Model tries another replace_lines before reading again (1 fresh failure, NOT 2)
      act({ tool: 'replace_lines', path: 'app/page.tsx', start: 1, end: 1, new: '<title>Second fix</title>' }),
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 1 }),
      act({ tool: 'replace_lines', path: 'app/page.tsx', start: 1, end: 1, new: '<title>Second fix</title>' }),
      act({ tool: 'finish', summary: 'Applied both fixes cleanly.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
  });

  it('gives AI Visibility findings public-page guidance rather than targeting Cart.jsx', async () => {
    prisma.growthOpportunity = {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'finding_ai_1',
          source: 'AI_VISIBILITY',
          title: 'AI models cite Rival instead of your business',
          summary: 'Assistants recommend Rival for delivery queries.',
          recommendedAction: 'Add Organization and FAQPage JSON-LD to the homepage.',
          affectedPages: ['https://acme.in/'],
        },
      ]),
      update: jest.fn().mockResolvedValue({}),
    };
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 2 }),
      act({ tool: 'edit', path: 'app/page.tsx', old: '<title>Old title</title>', new: '<title>Acme Official</title>' }),
      act({ tool: 'finish', summary: 'Updated homepage.' }),
    );
    const { done } = await service.startForFindings('proj_1', 'org_1', { findingIds: ['finding_ai_1'] });
    const finished: any = await done;
    expect(finished.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    const firstPrompt = router.generate.mock.calls[0][0].prompt;
    expect(firstPrompt).not.toContain('Cart.jsx');
    expect(firstPrompt).toContain('primary public landing');
  });

  it('reverts a destructive syntax-breaking replace_lines edit atomically so the agent recovers cleanly and opens a PR', async () => {
    const realValidation = new ValidationService();
    const svcWithRealValidation = new EngineerAgentService(
      prisma,
      router,
      git,
      { analyzeRepository: jest.fn().mockResolvedValue({ packageManager: 'npm' }) } as any,
      realValidation,
      { decryptCredentials: jest.fn().mockReturnValue('ghp_realtoken123') } as any,
    );

    const seoHeadPath = path.join(dir, 'app/SEOHead.jsx');
    await fs.writeFile(
      seoHeadPath,
      [
        "import { Helmet } from 'react-helmet-async';",
        'export default function SEOHead() {',
        '  const org = { "@context": "https://schema.org", "@type": "Organization", name: "Acme" };',
        '  return (',
        '    <Helmet>',
        '      <title>Acme Home</title>',
        '      <meta name="description" content="Fresh goods" />',
        '      <meta name="robots" content="index,follow" />',
        '      <meta property="og:title" content="Acme Home" />',
        '      <meta property="og:site_name" content="Acme" />',
        '    </Helmet>',
        '  );',
        '}',
        '',
      ].join('\n'),
      'utf8',
    );

    replies.push(
      act({ tool: 'read', path: 'app/SEOHead.jsx', start: 1, end: 20 }),
      // Model mistakenly replaces the entire return (<Helmet>...</Helmet>); block (lines 4-13) with 2 bare JSX lines
      act({
        tool: 'replace_lines',
        path: 'app/SEOHead.jsx',
        start: 4,
        end: 13,
        new: '      <script type="application/ld+json">{JSON.stringify(org)}</script>',
      }),
      // Because the broken edit was reverted cleanly and read state stayed intact, model immediately submits a narrow valid edit
      act({
        tool: 'replace_lines',
        path: 'app/SEOHead.jsx',
        start: 10,
        end: 11,
        new: '      <meta property="og:site_name" content="Acme" />\n      <script type="application/ld+json">{JSON.stringify(org)}</script>\n    </Helmet>',
      }),
      act({ tool: 'finish', summary: 'Added Organization JSON-LD inside SEOHead Helmet.' }),
    );

    let committed = '';
    git.commitAndPush.mockImplementation(async () => {
      committed = await fs.readFile(seoHeadPath, 'utf8');
    });

    const run = await svcWithRealValidation.run('proj_1', 'org_1', 'Add Organization JSON-LD to SEOHead.jsx');
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
    expect(committed).toContain('<Helmet>');
    expect(committed).toContain('<script type="application/ld+json">{JSON.stringify(org)}</script>');
    expect(committed).toContain('</Helmet>');
    const recoveryPrompt = router.generate.mock.calls[2][0].prompt;
    expect(recoveryPrompt).toContain('Edit reverted (app/SEOHead.jsx left unchanged) because it introduced a syntax error');
    expect(recoveryPrompt).toContain('deleting surrounding JSX/braces');
  });

  it('does not discard already-valid changes when a follow-up edit hits a pre-read reminder and a no-op replacement', async () => {
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 2 }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'New title' }),
      // Procedural pre-read reminder (forgot to re-read before second edit)
      act({ tool: 'replace_lines', path: 'app/page.tsx', start: 1, end: 1, new: '<title>New title</title>' }),
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 2 }),
      // Harmless no-op replacement (line already matches)
      act({ tool: 'replace_lines', path: 'app/page.tsx', start: 1, end: 1, new: '<title>New title</title>' }),
      act({ tool: 'finish', summary: 'Updated page title cleanly.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
    const finishPrompt = router.generate.mock.calls[5][0].prompt;
    expect(finishPrompt).toContain('already match your replacement');
  });

  it('preserves valid prior edits and guides the model to finish instead of aborting on a second follow-up edit error', async () => {
    await fs.writeFile(path.join(dir, 'app/second.tsx'), '<p>Second</p>\n');
    replies.push(
      act({ tool: 'read', path: 'app/page.tsx', start: 1, end: 2 }),
      act({ tool: 'edit', path: 'app/page.tsx', old: 'Old title', new: 'New title' }),
      act({ tool: 'read', path: 'app/second.tsx', start: 1, end: 2 }),
      act({ tool: 'edit', path: 'app/second.tsx', old: 'wrong1', new: 'x' }),
      act({ tool: 'read', path: 'app/second.tsx', start: 1, end: 2 }),
      act({ tool: 'edit', path: 'app/second.tsx', old: 'wrong2', new: 'y' }),
      act({ tool: 'finish', summary: 'Applied the primary title fix in app/page.tsx.' }),
    );
    const run = await service.run('proj_1', 'org_1', INSTRUCTION);
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
    expect(run.filesChanged).toEqual(['app/page.tsx']);
  });

  it('surfaces pre-search canonical matches on turn 1 and challenges premature zero-change finish so duplicate index.html canonical is fixed', async () => {
    const realValidation = new ValidationService();
    const svc = new EngineerAgentService(
      prisma,
      router,
      git,
      { analyzeRepository: jest.fn().mockResolvedValue({ framework: 'React', appRoot: 'frontend', packageManager: 'npm' }) } as any,
      realValidation,
      { decryptCredentials: jest.fn().mockReturnValue('ghp_realtoken123') } as any,
    );

    await fs.mkdir(path.join(dir, 'frontend/src/pages'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'frontend/index.html'),
      '<!doctype html><html><head>\n  <link rel="canonical" href="https://acme.in/" />\n  <title>Acme</title>\n</head><body></body></html>\n',
    );
    await fs.writeFile(
      path.join(dir, 'frontend/src/pages/BlogPost.jsx'),
      'export default function BlogPost() { return <link rel="canonical" href="https://acme.in/blog/post" />; }\n',
    );

    replies.push(
      act({ tool: 'read', path: 'frontend/src/pages/BlogPost.jsx', start: 1, end: 20 }),
      // Model prematurely claims canonical is already dynamic without inspecting frontend/index.html
      act({ tool: 'finish', summary: 'The canonical URL in BlogPost.jsx is already dynamically generated.' }),
      // Challenged with unread matching file frontend/index.html -> reads and removes the conflicting static canonical!
      act({ tool: 'read', path: 'frontend/index.html', start: 1, end: 10 }),
      act({ tool: 'replace_lines', path: 'frontend/index.html', start: 2, end: 2, new: '' }),
      act({ tool: 'finish', summary: 'Removed conflicting static canonical tag from frontend/index.html.' }),
    );

    const run = await svc.run('proj_1', 'org_1', 'Fix 23 pages declare more than one preferred address (duplicate canonical)');
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(run.filesChanged).toEqual(['frontend/index.html']);
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
    const turn1Prompt = router.generate.mock.calls[0][0].prompt;
    expect(turn1Prompt).toContain('REPOSITORY MAP');
    expect(turn1Prompt).toContain('frontend/index.html');
    expect(turn1Prompt).toContain('AUTO PRE-SEARCH HITS');
    const challengePrompt = router.generate.mock.calls[2][0].prompt;
    expect(challengePrompt).toContain('You have NOT inspected these matching files yet: frontend/index.html');
  });

  it('allows creating standalone public SEO web assets like robots.txt or sitemap.xml', async () => {
    const realValidation = new ValidationService();
    const svc = new EngineerAgentService(
      prisma,
      router,
      git,
      { analyzeRepository: jest.fn().mockResolvedValue({ framework: 'React', packageManager: 'npm' }) } as any,
      realValidation,
      { decryptCredentials: jest.fn().mockReturnValue('ghp_realtoken123') } as any,
    );
    replies.push(
      act({ tool: 'create', path: 'public/robots.txt', content: 'User-agent: *\nAllow: /\nSitemap: https://acme.in/sitemap.xml\n' }),
      act({ tool: 'finish', summary: 'Created public/robots.txt with sitemap directive.' }),
    );
    const run = await svc.run('proj_1', 'org_1', 'Create public/robots.txt and reference sitemap.xml');
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(run.filesChanged).toEqual(['public/robots.txt']);
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
  });

  it('challenges finish when a new comparison page is not yet wired into an existing file so the agent wires it and opens a PR', async () => {
    const realValidation = new ValidationService();
    const svc = new EngineerAgentService(
      prisma,
      router,
      git,
      { analyzeRepository: jest.fn().mockResolvedValue({ framework: 'React', packageManager: 'npm' }) } as any,
      realValidation,
      { decryptCredentials: jest.fn().mockReturnValue('ghp_realtoken123') } as any,
    );

    await fs.writeFile(
      path.join(dir, 'app/App.jsx'),
      "export default function App() {\n  return <main><h1>Acme Home</h1></main>;\n}\n",
    );

    replies.push(
      act({ tool: 'create', path: 'app/ComparisonPage.jsx', content: 'export default function ComparisonPage() {\n  return <section><h2>Acme vs Rival</h2></section>;\n}\n' }),
      // Model tries to finish without wiring ComparisonPage.jsx into any existing file
      act({ tool: 'finish', summary: 'Created ComparisonPage.jsx.' }),
      // Integration gate rejects finish and directs model to connect it -> reads App.jsx and imports/renders it!
      act({ tool: 'read', path: 'app/App.jsx', start: 1, end: 10 }),
      act({ tool: 'replace_lines', path: 'app/App.jsx', start: 1, end: 2, new: "import ComparisonPage from './ComparisonPage';\nexport default function App() {\n  return <main><h1>Acme Home</h1><ComparisonPage /></main>;" }),
      act({ tool: 'finish', summary: 'Created ComparisonPage.jsx and wired it into App.jsx.' }),
    );

    const run = await svc.run('proj_1', 'org_1', 'Add comparison page for AI models cite Rival instead of your business');
    expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
    expect(run.filesChanged).toEqual(expect.arrayContaining(['app/ComparisonPage.jsx', 'app/App.jsx']));
    expect(git.createPullRequest).toHaveBeenCalledTimes(1);
    const integrationPrompt = router.generate.mock.calls[2][0].prompt;
    expect(integrationPrompt).toContain('without editing any existing website file');
  });
});
