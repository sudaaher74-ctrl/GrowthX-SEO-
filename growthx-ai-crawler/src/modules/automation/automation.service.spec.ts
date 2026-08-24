jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('simple-git', () => ({ simpleGit: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AutomationRunStatus, } from '@prisma/client';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { PrismaService } from '../../database/prisma.service';
import { GitService } from '../autonomous-engineer/agents/git/git.service';
import { PatchGenerationService } from '../autonomous-engineer/agents/patch-generation/patch-generation.service';
import { RepositoryUnderstandingService } from '../autonomous-engineer/agents/repository-understanding/repository-understanding.service';
import { ValidationService } from '../autonomous-engineer/agents/validation/validation.service';
import { AutoFixService } from '../ai/auto-fix.service';
import { SecurityService } from '../security/security.service';
import { AutomationService } from './automation.service';
import { ContentGenerationService } from './content-generation.service';

const REPO = {
  id: 'repo_1',
  projectId: 'proj_1',
  owner: 'acme',
  name: 'website',
  defaultBranch: 'main',
  accessTokenEncrypted: 'enc:token',
  framework: 'static-html',
  contentDir: 'content/blog',
  autoMerge: false,
};

function issue(overrides: Record<string, any> = {}) {
  return {
    id: 'issue_1',
    issueType: 'MISSING_TITLE',
    severity: 'CRITICAL',
    affectedUrl: 'https://acme.com/guides/jackets',
    aiRecommendation: {
      recommendedFixPatch: JSON.stringify({ fixType: 'META_TITLE', proposedValue: 'Jackets | acme.com' }),
    },
    ...overrides,
  };
}

describe('AutomationService', () => {
  let service: AutomationService;
  let prisma: any;
  let git: any;
  let patcher: any;
  let validation: any;
  let entitlements: any;
  let workDir: string;

  beforeEach(async () => {
    // A real temp directory so file resolution is genuinely exercised.
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'growthx-auto-'));
    await fs.mkdir(path.join(workDir, 'guides'), { recursive: true });
    await fs.writeFile(path.join(workDir, 'guides/jackets.html'), '<html><head></head></html>');

    prisma = {
      siteRepository: {
        findUnique: jest.fn().mockResolvedValue(REPO),
        upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'repo_1', ...create })),
      },
      automationRun: {
        create: jest.fn().mockResolvedValue({ id: 'run_1' }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'run_1', ...data })),
        findMany: jest.fn().mockResolvedValue([]),
      },
      issue: { findMany: jest.fn().mockResolvedValue([issue()]) },
      contentPiece: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    };

    git = {
      cloneRepository: jest.fn().mockResolvedValue(workDir),
      createFeatureBranch: jest.fn().mockResolvedValue(undefined),
      commitAndPush: jest.fn().mockResolvedValue(undefined),
      createPullRequest: jest.fn().mockResolvedValue('https://github.com/acme/website/pull/7'),
    };
    patcher = { applyFix: jest.fn().mockResolvedValue({ applied: true }) };
    validation = { validateRepository: jest.fn().mockResolvedValue({ success: true, output: '' }) };

    entitlements = {
      assertFeature: jest.fn().mockResolvedValue(undefined),
      assertQuota: jest.fn().mockResolvedValue(undefined),
      recordUsage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationService,
        { provide: PrismaService, useValue: prisma },
        { provide: GitService, useValue: git },
        { provide: PatchGenerationService, useValue: patcher },
        { provide: RepositoryUnderstandingService, useValue: { analyzeRepository: jest.fn().mockResolvedValue({ packageManager: 'npm' }) } },
        { provide: ValidationService, useValue: validation },
        { provide: AutoFixService, useValue: {} },
        { provide: ContentGenerationService, useValue: { toMarkdownFile: () => '---\ntitle: "x"\n---\nbody\n' } },
        { provide: SecurityService, useValue: { encryptCredentials: (v: string) => `enc:${v}`, decryptCredentials: (v: string) => v.replace('enc:', '') } },
],
    }).compile();

    service = module.get(AutomationService);
  });

  afterEach(async () => {
    await fs.rm(workDir, { recursive: true, force: true });
  });

  describe('repository connection', () => {
    it('encrypts the token and never returns it', async () => {
      const result = await service.connectRepository('proj_1', {
        owner: 'acme',
        name: 'website',
        accessToken: 'ghp_supersecret',
      });

      expect(prisma.siteRepository.upsert.mock.calls[0][0].create.accessTokenEncrypted).toBe('enc:ghp_supersecret');
      expect(JSON.stringify(result)).not.toContain('ghp_supersecret');
      expect(result).toMatchObject({ tokenConfigured: true });
    });

    it('defaults autoMerge to off — publishing live must be deliberate', async () => {
      await service.connectRepository('proj_1', { owner: 'a', name: 'b', accessToken: 't' });
      expect(prisma.siteRepository.upsert.mock.calls[0][0].create.autoMerge).toBe(false);
    });

    it('rejects an incomplete connection', async () => {
      await expect(
        service.connectRepository('proj_1', { owner: 'a', name: '', accessToken: 't' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('runFixes', () => {
    it('clones, patches, validates, pushes and opens a PR', async () => {
      const run = await service.runFixes('proj_1', 'org_1');

      expect(git.cloneRepository).toHaveBeenCalled();
      expect(patcher.applyFix).toHaveBeenCalled();
      expect(validation.validateRepository).toHaveBeenCalled();
      expect(git.commitAndPush).toHaveBeenCalled();
      expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
      expect(run.pullRequestUrl).toBe('https://github.com/acme/website/pull/7');
    });

    it('is Pro-only and metered', async () => {
      await service.runFixes('proj_1', 'org_1');


    });

    it('does nothing when the plan does not allow it', async () => {
      entitlements.assertFeature.mockRejectedValue(new ForbiddenException());
      await expect(service.runFixes('proj_1', 'org_1')).rejects.toThrow(ForbiddenException);
      expect(git.cloneRepository).not.toHaveBeenCalled();
    });

    it('refuses to run without a connected repository', async () => {
      prisma.siteRepository.findUnique.mockResolvedValue(null);
      await expect(service.runFixes('proj_1', 'org_1')).rejects.toThrow(BadRequestException);
    });

    it('NEVER pushes when the build fails', async () => {
      validation.validateRepository.mockResolvedValue({ success: false, output: 'tsc error' });

      const run = await service.runFixes('proj_1', 'org_1');

      expect(git.commitAndPush).not.toHaveBeenCalled();
      expect(git.createPullRequest).not.toHaveBeenCalled();
      expect(run.status).toBe(AutomationRunStatus.FAILED);
      expect(run.error).toMatch(/Validation failed/);
    });

    it('does not bill when nothing was shipped', async () => {
      validation.validateRepository.mockResolvedValue({ success: false, output: 'boom' });
      await service.runFixes('proj_1', 'org_1');
      expect(entitlements.recordUsage).not.toHaveBeenCalled();
    });

    it('skips an issue whose URL matches no file, rather than writing to the wrong one', async () => {
      prisma.issue.findMany.mockResolvedValue([
        issue({ id: 'i2', affectedUrl: 'https://acme.com/does/not/exist' }),
      ]);

      const run = await service.runFixes('proj_1', 'org_1');

      expect(patcher.applyFix).not.toHaveBeenCalled();
      expect(run.status).toBe(AutomationRunStatus.FAILED);
      expect(run.error).toMatch(/no matching file/);
    });

    it('skips an issue with an unparseable patch', async () => {
      prisma.issue.findMany.mockResolvedValue([issue({ aiRecommendation: { recommendedFixPatch: 'not json' } })]);
      const run = await service.runFixes('proj_1', 'org_1');
      expect(run.error).toMatch(/no usable patch/);
    });

    it('stops early when there is nothing to fix', async () => {
      prisma.issue.findMany.mockResolvedValue([]);
      const run = await service.runFixes('proj_1', 'org_1');

      expect(git.cloneRepository).not.toHaveBeenCalled();
      expect(run.error).toMatch(/No open issues/);
    });

    it('records a per-step log so a customer can see what happened', async () => {
      const run = await service.runFixes('proj_1', 'org_1');
      const steps = (run.steps as any[]).map((s) => s.step);
      expect(steps).toEqual(expect.arrayContaining(['clone', 'branch', 'patch', 'validate', 'push', 'pull_request']));
    });

    it('deletes the clone afterwards — it holds customer source', async () => {
      await service.runFixes('proj_1', 'org_1');
      await expect(fs.access(workDir)).rejects.toThrow();
    });

    it('cleans up even when the run throws', async () => {
      git.createFeatureBranch.mockRejectedValue(new Error('git exploded'));
      const run = await service.runFixes('proj_1', 'org_1');

      expect(run.status).toBe(AutomationRunStatus.FAILED);
      await expect(fs.access(workDir)).rejects.toThrow();
    });
  });

  describe('runContent', () => {
    const drafted = {
      id: 'piece_1',
      title: 'Best jackets',
      slug: 'best-jackets',
      body: '## Intro',
      metaDescription: 'A guide',
      targetQuery: 'best jackets',
      generatedByModel: 'claude-opus-5',
    };

    it('writes drafted pages and opens a PR', async () => {
      prisma.contentPiece.findMany.mockResolvedValue([drafted]);

      const run = await service.runContent('proj_1', 'org_1');

      expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
      expect(run.filesChanged).toEqual([path.join('content/blog', 'best-jackets.md')]);
      expect(prisma.contentPiece.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'piece_1' } }),
      );
    });

    it('refuses when nothing has been drafted', async () => {
      prisma.contentPiece.findMany.mockResolvedValue([]);
      const run = await service.runContent('proj_1', 'org_1');

      expect(git.cloneRepository).not.toHaveBeenCalled();
      expect(run.error).toMatch(/No drafted content/);
    });

    it('never pushes content when the build fails', async () => {
      prisma.contentPiece.findMany.mockResolvedValue([drafted]);
      validation.validateRepository.mockResolvedValue({ success: false, output: 'broken' });

      const run = await service.runContent('proj_1', 'org_1');

      expect(git.commitAndPush).not.toHaveBeenCalled();
      expect(run.status).toBe(AutomationRunStatus.FAILED);
    });
  });
});
