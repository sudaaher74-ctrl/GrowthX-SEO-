import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CrawlController } from './crawl.controller';
import { CrawlerService, crawlLimits } from './crawler.service';
import { UrlInventoryService } from './inventory/url-inventory.service';
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

/** The shared crawl workers must not be monopolised by one account or one site. */
describe('crawl capacity', () => {
  describe('starting an audit from the app', () => {
    let controller: CrawlController;
    let prisma: any;
    let crawler: { startCrawlJob: jest.Mock };

    beforeEach(async () => {
      prisma = {
        website: {
          findUnique: jest.fn().mockResolvedValue({ id: 'w_new', domain: 'new.in', project: { organizationId: 'org_1' } }),
        },
        crawlJob: { findMany: jest.fn().mockResolvedValue([]) },
      };
      crawler = { startCrawlJob: jest.fn().mockResolvedValue('job_1') };
      const module: TestingModule = await Test.createTestingModule({
        controllers: [CrawlController],
        providers: [
          { provide: PrismaService, useValue: prisma },
          { provide: CrawlerService, useValue: crawler },
          { provide: SecurityService, useValue: {} },
          { provide: HistoryService, useValue: {} },
          { provide: GraphService, useValue: {} },
          { provide: AiService, useValue: {} },
          { provide: AutoFixService, useValue: {} },
          { provide: SchedulerService, useValue: {} },
          { provide: OrgContextService, useValue: { assertMembership: jest.fn().mockResolvedValue(undefined) } },
          { provide: VerificationEngineService, useValue: {} },
          { provide: FixPreviewService, useValue: {} },
          { provide: UrlInventoryService, useValue: {} },
        ],
      }).compile();
      controller = module.get(CrawlController);
    });

    it('starts an audit when the account has room', async () => {
      prisma.crawlJob.findMany.mockResolvedValue([{ websiteId: 'w_a' }]);
      await expect(controller.startCrawlJob(REQ, { websiteId: 'w_new' })).resolves.toMatchObject({ jobId: 'job_1' });
    });

    it("refuses a fourth site while three of the account's sites are being audited", async () => {
      prisma.crawlJob.findMany.mockResolvedValue([{ websiteId: 'w_a' }, { websiteId: 'w_b' }, { websiteId: 'w_c' }]);
      const error = await controller.startCrawlJob(REQ, { websiteId: 'w_new' }).catch((e) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(429);
      expect(crawler.startCrawlJob).not.toHaveBeenCalled();
    });

    it('always lets a site that is already being audited through, since that returns the running crawl', async () => {
      prisma.crawlJob.findMany.mockResolvedValue([{ websiteId: 'w_a' }, { websiteId: 'w_b' }, { websiteId: 'w_new' }]);
      await expect(controller.startCrawlJob(REQ, { websiteId: 'w_new' })).resolves.toMatchObject({ jobId: 'job_1' });
    });

    it("counts only this organization's own sites", async () => {
      await controller.startCrawlJob(REQ, { websiteId: 'w_new' });
      expect(prisma.crawlJob.findMany.mock.calls[0][0].where.website).toEqual({ scope: 'own', project: { organizationId: 'org_1' } });
    });
  });

  describe('CrawlerService.startCrawlJob', () => {
    function fakeService(inFlight: { id: string } | null) {
      const created: any[] = [];
      const self: any = {
        prisma: {
          website: { findUnique: jest.fn().mockResolvedValue({ id: 'w1', domain: 'shop.in', url: 'https://shop.in', maxConcurrency: 5, maxDepth: 10, rateLimitDelayMs: 500 }) },
          crawlJob: {
            findFirst: jest.fn().mockResolvedValue(inFlight),
            create: jest.fn(async ({ data }: any) => {
              created.push(data);
              return { id: 'job_new', ...data };
            }),
          },
        },
        logger: { log: jest.fn() },
        queue: { addCrawlJob: jest.fn(), crawlJobsQueue: {} },
      };
      return { self, created, start: (opts: any = {}) => (CrawlerService.prototype.startCrawlJob as any).call(self, 'w1', opts) };
    }

    it('hands back the crawl already running for the site instead of starting a second', async () => {
      const { start, created, self } = fakeService({ id: 'job_running' });
      await expect(start()).resolves.toBe('job_running');
      expect(created).toEqual([]);
      expect(self.queue.addCrawlJob).not.toHaveBeenCalled();
    });

    it('caps concurrency, depth and pages at the deployment ceilings', async () => {
      const { start, created } = fakeService(null);
      await start({ maxConcurrency: 500, maxDepth: 1000, pageLimit: 1_000_000 });
      const limits = crawlLimits();
      expect(created[0]).toMatchObject({ concurrency: limits.maxConcurrency, depthLimit: limits.maxDepth, pageLimit: limits.maxPageLimit });
    });

    it('gives every crawl a page ceiling, even when none was asked for', async () => {
      const { start, created } = fakeService(null);
      await start();
      expect(created[0].pageLimit).toBe(crawlLimits().defaultPageLimit);
    });

    it('keeps a smaller page limit a caller asked for', async () => {
      const { start, created } = fakeService(null);
      await start({ pageLimit: 150 });
      expect(created[0].pageLimit).toBe(150);
    });
  });
});
