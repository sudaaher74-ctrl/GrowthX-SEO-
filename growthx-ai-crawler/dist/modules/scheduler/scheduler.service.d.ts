import { PrismaService } from '../../database/prisma.service';
import { CrawlerService } from '../crawler/crawler.service';
export declare class SchedulerService {
    private readonly prisma;
    private readonly crawlerService;
    private readonly logger;
    constructor(prisma: PrismaService, crawlerService: CrawlerService);
    /**
     * Daily Cron trigger at midnight UTC for scheduled websites
     */
    handleDailyScheduledCrawls(): Promise<void>;
    /**
     * Weekly Cron trigger every Monday at 1 AM UTC
     */
    handleWeeklyScheduledCrawls(): Promise<void>;
    /**
     * Monthly Cron trigger on the 1st of every month at 2 AM UTC
     */
    handleMonthlyScheduledCrawls(): Promise<void>;
    private triggerScheduledCrawls;
    /**
     * Webhook handler for CI/CD deployment or sitemap update triggers
     */
    handleWebhookTrigger(domainOrId: string, secretToken?: string): Promise<{
        success: boolean;
        jobId?: string;
        message: string;
    }>;
}
