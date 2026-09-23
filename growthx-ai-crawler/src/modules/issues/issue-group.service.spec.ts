import { IssueCountService } from './issue-count.service';
import { IssueGroupService, readableType } from './issue-group.service';

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000);

/** In-memory tables for grouping, including Search Console page data. */
function fakePrisma(issues: Array<Record<string, any>>, gsc: Array<{ page: string; impressions: number }> = []) {
  return {
    website: { findMany: jest.fn(async () => [{ id: 'site_1' }]) },
    crawlJob: {
      findFirst: jest.fn(async () => ({
        id: 'job_1',
        websiteId: 'site_1',
        pagesCrawled: 35,
        healthScore: 89,
        finishedAt: daysAgo(1),
        createdAt: daysAgo(1),
      })),
    },
    issue: {
      findMany: jest.fn(async ({ where }: any) =>
        issues.filter(
          (i) =>
            where.crawlJobId.in.includes(i.crawlJobId) &&
            i.status === where.status &&
            (!where.issueType || where.issueType.in.includes(i.issueType)),
        ),
      ),
    },
    gscDailyMetric: {
      groupBy: jest.fn(async () => gsc.map((g) => ({ page: g.page, _sum: { impressions: g.impressions } }))),
    },
  };
}

function issue(over: Record<string, any>) {
  return {
    crawlJobId: 'job_1',
    status: 'OPEN',
    fingerprint: null,
    groupKey: null,
    severity: 'HIGH',
    confidence: 'LIKELY',
    category: 'SCHEMA',
    aiFixAvailable: true,
    firstDetectedAt: daysAgo(10),
    regressionCount: 0,
    description: 'engine description',
    recommendation: 'engine recommendation',
    ...over,
  };
}

function service(issues: Array<Record<string, any>>, gsc: Array<{ page: string; impressions: number }> = []) {
  const prisma = fakePrisma(issues, gsc) as any;
  return new IssueGroupService(prisma, new IssueCountService(prisma));
}

describe('IssueGroupService.groupsForProject', () => {
  it('shows distinct problems instead of one problem on five pages', async () => {
    // The live Aiva queue: five rows, all SCHEMA_PRODUCT_OFFERS, while the
    // other kinds of finding never made it onto the list.
    const products = ['tomato', 'onion', 'mint', 'coriander-green-chilli', '9mm-french-fries'];
    const svc = service([
      ...products.map((p) =>
        issue({ issueType: 'SCHEMA_PRODUCT_OFFERS', affectedUrl: `https://aivaenterprises.com/products/${p}` }),
      ),
      issue({ issueType: 'MISSING_META_DESCRIPTION', severity: 'MEDIUM', affectedUrl: 'https://aivaenterprises.com/about' }),
      issue({ issueType: 'MISSING_H1', affectedUrl: 'https://aivaenterprises.com/contact', aiFixAvailable: false }),
    ]);

    const { groups } = await svc.groupsForProject('proj_1', { limit: 5 });

    expect(groups.map((g) => g.issueType).sort()).toEqual(
      ['MISSING_H1', 'MISSING_META_DESCRIPTION', 'SCHEMA_PRODUCT_OFFERS'].sort(),
    );
    const schema = groups.find((g) => g.issueType === 'SCHEMA_PRODUCT_OFFERS')!;
    expect(schema.affectedCount).toBe(5);
    expect(schema.sampleUrls).toHaveLength(5);
  });

  it('takes the worst severity and the weakest confidence of its members', async () => {
    const svc = service([
      issue({ issueType: 'MISSING_TITLE', severity: 'LOW', confidence: 'CONFIRMED', affectedUrl: 'https://x.com/a' }),
      issue({ issueType: 'MISSING_TITLE', severity: 'CRITICAL', confidence: 'CONFIRMED', affectedUrl: 'https://x.com/b' }),
      issue({ issueType: 'MISSING_TITLE', severity: 'MEDIUM', confidence: 'ADVISORY', affectedUrl: 'https://x.com/c' }),
    ]);

    const [group] = (await svc.groupsForProject('proj_1')).groups;

    // As urgent as its worst page, as trustworthy as its weakest evidence.
    expect(group.severity).toBe('CRITICAL');
    expect(group.confidence).toBe('ADVISORY');
  });

  it('is auto-fixable only when every member is', async () => {
    const svc = service([
      issue({ issueType: 'MISSING_TITLE', aiFixAvailable: true, affectedUrl: 'https://x.com/a' }),
      issue({ issueType: 'MISSING_TITLE', aiFixAvailable: false, affectedUrl: 'https://x.com/b' }),
    ]);

    const [group] = (await svc.groupsForProject('proj_1')).groups;

    expect(group.aiFixAvailable).toBe(false);
  });

  it('keeps the earliest first-seen date and the highest regression count', async () => {
    const svc = service([
      issue({ issueType: 'MISSING_TITLE', firstDetectedAt: daysAgo(3), regressionCount: 0, affectedUrl: 'https://x.com/a' }),
      issue({ issueType: 'MISSING_TITLE', firstDetectedAt: daysAgo(40), regressionCount: 2, affectedUrl: 'https://x.com/b' }),
    ]);

    const [group] = (await svc.groupsForProject('proj_1')).groups;

    expect(group.firstDetectedAt).toBe(daysAgo(40).toISOString());
    expect(group.regressionCount).toBe(2);
  });

  it('orders by impact, highest first', async () => {
    const svc = service([
      issue({ issueType: 'SHORT_TITLE', severity: 'LOW', confidence: 'ADVISORY', affectedUrl: 'https://x.com/a' }),
      issue({ issueType: 'MISSING_TITLE', severity: 'CRITICAL', confidence: 'CONFIRMED', affectedUrl: 'https://x.com/b' }),
      issue({ issueType: 'LONG_TITLE', severity: 'MEDIUM', confidence: 'LIKELY', affectedUrl: 'https://x.com/c' }),
    ]);

    const { groups } = await svc.groupsForProject('proj_1');
    const impacts = groups.map((g) => g.impact);

    expect(impacts).toEqual([...impacts].sort((a, b) => b - a));
    expect(groups[0].issueType).toBe('MISSING_TITLE');
  });

  it('says ordering is not traffic-weighted when Search Console is not connected', async () => {
    const svc = service([issue({ issueType: 'MISSING_TITLE', affectedUrl: 'https://x.com/a' })], []);

    const result = await svc.groupsForProject('proj_1');

    expect(result.reachAvailable).toBe(false);
    expect(result.groups[0].reachAvailable).toBe(false);
    // Ordering still works without it.
    expect(result.groups[0].impact).toBeGreaterThan(0);
  });

  it('weights by traffic when Search Console is connected, matching URLs normalised', async () => {
    // Search Console reports www and no trailing slash; the crawler recorded
    // the bare host with one. Compared raw, the busy page would look unvisited.
    const svc = service(
      [
        issue({ issueType: 'MISSING_TITLE', severity: 'MEDIUM', affectedUrl: 'https://x.com/busy/' }),
        issue({ issueType: 'LONG_TITLE', severity: 'MEDIUM', affectedUrl: 'https://x.com/quiet' }),
      ],
      [
        { page: 'https://www.x.com/busy', impressions: 900 },
        { page: 'https://www.x.com/quiet', impressions: 100 },
      ],
    );

    const { groups, reachAvailable } = await svc.groupsForProject('proj_1');

    expect(reachAvailable).toBe(true);
    // Same severity, same fix class — traffic alone decides the order.
    expect(groups[0].issueType).toBe('MISSING_TITLE');
    expect(groups[0].impact).toBeGreaterThan(groups[1].impact);
  });

  it('returns an honest empty list for another detector rather than relabelling the audit', async () => {
    const svc = service([issue({ issueType: 'MISSING_TITLE', affectedUrl: 'https://x.com/a' })]);

    expect((await svc.groupsForProject('proj_1', { source: 'LOCAL' })).groups).toEqual([]);
    expect((await svc.groupsForProject('proj_1', { source: 'website' })).groups).toHaveLength(1);
  });

  it('filters by severity', async () => {
    const svc = service([
      issue({ issueType: 'MISSING_TITLE', severity: 'CRITICAL', affectedUrl: 'https://x.com/a' }),
      issue({ issueType: 'LONG_TITLE', severity: 'LOW', affectedUrl: 'https://x.com/b' }),
    ]);

    const { groups } = await svc.groupsForProject('proj_1', { severity: 'critical' });

    expect(groups.map((g) => g.issueType)).toEqual(['MISSING_TITLE']);
  });

  it('uses the plain-language copy layer for title, summary and action', async () => {
    const svc = service([
      issue({ issueType: 'MISSING_META_DESCRIPTION', affectedUrl: 'https://x.com/a', description: 'No meta description.', recommendation: 'Add one.' }),
    ]);

    const [group] = (await svc.groupsForProject('proj_1')).groups;

    expect(group.title).toBe('1 page lets Google write their own description — usually badly');
    expect(group.action).toContain("We'll write a short description for each page");
  });
});

