import { CrawlFrequency } from '@prisma/client';
import { computeNextScheduledRun, SchedulerService } from './scheduler.service';

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
  let scheduler: SchedulerService;

  beforeEach(() => {
    prisma = {
      website: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
      crawlJob: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    crawler = { startCrawlJob: jest.fn().mockResolvedValue('job_1') };
    scheduler = new SchedulerService(prisma as any, crawler as any);
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

  describe('persisted cadence, biweekly & full pipeline', () => {
    it('computes real UTC next scheduled run timestamps for all cadences', () => {
      const ref = new Date('2026-11-10T10:00:00.000Z'); // Tuesday
      expect(computeNextScheduledRun(CrawlFrequency.OFF, ref)).toBeNull();
      expect(computeNextScheduledRun(CrawlFrequency.DAILY, ref)).toBe('2026-11-11T00:00:00.000Z');
      expect(computeNextScheduledRun(CrawlFrequency.WEEKLY, ref)).toBe('2026-11-16T01:00:00.000Z');
      expect(computeNextScheduledRun(CrawlFrequency.BIWEEKLY, ref)).toBe('2026-11-15T02:00:00.000Z');
      expect(computeNextScheduledRun(CrawlFrequency.MONTHLY, ref)).toBe('2026-12-01T02:00:00.000Z');
    });

    it('dispatches FULL_PIPELINE when automationSettings.pipelineMode is FULL_PIPELINE', async () => {
      const autopilot = { start: jest.fn().mockResolvedValue({ id: 'ap_1' }) };
      prisma.organizationMember = {
        findFirst: jest.fn().mockResolvedValue({ userId: 'user_owner' }),
      };
      const fullScheduler = new SchedulerService(prisma as any, crawler as any, autopilot as any);
      prisma.website.findMany.mockResolvedValue([
        {
          id: 'site_pipe.test',
          domain: 'pipe.test',
          projectId: 'proj_1',
          project: {
            id: 'proj_1',
            organizationId: 'org_1',
            automationSettings: {
              pipelineMode: 'FULL_PIPELINE',
              maxDepth: 1000,
              maxConcurrency: 5,
              useSitemap: true,
            },
          },
        },
      ]);

      await fullScheduler.handleBiweeklyScheduledCrawls();

      expect(autopilot.start).toHaveBeenCalledWith({
        userId: 'user_owner',
        organizationId: 'org_1',
        domain: 'pipe.test',
        projectId: 'proj_1',
        forceRefresh: true,
      });
      expect(crawler.startCrawlJob).not.toHaveBeenCalled();
    });
  });
});
