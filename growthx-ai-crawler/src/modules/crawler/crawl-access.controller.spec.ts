import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CrawlController } from './crawl.controller';
import { UrlInventoryService } from './inventory/url-inventory.service';
import { CrawlerService } from './crawler.service';
import { SecurityService } from '../security/security.service';
import { HistoryService } from '../history/history.service';
import { GraphService } from '../graph/graph.service';
import { AiService } from '../ai/ai.service';
import { AutoFixService } from '../ai/auto-fix.service';
import { FixPreviewService } from '../ai/fix-preview.service';
import { VerificationEngineService } from './verification-engine.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { OrgContextService } from '../organizations/org-context.service';
import { SubscriptionQuotaService } from '../organizations/subscription-quota.service';

const REQ = { user: { userId: 'user_1' }, organizationId: 'org_1' };

/**
 * Routes that identify a resource by id rather than by project, and so must
 * each trace it to its organization before acting on it.
 */
describe('CrawlController — cross-tenant access', () => {
  let controller: CrawlController;
  let prisma: any;
  let orgContext: any;
  let aiService: any;
  let autoFix: any;
  let fixPreview: any;
  let verification: any;

  beforeEach(async () => {
    prisma = {
      issue: { findUnique: jest.fn().mockResolvedValue({ crawlJobId: 'job_other' }) },
      crawlJob: {
        findUnique: jest.fn().mockResolvedValue({ id: 'job_other', website: { project: { organizationId: 'org_other' } } }),
      },
      project: { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org_other' }) },
      website: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ id: 'w1', ...create })),
      },
    };
    // The caller belongs to org_1 only.
    const member = (_user: string, org: string) =>
      org === 'org_1' ? Promise.resolve() : Promise.reject(new ForbiddenException('no'));
    orgContext = {
      assertMembership: jest.fn().mockImplementation(member),
      assertCanWrite: jest.fn().mockImplementation(member),
      assertManager: jest.fn().mockImplementation(member),
    };
    aiService = { analyzeIssue: jest.fn() };
    autoFix = { generateFixPatch: jest.fn(), approveAndExecuteFix: jest.fn() };
    fixPreview = { buildPreview: jest.fn() };
    verification = { runVerification: jest.fn(), getLatestCertificate: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrawlController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: CrawlerService, useValue: {} },
        { provide: SecurityService, useValue: { generateVerificationToken: () => 'token' } },
        { provide: HistoryService, useValue: {} },
        { provide: GraphService, useValue: {} },
        { provide: AiService, useValue: aiService },
        { provide: AutoFixService, useValue: autoFix },
        { provide: SchedulerService, useValue: {} },
        { provide: OrgContextService, useValue: orgContext },
        { provide: VerificationEngineService, useValue: verification },
        {
          provide: SubscriptionQuotaService,
          useValue: {
            resolveTierForOrganization: jest.fn().mockResolvedValue('founder_free'),
            assertWebsiteQuota: jest.fn().mockResolvedValue(undefined),
            clampCrawlPageLimit: jest.fn().mockImplementation((limit: number) => limit ?? 5000),
          },
        },
        { provide: FixPreviewService, useValue: fixPreview },
        { provide: UrlInventoryService, useValue: {} },
      ],
    }).compile();

    controller = module.get(CrawlController);
  });

  describe("another organization's issue", () => {
    it('cannot be analysed', async () => {
      await expect(controller.analyzeIssue(REQ, 'issue_other')).rejects.toBeInstanceOf(ForbiddenException);
      expect(aiService.analyzeIssue).not.toHaveBeenCalled();
    });

    it('cannot have a fix generated or previewed', async () => {
      await expect(controller.generateAutoFix(REQ, 'issue_other')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(controller.fixPreview(REQ, 'issue_other')).rejects.toBeInstanceOf(ForbiddenException);
      expect(autoFix.generateFixPatch).not.toHaveBeenCalled();
      expect(fixPreview.buildPreview).not.toHaveBeenCalled();
    });

    it('cannot be approved', async () => {
      await expect(controller.approveFix(REQ, 'issue_other')).rejects.toBeInstanceOf(ForbiddenException);
      expect(autoFix.approveAndExecuteFix).not.toHaveBeenCalled();
    });
  });

  it('records the signed-in user as the approver of their own issue', async () => {
    prisma.crawlJob.findUnique.mockResolvedValue({ id: 'job_1', website: { project: { organizationId: 'org_1' } } });
    await controller.approveFix(REQ, 'issue_1');
    expect(autoFix.approveAndExecuteFix).toHaveBeenCalledWith('issue_1', 'user_1');
  });

  it('reports a missing issue as not found', async () => {
    prisma.issue.findUnique.mockResolvedValue(null);
    await expect(controller.analyzeIssue(REQ, 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuses verification for another organization's project", async () => {
    await expect(controller.runVerification(REQ, 'p_other', {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.getLatestVerification(REQ, 'p_other')).rejects.toBeInstanceOf(ForbiddenException);
    expect(verification.runVerification).not.toHaveBeenCalled();
    expect(verification.getLatestCertificate).not.toHaveBeenCalled();
  });

  describe('website registration', () => {
    it("does not let a differently-typed domain take over another organization's verified site", async () => {
      prisma.website.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.domain_scope?.domain === 'victim.com' && where.domain_scope.scope === 'own'
            ? { id: 'w_victim', isVerified: true, project: { organizationId: 'org_other' } }
            : null,
        ),
      );

      await expect(
        controller.registerWebsiteRoute(REQ, { url: 'https://Victim.com/', domain: 'https://Victim.com/' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.website.upsert).not.toHaveBeenCalled();
    });

    it("registers an unverified site under an org-scoped claim without taking over competitor or exclusive own slots (Medium #18)", async () => {
      await controller.registerWebsiteRoute(REQ, { url: 'https://rival.com', domain: 'rival.com' });

      expect(prisma.website.findUnique.mock.calls[0][0].where).toEqual({ domain_scope: { domain: 'rival.com', scope: 'own' } });
      const upsert = prisma.website.upsert.mock.calls[0][0];
      expect(upsert.where).toEqual({
        domain_scope: { domain: 'rival.com', scope: 'claim:org_1' },
        OR: [{ projectId: null }, { project: { organizationId: 'org_1' } }],
      });
      expect(upsert.create).toMatchObject({ domain: 'rival.com', scope: 'claim:org_1', isVerified: false });
    });

    it('allows the legitimate domain owner to register and verify even if another org holds an unverified claim (Medium #18)', async () => {
      // Another org has a legacy unverified OWN_SCOPE row; Org 1 must NOT be blocked from creating its own claim.
      prisma.website.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(
          where.domain_scope?.domain === 'realowner.com' && where.domain_scope.scope === 'own'
            ? { id: 'w_squat', isVerified: false, project: { organizationId: 'org_squatter' } }
            : null,
        ),
      );

      const claimed = await controller.registerWebsiteRoute(REQ, {
        url: 'https://realowner.com',
        domain: 'realowner.com',
      });
      expect(claimed.scope).toBe('claim:org_1');
      expect(claimed.isVerified).toBe(false);

      // Now Org 1 proves DNS TXT ownership and gets promoted atomically to exclusive OWN_SCOPE.
      prisma.website.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'w1') {
          return Promise.resolve({
            id: 'w1',
            domain: 'realowner.com',
            scope: 'claim:org_1',
            isVerified: false,
            verificationToken: 'token',
            project: { organizationId: 'org_1' },
          });
        }
        if (where.domain_scope?.domain === 'realowner.com' && where.domain_scope.scope === 'own') {
          return Promise.resolve({
            id: 'w_squat',
            isVerified: false,
            project: { organizationId: 'org_squatter' },
          });
        }
        return Promise.resolve(null);
      });
      prisma.website.update = jest.fn().mockImplementation(({ where, data }: any) =>
        Promise.resolve({ id: where.id, domain: 'realowner.com', ...data }),
      );
      (controller as any).securityService.verifyDomainOwnership = jest.fn().mockResolvedValue(true);

      const verified = await controller.verifyDomain(REQ, 'w1');
      expect(verified.success).toBe(true);
      expect(verified.isVerified).toBe(true);
      // Legacy unverified squat was demoted before promoting Org 1 to exclusive OWN_SCOPE
      expect(prisma.website.update).toHaveBeenCalledWith({
        where: { id: 'w_squat' },
        data: { scope: 'legacy-unverified:w_squat' },
      });
      expect(prisma.website.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'w1' },
          data: expect.objectContaining({ scope: 'own', isVerified: true }),
        }),
      );
    });

    it('checks write role and quota in the destination project organization, blocking a viewer in Org B who is owner in Org A (Medium #16)', async () => {
      prisma.project.findUnique.mockResolvedValue({ organizationId: 'org_viewer' });
      orgContext.assertCanWrite.mockImplementation((_user: string, org: string) =>
        org === 'org_1' ? Promise.resolve() : Promise.reject(new ForbiddenException('view-only in org_viewer')),
      );
      orgContext.assertMembership.mockResolvedValue(undefined); // Caller IS a member (VIEWER) of org_viewer!

      await expect(
        controller.registerWebsiteRoute(REQ, {
          url: 'https://new.com',
          domain: 'new.com',
          projectId: 'proj_in_org_viewer',
        }),
      ).rejects.toThrow(/view-only/i);

      expect(orgContext.assertCanWrite).toHaveBeenCalledWith('user_1', 'org_viewer');
      expect(prisma.website.upsert).not.toHaveBeenCalled();
    });

    it('refuses the claim when another organization registered the domain in the meantime', async () => {
      prisma.website.upsert.mockRejectedValueOnce(Object.assign(new Error('unique'), { code: 'P2002' }));
      await expect(
        controller.registerWebsiteRoute(REQ, { url: 'https://new.com', domain: 'new.com' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("refuses to attach a site to a project in another organization", async () => {
      await expect(
        controller.registerWebsiteRoute(REQ, { url: 'https://new.com', domain: 'new.com', projectId: 'p_other' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.website.upsert).not.toHaveBeenCalled();
    });
  });

  describe('crawl status secret redaction (Medium #19)', () => {
    it('selects only public Website fields and strips webhookSecret, authCredentials, and verificationToken on GET /api/crawls/:id for a VIEWER', async () => {
      prisma.crawlJob.findUnique.mockResolvedValue({
        id: 'job_1',
        status: 'COMPLETED',
        website: {
          id: 'w_1',
          domain: 'acme.com',
          scope: 'own',
          url: 'https://acme.com',
          isVerified: true,
          webhookSecret: 'whsec_synthetic_secret_must_never_leak',
          authCredentials: 'enc_synthetic_auth_blob',
          verificationToken: 'growthx-verify-synthetic',
          project: { organizationId: 'org_1' },
        },
      });

      const res: any = await controller.getCrawlJob(REQ, 'job_1');

      // Prisma query itself uses an explicit safe select (never `website: true` or unbounded include)
      const queryArg = prisma.crawlJob.findUnique.mock.calls[0][0];
      expect(queryArg.include.website.select).toBeDefined();
      expect(queryArg.include.website.select.webhookSecret).toBeUndefined();
      expect(queryArg.include.website.select.authCredentials).toBeUndefined();
      expect(queryArg.include.website.select.verificationToken).toBeUndefined();

      // Serialized HTTP response contains ZERO secrets even if extra keys existed
      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('whsec_synthetic_secret_must_never_leak');
      expect(serialized).not.toContain('enc_synthetic_auth_blob');
      expect(serialized).not.toContain('growthx-verify-synthetic');
      expect(res.website).not.toHaveProperty('webhookSecret');
      expect(res.website).not.toHaveProperty('authCredentials');
      expect(res.website).not.toHaveProperty('verificationToken');
      expect(res.website.domain).toBe('acme.com');
    });

    it('strips website secrets on GET /api/websites/:domain/latest-crawl', async () => {
      prisma.website.findUnique.mockResolvedValue({
        id: 'w_1',
        domain: 'acme.com',
        scope: 'own',
        isVerified: true,
        project: { organizationId: 'org_1' },
      });
      prisma.crawlJob.findMany = jest.fn().mockResolvedValue([
        {
          id: 'job_latest',
          status: 'COMPLETED',
          pagesCrawled: 12,
          healthScore: 91,
          website: {
            id: 'w_1',
            domain: 'acme.com',
            webhookSecret: 'whsec_latest_secret',
            authCredentials: 'enc_latest_creds',
            verificationToken: 'verify_latest_tok',
          },
        },
      ]);

      const res: any = await controller.getLatestCrawlJob(REQ, 'acme.com');
      const queryArg = prisma.crawlJob.findMany.mock.calls[0][0];
      expect(queryArg.include.website).toEqual(expect.objectContaining({ select: expect.any(Object) }));
      expect(queryArg.include.website.select.webhookSecret).toBeUndefined();

      const serialized = JSON.stringify(res);
      expect(serialized).not.toContain('whsec_latest_secret');
      expect(serialized).not.toContain('enc_latest_creds');
      expect(serialized).not.toContain('verify_latest_tok');
    });
  });
});
