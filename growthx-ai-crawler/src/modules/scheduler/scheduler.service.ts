import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crawlerService: CrawlerService
  ) {}

  /**
   * Daily Cron trigger at midnight UTC for scheduled websites
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyScheduledCrawls(): Promise<void> {
    this.logger.log('Running daily scheduled crawl check...');
    await this.triggerScheduledCrawls('DAILY');
  }

  /**
   * Weekly Cron trigger every Monday at 1 AM UTC
   */
  @Cron('0 1 * * 1')
  async handleWeeklyScheduledCrawls(): Promise<void> {
    this.logger.log('Running weekly scheduled crawl check...');
    await this.triggerScheduledCrawls('WEEKLY');
  }

  /**
   * Monthly Cron trigger on the 1st of every month at 2 AM UTC
   */
  @Cron('0 2 1 * *')
  async handleMonthlyScheduledCrawls(): Promise<void> {
    this.logger.log('Running monthly scheduled crawl check...');
    await this.triggerScheduledCrawls('MONTHLY');
  }

  private async triggerScheduledCrawls(frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'): Promise<void> {
    try {
      // In our schema, we can filter by websites with isVerified=true and check if a scheduled frequency metadata or rule exists.
      // We query all verified websites to check their scheduled status.
      const websites = await this.prisma.website.findMany({
        where: { isVerified: true },
      });

      for (const site of websites) {
        // Trigger crawl if verified
        this.logger.log(`Dispatching ${frequency} scheduled crawl for domain: ${site.domain}`);
        this.crawlerService.startCrawlJob(site.id).catch((err) => {
          this.logger.error(`Failed to start scheduled crawl for ${site.domain}`, err);
        });
      }
    } catch (err) {
      this.logger.error(`Error during ${frequency} scheduled crawls trigger`, err);
    }
  }

  /**
   * Webhook handler for CI/CD deployment or sitemap update triggers
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

    if (website.webhookSecret && website.webhookSecret !== secretToken) {
      return { success: false, message: 'Invalid webhook authentication token.' };
    }

    const jobId = await this.crawlerService.startCrawlJob(website.id);
    return {
      success: true,
      jobId,
      message: `Successfully triggered automated audit for ${website.domain} via webhook.`,
    };
  }
}
