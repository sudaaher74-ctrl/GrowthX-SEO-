import { crawlExclusionReason } from './crawlable';
import { UrlInventoryService } from './inventory/url-inventory.service';
import { prioritizeSites } from './crawl-priority';
describe('Crawl speed exclusions', () => {
  it('prioritizes own pages without dropping competitors, rotating peers fairly', () => {
    const jobs = ['competitor:a', 'own', 'competitor:b'].map(scope => ({ website: { scope } }));
    expect(prioritizeSites(jobs, 0).map(job => job.website.scope)).toEqual(['own', 'competitor:a', 'competitor:b']);
    expect(prioritizeSites(jobs, 1).map(job => job.website.scope)).toEqual(['own', 'competitor:b', 'competitor:a']);
  });
  it('excludes assets and commerce handoffs but retains public login and product pages', () => {
    expect(crawlExclusionReason('https://site.test/photo.png?v=1')).toBe('unsupported_content_type');
    expect(crawlExclusionReason('https://site.test/customer_authentication/redirect?token=changing')).toBe('skipped_by_configuration');
    expect(crawlExclusionReason('https://site.test/login')).toBeNull();
    expect(crawlExclusionReason('https://site.test/products?category=milk')).toBeNull();
  });
  it('records media as excluded before the fair scheduler sees the frontier', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 2 });
    const db = { crawlFrontier: { createMany }, $executeRaw: jest.fn().mockResolvedValue(0) };
    const inventory = new UrlInventoryService(db as never);
    await inventory.record('speed', [{ url: 'https://site.test/photo.jpg', source: 'link' }, { url: 'https://site.test/products', source: 'link' }]);
    const rows = createMany.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({ state: 'SKIPPED', reason: 'unsupported_content_type' });
    expect(rows[1]).toMatchObject({ state: 'PENDING', reason: 'queued' });
  });
});
