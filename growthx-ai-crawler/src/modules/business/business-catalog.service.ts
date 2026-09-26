import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CompetitorCrawlService } from '../content-intelligence/competitor-crawl.service';

/**
 * Business module, Catalog (You) / Catalog (Them): the product catalog
 * extracted by the crawler's product detector, read back per project and per
 * existing competitor. Extraction itself happens in CrawlerService, as part
 * of the crawl job Website Audit already runs — this service only reads what
 * that job wrote and, for a competitor, queues the same crawl job the
 * Competitor Intelligence module already uses.
 */

export type CatalogCrawlStatus = 'NOT_STARTED' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

@Injectable()
export class BusinessCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly competitorCrawl: CompetitorCrawlService,
  ) {}

  private async ownSiteCrawlStatus(projectId: string): Promise<{ status: CatalogCrawlStatus; crawledAt: Date | null }> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { website: { projectId } },
      orderBy: { createdAt: 'desc' },
      select: { status: true, finishedAt: true },
    });
    if (!job) return { status: 'NOT_STARTED', crawledAt: null };
    return { status: job.status, crawledAt: job.finishedAt };
  }

  private async competitorCrawlStatus(websiteId: string | null): Promise<{ status: CatalogCrawlStatus; crawledAt: Date | null }> {
    if (!websiteId) return { status: 'NOT_STARTED', crawledAt: null };
    const job = await this.prisma.crawlJob.findFirst({
      where: { websiteId },
      orderBy: { createdAt: 'desc' },
      select: { status: true, finishedAt: true },
    });
    if (!job) return { status: 'NOT_STARTED', crawledAt: null };
    return { status: job.status, crawledAt: job.finishedAt };
  }

  /** Catalog (You): the project's own crawled product pages. */
  async getMyCatalog(projectId: string) {
    const [{ status, crawledAt }, products] = await Promise.all([
      this.ownSiteCrawlStatus(projectId),
      this.prisma.catalogProduct.findMany({
        where: { projectId, competitorId: null },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return { crawlStatus: status, crawledAt, products };
  }

  /** Catalog (Them): every product row found for every competitor already tracked on this project. */
  async getCompetitorCatalogs(projectId: string) {
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: { id: true, domain: true, label: true, name: true, websiteId: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      competitors.map(async (competitor) => {
        const [{ status, crawledAt }, products] = await Promise.all([
          this.competitorCrawlStatus(competitor.websiteId),
          this.prisma.catalogProduct.findMany({
            where: { projectId, competitorId: competitor.id },
            orderBy: { updatedAt: 'desc' },
          }),
        ]);

        return {
          competitor: {
            id: competitor.id,
            domain: competitor.domain,
            label: competitor.label ?? competitor.name ?? competitor.domain,
          },
          crawlStatus: status,
          crawledAt,
          products,
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
