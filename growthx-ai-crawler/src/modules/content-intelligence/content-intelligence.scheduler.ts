import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { CompetitorCrawlService } from './competitor-crawl.service';
import { CompetitorMonitorService } from './competitor-monitor.service';
import { ContentStrategyService } from './content-strategy.service';
import { SocialScraperService } from './social-scraper.service';
import { CompetitorLocalService } from '../competitor-action-engine/competitor-local.service';
import { TRACKED_COMPETITOR_STATUSES } from './competitor-status';

/**
 * Automated Cron Scheduler for Competitor Intelligence & Recurring Site Crawls.
 *
 * Runs scheduled sweeps for:
 * 1. Daily Competitor Website Crawling & Catalog Change Detection (02:00 UTC)
 * 2. Daily Competitor Content Ingestion (03:00 UTC)
 * 3. Daily Competitor Social Video & Velocity Surge Alert Sweeps (04:00 UTC)
 * 4. Weekly Opportunity & 30-60-90 Day Strategy Refreshes (Mondays at 05:00 UTC)
 */
@Injectable()
export class ContentIntelligenceScheduler {
  private readonly logger = new Logger(ContentIntelligenceScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly competitorCrawlService: CompetitorCrawlService,
    private readonly competitorMonitorService: CompetitorMonitorService,
    private readonly contentStrategyService: ContentStrategyService,
    private readonly socialScraper: SocialScraperService,
    private readonly competitorLocal: CompetitorLocalService,
  ) {}

