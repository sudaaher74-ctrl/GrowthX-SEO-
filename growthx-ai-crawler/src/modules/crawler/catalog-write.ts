import type { PrismaService } from '../../database/prisma.service';
import { completenessScore, matchConfidence, ProductSignal } from './product-detector';

/** Where one website's product pages are written: the project's own catalog, or one competitor's. */
export interface CatalogTarget {
  projectId: string;
  competitorId: string | null;
  organizationId: string;
}

/**
 * Writes one CatalogProduct row for a page the product detector flagged.
 *
 * One implementation for both writers: the crawler, as it reads each page,
 * and the Business module's rebuild from pages already stored — so a product
 * found either way is the same row with the same fields.
 */
export async function writeCatalogProduct(
  prisma: PrismaService,
  target: CatalogTarget,
  pageId: string,
  pageUrl: string,
  signal: ProductSignal,
): Promise<void> {
  const shared = {
    pageId,
    name: signal.name,
    priceStatus: signal.priceStatus,
    priceMinorUnits: signal.priceMinorUnits,
    currency: signal.currency,
    stockStatus: signal.stockStatus,
    stockValue: signal.stockValue,
    category: signal.category,
    ctaType: signal.ctaType,
    completenessScore: completenessScore(signal),
  };

  if (target.competitorId) {
    // A real, non-null competitorId makes (projectId, competitorId, url) a
    // genuine tuple, so the compound unique key upsert works as-is. Match
    // confidence is only meaningful here: matching your own crawl to your own
    // catalog isn't a guess, so it stays null on those rows.
    const confidence = matchConfidence(signal);
    await prisma.catalogProduct.upsert({
      where: { projectId_competitorId_url: { projectId: target.projectId, competitorId: target.competitorId, url: pageUrl } },
      create: {
        projectId: target.projectId,
        competitorId: target.competitorId,
        url: pageUrl,
        organizationId: target.organizationId,
        matchConfidence: confidence,
        ...shared,
      },
      update: { organizationId: target.organizationId, matchConfidence: confidence, ...shared },
    });
    return;
  }

  // competitorId is NULL for every own-site row, and Postgres never treats two
  // NULLs as a duplicate, so the compound unique key cannot back an upsert
  // here — the partial index that protects this case is enforced by the
  // database, not by the Prisma query engine. findFirst+create/update reaches
  // the same result explicitly.
  const existing = await prisma.catalogProduct.findFirst({
    where: { projectId: target.projectId, competitorId: null, url: pageUrl },
    select: { id: true },
  });
  if (existing) {
    await prisma.catalogProduct.update({ where: { id: existing.id }, data: { organizationId: target.organizationId, ...shared } });
  } else {
    await prisma.catalogProduct.create({
      data: { projectId: target.projectId, competitorId: null, url: pageUrl, organizationId: target.organizationId, ...shared },
    });
  }
}
