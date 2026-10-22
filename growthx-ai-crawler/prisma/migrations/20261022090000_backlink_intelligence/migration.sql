CREATE TABLE "BacklinkSource" (
  "id" TEXT NOT NULL, "projectId" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL,
  "origin" TEXT NOT NULL, "discovery" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
  "lastAttemptAt" TIMESTAMP(3), "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BacklinkSource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BacklinkSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BacklinkSource_projectId_sourceUrl_key" ON "BacklinkSource"("projectId", "sourceUrl");
CREATE INDEX "BacklinkSource_nextCheckAt_projectId_idx" ON "BacklinkSource"("nextCheckAt", "projectId");
CREATE TABLE "Backlink" (
  "id" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "targetUrl" TEXT NOT NULL,
  "targetHost" TEXT NOT NULL, "targetKind" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
  "anchorText" TEXT, "rel" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "firstObservedAt" TIMESTAMP(3), "lastVerifiedAt" TIMESTAMP(3), "firstMissingAt" TIMESTAMP(3),
  "missingChecks" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Backlink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Backlink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BacklinkSource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Backlink_sourceId_targetUrl_key" ON "Backlink"("sourceId", "targetUrl");
CREATE INDEX "Backlink_targetHost_status_idx" ON "Backlink"("targetHost", "status");
CREATE TABLE "BacklinkObservation" (
  "id" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "outcome" TEXT NOT NULL, "statusCode" INTEGER, "finalUrl" TEXT, "reason" TEXT NOT NULL,
  "contentHash" TEXT, "evidence" JSONB NOT NULL,
  CONSTRAINT "BacklinkObservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BacklinkObservation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "BacklinkSource"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BacklinkObservation_sourceId_checkedAt_idx" ON "BacklinkObservation"("sourceId", "checkedAt");
