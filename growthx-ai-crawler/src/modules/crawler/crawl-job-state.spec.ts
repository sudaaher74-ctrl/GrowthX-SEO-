import { CrawlJobState } from './crawl-job-state';
import { normalizeUrl } from './url/url-normalizer';
import { UrlInventoryService } from './inventory/url-inventory.service';

describe('crawl state frontier identity', () => {
  const state = new CrawlJobState({} as any);
  it.each([
    'https://osinterior.in/contact?project=99%20WOK%20STREET',
    'https://osinterior.in/contact?project=CARAVAN%20LOUNGE',
    'https://example.com/products?b=2&a=1&utm_source=test',
  ])('settles the same URL key the frontier claimed: %s', raw => {
    expect(state.normalizeUrl(raw)).toBe(normalizeUrl(raw));
  });
  it('releases a reservation when a query URL fetch completes or is deduplicated', async () => {
    const raw = 'https://osinterior.in/contact?project=99%20WOK%20STREET';
    const row = { normalizedUrl: normalizeUrl(raw), state: 'IN_PROGRESS', crawledAt: null as Date | null };
    const updateMany = jest.fn(async ({ where, data }) => {
      if (where.normalizedUrl !== row.normalizedUrl) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    });
    const inventory = new UrlInventoryService({ crawlFrontier: { updateMany } } as any);
    await inventory.markCrawled('job', state.normalizeUrl(raw), { httpStatus: 200 });
    expect(row.state).toBe('DONE');
    row.state = 'IN_PROGRESS'; row.crawledAt = null;
    await inventory.markExcluded('job', state.normalizeUrl(raw), 'duplicate');
    expect(row.state).toBe('SKIPPED');
  });
});
