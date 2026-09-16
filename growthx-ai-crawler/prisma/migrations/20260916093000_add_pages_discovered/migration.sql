-- URLs a crawl set out to fetch, so a truncated crawl can be told from a
-- complete one. Existing rows keep 0, which reads as "not recorded" rather
-- than claiming a coverage figure for crawls that never measured it.
ALTER TABLE "CrawlJob" ADD COLUMN "pagesDiscovered" INTEGER NOT NULL DEFAULT 0;
