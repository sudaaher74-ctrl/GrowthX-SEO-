import { CrawlFrequency } from '@prisma/client';
import { SchedulerService } from './scheduler.service';

/** A site as the scheduler's own `select` returns it. */
function site(domain: string, organizationId: string | null = 'org_1') {
  return {
    id: `site_${domain}`,
    domain,
    project: organizationId ? { organizationId } : null,
  };
}

describe('SchedulerService', () => {
  let prisma: any;
  let crawler: { startCrawlJob: jest.Mock };
  let entitlements: { hasFeature: jest.Mock };
  let scheduler: SchedulerService;

  beforeEach(() => {
    prisma = {
      website: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      crawlJob: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    crawler = { startCrawlJob: jest.fn().mockResolvedValue('job_1') };
    entitlements = { hasFeature: jest.fn().mockResolvedValue(true) };
    scheduler = new SchedulerService(prisma as any, crawler as any, entitlements as any);
  });

  const crawledDomains = () =>
    crawler.startCrawlJob.mock.calls.map(([id]) => String(id).replace('site_', ''));

  describe('scheduled crawls', () => {
    it('only selects sites on the cadence being run', async () => {
      await scheduler.handleWeeklyScheduledCrawls();

      // The bug was the absence of this filter: all three crons selected every
      // verified site, so one site was crawled daily, weekly and monthly.
      expect(prisma.website.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isVerified: true, crawlFrequency: CrawlFrequency.WEEKLY },
        }),
      );
    });

    it.each([
      ['handleDailyScheduledCrawls', CrawlFrequency.DAILY],
      ['handleWeeklyScheduledCrawls', CrawlFrequency.WEEKLY],
      ['handleMonthlyScheduledCrawls', CrawlFrequency.MONTHLY],
    ])('%s asks only for its own cadence', async (method, frequency) => {
      await (scheduler as any)[method]();
      expect(prisma.website.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isVerified: true, crawlFrequency: frequency } }),
      );
    });

    it('crawls the sites it selected', async () => {
      prisma.website.findMany.mockResolvedValue([site('a.test'), site('b.test')]);

      await scheduler.handleDailyScheduledCrawls();

      expect(crawledDomains()).toEqual(['a.test', 'b.test']);
    });

    it('skips a site whose plan does not include scheduled crawls', async () => {
      prisma.website.findMany.mockResolvedValue([site('paid.test', 'org_paid'), site('free.test', 'org_free')]);
      entitlements.hasFeature.mockImplementation(async (orgId: string) => orgId === 'org_paid');

      await scheduler.handleDailyScheduledCrawls();

      expect(crawledDomains()).toEqual(['paid.test']);
    });

    it('skips a site with no owning organization', async () => {
      prisma.website.findMany.mockResolvedValue([site('orphan.test', null), site('owned.test')]);

      await scheduler.handleDailyScheduledCrawls();

      expect(crawledDomains()).toEqual(['owned.test']);
    });

    it('does not stack a second crawl on a site already crawling', async () => {
      prisma.website.findMany.mockResolvedValue([site('busy.test'), site('idle.test')]);
      prisma.crawlJob.findFirst.mockImplementation(async ({ where }: any) =>
        where.websiteId === 'site_busy.test' ? { id: 'inflight' } : null,
      );

      await scheduler.handleDailyScheduledCrawls();

      expect(crawledDomains()).toEqual(['idle.test']);
    });

    it('keeps going when one site fails to start', async () => {
      prisma.website.findMany.mockResolvedValue([site('bad.test'), site('good.test')]);
      crawler.startCrawlJob.mockImplementation(async (id: string) => {
        if (id === 'site_bad.test') throw new Error('unreachable');
        return 'job_1';
      });

      await expect(scheduler.handleDailyScheduledCrawls()).resolves.toBeUndefined();
      expect(crawledDomains()).toEqual(['bad.test', 'good.test']);
    });
  });

  describe('webhook trigger', () => {
    const verified = {
      id: 'w1',
      domain: 'example.test',
      isVerified: true,
      webhookSecret: 'super-secret-value',
    };

    it('refuses a site with no webhook secret configured', async () => {
      // The default. The old check was `if (secret && secret !== provided)`,
      // which skipped itself entirely when no secret was set — leaving an
      // unauthenticated endpoint that could start a crawl on any verified site.
      prisma.website.findFirst.mockResolvedValue({ ...verified, webhookSecret: null });

      const result = await scheduler.handleWebhookTrigger('example.test');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/no webhook secret/i);
      expect(crawler.startCrawlJob).not.toHaveBeenCalled();
    });

    it('refuses when no secret is supplied', async () => {
      prisma.website.findFirst.mockResolvedValue(verified);

      const result = await scheduler.handleWebhookTrigger('example.test');

      expect(result.success).toBe(false);
      expect(crawler.startCrawlJob).not.toHaveBeenCalled();
    });

    it('refuses a wrong secret', async () => {
      prisma.website.findFirst.mockResolvedValue(verified);

      const result = await scheduler.handleWebhookTrigger('example.test', 'wrong-secret-value');

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/invalid webhook/i);
      expect(crawler.startCrawlJob).not.toHaveBeenCalled();
    });

    it('refuses a secret that is merely a prefix of the real one', async () => {
      prisma.website.findFirst.mockResolvedValue(verified);

      const result = await scheduler.handleWebhookTrigger('example.test', 'super');

      expect(result.success).toBe(false);
      expect(crawler.startCrawlJob).not.toHaveBeenCalled();
    });

    it('accepts the correct secret', async () => {
      prisma.website.findFirst.mockResolvedValue(verified);

      const result = await scheduler.handleWebhookTrigger('example.test', 'super-secret-value');

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('job_1');
      expect(crawler.startCrawlJob).toHaveBeenCalledWith('w1');
    });

    it('refuses an unverified site even with the right secret', async () => {
      prisma.website.findFirst.mockResolvedValue({ ...verified, isVerified: false });

      const result = await scheduler.handleWebhookTrigger('example.test', 'super-secret-value');

      expect(result.success).toBe(false);
      expect(crawler.startCrawlJob).not.toHaveBeenCalled();
    });

    it('reports an unknown domain', async () => {
      prisma.website.findFirst.mockResolvedValue(null);

      const result = await scheduler.handleWebhookTrigger('nope.test', 'x');

      expect(result.success).toBe(false);
      expect(crawler.startCrawlJob).not.toHaveBeenCalled();
    });
  });
});
