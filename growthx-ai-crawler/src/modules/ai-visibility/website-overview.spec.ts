import { AiVisibilityService } from './ai-visibility.service';
import { notOpenedTotal, OverviewCrawl, readState, summarisePages, toPageTypeCounts } from './website-overview';

const at = (iso: string) => new Date(iso);
function crawl(over: Partial<OverviewCrawl>): OverviewCrawl {
  return {
    id: 'job',
    status: 'COMPLETED',
    pagesCrawled: 0,
    healthScore: null,
    errorMessage: null,
    createdAt: at('2026-09-27T10:00:00Z'),
    startedAt: at('2026-09-27T10:00:05Z'),
    finishedAt: at('2026-09-27T10:20:00Z'),
    updatedAt: at('2026-09-27T10:20:00Z'),
    ...over,
  };
}

/**
 * What the customer sees for each website: whether it is being read now, how
 * much of it has been read, and what is on it. The cases below are the ones
 * the old screen could not tell apart.
 */
describe('readState', () => {
  it('says a site is being read while its crawl runs, and which crawl that is', () => {
    const state = readState([crawl({ id: 'now', status: 'RUNNING', pagesCrawled: 37, finishedAt: null })]);
    expect(state).toMatchObject({
      status: 'READING',
      readingCrawlId: 'now',
      readCrawlId: null,
      readingStartedAt: '2026-09-27T10:00:05.000Z',
      lastReadAt: null,
    });
  });

  it('keeps the last good figures on screen while a re-read runs', () => {
    const state = readState([
      crawl({ id: 'now', status: 'RUNNING', pagesCrawled: 12, finishedAt: null }),
      crawl({ id: 'before', pagesCrawled: 247 }),
    ]);
    expect(state).toMatchObject({ status: 'READING', readingCrawlId: 'now', readCrawlId: 'before', lastReadAt: '2026-09-27T10:20:00.000Z' });
  });

  it('says a queued crawl has not started yet', () => {
    expect(readState([crawl({ status: 'PENDING', finishedAt: null, startedAt: null })]).status).toBe('QUEUED');
  });

  it('says a site was read, and when', () => {
    expect(readState([crawl({ id: 'done', pagesCrawled: 34 })])).toMatchObject({ status: 'READ', readingCrawlId: null, readCrawlId: 'done' });
  });

  it('says why a site could not be read, rather than "still reading" forever', () => {
    const state = readState([crawl({ status: 'FAILED', errorMessage: 'The site refused the connection (HTTP 403).', pagesCrawled: 0 })]);
    expect(state).toMatchObject({ status: 'FAILED', readCrawlId: null, error: 'The site refused the connection (HTTP 403).' });
  });

  it('says a site has not been read at all when it has no crawls', () => {
    expect(readState([])).toMatchObject({ status: 'WAITING', readCrawlId: null, readingCrawlId: null });
  });
});

describe('summarisePages', () => {
  const row = (pageType: string | null, statusCode: number | null, count: number, blockedSuspected = false) => ({
    pageType,
    statusCode,
    blockedSuspected,
    count,
  });

  it('counts only pages that opened as read, so the kinds of pages add up to it', () => {
    // The Fortueexicom crawl: 300 attempts, 16 pages that opened.
    const summary = summarisePages([
      row('OTHER', 200, 11),
      row('CATEGORY', 200, 2),
      row('PRODUCT', 301, 2),
      row('HOME', 200, 1),
      row('OTHER', 429, 250, true),
      row('OTHER', 403, 20, true),
      row('OTHER', 404, 9),
      row('OTHER', 0, 5),
    ]);

    expect(summary.opened).toBe(16);
    expect(summary.pageTypes.reduce((sum, t) => sum + t.count, 0)).toBe(summary.opened);
    expect(summary.notOpened).toEqual({ refused: 270, errored: 9, noAnswer: 5 });
    expect(summary.opened + notOpenedTotal(summary.notOpened)).toBe(300);
  });

  it('never counts a page as read when the site turned us away, whatever the status', () => {
    const summary = summarisePages([row('PRODUCT', 200, 3, true)]);
    expect(summary.opened).toBe(0);
    expect(summary.pageTypes).toEqual([]);
    expect(summary.notOpened.refused).toBe(3);
  });

  it('does not count a request nothing answered as a working page', () => {
    // 0 is not an HTTP status. It used to pass a `statusCode < 400` filter
    // and be counted as a page the site has.
    expect(summarisePages([row('OTHER', 0, 4), row('OTHER', null, 1)])).toMatchObject({ opened: 0, notOpened: { noAnswer: 5 } });
  });
});

