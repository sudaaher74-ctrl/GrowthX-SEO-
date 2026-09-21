import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService, CrawlDiffReport } from './history.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { CrawlJob, Issue, IssueSeverity, JobStatus } from '@prisma/client';

describe('HistoryService', () => {
  let service: HistoryService;
  let mockPrisma: {
    crawlJob: {
      findUnique: jest.Mock;
    };
    issue: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    mockPrisma = {
      crawlJob: {
        findUnique: jest.fn(),
      },
      issue: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw NotFoundException when current crawl job does not exist', async () => {
    mockPrisma.crawlJob.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'job_curr') return Promise.resolve(null);
      if (where.id === 'job_prev') return Promise.resolve({ id: 'job_prev', pagesCrawled: 10 });
      return Promise.resolve(null);
    });

    await expect(service.compareCrawlJobs('job_curr', 'job_prev')).rejects.toThrow(NotFoundException);
    await expect(service.compareCrawlJobs('job_curr', 'job_prev')).rejects.toThrow(
      'One or both specified crawl jobs were not found',
    );
  });

  it('should throw NotFoundException when previous crawl job does not exist', async () => {
    mockPrisma.crawlJob.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'job_curr') return Promise.resolve({ id: 'job_curr', pagesCrawled: 20 });
      if (where.id === 'job_prev') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    await expect(service.compareCrawlJobs('job_curr', 'job_prev')).rejects.toThrow(NotFoundException);
  });

  it('should correctly identify recurring, new, and resolved issues between two crawl jobs', async () => {
    const prevJob: Partial<CrawlJob> = {
      id: 'job_audit_1',
      pagesCrawled: 25,
      status: JobStatus.COMPLETED,
    };
    const currJob: Partial<CrawlJob> = {
      id: 'job_audit_2',
      pagesCrawled: 30,
      status: JobStatus.COMPLETED,
    };

    mockPrisma.crawlJob.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'job_audit_2') return Promise.resolve(currJob);
      if (where.id === 'job_audit_1') return Promise.resolve(prevJob);
      return Promise.resolve(null);
    });

    // Previous crawl issues: Issue A, Issue B, Issue C
    const prevIssues: Partial<Issue>[] = [
      {
        issueType: 'MISSING_TITLE',
        affectedUrl: 'https://example.com/page-1',
        severity: IssueSeverity.HIGH,
        description: 'Page is missing title tag',
      },
      {
        issueType: 'BROKEN_LINK_INTERNAL',
        affectedUrl: 'https://example.com/broken-page',
        severity: IssueSeverity.CRITICAL,
        description: 'Internal link returns 404',
      },
      {
        issueType: 'SLOW_LCP',
        affectedUrl: 'https://example.com/heavy-page',
        severity: IssueSeverity.MEDIUM,
        description: 'LCP is over 2.5s',
      },
    ];

    // Current crawl issues:
    // - Issue A (MISSING_TITLE on page-1): recurring
    // - Issue C (SLOW_LCP on heavy-page): recurring
    // - Issue D (MISSING_META_DESCRIPTION on page-2): new
    // - Issue B (BROKEN_LINK_INTERNAL on broken-page): absent -> resolved!
    const currIssues: Partial<Issue>[] = [
      {
        issueType: 'MISSING_TITLE',
        affectedUrl: 'https://example.com/page-1',
        severity: IssueSeverity.HIGH,
        description: 'Page is missing title tag',
      },
      {
        issueType: 'SLOW_LCP',
        affectedUrl: 'https://example.com/heavy-page',
        severity: IssueSeverity.MEDIUM,
        description: 'LCP is over 2.5s',
      },
      {
        issueType: 'MISSING_META_DESCRIPTION',
        affectedUrl: 'https://example.com/page-2',
        severity: IssueSeverity.MEDIUM,
        description: 'Page is missing meta description',
      },
    ];

    mockPrisma.issue.findMany.mockImplementation(({ where }: { where: { crawlJobId: string } }) => {
      if (where.crawlJobId === 'job_audit_2') return Promise.resolve(currIssues);
      if (where.crawlJobId === 'job_audit_1') return Promise.resolve(prevIssues);
      return Promise.resolve([]);
    });

    const report: CrawlDiffReport = await service.compareCrawlJobs('job_audit_2', 'job_audit_1');

    expect(report.currentJobId).toBe('job_audit_2');
    expect(report.previousJobId).toBe('job_audit_1');
    expect(report.pageCountDiff).toBe(5); // 30 - 25
    expect(report.issuesCountDiff).toBe(0); // 3 - 3

    expect(report.recurringIssues).toHaveLength(2);
    expect(report.recurringIssues.map((i) => i.issueType)).toEqual(
      expect.arrayContaining(['MISSING_TITLE', 'SLOW_LCP']),
    );

    expect(report.newIssues).toHaveLength(1);
    expect(report.newIssues[0]).toEqual({
      issueType: 'MISSING_META_DESCRIPTION',
      severity: IssueSeverity.MEDIUM,
      affectedUrl: 'https://example.com/page-2',
      description: 'Page is missing meta description',
    });

    expect(report.resolvedIssues).toHaveLength(1);
    expect(report.resolvedIssues[0]).toEqual({
      issueType: 'BROKEN_LINK_INTERNAL',
      severity: IssueSeverity.CRITICAL,
      affectedUrl: 'https://example.com/broken-page',
      description: 'Internal link returns 404',
    });

    expect(report.summaryMessage).toBe(
      'Comparison complete: 1 new issues detected, 1 issues resolved, and 2 issues remain open.',
    );
  });

  it('should differentiate multiple issues on the same URL by issueType', async () => {
    mockPrisma.crawlJob.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      return Promise.resolve({ id: where.id, pagesCrawled: 10 });
    });

    const prevIssues: Partial<Issue>[] = [
      {
        issueType: 'MISSING_TITLE',
        affectedUrl: 'https://example.com/home',
        severity: IssueSeverity.HIGH,
        description: 'Missing title',
      },
    ];

    const currIssues: Partial<Issue>[] = [
      {
        issueType: 'MISSING_H1',
        affectedUrl: 'https://example.com/home',
        severity: IssueSeverity.MEDIUM,
        description: 'Missing H1',
      },
    ];

    mockPrisma.issue.findMany.mockImplementation(({ where }: { where: { crawlJobId: string } }) => {
      if (where.crawlJobId === 'curr') return Promise.resolve(currIssues);
      return Promise.resolve(prevIssues);
    });

    const report = await service.compareCrawlJobs('curr', 'prev');

    expect(report.recurringIssues).toHaveLength(0);
    expect(report.resolvedIssues).toHaveLength(1);
    expect(report.resolvedIssues[0].issueType).toBe('MISSING_TITLE');
    expect(report.newIssues).toHaveLength(1);
    expect(report.newIssues[0].issueType).toBe('MISSING_H1');
  });

  it('should differentiate identical issue types on different URLs', async () => {
    mockPrisma.crawlJob.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      return Promise.resolve({ id: where.id, pagesCrawled: 10 });
    });

    const prevIssues: Partial<Issue>[] = [
      {
        issueType: '404_PAGE',
        affectedUrl: 'https://example.com/old-url',
        severity: IssueSeverity.HIGH,
        description: 'Page not found',
      },
    ];

    const currIssues: Partial<Issue>[] = [
      {
        issueType: '404_PAGE',
        affectedUrl: 'https://example.com/new-url',
        severity: IssueSeverity.HIGH,
        description: 'Page not found',
      },
    ];

    mockPrisma.issue.findMany.mockImplementation(({ where }: { where: { crawlJobId: string } }) => {
      if (where.crawlJobId === 'curr') return Promise.resolve(currIssues);
      return Promise.resolve(prevIssues);
    });

    const report = await service.compareCrawlJobs('curr', 'prev');

    expect(report.recurringIssues).toHaveLength(0);
    expect(report.resolvedIssues[0].affectedUrl).toBe('https://example.com/old-url');
    expect(report.newIssues[0].affectedUrl).toBe('https://example.com/new-url');
  });

  it('should handle negative deltas and zero issues cleanly', async () => {
    mockPrisma.crawlJob.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === 'curr') return Promise.resolve({ id: 'curr', pagesCrawled: 5 });
      if (where.id === 'prev') return Promise.resolve({ id: 'prev', pagesCrawled: 20 });
      return Promise.resolve(null);
    });

    mockPrisma.issue.findMany.mockResolvedValue([]);

    const report = await service.compareCrawlJobs('curr', 'prev');

    expect(report.pageCountDiff).toBe(-15); // 5 - 20
    expect(report.issuesCountDiff).toBe(0);
    expect(report.newIssues).toHaveLength(0);
    expect(report.resolvedIssues).toHaveLength(0);
    expect(report.recurringIssues).toHaveLength(0);
    expect(report.summaryMessage).toBe(
      'Comparison complete: 0 new issues detected, 0 issues resolved, and 0 issues remain open.',
    );
  });

  it('should invoke and integrate with underlying CrawlJob and Issue Prisma models', async () => {
    // Model invocation: simulate realistic CrawlJob and Issue entities conforming to Prisma types
    const mockCrawlJobPrevious: Partial<CrawlJob> = {
      id: 'job_prisma_prev_101',
      websiteId: 'website_prod_1',
      status: JobStatus.COMPLETED,
      pagesCrawled: 120,
      pagesDiscovered: 130,
      issuesFound: 2,
      healthScore: 84,
      uniqueIssuesCount: 2,
      resolvedIssuesCount: 0,
    };

    const mockCrawlJobCurrent: Partial<CrawlJob> = {
      id: 'job_prisma_curr_102',
      websiteId: 'website_prod_1',
      status: JobStatus.COMPLETED,
      pagesCrawled: 125,
      pagesDiscovered: 135,
      issuesFound: 1,
      healthScore: 92,
      uniqueIssuesCount: 1,
      resolvedIssuesCount: 1,
    };

    const mockIssuesPrev: Partial<Issue>[] = [
      {
        id: 'iss_1',
        crawlJobId: mockCrawlJobPrevious.id!,
        issueType: 'MISSING_H1',
        severity: IssueSeverity.MEDIUM,
        affectedUrl: 'https://example.com/about',
        description: 'Page is missing H1 heading',
        recommendation: 'Add <h1> tag',
      },
      {
        id: 'iss_2',
        crawlJobId: mockCrawlJobPrevious.id!,
        issueType: 'MIXED_CONTENT',
        severity: IssueSeverity.HIGH,
        affectedUrl: 'https://example.com/store',
        description: 'HTTP resource on HTTPS page',
        recommendation: 'Upgrade to https://',
      },
    ];

    const mockIssuesCurr: Partial<Issue>[] = [
      {
        id: 'iss_3',
        crawlJobId: mockCrawlJobCurrent.id!,
        issueType: 'MIXED_CONTENT',
        severity: IssueSeverity.HIGH,
        affectedUrl: 'https://example.com/store',
        description: 'HTTP resource on HTTPS page',
        recommendation: 'Upgrade to https://',
      },
    ];

    mockPrisma.crawlJob.findUnique.mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === mockCrawlJobCurrent.id) return Promise.resolve(mockCrawlJobCurrent);
      if (where.id === mockCrawlJobPrevious.id) return Promise.resolve(mockCrawlJobPrevious);
      return Promise.resolve(null);
    });

    mockPrisma.issue.findMany.mockImplementation(({ where }: { where: { crawlJobId: string } }) => {
      if (where.crawlJobId === mockCrawlJobCurrent.id) return Promise.resolve(mockIssuesCurr);
      if (where.crawlJobId === mockCrawlJobPrevious.id) return Promise.resolve(mockIssuesPrev);
      return Promise.resolve([]);
    });

    const result = await service.compareCrawlJobs(mockCrawlJobCurrent.id!, mockCrawlJobPrevious.id!);

    expect(result.currentJobId).toBe(mockCrawlJobCurrent.id);
    expect(result.previousJobId).toBe(mockCrawlJobPrevious.id);
    expect(result.pageCountDiff).toBe(5);
    expect(result.issuesCountDiff).toBe(-1); // 1 - 2 = -1
    expect(result.recurringIssues).toHaveLength(1);
    expect(result.recurringIssues[0].issueType).toBe('MIXED_CONTENT');
    expect(result.resolvedIssues).toHaveLength(1);
    expect(result.resolvedIssues[0].issueType).toBe('MISSING_H1');
    expect(result.newIssues).toHaveLength(0);
  });
});
