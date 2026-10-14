CREATE TABLE "AiVisibilityJourney" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "phase" TEXT NOT NULL DEFAULT 'PREPARE',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "context" JSONB,
  "brief" JSONB,
  "analysis" JSONB,
  "errors" JSONB NOT NULL DEFAULT '[]',
  "scanId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiVisibilityJourney_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AiVisibilityJourney_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AiVisibilityJourney_scanId_key" ON "AiVisibilityJourney"("scanId");
CREATE INDEX "AiVisibilityJourney_projectId_createdAt_idx" ON "AiVisibilityJourney"("projectId", "createdAt");
-- Serialize paid runs across API replicas, including double clicks.
CREATE UNIQUE INDEX "AiVisibilityJourney_one_active_project" ON "AiVisibilityJourney"("projectId")
WHERE "status" IN ('QUEUED', 'PREPARING', 'CHECKING', 'PLANNING');
