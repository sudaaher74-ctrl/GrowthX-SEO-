ALTER TABLE "Backlink"
  ADD COLUMN "followState" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "linkTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "placements" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lostConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "lastChangedAt" TIMESTAMP(3);
ALTER TABLE "BacklinkSource" ADD COLUMN "changeHistoryTruncated" BOOLEAN NOT NULL DEFAULT false;
-- Existing LOST rows have a confirmed loss, but no new historical event is
-- manufactured. The latest recorded attempt is the only available bound.
UPDATE "Backlink" b SET "lostConfirmedAt" = s."lastAttemptAt"
FROM "BacklinkSource" s WHERE b."sourceId" = s.id AND b.status = 'LOST';
CREATE INDEX "Backlink_sourceId_targetKind_status_idx" ON "Backlink"("sourceId", "targetKind", "status");
CREATE INDEX "Backlink_sourceId_firstObservedAt_idx" ON "Backlink"("sourceId", "firstObservedAt");
CREATE TABLE "BacklinkChange" (
  "id" TEXT NOT NULL, "backlinkId" TEXT NOT NULL, "kind" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "before" JSONB NOT NULL DEFAULT '{}', "after" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "BacklinkChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BacklinkChange_backlinkId_fkey" FOREIGN KEY ("backlinkId") REFERENCES "Backlink"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BacklinkChange_backlinkId_occurredAt_idx" ON "BacklinkChange"("backlinkId", "occurredAt");
CREATE INDEX "BacklinkChange_occurredAt_kind_idx" ON "BacklinkChange"("occurredAt", "kind");
