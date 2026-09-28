import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PrismaService } from '../../database/prisma.service';
import { HtmlExtractorService } from '../extractor/html-extractor.service';
import { detectProductSignals } from '../crawler/product-detector';
import { CatalogTarget, writeCatalogProduct } from '../crawler/catalog-write';
import { OPENED_PAGE } from '../crawler/page-outcome';

const BATCH = 20;

/**
 * Builds a catalog from pages a crawl already stored, instead of asking the
 * customer to crawl the site again.
 *
 * Products are otherwise only recorded while a crawl reads each page, so a
 * competitor read before it was linked to this project — or before a product
 * was recognisable, or during the months the link was cached stale — showed
 * "No product pages found" beside a Competitor Intelligence card saying 300
 * pages had been read, and the only way offered to fix it was "Re-crawl".
 * The pages are already here; this reads them with the same detector the
 * crawler uses and writes the same rows.
 *
 * Runs in the background, once per crawl and catalog, one page at a time with
 * a yield between pages, so a small server keeps answering while it works.
 */
@Injectable()
export class CatalogBackfillService {
  private readonly logger = new Logger(CatalogBackfillService.name);
  private readonly extractor = new HtmlExtractorService();
  /** Crawl + catalog pairs already read, this process. */
  private readonly done = new Set<string>();
  private readonly running = new Map<string, Promise<number>>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Starts reading `crawlJobId`'s stored pages into `target`'s catalog, unless
   * that already happened. True while a read is running, so the screen can
   * say so and look again shortly.
   */
  ensure(target: CatalogTarget, crawlJobId: string): boolean {
    const key = `${crawlJobId}:${target.projectId}:${target.competitorId ?? 'own'}`;
    if (this.done.has(key)) return false;
    if (this.running.has(key)) return true;

    const run = this.rebuild(target, crawlJobId)
      .catch((err) => {
        this.logger.warn(`Catalog rebuild from crawl ${crawlJobId} failed: ${(err as Error).message}`);
        return 0;
      })
      .finally(() => {
        this.running.delete(key);
        this.done.add(key);
      });
    this.running.set(key, run);
    return true;
  }

  /** Awaitable form, for tests and for callers that need the products now. */
  async rebuild(target: CatalogTarget, crawlJobId: string): Promise<number> {
    // A catalog that already has products from this crawl was written by the
    // crawler as it went; there is nothing to add.
    const already = await this.prisma.catalogProduct.count({
      where: { projectId: target.projectId, competitorId: target.competitorId, page: { crawlJobId } },
    });
    if (already > 0) return 0;

    let written = 0;
    let cursor: string | undefined;
    for (;;) {
      const pages = await this.prisma.page.findMany({
        where: { crawlJobId, ...OPENED_PAGE, rawHtml: { not: null } },
        select: { id: true, url: true, pageType: true, rawHtml: true, renderedHtml: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      if (pages.length === 0) break;
      cursor = pages[pages.length - 1].id;

      for (const page of pages) {
        const html = page.renderedHtml || page.rawHtml;
        if (!html) continue;
        const $ = cheerio.load(html);
        const signal = detectProductSignals({
          url: page.url,
          jsonLd: this.extractor.extract($, page.url).jsonLd,
          bodyText: $('body').text(),
          pageTypeIsProduct: page.pageType === 'PRODUCT',
        });
        if (signal.isProductPage) {
          await writeCatalogProduct(this.prisma, target, page.id, page.url, signal);
          written++;
        }
        await new Promise((resolve) => setImmediate(resolve));
      }
      if (pages.length < BATCH) break;
    }

    this.logger.log(`Catalog rebuilt from crawl ${crawlJobId}: ${written} product page(s) for project ${target.projectId}.`);
    return written;
  }
}
