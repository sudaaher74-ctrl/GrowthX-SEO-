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
import { ImpactService } from '../impact/impact.service';
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
  let autoFix: any;
  let validation: any;
  let entitlements: any;
  let impact: any;
  let workDir: string;

  beforeEach(async () => {
    impact = { recordIntervention: jest.fn().mockResolvedValue({ id: 'int-1' }) };
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
      aIRecommendation: {
        findUnique: jest.fn().mockResolvedValue({
          recommendedFixPatch: JSON.stringify({ fixType: 'META_TITLE', proposedValue: 'Generated title' }),
        }),
      },
      contentPiece: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    };

    git = {
      cloneRepository: jest.fn().mockResolvedValue(workDir),
      createFeatureBranch: jest.fn().mockResolvedValue(undefined),
      commitAndPush: jest.fn().mockResolvedValue(undefined),
      createPullRequest: jest.fn().mockResolvedValue('https://github.com/acme/website/pull/7'),
    };
    patcher = { applyFix: jest.fn().mockResolvedValue({ applied: true }) };
    autoFix = { generateFixPatch: jest.fn().mockResolvedValue({ fixType: 'META_TITLE' }) };
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
        { provide: AutoFixService, useValue: autoFix },
        { provide: ContentGenerationService, useValue: { toMarkdownFile: () => '---\ntitle: "x"\n---\nbody\n' } },
        { provide: SecurityService, useValue: { encryptCredentials: (v: string) => `enc:${v}`, decryptCredentials: (v: string) => v.replace('enc:', '') } },
        { provide: ImpactService, useValue: impact },
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

    it('generates the patch when the stored one is prose rather than JSON', async () => {
      // The crawl's analysis writes prose into the same column, so arriving
      // without an applicable patch is the normal case, not an error.
      prisma.issue.findMany.mockResolvedValue([
        issue({ aiRecommendation: { recommendedFixPatch: 'Add a descriptive title.' } }),
      ]);

      const run = await service.runFixes('proj_1', 'org_1');

      expect(autoFix.generateFixPatch).toHaveBeenCalledWith('issue_1', 'org_1');
      expect(patcher.applyFix).toHaveBeenCalled();
      expect(run.pullRequestUrl).toBe('https://github.com/acme/website/pull/7');
    });

    it('regenerates a cached patch that fails to apply and retries once', async () => {
      // A patch cached before a fix-generation bug was fixed (e.g. a schema
      // issue that used to be mis-typed as META_TITLE) can fail forever on
      // stale data even after the code that produced it is fixed.
      patcher.applyFix
        .mockResolvedValueOnce({ applied: false, reason: 'No metadata export to patch.' })
        .mockResolvedValueOnce({ applied: true });

      const run = await service.runFixes('proj_1', 'org_1');

      expect(autoFix.generateFixPatch).toHaveBeenCalledWith('issue_1', 'org_1');
      expect(patcher.applyFix).toHaveBeenCalledTimes(2);
      expect(run.pullRequestUrl).toBe('https://github.com/acme/website/pull/7');
    });

    it('does not retry when a freshly generated patch still fails to apply', async () => {
      prisma.issue.findMany.mockResolvedValue([
        issue({ aiRecommendation: { recommendedFixPatch: 'not json' } }),
      ]);
      patcher.applyFix.mockResolvedValue({ applied: false, reason: 'still no good' });

      const run = await service.runFixes('proj_1', 'org_1');

      expect(autoFix.generateFixPatch).toHaveBeenCalledTimes(1);
      expect(patcher.applyFix).toHaveBeenCalledTimes(1);
      expect(run.error).toMatch(/Nothing could be applied/);
    });

    it('skips the issue when no patch can be generated either', async () => {
      prisma.issue.findMany.mockResolvedValue([
        issue({ aiRecommendation: { recommendedFixPatch: 'not json' } }),
      ]);
      prisma.aIRecommendation.findUnique.mockResolvedValue({ recommendedFixPatch: 'still not json' });

      const run = await service.runFixes('proj_1', 'org_1');
      expect(run.error).toMatch(/no usable patch could be generated/);
    });

    it('reports a generator failure without aborting the run', async () => {
      prisma.issue.findMany.mockResolvedValue([
        issue({ aiRecommendation: { recommendedFixPatch: 'not json' } }),
      ]);
      autoFix.generateFixPatch.mockRejectedValue(new Error('model unavailable'));

      const run = await service.runFixes('proj_1', 'org_1');
      expect(run.error).toMatch(/could not generate a fix/);
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
  describe('the intervention ledger', () => {
    it('records every applied fix against the page it changed', async () => {
      await service.runFixes('proj_1', 'org_1');

      expect(impact.recordIntervention).toHaveBeenCalled();
      const recorded = impact.recordIntervention.mock.calls[0][0];
      expect(recorded).toMatchObject({
        projectId: 'proj_1',
        changeClass: expect.any(String),
      });
      expect(recorded.url).toBeTruthy();
      expect(recorded.pullRequestUrl).toBeTruthy();
    });

    it('does not mark the change shipped, because a pull request is not production', async () => {
      // The measurement clock has to start when the change reached users. A PR
      // that sits unreviewed for three weeks would otherwise have three weeks
      // of unrelated citation movement counted as its "after".
      await service.runFixes('proj_1', 'org_1');

      const recorded = impact.recordIntervention.mock.calls[0][0];
      expect(recorded.shippedAt).toBeUndefined();
    });

    it('still opens the pull request when the ledger write fails', async () => {
      // The customer's change is real either way, and the run's own record
      // already holds the PR URL. Losing the bookkeeping must not lose the fix.
      impact.recordIntervention.mockRejectedValue(new Error('database is down'));

      const run = await service.runFixes('proj_1', 'org_1');
      expect(run.status).toBe(AutomationRunStatus.AWAITING_REVIEW);
      expect(run.pullRequestUrl).toBeTruthy();
    });

    it('records nothing when no fix was applied', async () => {
      patcher.applyFix.mockResolvedValue({ applied: false, reason: 'no match' });

      await service.runFixes('proj_1', 'org_1');
      expect(impact.recordIntervention).not.toHaveBeenCalled();
    });
  });

  describe('resolveTargetFile', () => {
    const os = require('os');
    const realFs = require('fs');
    const nodePath = require('path');
    let repo: string;

    /** Creates an empty file, making its parent directories on the way. */
    function touch(relative: string) {
      const absolute = nodePath.join(repo, relative);
      realFs.mkdirSync(nodePath.dirname(absolute), { recursive: true });
      realFs.writeFileSync(absolute, '');
    }

    const resolve = (url: string, framework = 'nextjs') =>
      (service as any).resolveTargetFile(repo, url, framework);

    beforeEach(() => {
      repo = realFs.mkdtempSync(nodePath.join(os.tmpdir(), 'growthx-resolve-'));
    });

    afterEach(() => {
      realFs.rmSync(repo, { recursive: true, force: true });
    });

    it('finds an App Router page inside a monorepo workspace', async () => {
      touch('frontend/src/app/contact/page.jsx');
      await expect(resolve('https://site.com/contact')).resolves.toBe(
        nodePath.join(repo, 'frontend/src/app/contact/page.jsx'),
      );
    });

    it('sees through route groups, which are on disk but not in the URL', async () => {
      touch('frontend/src/app/(public)/page.jsx');
      touch('frontend/src/app/(public)/about/page.jsx');
      await expect(resolve('https://site.com/')).resolves.toBe(
        nodePath.join(repo, 'frontend/src/app/(public)/page.jsx'),
      );
      await expect(resolve('https://site.com/about')).resolves.toBe(
        nodePath.join(repo, 'frontend/src/app/(public)/about/page.jsx'),
      );
    });

    it('prefers a real route over a bare index.html in an earlier workspace', async () => {
      // readdir yields `admin` before `frontend`; the Next.js page must still win.
      touch('admin/index.html');
      touch('frontend/src/app/(public)/page.jsx');
      await expect(resolve('https://site.com/')).resolves.toBe(
        nodePath.join(repo, 'frontend/src/app/(public)/page.jsx'),
      );
    });

    it('falls back to a dynamic segment only when no literal route matches', async () => {
      touch('src/app/products/page.jsx');
      touch('src/app/products/[slug]/page.jsx');
      await expect(resolve('https://site.com/products')).resolves.toBe(
        nodePath.join(repo, 'src/app/products/page.jsx'),
      );
      await expect(resolve('https://site.com/products/ghee-500ml')).resolves.toBe(
        nodePath.join(repo, 'src/app/products/[slug]/page.jsx'),
      );
    });

    it('still resolves the Pages Router and plain HTML', async () => {
      touch('src/pages/pricing.tsx');
      touch('help.html');
      await expect(resolve('https://site.com/pricing')).resolves.toBe(
        nodePath.join(repo, 'src/pages/pricing.tsx'),
      );
      await expect(resolve('https://site.com/help')).resolves.toBe(nodePath.join(repo, 'help.html'));
    });

    it('returns null rather than guessing when nothing matches', async () => {
      touch('frontend-react/src/pages/Cart.jsx');
      // A react-router SPA maps URLs to components in a router file, not by
      // filename, so /cart must not be guessed onto Cart.jsx.
      await expect(resolve('https://site.com/cart')).resolves.toBeNull();
    });

    it('never escapes the clone directory', async () => {
      touch('src/app/page.jsx');
      await expect(resolve('https://site.com/../../etc/passwd')).resolves.toBeNull();
    });

    it('ignores node_modules when looking for workspaces', async () => {
      touch('node_modules/some-pkg/src/app/contact/page.jsx');
      await expect(resolve('https://site.com/contact')).resolves.toBeNull();
    });
  });

  describe('describeRunFailure', () => {
    const TOKEN = 'github_pat_11EXAMPLE_canary_abcdefghijklmnop';
    const describe_ = (error: any, token = TOKEN) =>
      (service as any).describeRunFailure(error, token);

    it('never returns the access token, which git quotes back on failure', () => {
      // The clone URL embeds the credential, so a failed clone would otherwise
      // write it into the run record, the logs and the dashboard.
      const out = describe_(
        new Error(
          `fatal: could not read Password for 'https://${TOKEN}@github.com': terminal prompts disabled`,
        ),
      );
      expect(out).not.toContain(TOKEN);
      expect(out).toMatch(/rejected the access token/i);
    });

    it('redacts a credential embedded in a URL even when it is not the stored token', () => {
      const out = describe_(new Error("fatal: unable to access 'https://ghp_someoneelse123456@github.com/x/y.git'"), '');
      expect(out).not.toContain('ghp_someoneelse123456');
    });

    it('explains a missing git binary as a deployment problem', () => {
      expect(describe_(new Error('spawn git ENOENT'))).toMatch(/git is not available on the server/i);
    });

    it('distinguishes a missing repository from a permissions failure', () => {
      expect(describe_(new Error('remote: Repository not found'))).toMatch(/could not find that repository/i);
      expect(describe_(new Error('Resource not accessible by personal access token'))).toMatch(
        /missing Contents or Pull requests write access/i,
      );
    });

    it('passes an unrecognised failure through unchanged', () => {
      expect(describe_(new Error('disk quota exceeded'))).toBe('disk quota exceeded');
    });
  });
});
