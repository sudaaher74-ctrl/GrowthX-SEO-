-- Every gap comparison needs both sides typed: "they have 24 service pages you
-- don't" cannot be computed while a service page and a blog post are the same
-- kind of row. Existing pages take the column default and are re-typed by a
-- one-off backfill, so nothing waits on a re-crawl.
ALTER TABLE "Page" ADD COLUMN     "pageType" TEXT NOT NULL DEFAULT 'OTHER';

-- CreateIndex
CREATE INDEX "Page_crawlJobId_pageType_idx" ON "Page"("crawlJobId", "pageType");
