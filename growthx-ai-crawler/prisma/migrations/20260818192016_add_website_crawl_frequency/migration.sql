-- CreateEnum
CREATE TYPE "CrawlFrequency" AS ENUM ('OFF', 'DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Website" ADD COLUMN     "crawlFrequency" "CrawlFrequency" NOT NULL DEFAULT 'MONTHLY';

-- CreateIndex
CREATE INDEX "Website_isVerified_crawlFrequency_idx" ON "Website"("isVerified", "crawlFrequency");
