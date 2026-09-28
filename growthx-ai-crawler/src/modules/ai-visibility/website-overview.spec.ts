import { AiVisibilityService } from './ai-visibility.service';
import { OverviewCrawl, readState, toPageTypeCounts } from './website-overview';

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
  it('says a site is being read, with the pages read so far, while its crawl runs', () => {
    const state = readState([crawl({ id: 'now', status: 'RUNNING', pagesCrawled: 37, finishedAt: null })]);
    expect(state).toMatchObject({ status: 'READING', pagesSoFar: 37, pagesRead: 0, readingStartedAt: '2026-09-27T10:00:05.000Z', lastReadAt: null });
  });

  it('keeps the last good figures on screen while a re-read runs', () => {
    const state = readState([
      crawl({ id: 'now', status: 'RUNNING', pagesCrawled: 12, finishedAt: null }),
      crawl({ id: 'before', pagesCrawled: 247 }),
    ]);
    expect(state).toMatchObject({ status: 'READING', pagesSoFar: 12, pagesRead: 247, readCrawlId: 'before', lastReadAt: '2026-09-27T10:20:00.000Z' });
  });

  it('says a queued crawl has not started yet', () => {
    expect(readState([crawl({ status: 'PENDING', finishedAt: null, startedAt: null })]).status).toBe('QUEUED');
  });

  it('says a site was read, and when', () => {
    expect(readState([crawl({ id: 'done', pagesCrawled: 34 })])).toMatchObject({ status: 'READ', pagesRead: 34, pagesSoFar: null, readCrawlId: 'done' });
  });

  it('says why a site could not be read, rather than "still reading" forever', () => {
    const state = readState([crawl({ status: 'FAILED', errorMessage: 'The site refused the connection (HTTP 403).', pagesCrawled: 0 })]);
    expect(state).toMatchObject({ status: 'FAILED', pagesRead: 0, error: 'The site refused the connection (HTTP 403).' });
  });

  it('says a site has not been read at all when it has no crawls', () => {
    expect(readState([])).toMatchObject({ status: 'WAITING', pagesRead: 0, readCrawlId: null });
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
          { domain: 'milquufresh.in', projectId: 'p1', crawlJobs: [crawl({ id: 'own', pagesCrawled: 34, healthScore: 80 })] },
          { domain: 'countrydelight.in', projectId: null, crawlJobs: [crawl({ id: 'cd', pagesCrawled: 247 })] },
          {
            domain: 'mittaldairy.in',
            projectId: null,
            crawlJobs: [crawl({ id: 'md', status: 'RUNNING', pagesCrawled: 9, finishedAt: null })],
          },
        ]),
      },
      localLocation: { findFirst: jest.fn().mockResolvedValue({ rating: 4.6, reviewCount: 128 }) },
      page: {
        groupBy: jest.fn().mockResolvedValue([
          { crawlJobId: 'own', pageType: 'PRODUCT', _count: { _all: 20 } },
          { crawlJobId: 'own', pageType: 'HOME', _count: { _all: 1 } },
          { crawlJobId: 'cd', pageType: 'PRODUCT', _count: { _all: 150 } },
          { crawlJobId: 'cd', pageType: 'BLOG', _count: { _all: 60 } },
        ]),
      },
    };
    const service = new AiVisibilityService(prisma as any, {} as any);
    jest.spyOn(service, 'listCompetitors').mockResolvedValue([
      { id: 'c1', domain: 'countrydelight.in', label: 'country delight', healthScore: 78, rating: 4.3, reviewCount: 5120 },
      { id: 'c2', domain: 'mittaldairy.in', label: 'mittal dairy farms', healthScore: null, rating: null, reviewCount: null },
    ] as any);
    return { service, prisma };
  }

  it('describes your website first, then each competitor, with pages, kinds of pages and rating', async () => {
    const { service } = build();
    const { sites } = await service.websitesOverview('p1');

    expect(sites.map((s) => [s.role, s.name, s.status])).toEqual([
      ['you', 'Your website', 'READ'],
      ['competitor', 'country delight', 'READ'],
      ['competitor', 'mittal dairy farms', 'READING'],
    ]);
    expect(sites[0]).toMatchObject({ pagesRead: 34, healthScore: 80, rating: 4.6, reviewCount: 128 });
    expect(sites[0].pageTypes.map((t) => `${t.count} ${t.label}`)).toEqual(['20 Product pages', '1 Homepage']);
    expect(sites[1]).toMatchObject({ pagesRead: 247, healthScore: 78, rating: 4.3, reviewCount: 5120 });
    expect(sites[1].pageTypes[0]).toEqual({ type: 'PRODUCT', label: 'Product pages', count: 150 });
    expect(sites[2]).toMatchObject({ pagesSoFar: 9, pageTypes: [] });
  });

  it('counts page kinds from each site\'s own read crawl, leaving broken pages out, in one query', async () => {
    const { service, prisma } = build();
    await service.websitesOverview('p1');

    expect(prisma.page.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.page.groupBy.mock.calls[0][0].where).toEqual({ crawlJobId: { in: ['own', 'cd'] }, statusCode: { lt: 400 } });
  });

  it('says your rating is not connected, rather than zero, when there is no Business Profile location', async () => {
    const { service, prisma } = build();
    prisma.localLocation.findFirst.mockResolvedValue(null);
    const { sites } = await service.websitesOverview('p1');
    expect(sites[0]).toMatchObject({ rating: null, reviewCount: null });
  });
});
