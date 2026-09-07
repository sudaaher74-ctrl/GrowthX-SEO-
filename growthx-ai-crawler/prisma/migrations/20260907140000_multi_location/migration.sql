-- Locations become many-per-project: the product sells to businesses with
-- 5-100 locations and prices per location, which a one-to-one relation could
-- not represent.
DROP INDEX IF EXISTS "LocalLocation_projectId_key";

-- AlterTable
ALTER TABLE "LocalLocation" ADD COLUMN "placeId" TEXT;
ALTER TABLE "LocalLocation" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "LocalLocation" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "LocalLocation" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill before the unique index exists.
--
-- Rows created before this migration have no placeId. Left NULL, they can never
-- be matched by the (projectId, placeId) upsert that connectBusiness now
-- performs -- Postgres treats NULLs as distinct, so the lookup misses and the
-- next reconnect of an existing listing would insert a SECOND location for that
-- project instead of updating the first. At per-location pricing that
-- double-bills the customer. The empty string is the same value the application
-- writes when Places supplies no id, so the two agree.
UPDATE "LocalLocation" SET "placeId" = '' WHERE "placeId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LocalLocation_projectId_placeId_key" ON "LocalLocation"("projectId", "placeId");

-- CreateIndex
CREATE INDEX "LocalLocation_projectId_idx" ON "LocalLocation"("projectId");
