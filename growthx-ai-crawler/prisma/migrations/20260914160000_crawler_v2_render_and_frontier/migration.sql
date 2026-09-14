-- Crawler v2: raw-vs-rendered page capture, honest fetch outcomes, computed
-- indexability, and a frontier that survives a worker restart.

-- Page: raw vs rendered, and why the crawler reached its conclusions.
ALTER TABLE "Page" ADD COLUMN "rawHtml" TEXT;
ALTER TABLE "Page" ADD COLUMN "renderedHtml" TEXT;
ALTER TABLE "Page" ADD COLUMN "jsRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Page" ADD COLUMN "discoverySource" TEXT NOT NULL DEFAULT 'seed';
ALTER TABLE "Page" ADD COLUMN "statusChain" JSONB;
ALTER TABLE "Page" ADD COLUMN "blockedSuspected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Page" ADD COLUMN "indexabilityReason" JSONB;

-- UNKNOWN, not false. A signal we could not read is not a signal that said no,
-- and every existing row was scored before indexability was computed at all.
ALTER TABLE "Page" ADD COLUMN "indexability" TEXT NOT NULL DEFAULT 'UNKNOWN';

CREATE INDEX "Page_crawlJobId_indexability_idx" ON "Page"("crawlJobId", "indexability");
CREATE INDEX "Page_crawlJobId_jsRequired_idx" ON "Page"("crawlJobId", "jsRequired");

-- The crawl frontier, moved out of Redis and worker memory into the database.
CREATE TABLE "CrawlFrontier" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "depth" INTEGER NOT NULL DEFAULT 0,
    "discoverySource" TEXT NOT NULL DEFAULT 'link',
    "sourceUrl" TEXT,
    "reason" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrawlFrontier_pkey" PRIMARY KEY ("id")
);

-- The dedup key. Claiming a URL is an INSERT that either wins or conflicts, so
-- this constraint is what makes the claim atomic across workers.
CREATE UNIQUE INDEX "CrawlFrontier_crawlJobId_normalizedUrl_key" ON "CrawlFrontier"("crawlJobId", "normalizedUrl");
CREATE INDEX "CrawlFrontier_crawlJobId_state_idx" ON "CrawlFrontier"("crawlJobId", "state");
CREATE INDEX "CrawlFrontier_crawlJobId_state_depth_idx" ON "CrawlFrontier"("crawlJobId", "state", "depth");

ALTER TABLE "CrawlFrontier" ADD CONSTRAINT "CrawlFrontier_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "CrawlJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
