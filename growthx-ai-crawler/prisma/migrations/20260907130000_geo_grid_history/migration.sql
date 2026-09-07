-- CreateTable
CREATE TABLE "GeoGridRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "locationId" TEXT,
    "keyword" TEXT NOT NULL,
    "gridSize" INTEGER NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "radiusKm" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'GOOGLE_PLACES',
    "averageRank" DOUBLE PRECISION,
    "foundCount" INTEGER NOT NULL,
    "top3Count" INTEGER NOT NULL,
    "top10Count" INTEGER NOT NULL,
    "pointCount" INTEGER NOT NULL,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeoGridRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoGridPoint" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "row" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "direction" TEXT NOT NULL,
    "rank" INTEGER,
    "resultCount" INTEGER NOT NULL,

    CONSTRAINT "GeoGridPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoGridCompetitor" (
    "id" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "placeId" TEXT,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "isClient" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GeoGridCompetitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeoGridRun_projectId_keyword_ranAt_idx" ON "GeoGridRun"("projectId", "keyword", "ranAt");

-- CreateIndex
CREATE INDEX "GeoGridRun_locationId_ranAt_idx" ON "GeoGridRun"("locationId", "ranAt");

-- CreateIndex
CREATE INDEX "GeoGridPoint_runId_idx" ON "GeoGridPoint"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoGridPoint_runId_row_col_key" ON "GeoGridPoint"("runId", "row", "col");

-- CreateIndex
CREATE INDEX "GeoGridCompetitor_pointId_rank_idx" ON "GeoGridCompetitor"("pointId", "rank");

-- CreateIndex
CREATE INDEX "GeoGridCompetitor_name_idx" ON "GeoGridCompetitor"("name");

-- AddForeignKey
ALTER TABLE "GeoGridPoint" ADD CONSTRAINT "GeoGridPoint_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GeoGridRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoGridCompetitor" ADD CONSTRAINT "GeoGridCompetitor_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "GeoGridPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
