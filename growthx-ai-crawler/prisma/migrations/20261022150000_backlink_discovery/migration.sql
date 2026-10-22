CREATE TABLE "PublicBacklinkEdge" (
  "id" TEXT PRIMARY KEY, "sourceUrl" TEXT NOT NULL, "targetUrl" TEXT NOT NULL,
  "targetHost" TEXT NOT NULL, "targetRoot" TEXT NOT NULL, "archivePath" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3), "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PublicBacklinkEdge_targetRoot_indexedAt_idx" ON "PublicBacklinkEdge"("targetRoot", "indexedAt");
CREATE INDEX "PublicBacklinkEdge_indexedAt_idx" ON "PublicBacklinkEdge"("indexedAt");
CREATE TABLE "PublicBacklinkSlice" (
  "path" TEXT PRIMARY KEY, "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "pages" INTEGER NOT NULL DEFAULT 0, "edges" INTEGER NOT NULL DEFAULT 0,
  "bytes" INTEGER NOT NULL DEFAULT 0, "reason" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3)
);
CREATE TABLE "BacklinkDiscoveryRun" (
  "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "stage" TEXT NOT NULL DEFAULT 'Waiting for discovery worker', "candidates" INTEGER NOT NULL DEFAULT 0,
  "added" INTEGER NOT NULL DEFAULT 0, "verified" INTEGER NOT NULL DEFAULT 0, "checked" INTEGER NOT NULL DEFAULT 0,
  "sourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "details" JSONB NOT NULL DEFAULT '[]', "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "finishedAt" TIMESTAMP(3),
  CONSTRAINT "BacklinkDiscoveryRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BacklinkDiscoveryRun_projectId_startedAt_idx" ON "BacklinkDiscoveryRun"("projectId", "startedAt");
CREATE INDEX "BacklinkDiscoveryRun_status_startedAt_idx" ON "BacklinkDiscoveryRun"("status", "startedAt");
CREATE UNIQUE INDEX "BacklinkDiscoveryRun_one_active_per_project" ON "BacklinkDiscoveryRun"("projectId") WHERE "status" IN ('QUEUED', 'RUNNING');
