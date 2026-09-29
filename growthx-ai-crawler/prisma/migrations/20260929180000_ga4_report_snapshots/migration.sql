-- GA4 report snapshots (exact 7d / 28d / 90d totals, cached per workspace) and
-- a per-workspace unique key on the GA4 fact table.
--
-- Ga4DailyMetric was unique on (propertyId, date, ...) without projectId, so two
-- workspaces on the same GA4 property collided and the second got no rows. The
-- new key is a superset of the old one, so no existing row can violate it.

-- DropIndex
DROP INDEX "Ga4DailyMetric_propertyId_date_grain_landingPage_channel_co_key";

-- CreateIndex
CREATE UNIQUE INDEX "Ga4DailyMetric_projectId_propertyId_date_grain_landingPage__key" ON "Ga4DailyMetric"("projectId", "propertyId", "date", "grain", "landingPage", "channel", "country", "device");

-- CreateTable
CREATE TABLE "Ga4ReportSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "range" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ga4ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ga4ReportSnapshot_projectId_idx" ON "Ga4ReportSnapshot"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Ga4ReportSnapshot_projectId_propertyId_range_key" ON "Ga4ReportSnapshot"("projectId", "propertyId", "range");

-- AddForeignKey
ALTER TABLE "Ga4ReportSnapshot" ADD CONSTRAINT "Ga4ReportSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