describe('IssueGroupService.pagesForGroup', () => {
  it('paginates the affected pages past 100', async () => {
    const svc = service(
      Array.from({ length: 250 }, (_, i) =>
        issue({ issueType: 'MISSING_ALT_TEXT', affectedUrl: `https://x.com/p/${String(i).padStart(3, '0')}` }),
      ),
    );
    const { groups } = await svc.groupsForProject('proj_1');
    const key = groups[0].groupKey;

    const first = await svc.pagesForGroup('proj_1', key, 100);
    const second = await svc.pagesForGroup('proj_1', key, 100, first.nextCursor!);
    const third = await svc.pagesForGroup('proj_1', key, 100, second.nextCursor!);

    expect(first.total).toBe(250);
    expect(first.items).toHaveLength(100);
    expect(second.items).toHaveLength(100);
    expect(third.items).toHaveLength(50);
    expect(third.nextCursor).toBeNull();

    // Every page exactly once across the whole walk.
    const seen = [...first.items, ...second.items, ...third.items].map((i) => i.url);
    expect(new Set(seen).size).toBe(250);
  });

  it('treats a garbage cursor as the start rather than failing', async () => {
    const svc = service([issue({ issueType: 'MISSING_TITLE', affectedUrl: 'https://x.com/a' })]);
    const { groups } = await svc.groupsForProject('proj_1');

    const page = await svc.pagesForGroup('proj_1', groups[0].groupKey, 10, 'not-a-cursor!!');

    expect(page.items).toHaveLength(1);
  });

  it('returns an empty page for a group that does not exist', async () => {
    const svc = service([issue({ issueType: 'MISSING_TITLE', affectedUrl: 'https://x.com/a' })]);

    const page = await svc.pagesForGroup('proj_1', 'proj_1::NOPE', 10);

    expect(page).toEqual({ items: [], nextCursor: null, total: 0 });
  });
});

describe('readableType', () => {
  it('turns an engine type into a readable label', () => {
    expect(readableType('MISSING_META_DESCRIPTION')).toBe('Missing meta description');
    expect(readableType('SCHEMA_PRODUCT_OFFERS')).toBe('Schema product offers');
  });
});
