-- Search Console fact table and sync-run history. Both are new tables, so
-- nothing existing is touched. One fact table with a grain discriminator
-- rather than a table per dimension: that is the shape the Search Analytics
-- API returns, and it is what makes the query-and-page grain — the link
-- from a search term to the page that answered it — a row rather than a join.
-- CreateTable
CREATE TABLE "GscDailyMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "grain" TEXT NOT NULL,
    "query" TEXT,
    "page" TEXT,
    "country" TEXT,
    "device" TEXT,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GscDailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataSyncJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "rangeStart" DATE,
    "rangeEnd" DATE,
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DataSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GscDailyMetric_projectId_grain_date_idx" ON "GscDailyMetric"("projectId", "grain", "date");

-- CreateIndex
CREATE INDEX "GscDailyMetric_projectId_grain_clicks_idx" ON "GscDailyMetric"("projectId", "grain", "clicks");

-- CreateIndex
CREATE INDEX "GscDailyMetric_projectId_page_idx" ON "GscDailyMetric"("projectId", "page");

-- CreateIndex
CREATE UNIQUE INDEX "GscDailyMetric_propertyId_date_grain_query_page_country_dev_key" ON "GscDailyMetric"("propertyId", "date", "grain", "query", "page", "country", "device");

-- CreateIndex
CREATE INDEX "DataSyncJob_projectId_provider_startedAt_idx" ON "DataSyncJob"("projectId", "provider", "startedAt");

