-- AlterTable CrawlJob
ALTER TABLE "CrawlJob" ADD COLUMN IF NOT EXISTS "healthScore" INTEGER;
ALTER TABLE "CrawlJob" ADD COLUMN IF NOT EXISTS "uniqueIssuesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrawlJob" ADD COLUMN IF NOT EXISTS "resolvedIssuesCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CrawlJob" ADD COLUMN IF NOT EXISTS "qualityDiagnostics" JSONB;

-- AlterTable Issue
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "confidence" TEXT NOT NULL DEFAULT 'LIKELY';
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "impact" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "explanation" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "evidence" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "dedupKey" TEXT;
ALTER TABLE "Issue" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Issue_crawlJobId_dedupKey_idx" ON "Issue"("crawlJobId", "dedupKey");
CREATE INDEX IF NOT EXISTS "Issue_crawlJobId_category_idx" ON "Issue"("crawlJobId", "category");
