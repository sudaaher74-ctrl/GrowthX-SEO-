-- Social profiles published on a crawled site, read from the crawl's own links.
--
-- The crawler already saw every outbound link on every page and discarded the
-- external ones, so the only social discovery in the product re-fetched a
-- site's homepage to look for links it had had in hand. These rows keep them.
--
-- pageCount is the honest way to tell a site's own account from a link to
-- somebody else's: a business's profiles sit in the footer and so appear on
-- every page, while a mention of a partner appears once. It is counted per
-- crawl job, so it stays comparable to that crawl's page total instead of
-- accumulating across every crawl the site has ever had.
CREATE TABLE "SiteSocialLink" (
    "id" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "profileUrl" TEXT NOT NULL,
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteSocialLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SiteSocialLink_crawlJobId_platform_handle_key" ON "SiteSocialLink"("crawlJobId", "platform", "handle");
CREATE INDEX "SiteSocialLink_crawlJobId_idx" ON "SiteSocialLink"("crawlJobId");

ALTER TABLE "SiteSocialLink" ADD CONSTRAINT "SiteSocialLink_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "CrawlJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
