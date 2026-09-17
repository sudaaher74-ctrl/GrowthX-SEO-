-- The URL inventory: every URL a crawl discovered, with what became of it.
--
-- CrawlFrontier already held one row per unique (crawlJobId, normalizedUrl),
-- which is the right shape for an inventory but carried only enough state to
-- schedule a fetch. Without the outcome on the row, "discovered" could only be
-- counted from a job-level integer written once at seed time, so URLs found in
-- links mid-crawl never reached the denominator and coverage read 100% on a
-- crawl that had fetched less than all of what it found.
--
-- Existing rows get NULLs, which read as "not recorded" rather than asserting
-- an outcome for crawls that never measured one.

-- Every source that found this URL. One URL in the sitemap and in a nav menu
-- is one row with two sources, never two rows.
ALTER TABLE "CrawlFrontier" ADD COLUMN "sources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- The outcome of the fetch, recorded per URL rather than inferred downstream.
ALTER TABLE "CrawlFrontier" ADD COLUMN "httpStatus" INTEGER;
ALTER TABLE "CrawlFrontier" ADD COLUMN "contentType" TEXT;
ALTER TABLE "CrawlFrontier" ADD COLUMN "indexability" TEXT;
ALTER TABLE "CrawlFrontier" ADD COLUMN "canonicalUrl" TEXT;
ALTER TABLE "CrawlFrontier" ADD COLUMN "robotsAllowed" BOOLEAN;
ALTER TABLE "CrawlFrontier" ADD COLUMN "rendered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CrawlFrontier" ADD COLUMN "redirectTarget" TEXT;

-- The lifecycle, so a URL stuck between discovery and the queue is visible as
-- stuck rather than absent.
ALTER TABLE "CrawlFrontier" ADD COLUMN "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CrawlFrontier" ADD COLUMN "queuedAt" TIMESTAMP(3);
ALTER TABLE "CrawlFrontier" ADD COLUMN "crawledAt" TIMESTAMP(3);

-- Backfill: the source a row was created with is its first source.
UPDATE "CrawlFrontier" SET "sources" = ARRAY["discoverySource"] WHERE cardinality("sources") = 0;

-- And its real discovery time is when the row was written, not when this
-- migration ran. The column default would stamp every historical URL with the
-- moment of the deploy, which is a timestamp nothing observed -- the same kind
-- of plausible-looking figure this whole change exists to remove.
UPDATE "CrawlFrontier" SET "discoveredAt" = "createdAt";

-- The source breakdown groups by source over a single crawl.
CREATE INDEX "CrawlFrontier_crawlJobId_discoverySource_idx" ON "CrawlFrontier"("crawlJobId", "discoverySource");
