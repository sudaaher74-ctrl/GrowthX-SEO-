-- Crawl retention: records which crawls have had their stored HTML cleared,
-- and which have had their page-level detail deleted, so the nightly job
-- never reprocesses one. Nullable and without defaults, so adding them is a
-- metadata-only change that does not rewrite the CrawlJob table. Idempotent,
-- like the migrations before it.

ALTER TABLE "CrawlJob" ADD COLUMN IF NOT EXISTS "htmlPrunedAt" TIMESTAMP(3);
ALTER TABLE "CrawlJob" ADD COLUMN IF NOT EXISTS "detailsPrunedAt" TIMESTAMP(3);
