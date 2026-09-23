import { assertSeveritiesSum, combinedHealthScore, IssueCountService } from './issue-count.service';
import { fingerprintFor } from './fingerprint.util';

/**
 * A small in-memory stand-in for the three tables counting reads. It honours
 * the filters the service actually sends, so a test that seeds history on an
 * old crawl proves the service excludes it rather than proving the mock does.
 */
function fakePrisma(data: {
  websites: Array<{ id: string; projectId: string }>;
  crawls: Array<{
    id: string;
    websiteId: string;
    status: string;
    createdAt: Date;
    pagesCrawled?: number;
    healthScore?: number | null;
    finishedAt?: Date | null;
  }>;
  issues: Array<Record<string, any>>;
}) {
  return {
    website: {
      findMany: jest.fn(async ({ where }: any) =>
        data.websites.filter((w) => w.projectId === where.projectId).map((w) => ({ id: w.id })),
      ),
    },
    crawlJob: {
      findFirst: jest.fn(async ({ where }: any) => {
        const matches = data.crawls
          .filter((c) => c.websiteId === where.websiteId && c.status === where.status)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const c = matches[0];
        return c
          ? {
              id: c.id,
              websiteId: c.websiteId,
              pagesCrawled: c.pagesCrawled ?? 0,
              healthScore: c.healthScore ?? null,
              finishedAt: c.finishedAt ?? c.createdAt,
              createdAt: c.createdAt,
            }
          : null;
      }),
    },
    issue: {
      findMany: jest.fn(async ({ where }: any) => {
        if (where.status === 'RESOLVED') {
          const projectId = where.crawlJob.website.projectId;
          const sites = new Set(data.websites.filter((w) => w.projectId === projectId).map((w) => w.id));
          const jobs = new Set(data.crawls.filter((c) => sites.has(c.websiteId)).map((c) => c.id));
          return data.issues.filter(
            (i) =>
              jobs.has(i.crawlJobId) &&
              i.status === 'RESOLVED' &&
              i.fingerprint &&
              i.resolvedAt >= where.resolvedAt.gte,
          );
        }
        const jobs: string[] = where.crawlJobId.in;
        return data.issues.filter((i) => jobs.includes(i.crawlJobId) && i.status === where.status);
      }),
    },
  };
}

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000);

/** One finding, with every column the service selects. */
function issue(over: Record<string, any>) {
  return {
    status: 'OPEN',
    fingerprint: null,
    groupKey: null,
    confidence: 'LIKELY',
    category: 'TECHNICAL',
    aiFixAvailable: false,
    firstDetectedAt: daysAgo(10),
    regressionCount: 0,
    resolvedAt: null,
    ...over,
  };
}

