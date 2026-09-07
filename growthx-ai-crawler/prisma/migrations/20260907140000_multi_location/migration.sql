-- Locations become many-per-project: the product sells to businesses with
-- 5-100 locations and prices per location, which a one-to-one relation could
-- not represent.
DROP INDEX IF EXISTS "LocalLocation_projectId_key";

-- AlterTable
ALTER TABLE "LocalLocation" ADD COLUMN "placeId" TEXT;
ALTER TABLE "LocalLocation" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "LocalLocation" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "LocalLocation" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "LocalLocation_projectId_placeId_key" ON "LocalLocation"("projectId", "placeId");

-- CreateIndex
CREATE INDEX "LocalLocation_projectId_idx" ON "LocalLocation"("projectId");
