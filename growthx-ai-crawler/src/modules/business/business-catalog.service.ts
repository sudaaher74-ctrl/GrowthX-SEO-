import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { crawlToShow } from '../crawler/crawl-selection';
import { PrismaService } from '../../database/prisma.service';
import { CompetitorCrawlService } from '../content-intelligence/competitor-crawl.service';
import { OPENED_PAGE } from '../crawler/page-outcome';
import { CatalogBackfillService } from './catalog-backfill.service';

/**
 * Business module, Catalog (You) / Catalog (Them): the product catalog
 * extracted by the crawler's product detector, read back per project and per
 * existing competitor. Extraction itself happens in CrawlerService, as part
 * of the crawl job Website Audit already runs — this service only reads what
 * that job wrote and, for a competitor, queues the same crawl job the
 * Competitor Intelligence module already uses.
 */

export type CatalogCrawlStatus = 'NOT_STARTED' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

interface ShownCrawl {
  status: CatalogCrawlStatus;
  crawledAt: Date | null;
  crawlId: string | null;
}

@Injectable()
export class BusinessCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly competitorCrawl: CompetitorCrawlService,
    private readonly backfill: CatalogBackfillService,
  ) {}

  /**
   * The newest crawl's status, unless it failed after an earlier crawl read
   * the site: the products on screen came from that earlier crawl, so it is
   * the one whose status and date describe them.
   */
  private async crawlStatusFor(where: Prisma.CrawlJobWhereInput): Promise<ShownCrawl> {
    const { shown, lastUsable } = crawlToShow(
      await this.prisma.crawlJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { id: true, status: true, finishedAt: true, pagesCrawled: true },
      }),
    );
    if (!shown) return { status: 'NOT_STARTED', crawledAt: null, crawlId: null };
    // The crawl products are read from: the one shown when it finished,
    // otherwise the last one that read anything (a re-read may be running).
    const source = shown.status === 'COMPLETED' ? shown : lastUsable;
    return { status: shown.status, crawledAt: shown.finishedAt, crawlId: source?.id ?? null };
  }

  private ownSiteCrawlStatus(projectId: string): Promise<ShownCrawl> {
    return this.crawlStatusFor({ website: { projectId } });
  }

  private async competitorCrawlStatus(websiteId: string | null): Promise<ShownCrawl> {
    if (!websiteId) return { status: 'NOT_STARTED', crawledAt: null, crawlId: null };
    return this.crawlStatusFor({ websiteId });
  }

  /**
   * Pages that crawl opened, so an empty catalog can say how much of the site
   * was looked at, and whether its products are still being read from them.
   */
  private async readProgress(crawlId: string | null, target: { projectId: string; competitorId: string | null; organizationId: string } | null) {
    if (!crawlId) return { pagesRead: 0, readingProducts: false };
    const readingProducts = target ? this.backfill.ensure(target, crawlId) : false;
    const pagesRead = await this.prisma.page.count({ where: { crawlJobId: crawlId, ...OPENED_PAGE } });
    return { pagesRead, readingProducts };
  }

  /** Catalog (You): the project's own crawled product pages. */
  async getMyCatalog(projectId: string) {
    const [shown, products, project] = await Promise.all([
      this.ownSiteCrawlStatus(projectId),
      this.prisma.catalogProduct.findMany({
        where: { projectId, competitorId: null },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } }),
    ]);
    const progress = await this.readProgress(
      shown.crawlId,
      project ? { projectId, competitorId: null, organizationId: project.organizationId } : null,
    );

    return { crawlStatus: shown.status, crawledAt: shown.crawledAt, products, ...progress };
  }

  /** Catalog (Them): every product row found for every competitor already tracked on this project. */
  async getCompetitorCatalogs(projectId: string) {
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: {
        id: true,
        domain: true,
        label: true,
        name: true,
        websiteId: true,
        status: true,
        project: { select: { organizationId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      competitors.map(async (competitor) => {
        const [shown, products] = await Promise.all([
          this.competitorCrawlStatus(competitor.websiteId),
          this.prisma.catalogProduct.findMany({
            where: { projectId, competitorId: competitor.id },
            orderBy: { updatedAt: 'desc' },
          }),
        ]);
        const progress = await this.readProgress(shown.crawlId, {
          projectId,
          competitorId: competitor.id,
          organizationId: competitor.project.organizationId,
        });

        return {
          competitor: {
            id: competitor.id,
            domain: competitor.domain,
            label: competitor.label ?? competitor.name ?? competitor.domain,
          },
          crawlStatus: shown.status,
          crawledAt: shown.crawledAt,
          products,
          ...progress,
        };
      }),
    );
  }

  /**
   * Queues the same crawl job Competitor Intelligence already uses against
   * this competitor's domain. Product extraction rides along inside it — no
   * separate crawl, no separate queue.
   */
  async crawlCompetitor(organizationId: string, projectId: string, competitorId: string) {
    const competitor = await this.prisma.competitorDomain.findFirst({ where: { id: competitorId, projectId } });
    if (!competitor) throw new NotFoundException('Competitor not found for this project.');
    return this.competitorCrawl.startCrawl(organizationId, projectId, competitorId);
  }
}