describe('IssueCountService', () => {
  const project = 'proj_1';
  const single = [{ id: 'site_1', projectId: project }];

  it('makes the severity buckets sum to the total', async () => {
    // The bug this service exists to end: CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0
    // printed directly above a total of 156 and a list of rows tagged HIGH.
    const prisma = fakePrisma({
      websites: single,
      crawls: [{ id: 'job_1', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(1) }],
      issues: [
        issue({ crawlJobId: 'job_1', issueType: 'MISSING_TITLE', severity: 'CRITICAL', affectedUrl: 'https://x.com/' }),
        issue({ crawlJobId: 'job_1', issueType: 'MISSING_H1', severity: 'HIGH', affectedUrl: 'https://x.com/a' }),
        issue({ crawlJobId: 'job_1', issueType: 'MISSING_H1', severity: 'HIGH', affectedUrl: 'https://x.com/b' }),
        issue({ crawlJobId: 'job_1', issueType: 'LONG_TITLE', severity: 'MEDIUM', affectedUrl: 'https://x.com/c' }),
        issue({ crawlJobId: 'job_1', issueType: 'SHORT_TITLE', severity: 'LOW', affectedUrl: 'https://x.com/d' }),
      ],
    });
    const counts = await new IssueCountService(prisma as any).countsForProject(project);

    const sum = Object.values(counts.bySeverity).reduce((s, n) => s + n, 0);
    expect(counts.openFindings).toBe(5);
    expect(sum).toBe(counts.openFindings);
    expect(counts.bySeverity).toEqual({ CRITICAL: 1, HIGH: 2, MEDIUM: 1, LOW: 1 });
  });

  it('does not let findings from a superseded crawl inflate the count', async () => {
    // History is retained, so an old crawl's rows are still in the table. A
    // count over every row would add them to today's total.
    const prisma = fakePrisma({
      websites: single,
      crawls: [
        { id: 'job_old', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(40) },
        { id: 'job_new', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(1) },
      ],
      issues: [
        issue({ crawlJobId: 'job_old', issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: 'https://x.com/a' }),
        issue({ crawlJobId: 'job_old', issueType: 'MISSING_H1', severity: 'HIGH', affectedUrl: 'https://x.com/b' }),
        issue({ crawlJobId: 'job_old', issueType: 'THIN_CONTENT', severity: 'LOW', affectedUrl: 'https://x.com/c' }),
        issue({ crawlJobId: 'job_new', issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: 'https://x.com/a' }),
      ],
    });
    const counts = await new IssueCountService(prisma as any).countsForProject(project);

    expect(counts.openFindings).toBe(1);
  });

  it('ignores a crawl that has not completed', async () => {
    // A running crawl has only seen part of the site. Counting it would report
    // most of the site as suddenly clean.
    const prisma = fakePrisma({
      websites: single,
      crawls: [
        { id: 'job_done', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(5) },
        { id: 'job_running', websiteId: 'site_1', status: 'RUNNING', createdAt: daysAgo(0) },
      ],
      issues: [
        issue({ crawlJobId: 'job_done', issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: 'https://x.com/a' }),
        issue({ crawlJobId: 'job_done', issueType: 'MISSING_H1', severity: 'HIGH', affectedUrl: 'https://x.com/b' }),
      ],
    });
    const counts = await new IssueCountService(prisma as any).countsForProject(project);

    expect(counts.openFindings).toBe(2);
  });

  it('sums across every website in a multi-website project', async () => {
    const prisma = fakePrisma({
      websites: [
        { id: 'site_1', projectId: project },
        { id: 'site_2', projectId: project },
        { id: 'site_other', projectId: 'someone_else' },
      ],
      crawls: [
        { id: 'job_1', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(1), pagesCrawled: 30 },
        { id: 'job_2', websiteId: 'site_2', status: 'COMPLETED', createdAt: daysAgo(2), pagesCrawled: 5 },
        { id: 'job_x', websiteId: 'site_other', status: 'COMPLETED', createdAt: daysAgo(1), pagesCrawled: 99 },
      ],
      issues: [
        issue({ crawlJobId: 'job_1', issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: 'https://a.com/1' }),
        issue({ crawlJobId: 'job_1', issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: 'https://a.com/2' }),
        issue({ crawlJobId: 'job_2', issueType: 'MISSING_H1', severity: 'MEDIUM', affectedUrl: 'https://b.com/1' }),
        issue({ crawlJobId: 'job_x', issueType: 'MISSING_H1', severity: 'CRITICAL', affectedUrl: 'https://z.com/1' }),
      ],
    });
    const counts = await new IssueCountService(prisma as any).countsForProject(project);

    expect(counts.openFindings).toBe(3);
    expect(counts.pagesCrawled).toBe(35);
    // Two sites, two issue types each counted as its own group per site.
    expect(counts.openGroups).toBe(2);
    expect(counts.bySeverity.CRITICAL).toBe(0);
  });

  it('counts correctly before the identity backfill has run', async () => {
    // Production's state today: every existing row has a null fingerprint and
    // a null projectId. Counting DISTINCT fingerprint WHERE projectId would
    // report a fully crawled site as having nothing wrong with it.
    const prisma = fakePrisma({
      websites: single,
      crawls: [{ id: 'job_1', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(1) }],
      issues: [
        issue({ crawlJobId: 'job_1', projectId: null, fingerprint: null, issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: 'https://x.com/a' }),
        issue({ crawlJobId: 'job_1', projectId: null, fingerprint: null, issueType: 'MISSING_H1', severity: 'HIGH', affectedUrl: 'https://x.com/b' }),
      ],
    });
    const counts = await new IssueCountService(prisma as any).countsForProject(project);

    expect(counts.openFindings).toBe(2);
    expect(counts.openGroups).toBe(2);
  });

  it('counts one page reached by two spellings of its URL once', async () => {
    const prisma = fakePrisma({
      websites: single,
      crawls: [{ id: 'job_1', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(1) }],
      issues: [
        issue({ crawlJobId: 'job_1', issueType: 'MISSING_TITLE', severity: 'MEDIUM', affectedUrl: 'http://www.x.com/a/' }),
        issue({ crawlJobId: 'job_1', issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: 'https://x.com/a?utm_source=g' }),
      ],
    });
    const counts = await new IssueCountService(prisma as any).countsForProject(project);

    expect(counts.openFindings).toBe(1);
    // The more severe reading wins, and it is still in exactly one bucket.
    expect(counts.bySeverity).toEqual({ CRITICAL: 0, HIGH: 1, MEDIUM: 0, LOW: 0 });
  });

  it('treats a backfilled fingerprint and a derived one as the same finding', async () => {
    // A crawl half-written before the backfill and half after must not count
    // the same page twice because one row carries its fingerprint and the other
    // has it derived.
    const url = 'https://x.com/a';
    const prisma = fakePrisma({
      websites: single,
      crawls: [{ id: 'job_1', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(1) }],
      issues: [
        issue({ crawlJobId: 'job_1', fingerprint: fingerprintFor(project, 'MISSING_TITLE', url), issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: url }),
        issue({ crawlJobId: 'job_1', fingerprint: null, issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: 'http://www.x.com/a/' }),
      ],
    });
    const counts = await new IssueCountService(prisma as any).countsForProject(project);

    expect(counts.openFindings).toBe(1);
  });

  it('counts only AUTO-routed findings as auto-fixable', async () => {
    const prisma = fakePrisma({
      websites: single,
      crawls: [{ id: 'job_1', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(1) }],
      issues: [
        issue({ crawlJobId: 'job_1', issueType: 'MISSING_META_DESCRIPTION', severity: 'MEDIUM', affectedUrl: 'https://x.com/a' }),
        issue({ crawlJobId: 'job_1', issueType: 'SCHEMA_PRODUCT_OFFERS', severity: 'HIGH', affectedUrl: 'https://x.com/b' }),
        issue({ crawlJobId: 'job_1', issueType: 'MISSING_H1', severity: 'HIGH', affectedUrl: 'https://x.com/c' }),
        issue({ crawlJobId: 'job_1', issueType: 'SERVER_ERROR_5XX', severity: 'CRITICAL', affectedUrl: 'https://x.com/d' }),
      ],
    });
    const counts = await new IssueCountService(prisma as any).countsForProject(project);

    expect(counts.autoFixable).toBe(2);
  });

  it('excludes IGNORED findings from the open count', async () => {
    const prisma = fakePrisma({
      websites: single,
      crawls: [{ id: 'job_1', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(1) }],
      issues: [
        issue({ crawlJobId: 'job_1', issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: 'https://x.com/a' }),
        issue({ crawlJobId: 'job_1', issueType: 'LONG_TITLE', severity: 'LOW', affectedUrl: 'https://x.com/b', status: 'IGNORED' }),
      ],
    });
    const counts = await new IssueCountService(prisma as any).countsForProject(project);

    expect(counts.openFindings).toBe(1);
  });

  it('counts resolutions within the period, read from the crawl that last saw them', async () => {
    const prisma = fakePrisma({
      websites: single,
      crawls: [
        { id: 'job_old', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(20) },
        { id: 'job_new', websiteId: 'site_1', status: 'COMPLETED', createdAt: daysAgo(1) },
      ],
      issues: [
        issue({ crawlJobId: 'job_old', status: 'RESOLVED', fingerprint: 'fp_a', resolvedAt: daysAgo(1), issueType: 'MISSING_TITLE', severity: 'HIGH', affectedUrl: 'https://x.com/a' }),
        issue({ crawlJobId: 'job_old', status: 'RESOLVED', fingerprint: 'fp_b', resolvedAt: daysAgo(60), issueType: 'MISSING_H1', severity: 'HIGH', affectedUrl: 'https://x.com/b' }),
      ],
    });
    const counts = await new IssueCountService(prisma as any).countsForProject(project, 28);

    expect(counts.resolvedThisPeriod).toBe(1);
  });

  it('returns an honest empty result for a project that has never been crawled', async () => {
    const prisma = fakePrisma({ websites: single, crawls: [], issues: [] });
    const counts = await new IssueCountService(prisma as any).countsForProject(project);

    expect(counts.openFindings).toBe(0);
    // Null, not zero: an unmeasured site is not the worst possible site.
    expect(counts.healthScore).toBeNull();
    expect(counts.crawledAt).toBeNull();
  });
});

