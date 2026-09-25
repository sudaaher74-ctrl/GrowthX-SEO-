import { RivalSnapshotService, extractPageFacts, factsHash } from './rival-snapshot.service';

const html = (title: string, extra = '') => `<!doctype html><html><head><title>${title}</title>
<meta name="description" content="Fresh A2 milk delivered daily">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":["Product","Offer"]}]}</script>
<script type="application/ld+json">{ not json</script>
</head><body><h1>  A2 Milk   Delivery </h1><p>one two three</p>${extra}<script>var x = "ignored words";</script></body></html>`;

describe('extractPageFacts', () => {
  it('reads title, h1, meta description, JSON-LD types and word count', () => {
    const facts = extractPageFacts(html('A2 Milk | Rival'), 200);
    expect(facts).toEqual({
      statusCode: 200,
      title: 'A2 Milk | Rival',
      h1: 'A2 Milk Delivery',
      metaDescription: 'Fresh A2 milk delivered daily',
      schemaTypes: ['Offer', 'Organization', 'Product'],
      wordCount: 6,
    });
  });

  it('gives the same hash for the same facts and a different one when a title changes', () => {
    expect(factsHash(extractPageFacts(html('A'), 200))).toBe(factsHash(extractPageFacts(html('A'), 200)));
    expect(factsHash(extractPageFacts(html('A'), 200))).not.toBe(factsHash(extractPageFacts(html('B'), 200)));
  });
});

class TestService extends RivalSnapshotService {
  protected pause(): Promise<void> {
    return Promise.resolve();
  }
}

function setup(opts: { urls: string[]; lastHash?: string | null; disallow?: string[] }) {
  const prisma = {
    rivalPageSnapshot: {
      findFirst: jest.fn().mockResolvedValue(opts.lastHash ? { contentHash: opts.lastHash } : null),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const discovery = {
    discoverSeeds: jest.fn().mockResolvedValue({
      urls: opts.urls.map((u) => ({ url: u, normalizedUrl: u, source: 'sitemap' })),
      robots: {},
    }),
    isAllowed: jest.fn((_r: unknown, url: string) => ({ allowed: !(opts.disallow ?? []).includes(url), evidence: '' })),
  };
  const fetcher = { fetchPage: jest.fn().mockResolvedValue({ html: html('Same'), statusCode: 200 }) };
  const service = new TestService(prisma as any, discovery as any, fetcher as any);
  return { service, prisma, fetcher };
}

describe('RivalSnapshotService.snapshotDomain', () => {
  it('writes a snapshot for a page seen for the first time', async () => {
    const { service, prisma } = setup({ urls: ['https://rival.in/a'] });
    const r = await service.snapshotDomain('rival.in');
    expect(r.written).toBe(2); // homepage + /a
    expect(prisma.rivalPageSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ domain: 'rival.in', url: 'https://rival.in/a', title: 'Same' }) }),
    );
  });

  it('writes nothing when the page has not changed since the last snapshot', async () => {
    const unchanged = factsHash(extractPageFacts(html('Same'), 200));
    const { service, prisma } = setup({ urls: ['https://rival.in/a'], lastHash: unchanged });
    const r = await service.snapshotDomain('rival.in');
    expect(r.fetched).toBe(2);
    expect(r.written).toBe(0);
    expect(prisma.rivalPageSnapshot.create).not.toHaveBeenCalled();
  });

  it('respects robots.txt and ignores other hosts', async () => {
    const { service, fetcher } = setup({
      urls: ['https://rival.in/private', 'https://other.com/x', 'https://www.rival.in/ok'],
      disallow: ['https://rival.in/private'],
    });
    const r = await service.snapshotDomain('rival.in');
    expect(r.skippedByRobots).toBe(1);
    const fetched = fetcher.fetchPage.mock.calls.map((c) => c[0]);
    expect(fetched).toEqual(['https://rival.in/', 'https://www.rival.in/ok']);
  });

  it('never fetches more than MAX_PAGES from one rival', async () => {
    const urls = Array.from({ length: 120 }, (_, i) => `https://rival.in/p${i}`);
    const { service, fetcher } = setup({ urls });
    await service.snapshotDomain('rival.in');
    expect(fetcher.fetchPage).toHaveBeenCalledTimes(RivalSnapshotService.MAX_PAGES);
  });
});