  /**
   * Daily 02:00 UTC: Recrawl tracked competitor domains to detect catalog updates,
   * new product pages, deleted routes, and SEO structural changes.
   */
  @Cron('0 2 * * *')
  async handleDailyCompetitorCrawl(): Promise<void> {
    if (process.env.COMPETITOR_CRON_ENABLED === 'false') {
      this.logger.log('Competitor automated crawl cron is disabled by configuration.');
      return;
    }

    this.logger.log('Starting daily recurring competitor crawl sweep...');

    try {
      const activeCompetitors = await this.prisma.competitorDomain.findMany({
        where: {
          status: { in: TRACKED_COMPETITOR_STATUSES },
        },
        select: {
          id: true,
          domain: true,
          projectId: true,
          project: { select: { organizationId: true } },
        },
      });

      this.logger.log(`Found ${activeCompetitors.length} active competitor domains across all projects.`);

      let successCount = 0;
      let failureCount = 0;

      for (const comp of activeCompetitors) {
        try {
          this.logger.log(`[Cron] Recrawling competitor ${comp.domain} for project ${comp.projectId}...`);
          await this.competitorCrawlService.startCrawl(comp.project.organizationId, comp.projectId, comp.id);
          successCount++;
        } catch (err: any) {
          this.logger.error(`[Cron] Failed to crawl competitor ${comp.domain}: ${err.message}`);
          failureCount++;
        }
      }

      this.logger.log(
        `Daily competitor crawl completed: ${successCount} succeeded, ${failureCount} failed out of ${activeCompetitors.length}.`,
      );

      // Google listings refresh alongside the crawl: both describe where a
      // competitor stands today and both feed the same comparison, so letting
      // one go stale while the other is current would make the two disagree.
      const projectIds = [...new Set(activeCompetitors.map((comp) => comp.projectId))];
      for (const projectId of projectIds) {
        try {
          const local = await this.competitorLocal.refreshProject(projectId);
          if (local.skippedReason) {
            this.logger.log(`[Cron] Competitor local refresh skipped: ${local.skippedReason}`);
            break;
          }
          this.logger.log(
            `[Cron] Competitor local refresh for ${projectId}: ${local.matched} of ${local.checked} matched.`,
          );
        } catch (err: any) {
          this.logger.error(`[Cron] Competitor local refresh failed for ${projectId}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error during daily competitor crawl job: ${err.message}`, err.stack);
    }
  }

  /**
   * Daily 03:00 UTC: Pull each tracked competitor's recent uploads.
   *
   * Nothing did this. `syncYoutubeAccountContent` was reachable only from a
   * manual per-account POST, and `fetchYoutubeCompetitorData` had no callers
   * at all, so `CompetitorContent` was never populated by any automatic
   * process. The 02:00 sweep crawls competitor *websites*; the 04:00 sweep
   * reads content that something else was supposed to have fetched. Between
   * them sat the gap that left the Cross-Competitor Matrix, Video
   * Intelligence and pattern detection permanently empty — including on
   * deployments that had a YouTube key configured and working.
   *
   * At 03:00 so the content is in place before change detection reads it.
   * YouTube costs roughly 3-5 quota units per account against a 10,000/day
   * allowance; Instagram Business Discovery is one call per account.
   */
  @Cron('0 3 * * *')
  async handleDailyCompetitorContentSync(): Promise<void> {
    if (process.env.COMPETITOR_CRON_ENABLED === 'false') return;

    // Each platform has its own credentials and either can be configured
    // alone, so the sweep collects whichever it can rather than refusing
    // outright because one is missing.
    const platforms: string[] = [];
    if (process.env.YOUTUBE_API_KEY) platforms.push('YOUTUBE');
    if (process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
      platforms.push('INSTAGRAM');
    }

    if (platforms.length === 0) {
      this.logger.warn(
        'Competitor content sync skipped: no ingestion credentials are set (YOUTUBE_API_KEY, or ' +
          'INSTAGRAM_ACCESS_TOKEN with INSTAGRAM_BUSINESS_ACCOUNT_ID), so no competitor posts can be collected.',
      );
      return;
    }

    this.logger.log(`Starting daily competitor content sync for ${platforms.join(', ')}...`);

    try {
      const accounts = await this.prisma.competitorAccount.findMany({
        where: { platform: { in: platforms }, isActive: true },
        select: {
          id: true,
          handle: true,
          projectId: true,
          organizationId: true,
        },
      });

      this.logger.log(`Found ${accounts.length} active competitor account(s) to sync.`);

      let imported = 0;
      let failures = 0;

      for (const account of accounts) {
        try {
          const result = await this.socialScraper.syncAccountContent(
            account.organizationId,
            account.projectId,
            account.id,
          );
          imported += result.imported;
        } catch (err: any) {
          // One channel that has been renamed, deleted or made private must
          // not stop the rest of the sweep.
          failures++;
          this.logger.error(`[Cron] Content sync failed for ${account.handle}: ${err.message}`);
        }
      }

      this.logger.log(
        `Daily competitor content sync completed: ${imported} item(s) imported, ${failures} account(s) failed out of ${accounts.length}.`,
      );
    } catch (err: any) {
      this.logger.error(`Error during daily competitor content sync: ${err.message}`, err.stack);
    }
  }

  /**
   * Daily 04:00 UTC: Scan competitor social accounts and publishing velocity
   * to detect viral spikes, posting surges, and new content pillars.
   */
  @Cron('0 4 * * *')
  async handleDailyCompetitorChangeAlerts(): Promise<void> {
    if (process.env.COMPETITOR_CRON_ENABLED === 'false') return;

    this.logger.log('Starting daily competitor change and alert sweep...');

    try {
      const projects = await this.prisma.project.findMany({
        where: {
          competitors: { some: { status: { in: TRACKED_COMPETITOR_STATUSES } } },
        },
        select: {
          id: true,
          organizationId: true,
          name: true,
        },
      });

      this.logger.log(`Found ${projects.length} project(s) with tracked competitors.`);

      for (const p of projects) {
        try {
          const alerts = await this.competitorMonitorService.runCompetitorChangeDetection(
            p.organizationId,
            p.id,
          );
          if (alerts && alerts.length > 0) {
            this.logger.log(`[Cron] Created ${alerts.length} new competitor alert(s) for project ${p.name}.`);
          }
        } catch (err: any) {
          this.logger.error(`[Cron] Alert detection failed for project ${p.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error during daily competitor alert detection: ${err.message}`, err.stack);
    }
  }

  /**
   * Weekly Mondays 05:00 UTC: Refresh opportunity analysis and AI content strategies
   * for all active projects.
   */
  @Cron('0 5 * * 1')
  async handleWeeklyOpportunityAndStrategyRefresh(): Promise<void> {
    if (process.env.COMPETITOR_CRON_ENABLED === 'false') return;

    this.logger.log('Starting weekly opportunity and strategy refresh sweep...');

    try {
      const projects = await this.prisma.project.findMany({
        where: {
          competitors: { some: {} },
        },
        select: {
          id: true,
          organizationId: true,
          name: true,
        },
      });

      for (const p of projects) {
        try {
          this.logger.log(`[Cron] Refreshing strategy and opportunities for project ${p.name}...`);
          await this.contentStrategyService.generateStrategy(p.organizationId, p.id);
        } catch (err: any) {
          this.logger.error(`[Cron] Strategy refresh failed for project ${p.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error during weekly strategy refresh: ${err.message}`, err.stack);
    }
  }

  /**
   * Manual trigger helper to run full competitor sync on-demand for a single project.
   */
  async triggerManualProjectSync(projectId: string, organizationId?: string) {
    let orgId = organizationId;
    if (!orgId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      orgId = project?.organizationId || '';
    }

    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
    });

    const crawlResults: any[] = [];
    for (const comp of competitors) {
      try {
        const res = await this.competitorCrawlService.startCrawl(orgId, projectId, comp.id);
        crawlResults.push({ competitorId: comp.id, status: 'SUCCESS', ...res });
      } catch (err: any) {
        crawlResults.push({ competitorId: comp.id, domain: comp.domain, status: 'FAILED', error: err.message });
      }
    }

    let alerts: any[] = [];
    if (orgId) {
      try {
        alerts = await this.competitorMonitorService.runCompetitorChangeDetection(orgId, projectId);
      } catch (err: any) {
        this.logger.warn(`Could not run change detection during manual sync: ${err.message}`);
      }
    }

    return {
      projectId,
      timestamp: new Date().toISOString(),
      competitorsCrawled: crawlResults.length,
      crawlResults,
      newAlertsGenerated: alerts.length,
    };
  }
}
