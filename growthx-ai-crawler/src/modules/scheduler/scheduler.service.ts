import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CrawlFrequency } from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';
import { EntitlementsService } from '../billing/entitlements.service';
import { Feature } from '../billing/plans.catalog';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawlerService: CrawlerService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Daily Cron trigger at midnight UTC for scheduled websites
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyScheduledCrawls(): Promise<void> {
    this.logger.log('Running daily scheduled crawl check...');
    await this.triggerScheduledCrawls(CrawlFrequency.DAILY);
  }

  /**
   * Weekly Cron trigger every Monday at 1 AM UTC
   */
  @Cron('0 1 * * 1')
  async handleWeeklyScheduledCrawls(): Promise<void> {
    this.logger.log('Running weekly scheduled crawl check...');
    await this.triggerScheduledCrawls(CrawlFrequency.WEEKLY);
  }

  /**
   * Monthly Cron trigger on the 1st of every month at 2 AM UTC
   */
  @Cron('0 2 1 * *')
  async handleMonthlyScheduledCrawls(): Promise<void> {
    this.logger.log('Running monthly scheduled crawl check...');
    await this.triggerScheduledCrawls(CrawlFrequency.MONTHLY);
  }

  /**
   * Starts a crawl for the sites that asked for this cadence.
   *
   * Each cron used to select every verified site in the database, so one site
   * was crawled by all three and a monthly customer got a daily crawl. Sites now
   * match exactly one cadence, and a site whose plan does not include scheduled
   * crawls is not crawled on a schedule at all — that was being given away.
   *
   * Failures are per-site: one unreachable domain must not stop the rest of the
   * batch, which is why each start is awaited inside its own try.
   */
  private async triggerScheduledCrawls(frequency: CrawlFrequency): Promise<void> {
    try {
      const websites = await this.prisma.website.findMany({
        where: { isVerified: true, crawlFrequency: frequency },
        select: {
          id: true,
          domain: true,
          project: { select: { organizationId: true } },
        },
      });

      if (websites.length === 0) {
        this.logger.log(`No sites are on the ${frequency} crawl schedule.`);
        return;
      }

      let started = 0;
      let skipped = 0;

      for (const site of websites) {
        try {
          const organizationId = site.project?.organizationId;

          // An unparented site has no plan to check and no one to bill the
          // pages to, so it is not something to crawl unattended.
          if (!organizationId) {
            this.logger.warn(`Skipping ${site.domain}: not attached to an organization.`);
            skipped++;
            continue;
          }

          if (!(await this.entitlements.hasFeature(organizationId, Feature.SCHEDULED_CRAWLS))) {
            this.logger.log(`Skipping ${site.domain}: plan does not include scheduled crawls.`);
            skipped++;
            continue;
          }

          // A crawl that outlives its own interval would otherwise stack up,
          // and on a small instance a pile-up is what takes the API down.
          const inFlight = await this.prisma.crawlJob.findFirst({
            where: { websiteId: site.id, status: { in: ['PENDING', 'RUNNING'] } },
            select: { id: true },
          });
          if (inFlight) {
            this.logger.log(`Skipping ${site.domain}: crawl ${inFlight.id} is still running.`);
            skipped++;
            continue;
          }

          this.logger.log(`Dispatching ${frequency} scheduled crawl for domain: ${site.domain}`);
          await this.crawlerService.startCrawlJob(site.id);
          started++;
        } catch (err) {
          this.logger.error(`Failed to start scheduled crawl for ${site.domain}`, err);
          skipped++;
        }
      }

      this.logger.log(
        `${frequency} scheduled crawls: ${started} started, ${skipped} skipped, ${websites.length} on this schedule.`,
      );
    } catch (err) {
      this.logger.error(`Error during ${frequency} scheduled crawls trigger`, err);
    }
  }

  /**
   * Webhook handler for CI/CD deployment or sitemap update triggers.
   *
   * The secret is required, not optional. The check used to read
   * `if (website.webhookSecret && website.webhookSecret !== secretToken)`, which
   * skips itself entirely when no secret is set — and none is set by default.
   * That left an unauthenticated endpoint able to start a crawl on any verified
   * domain, at whatever rate the caller liked.
   */
  async handleWebhookTrigger(domainOrId: string, secretToken?: string): Promise<{ success: boolean; jobId?: string; message: string }> {
    const website = await this.prisma.website.findFirst({
      where: {
        OR: [{ id: domainOrId }, { domain: domainOrId }, { url: domainOrId }],
      },
    });

    if (!website) {
      return { success: false, message: `No website registered for domain or ID: ${domainOrId}` };
    }

    if (!website.isVerified) {
      return { success: false, message: `Website ${website.domain} is not verified. Audit permission denied.` };
    }

    if (!website.webhookSecret) {
      return {
        success: false,
        message: `No webhook secret is configured for ${website.domain}, so webhook triggers are disabled for it.`,
      };
    }

    if (!this.secretMatches(website.webhookSecret, secretToken)) {
      return { success: false, message: 'Invalid webhook authentication token.' };
    }

    const jobId = await this.crawlerService.startCrawlJob(website.id);
    return {
      success: true,
      jobId,
      message: `Successfully triggered automated audit for ${website.domain} via webhook.`,
    };
  }

  /**
   * Constant-time comparison, so a caller cannot recover the secret one
   * character at a time by measuring how long the rejection takes.
   */
  private secretMatches(expected: string, provided?: string): boolean {
    if (!provided) return false;

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    // timingSafeEqual throws on a length mismatch, which would itself leak the
    // length, so compare against a padded copy and fold the length into the result.
    const length = Math.max(a.length, b.length);
    const padded = (buf: Buffer) => Buffer.concat([buf, Buffer.alloc(length - buf.length)]);

    return timingSafeEqual(padded(a), padded(b)) && a.length === b.length;
  }
}
