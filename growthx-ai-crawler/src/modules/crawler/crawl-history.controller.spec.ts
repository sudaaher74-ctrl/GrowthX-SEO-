import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CrawlController } from './crawl.controller';
import { CrawlerService } from './crawler.service';
import { SecurityService } from '../security/security.service';
import { HistoryService } from '../history/history.service';
import { GraphService } from '../graph/graph.service';
import { AiService } from '../ai/ai.service';
import { AutoFixService } from '../ai/auto-fix.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { OrgContextService } from '../organizations/org-context.service';

const ORG = 'org_1';
const REQ = { user: { userId: 'user_1' } };

function run(id: string, finishedAt: string, pagesCrawled: number, issuesFound: number) {
  return { id, pagesCrawled, issuesFound, startedAt: finishedAt, finishedAt };
}

describe('CrawlController — crawl history', () => {
  let controller: CrawlController;
  let prisma: any;
  let orgContext: any;

  beforeEach(async () => {
    prisma = {
      website: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'w1',
          domain: 'milquufresh.in',
          verificationToken: 't',
          project: { organizationId: ORG },
        }),
      },
      crawlJob: { findMany: jest.fn().mockResolvedValue([]) },
    };
    orgContext = { assertMembership: jest.fn().mockResolvedValue(undefined), resolve: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CrawlController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: CrawlerService, useValue: {} },
        { provide: SecurityService, useValue: {} },
        { provide: HistoryService, useValue: {} },
        { provide: GraphService, useValue: {} },
        { provide: AiService, useValue: {} },
        { provide: AutoFixService, useValue: {} },
        { provide: SchedulerService, useValue: {} },
        { provide: OrgContextService, useValue: orgContext },
      ],
    }).compile();

    controller = module.get(CrawlController);
  });

  it('checks the caller belongs to the site\'s organization', async () => {
    await controller.getCrawlHistory(REQ, 'milquufresh.in');

    expect(orgContext.assertMembership).toHaveBeenCalledWith('user_1', ORG);
  });

  it('refuses a domain the caller cannot reach', async () => {
    prisma.website.findUnique.mockResolvedValue(null);

    await expect(controller.getCrawlHistory(REQ, 'someone-elses.com')).rejects.toThrow(NotFoundException);
    expect(prisma.crawlJob.findMany).not.toHaveBeenCalled();
  });

  it('refuses a site attached to no organization', async () => {
    prisma.website.findUnique.mockResolvedValue({ id: 'w1', domain: 'x.com', project: null });

    await expect(controller.getCrawlHistory(REQ, 'x.com')).rejects.toThrow(ForbiddenException);
  });

  // A running or failed job carries zeros; plotting them would draw a collapse
  // that never happened.
  it('asks only for completed crawls that actually finished', async () => {
    await controller.getCrawlHistory(REQ, 'milquufresh.in');

    const where = prisma.crawlJob.findMany.mock.calls[0][0].where;
    expect(where.status).toBe(JobStatus.COMPLETED);
    expect(where.finishedAt).toEqual({ not: null });
  });

  it('returns oldest first so a trend line reads left to right', async () => {
    // The query sorts newest-first; the controller reverses it.
    prisma.crawlJob.findMany.mockResolvedValue([
      run('c3', '2026-08-20T00:00:00Z', 29, 130),
      run('c2', '2026-08-13T00:00:00Z', 25, 140),
      run('c1', '2026-08-06T00:00:00Z', 21, 155),
    ]);

    const result = await controller.getCrawlHistory(REQ, 'milquufresh.in');

    expect(result.map((r: any) => r.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('clamps the window so a long-lived site cannot return thousands', async () => {
    await controller.getCrawlHistory(REQ, 'milquufresh.in', '5000');
    expect(prisma.crawlJob.findMany.mock.calls[0][0].take).toBe(60);

    await controller.getCrawlHistory(REQ, 'milquufresh.in', 'not-a-number');
    expect(prisma.crawlJob.findMany.mock.calls[1][0].take).toBe(12);
  });
});
