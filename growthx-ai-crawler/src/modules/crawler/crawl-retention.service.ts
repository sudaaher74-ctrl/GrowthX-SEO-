import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';

/**
 * `delete` (the default) prunes. `report` works out exactly what would be
 * pruned and logs it without writing anything, for checking the numbers on a
 * real database first. `off` skips the run.
 */
export type RetentionMode = 'delete' | 'report' | 'off';

export interface RetentionConfig {
  mode: RetentionMode;
  /** Newest COMPLETED crawls per website that keep their stored page HTML. */
  keepHtml: number;
  /** Newest COMPLETED crawls per website that keep their pages and issues. */
  keepDetailed: number;
  /** A crawl younger than this is never stripped of detail, whatever its rank. */
  minAgeDays: number;
  /** Ceiling on crawls processed per run, so a first run on a large backlog stays short. */
  maxCrawlsPerRun: number;
}

export interface RetentionSummary {
  /** False in report mode: the counts below are what would have been pruned. */
  applied: boolean;
  htmlPruned: number;
  detailsPruned: number;
  filesDeleted: number;
  skippedProtected: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FINISHED: JobStatus[] = [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED];

function intFromEnv(name: string, fallback: number, min: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

export function retentionConfig(): RetentionConfig {
  const keepHtml = intFromEnv('CRAWL_RETENTION_KEEP_HTML', 2, 1);
  const mode = (process.env.CRAWL_RETENTION_MODE ?? 'delete').trim().toLowerCase();
  return {
    // Anything unrecognised reports rather than deletes: a typo must not delete.
    mode: mode === 'delete' || mode === 'off' ? mode : 'report',
    keepHtml,
    // Never fewer than keep HTML: a crawl whose pages were deleted has no HTML to keep.
    keepDetailed: Math.max(keepHtml, intFromEnv('CRAWL_RETENTION_KEEP_DETAILED', 3, 1)),
    minAgeDays: intFromEnv('CRAWL_RETENTION_MIN_AGE_DAYS', 45, 0),
    maxCrawlsPerRun: intFromEnv('CRAWL_RETENTION_MAX_PER_RUN', 200, 1),
  };
}

/**
 * Keeps the crawl tables from growing without limit.
 *
 * Every crawl writes a Page row per URL, each holding up to 128KB of served
 * HTML and 128KB of rendered HTML, plus its links, images, scores and issues.
 * Nothing removed any of it, so a site recrawled daily added its whole size to
 * the database every day, forever. Two tiers, per website:
 *
 * 1. HTML (almost all of the bytes). Crawls older than the newest
 *    `keepHtml` completed ones lose rawHtml, renderedHtml and their snapshot
 *    files. Nothing reads stored HTML beyond the latest crawl (Business reads
 *    the homepage of it; competitor change detection compares the last two),
 *    and the pages, issues and figures all stay.
 *
 * 2. Detail. Crawls older than the newest `keepDetailed` completed ones AND
 *    older than `minAgeDays` lose their pages (with links, images, scores),
 *    issues, graph and frontier. The CrawlJob row stays with its summary
 *    figures, so the trend line (which reads only those) still reaches back.
 *    The age floor exists because "issues resolved this period" (28 days by
 *    default) counts RESOLVED rows on the crawl that last saw each finding,
 *    which is an older crawl by definition. Deleting it inside that window
 *    would erase fixes the customer made.
 *
 * Never touched: a crawl still PENDING or RUNNING, a crawl an Autopilot run
 * points at, and a crawl whose pages a FixIntervention cites as before/after
 * evidence. Snapshot files Design Studio has saved a PageSnapshot for are kept.
 */
@Injectable()
export class CrawlRetentionService {
  private readonly logger = new Logger(CrawlRetentionService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** 02:30 UTC, ahead of the 03:00 rival snapshots and the Google sync after them. */
  @Cron('30 2 * * *')
  async nightly(): Promise<void> {
    const config = retentionConfig();
    if (config.mode === 'off') return;
    if (this.running) {
      this.logger.warn('Crawl retention skipped: the previous run has not finished.');
      return;
    }
    this.running = true;
    try {
      const summary = await this.run(config);
      this.logger.log(
        summary.applied
          ? `Crawl retention: cleared HTML on ${summary.htmlPruned} crawl(s), removed detail from ${summary.detailsPruned}, ` +
              `deleted ${summary.filesDeleted} snapshot file(s); ${summary.skippedProtected} protected crawl(s) left alone.`
          : `Crawl retention (report only, nothing changed): would clear HTML on ${summary.htmlPruned} crawl(s) and ` +
              `remove detail from ${summary.detailsPruned}; ${summary.skippedProtected} protected crawl(s) would be left alone. ` +
              'Set CRAWL_RETENTION_MODE=delete to apply.',
      );
    } catch (error) {
      this.logger.error('Crawl retention failed', error);
    } finally {
      this.running = false;
    }
  }

  async run(config: RetentionConfig = retentionConfig(), now: Date = new Date()): Promise<RetentionSummary> {
    const summary: RetentionSummary = {
      applied: config.mode === 'delete',
      htmlPruned: 0,
      detailsPruned: 0,
      filesDeleted: 0,
      skippedProtected: 0,
    };
    const protectedJobs = await this.protectedCrawls();
    const keepFiles = await this.filesDesignStudioUses();
    const ageFloor = new Date(now.getTime() - config.minAgeDays * DAY_MS);

    const websites = await this.prisma.crawlJob.findMany({
      where: { status: { in: FINISHED }, OR: [{ htmlPrunedAt: null }, { detailsPrunedAt: null }] },
      distinct: ['websiteId'],
      select: { websiteId: true },
    });

    const htmlJobs: string[] = [];
    const detailJobs: string[] = [];
    let budget = config.maxCrawlsPerRun;

    for (const { websiteId } of websites) {
      if (budget <= 0) break;

      // Ranked by creation, which follows crawl order; finishedAt can be null.
      const completed = await this.prisma.crawlJob.findMany({
        where: { websiteId, status: JobStatus.COMPLETED },
        orderBy: { createdAt: 'desc' },
        take: config.keepDetailed,
        select: { createdAt: true },
      });
      // A site with fewer completed crawls than we keep has nothing old enough.
      if (completed.length < config.keepHtml) continue;

      const htmlCutoff = completed[config.keepHtml - 1].createdAt;
      const detailCutoff = completed.length >= config.keepDetailed ? completed[config.keepDetailed - 1].createdAt : null;

      const older = await this.prisma.crawlJob.findMany({
        where: {
          websiteId,
          status: { in: FINISHED },
          createdAt: { lt: htmlCutoff },
          OR: [{ htmlPrunedAt: null }, { detailsPrunedAt: null }],
        },
        orderBy: { createdAt: 'asc' },
        select: { id: true, createdAt: true, htmlPrunedAt: true, detailsPrunedAt: true },
      });

      for (const job of older) {
        if (budget <= 0) break;
        if (protectedJobs.has(job.id)) {
          summary.skippedProtected++;
          continue;
        }
        const detailDue =
          !job.detailsPrunedAt && detailCutoff !== null && job.createdAt < detailCutoff && job.createdAt < ageFloor;
        if (detailDue) {
          detailJobs.push(job.id);
          budget--;
        } else if (!job.htmlPrunedAt) {
          htmlJobs.push(job.id);
          budget--;
        }
      }
    }

    if (!summary.applied) {
      summary.htmlPruned = htmlJobs.length;
      summary.detailsPruned = detailJobs.length;
      return summary;
    }

    for (const id of htmlJobs) {
      try {
        await this.prisma.$transaction([
          this.prisma.page.updateMany({
            where: { crawlJobId: id },
            data: { rawHtml: null, renderedHtml: null, htmlSnapshotUrl: null },
          }),
          this.prisma.crawlJob.update({ where: { id }, data: { htmlPrunedAt: now } }),
        ]);
        summary.htmlPruned++;
      } catch (error) {
        this.logger.warn(`[JOB ${id}] Could not clear stored HTML: ${(error as Error).message}`);
      }
    }

    for (const id of detailJobs) {
      try {
        // One transaction per crawl: it is either whole or untouched. Issues go
        // first (their AI recommendations cascade), then the page tree, whose
        // links, images, scores and schema cascade from Page.
        await this.prisma.$transaction([
          this.prisma.issue.deleteMany({ where: { crawlJobId: id } }),
          this.prisma.internalGraph.deleteMany({ where: { crawlJobId: id } }),
          this.prisma.siteSocialLink.deleteMany({ where: { crawlJobId: id } }),
          this.prisma.crawlFrontier.deleteMany({ where: { crawlJobId: id } }),
          this.prisma.page.deleteMany({ where: { crawlJobId: id } }),
          this.prisma.crawlJob.update({ where: { id }, data: { detailsPrunedAt: now, htmlPrunedAt: now } }),
        ]);
        summary.detailsPruned++;
      } catch (error) {
        this.logger.warn(`[JOB ${id}] Could not remove crawl detail: ${(error as Error).message}`);
      }
    }

    // After the rows, so a file is only removed once nothing records it.
    summary.filesDeleted = await this.storage.deleteSnapshotsForJobs([...htmlJobs, ...detailJobs], keepFiles);
    return summary;
  }

  /**
   * Crawls other records cite as evidence, which retention leaves whole. A
   * crawl owning a FixIntervention's before or after page is protected as a
   * whole, so that page keeps its HTML as well as its row.
   */
  private async protectedCrawls(): Promise<Set<string>> {
    const [autopilot, interventions] = await Promise.all([
      this.prisma.autopilotRun.findMany({ where: { ownCrawlJobId: { not: null } }, select: { ownCrawlJobId: true } }),
      this.prisma.fixIntervention.findMany({ select: { beforePageId: true, afterPageId: true } }),
    ]);

    const protectedPages = new Set<string>();
    for (const row of interventions) {
      if (row.beforePageId) protectedPages.add(row.beforePageId);
      if (row.afterPageId) protectedPages.add(row.afterPageId);
    }

    const protectedJobs = new Set<string>(autopilot.map((row) => row.ownCrawlJobId as string));
    if (protectedPages.size > 0) {
      const pages = await this.prisma.page.findMany({
        where: { id: { in: [...protectedPages] } },
        select: { crawlJobId: true },
      });
      for (const page of pages) protectedJobs.add(page.crawlJobId);
    }
    return protectedJobs;
  }

  /** Snapshot files a saved Design Studio analysis still reads. */
  private async filesDesignStudioUses(): Promise<Set<string>> {
    const rows = await this.prisma.pageSnapshot.findMany({
      where: { htmlSnapshotUrl: { not: null } },
      select: { htmlSnapshotUrl: true },
    });
    return new Set(rows.map((row) => row.htmlSnapshotUrl as string));
  }
}
