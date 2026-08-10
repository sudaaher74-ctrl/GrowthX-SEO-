"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var SchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../database/prisma.service");
const crawler_service_1 = require("../crawler/crawler.service");
let SchedulerService = SchedulerService_1 = class SchedulerService {
    constructor(prisma, crawlerService) {
        this.prisma = prisma;
        this.crawlerService = crawlerService;
        this.logger = new common_1.Logger(SchedulerService_1.name);
    }
    /**
     * Daily Cron trigger at midnight UTC for scheduled websites
     */
    async handleDailyScheduledCrawls() {
        this.logger.log('Running daily scheduled crawl check...');
        await this.triggerScheduledCrawls('DAILY');
    }
    /**
     * Weekly Cron trigger every Monday at 1 AM UTC
     */
    async handleWeeklyScheduledCrawls() {
        this.logger.log('Running weekly scheduled crawl check...');
        await this.triggerScheduledCrawls('WEEKLY');
    }
    /**
     * Monthly Cron trigger on the 1st of every month at 2 AM UTC
     */
    async handleMonthlyScheduledCrawls() {
        this.logger.log('Running monthly scheduled crawl check...');
        await this.triggerScheduledCrawls('MONTHLY');
    }
    async triggerScheduledCrawls(frequency) {
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
        }
        catch (err) {
            this.logger.error(`Error during ${frequency} scheduled crawls trigger`, err);
        }
    }
    /**
     * Webhook handler for CI/CD deployment or sitemap update triggers
     */
    async handleWebhookTrigger(domainOrId, secretToken) {
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
};
exports.SchedulerService = SchedulerService;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_MIDNIGHT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "handleDailyScheduledCrawls", null);
__decorate([
    (0, schedule_1.Cron)('0 1 * * 1'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "handleWeeklyScheduledCrawls", null);
__decorate([
    (0, schedule_1.Cron)('0 2 1 * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SchedulerService.prototype, "handleMonthlyScheduledCrawls", null);
exports.SchedulerService = SchedulerService = SchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        crawler_service_1.CrawlerService])
], SchedulerService);
//# sourceMappingURL=scheduler.service.js.map