import { CrawlFrequency } from '@prisma/client';
import {
  computeNextScheduledRun,
  matchesStaggeredSlot,
  scheduledSlotForWebsite,
  SchedulerService,
} from './scheduler.service';

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

  describe('deterministic staggered scheduling', () => {
    const prevStagger = process.env.CRAWL_STAGGER_SCHEDULES;
    const prevMax = process.env.SCHEDULER_MAX_PER_HOUR;

    afterEach(() => {
      if (prevStagger === undefined) delete process.env.CRAWL_STAGGER_SCHEDULES;
      else process.env.CRAWL_STAGGER_SCHEDULES = prevStagger;
      if (prevMax === undefined) delete process.env.SCHEDULER_MAX_PER_HOUR;
      else process.env.SCHEDULER_MAX_PER_HOUR = prevMax;
    });

    it('spreads 1,000 weekly websites uniformly across 168 UTC day-hour buckets instead of spiking Monday 01:00', () => {
      const buckets = new Map<string, number>();
      for (let i = 0; i < 1000; i++) {
        const slot = scheduledSlotForWebsite(`website_${i}`, CrawlFrequency.WEEKLY);
        const key = `${slot.dayOfWeek}-${slot.hour}`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      // With 168 buckets and 1,000 sites, mean is ~5.95 per hour-slot; no single bucket should exceed 3% (30 sites).
      expect(buckets.size).toBeGreaterThan(140);
      const maxBucket = Math.max(...buckets.values());
      expect(maxBucket).toBeLessThan(30);
    });

    it('computes a future staggered timestamp matching the website slot', () => {
      const ref = new Date('2026-11-10T10:30:00.000Z');
      for (const freq of [
        CrawlFrequency.DAILY,
        CrawlFrequency.WEEKLY,
        CrawlFrequency.BIWEEKLY,
        CrawlFrequency.MONTHLY,
      ]) {
        const nextIso = computeNextScheduledRun(freq, ref, 'site_alpha_123');
        expect(nextIso).not.toBeNull();
        const nextDate = new Date(nextIso!);
        expect(nextDate.getTime()).toBeGreaterThan(ref.getTime());
        expect(matchesStaggeredSlot('site_alpha_123', freq, nextDate)).toBe(true);
      }
    });

    it('dispatches only matching-slot websites on hourly cron and suppresses bulk fixed-time crons when enabled', async () => {
      process.env.CRAWL_STAGGER_SCHEDULES = 'true';
      process.env.SCHEDULER_MAX_PER_HOUR = '2';

      const slotA = scheduledSlotForWebsite('site_a.test', CrawlFrequency.DAILY);
      const dueTime = new Date(Date.UTC(2026, 10, 10, slotA.hour, 5, 0, 0));

      // Find a site whose DAILY hour differs from slotA.hour
      let nonDueId = 'site_other_0';
      for (let i = 0; i < 100; i++) {
        const candidate = `site_other_${i}`;
        if (scheduledSlotForWebsite(candidate, CrawlFrequency.DAILY).hour !== slotA.hour) {
          nonDueId = candidate;
          break;
        }
      }

      prisma.website.findMany.mockResolvedValue([
        { ...site('a.test'), crawlFrequency: CrawlFrequency.DAILY },
        { id: nonDueId, domain: 'other.test', crawlFrequency: CrawlFrequency.DAILY, project: { organizationId: 'org_1' } },
      ]);

      // Legacy midnight bulk cron should be a no-op when staggered mode is active.
      await scheduler.handleDailyScheduledCrawls();
      expect(crawler.startCrawlJob).not.toHaveBeenCalled();

      // Hourly staggered cron dispatches only the matching-slot website.
      await scheduler.handleStaggeredHourlyCrawls(dueTime);
      expect(crawledDomains()).toEqual(['a.test']);
    });
  });
});
