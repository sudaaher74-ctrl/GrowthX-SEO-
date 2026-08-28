-- GA4 fact table. Conversions and revenue are nullable rather than defaulted
-- to zero: most properties have no key events configured and most have no
-- revenue, and storing those as 0 makes "not measured" indistinguishable
-- from "measured, and it was none" — which reports a working business as
-- converting nobody.
-- CreateTable
CREATE TABLE "Ga4DailyMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "grain" TEXT NOT NULL,
    "landingPage" TEXT,
    "channel" TEXT,
    "country" TEXT,
    "device" TEXT,
    "users" INTEGER NOT NULL,
    "sessions" INTEGER NOT NULL,
    "engagementRate" DOUBLE PRECISION NOT NULL,
    "conversions" INTEGER,
    "revenue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ga4DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Ga4DailyMetric_projectId_grain_date_idx" ON "Ga4DailyMetric"("projectId", "grain", "date");

-- CreateIndex
CREATE INDEX "Ga4DailyMetric_projectId_landingPage_idx" ON "Ga4DailyMetric"("projectId", "landingPage");

-- CreateIndex
CREATE UNIQUE INDEX "Ga4DailyMetric_propertyId_date_grain_landingPage_channel_co_key" ON "Ga4DailyMetric"("propertyId", "date", "grain", "landingPage", "channel", "country", "device");

