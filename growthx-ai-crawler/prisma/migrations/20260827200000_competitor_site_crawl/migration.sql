-- Links a competitor to the crawled site behind their domain, and gives a
-- crawl job a page ceiling. Both nullable: existing competitors have not been
-- crawled, and existing jobs of the customer's own site have no ceiling.
-- AlterTable
ALTER TABLE "CompetitorDomain" ADD COLUMN     "websiteId" TEXT;

-- AlterTable
ALTER TABLE "CrawlJob" ADD COLUMN     "pageLimit" INTEGER;

-- SetNull rather than Cascade: deleting a crawled site must not delete the
-- competitor the customer added.
-- AddForeignKey
ALTER TABLE "CompetitorDomain" ADD CONSTRAINT "CompetitorDomain_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES "Website"("id") ON DELETE SET NULL ON UPDATE CASCADE;