describe('assertSeveritiesSum', () => {
  const base = {
    openFindings: 3,
    openGroups: 1,
    autoFixable: 0,
    resolvedThisPeriod: 0,
    regressedThisPeriod: 0,
    pagesCrawled: 1,
    healthScore: 90,
    crawledAt: null,
  };

  it('throws outside production when the buckets do not add up', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      expect(() =>
        assertSeveritiesSum({ ...base, bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } }),
      ).toThrow(/bySeverity sums to 0 but openFindings is 3/);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('does not take the dashboard down in production', () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() =>
        assertSeveritiesSum({ ...base, bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } }),
      ).not.toThrow();
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('passes when the buckets add up', () => {
    expect(() =>
      assertSeveritiesSum({ ...base, bySeverity: { CRITICAL: 1, HIGH: 1, MEDIUM: 1, LOW: 0 } }),
    ).not.toThrow();
  });
});

describe('combinedHealthScore', () => {
  const crawl = (healthScore: number | null, pagesCrawled: number) => ({
    id: 'j',
    websiteId: 'w',
    pagesCrawled,
    healthScore,
    finishedAt: null,
    createdAt: new Date(),
  });

  it('is the stored score for a single site, unchanged', () => {
    expect(combinedHealthScore([crawl(89, 35)])).toBe(89);
  });

  it('weights several sites by pages crawled', () => {
    // A 5-page landing site must not outvote a 500-page shop.
    expect(combinedHealthScore([crawl(90, 500), crawl(10, 5)])).toBe(89);
  });

  it('is null when no crawl has produced a score', () => {
    expect(combinedHealthScore([crawl(null, 10)])).toBeNull();
    expect(combinedHealthScore([])).toBeNull();
  });
});
