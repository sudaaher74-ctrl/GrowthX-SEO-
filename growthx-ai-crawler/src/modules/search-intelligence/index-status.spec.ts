import { explainCoverage, IndexStatusService, urlBelongsToProperty } from './index-status.service';

const inspect = jest.fn();
jest.mock('../integrations/google/google-apis', () => ({
  google: { searchconsole: () => ({ urlInspection: { index: { inspect } } }) },
}));

describe('explainCoverage', () => {
  it("puts Google's coverage states in plain words, with what to do", () => {
    expect(explainCoverage('Crawled - currently not indexed')).toMatchObject({ meaning: expect.stringMatching(/chose not to show it/), action: expect.any(String) });
    expect(explainCoverage('Submitted and indexed')).toEqual({ meaning: 'In Google and listed in your sitemap.', action: null });
    expect(explainCoverage("Excluded by ‘noindex’ tag").meaning).toMatch(/not to show it/);
  });

  it("keeps Google's own words for a state it does not know", () => {
    expect(explainCoverage('Something new')).toEqual({ meaning: 'Something new', action: null });
  });
});

describe('urlBelongsToProperty', () => {
  it('matches a domain property on any subdomain, and a URL-prefix property by prefix', () => {
    expect(urlBelongsToProperty('https://shop.milquu.in/a', 'sc-domain:milquu.in')).toBe(true);
    expect(urlBelongsToProperty('https://milquu.in/a', 'https://milquu.in/')).toBe(true);
    expect(urlBelongsToProperty('https://www.milquu.in/a', 'https://milquu.in/')).toBe(false);
    expect(urlBelongsToProperty('https://other.in/a', 'sc-domain:milquu.in')).toBe(false);
  });
});

describe('IndexStatusService', () => {
  function build() {
    const created: any[] = [];
    const prisma: any = {
      integration: { findUnique: jest.fn().mockResolvedValue({ selectedResourceId: 'sc-domain:milquu.in' }) },
      urlIndexInspection: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }) => created.push(data)),
      },
      website: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', domain: 'milquu.in', url: 'https://milquu.in' }) },
      crawlJob: { findFirst: jest.fn().mockResolvedValue({ id: 'job1', createdAt: new Date(), finishedAt: new Date() }) },
      page: {
        findMany: jest.fn().mockResolvedValue([{ url: 'https://milquu.in/' }, { url: 'https://milquu.in/a2-milk' }, { url: 'https://elsewhere.com/x' }]),
      },
    };
    const oauth: any = { clientFor: jest.fn().mockResolvedValue({}) };
    return { service: new IndexStatusService(prisma, oauth), prisma, created };
  }

  beforeEach(() => inspect.mockReset());

  it("stores Google's answer for each crawled page on the property, and nothing else", async () => {
    const { service, created } = build();
    inspect.mockResolvedValue({
      data: {
        inspectionResult: {
          inspectionResultLink: 'https://search.google.com/search-console/inspect?x',
          indexStatusResult: { verdict: 'NEUTRAL', coverageState: 'Crawled - currently not indexed', lastCrawlTime: '2026-09-20T10:00:00Z', sitemap: ['https://milquu.in/sitemap.xml'] },
        },
      },
    });

    const outcome = await service.inspect('p1');

    expect(inspect).toHaveBeenCalledTimes(2);
    expect(inspect.mock.calls[0][0]).toEqual({ requestBody: { inspectionUrl: 'https://milquu.in/', siteUrl: 'sc-domain:milquu.in' } });
    expect(created[1]).toMatchObject({ url: 'https://milquu.in/a2-milk', verdict: 'NEUTRAL', coverageState: 'Crawled - currently not indexed', sitemaps: ['https://milquu.in/sitemap.xml'] });
    expect(outcome).toMatchObject({ inspected: 2, failed: 0, quotaLeft: 1998 });
  });

  it("stops at Google's daily allowance instead of running into it", async () => {
    const { service, prisma } = build();
    prisma.urlIndexInspection.count.mockResolvedValue(2000);
    const outcome = await service.inspect('p1');
    expect(inspect).not.toHaveBeenCalled();
    expect(outcome.note).toMatch(/2,000/);
  });

  it('records a failed page as a failure, never as "not indexed"', async () => {
    const { service, created } = build();
    inspect.mockRejectedValueOnce({ response: { status: 400, data: { error: { message: 'URL not in property' } } } }).mockResolvedValue({ data: {} });
    const outcome = await service.inspect('p1');
    expect(created[0]).toMatchObject({ url: 'https://milquu.in/', error: 'URL not in property' });
    expect(created[0].verdict).toBeUndefined();
    expect(outcome.failed).toBe(1);
  });

  it('asks the customer to connect Search Console first', async () => {
    const { service, prisma } = build();
    prisma.integration.findUnique.mockResolvedValue(null);
    await expect(service.inspect('p1')).rejects.toThrow(/Connect Google Search Console/);
  });
});
