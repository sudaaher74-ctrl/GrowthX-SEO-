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
    orgContext = {
      assertMembership: jest.fn().mockImplementation((_user: string, org: string) =>
        org === 'org_1' ? Promise.resolve() : Promise.reject(new ForbiddenException('no')),
      ),
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
    it("does not let a differently-typed domain take over another organization's site", async () => {
      prisma.website.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve(where.domain === 'victim.com' ? { id: 'w_victim', project: { organizationId: 'org_other' } } : null),
      );

      await expect(
        controller.registerWebsiteRoute(REQ, { url: 'https://Victim.com/', domain: 'https://Victim.com/' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.website.upsert).not.toHaveBeenCalled();
    });

    it("refuses to attach a site to a project in another organization", async () => {
      await expect(
        controller.registerWebsiteRoute(REQ, { url: 'https://new.com', domain: 'new.com', projectId: 'p_other' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.website.upsert).not.toHaveBeenCalled();
    });
  });
});