describe('toPageTypeCounts', () => {
  it('names each kind of page and puts the largest first', () => {
    expect(
      toPageTypeCounts([
        { pageType: 'BLOG', count: 12 },
        { pageType: 'PRODUCT', count: 180 },
        { pageType: 'HOME', count: 1 },
        { pageType: 'CATEGORY', count: 0 },
      ]),
    ).toEqual([
      { type: 'PRODUCT', label: 'Product pages', count: 180 },
      { type: 'BLOG', label: 'Articles and guides', count: 12 },
      { type: 'HOME', label: 'Homepage', count: 1 },
    ]);
  });

  it('counts a type it has no name for as Other, instead of printing a code', () => {
    expect(toPageTypeCounts([{ pageType: 'MYSTERY', count: 3 }, { pageType: 'OTHER', count: 2 }, { pageType: null, count: 1 }])).toEqual([
      { type: 'OTHER', label: 'Other pages', count: 6 },
    ]);
  });
});

describe('AiVisibilityService.websitesOverview', () => {
  function build() {
    const prisma = {
      website: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'w-own', domain: 'milquufresh.in', projectId: 'p1', scope: 'own', crawlJobs: [crawl({ id: 'own', pagesCrawled: 34, healthScore: 80 })] },
          { id: 'w-cd', domain: 'countrydelight.in', projectId: null, scope: 'competitor:p1', crawlJobs: [crawl({ id: 'cd', pagesCrawled: 247 })] },
          {
            id: 'w-md',
            domain: 'mittaldairy.in',
            projectId: null,
            scope: 'competitor:p1',
            crawlJobs: [crawl({ id: 'md', status: 'RUNNING', pagesCrawled: 9, finishedAt: null })],
          },
        ]),
      },
      localLocation: { findFirst: jest.fn().mockResolvedValue({ rating: 4.6, reviewCount: 128 }) },
      page: {
        groupBy: jest.fn().mockResolvedValue([
          { crawlJobId: 'own', pageType: 'PRODUCT', statusCode: 200, blockedSuspected: false, _count: { _all: 20 } },
          { crawlJobId: 'own', pageType: 'HOME', statusCode: 200, blockedSuspected: false, _count: { _all: 1 } },
          // 13 of the 34 attempts on your own site were broken links.
          { crawlJobId: 'own', pageType: 'OTHER', statusCode: 404, blockedSuspected: false, _count: { _all: 13 } },
          { crawlJobId: 'cd', pageType: 'PRODUCT', statusCode: 200, blockedSuspected: false, _count: { _all: 150 } },
          { crawlJobId: 'cd', pageType: 'BLOG', statusCode: 200, blockedSuspected: false, _count: { _all: 60 } },
          // Country Delight turned 37 requests away.
          { crawlJobId: 'cd', pageType: 'OTHER', statusCode: 429, blockedSuspected: true, _count: { _all: 37 } },
          // Mittal Dairy's crawl is running: 7 pages open so far, 2 refused.
          { crawlJobId: 'md', pageType: 'PRODUCT', statusCode: 200, blockedSuspected: false, _count: { _all: 7 } },
          { crawlJobId: 'md', pageType: 'OTHER', statusCode: 403, blockedSuspected: true, _count: { _all: 2 } },
        ]),
      },
    };
    const service = new AiVisibilityService(prisma as any, {} as any);
    jest.spyOn(service, 'listCompetitors').mockResolvedValue([
      { id: 'c1', websiteId: 'w-cd', domain: 'countrydelight.in', label: 'country delight', healthScore: 78, rating: 4.3, reviewCount: 5120 },
      { id: 'c2', websiteId: 'w-md', domain: 'mittaldairy.in', label: 'mittal dairy farms', healthScore: null, rating: null, reviewCount: null },
    ] as any);
    return { service, prisma };
  }

  it("reads this project's own records only, never another customer's record of the same competitor", async () => {
    const { service, prisma } = build();
    await service.websitesOverview('p1');

    expect(prisma.website.findMany.mock.calls[0][0].where).toEqual({
      OR: [{ projectId: 'p1', scope: 'own' }, { id: { in: ['w-cd', 'w-md'] } }],
    });
  });

  it('shows a competitor with no record of its own as not read yet, whatever else is on file for its domain', async () => {
    const { service, prisma } = build();
    // Another customer's record of countrydelight.in, with a finished crawl.
    prisma.website.findMany.mockResolvedValue([
      { id: 'w-theirs', domain: 'countrydelight.in', projectId: null, scope: 'competitor:p2', crawlJobs: [crawl({ id: 'theirs', pagesCrawled: 247 })] },
    ]);
    jest.spyOn(service, 'listCompetitors').mockResolvedValue([
      { id: 'c1', websiteId: null, domain: 'countrydelight.in', label: 'country delight', healthScore: null, rating: null, reviewCount: null },
    ] as any);

    const { sites } = await service.websitesOverview('p1');

    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({ role: 'competitor', status: 'WAITING', pagesRead: 0, lastReadAt: null, pageTypes: [] });
    expect(prisma.page.groupBy).not.toHaveBeenCalled();
  });

  it('describes your website first, then each competitor, with pages, kinds of pages and rating', async () => {
    const { service } = build();
    const { sites } = await service.websitesOverview('p1');

    expect(sites.map((s) => [s.role, s.name, s.status])).toEqual([
      ['you', 'Your website', 'READ'],
      ['competitor', 'country delight', 'READ'],
      ['competitor', 'mittal dairy farms', 'READING'],
    ]);
    expect(sites[0]).toMatchObject({ pagesRead: 21, healthScore: 80, rating: 4.6, reviewCount: 128 });
    expect(sites[0].pageTypes.map((t) => `${t.count} ${t.label}`)).toEqual(['20 Product pages', '1 Homepage']);
    expect(sites[1]).toMatchObject({ pagesRead: 210, healthScore: 78, rating: 4.3, reviewCount: 5120 });
    expect(sites[1].pageTypes[0]).toEqual({ type: 'PRODUCT', label: 'Product pages', count: 150 });
    expect(sites[2]).toMatchObject({ pagesRead: 0, pagesSoFar: 7, notOpenedSoFar: 2, pageTypes: [] });
  });

  it('prints a "Pages read" that the kinds of pages add up to, with the rest shown apart', async () => {
    const { service } = build();
    const { sites } = await service.websitesOverview('p1');

    for (const site of sites) {
      expect(site.pageTypes.reduce((sum, t) => sum + t.count, 0)).toBe(site.pagesRead);
    }
    expect(sites[0].notOpened).toEqual({ refused: 0, errored: 13, noAnswer: 0 });
    expect(sites[1].notOpened).toEqual({ refused: 37, errored: 0, noAnswer: 0 });
  });

  it('says a read\'s pages are no longer known, rather than printing the attempt counter, once its rows are gone', async () => {
    const { service, prisma } = build();
    prisma.page.groupBy.mockResolvedValue([]);
    const { sites } = await service.websitesOverview('p1');

    expect(sites[1]).toMatchObject({ status: 'READ', pagesRead: null, notOpened: null, pageTypes: [] });
  });

  it('counts every site, read and being read, in one query', async () => {
    const { service, prisma } = build();
    await service.websitesOverview('p1');

    expect(prisma.page.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.page.groupBy.mock.calls[0][0].where).toEqual({ crawlJobId: { in: ['own', 'cd', 'md'] } });
  });

  it('says your rating is not connected, rather than zero, when there is no Business Profile location', async () => {
    const { service, prisma } = build();
    prisma.localLocation.findFirst.mockResolvedValue(null);
    const { sites } = await service.websitesOverview('p1');
    expect(sites[0]).toMatchObject({ rating: null, reviewCount: null });
  });
});
