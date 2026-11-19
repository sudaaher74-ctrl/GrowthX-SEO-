-- Add BIWEEKLY to CrawlFrequency enum idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'CrawlFrequency' AND e.enumlabel = 'BIWEEKLY'
  ) THEN
    ALTER TYPE "CrawlFrequency" ADD VALUE 'BIWEEKLY';
  END IF;
END $$;

-- Create ProjectAutomationSettings table for persisted scheduler & autonomy settings
CREATE TABLE IF NOT EXISTS "ProjectAutomationSettings" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "crawlFrequency" "CrawlFrequency" NOT NULL DEFAULT 'WEEKLY',
  "pipelineMode" TEXT NOT NULL DEFAULT 'CRAWL_ONLY',
  "maxDepth" INTEGER NOT NULL DEFAULT 500,
  "maxConcurrency" INTEGER NOT NULL DEFAULT 5,
  "useSitemap" BOOLEAN NOT NULL DEFAULT true,
  "autoStageLowRisk" BOOLEAN NOT NULL DEFAULT false,
  "agentAutonomy" JSONB NOT NULL DEFAULT '{}',
  "lastScheduledRunAt" TIMESTAMP(3),
  "lastScheduledStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProjectAutomationSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAutomationSettings_projectId_key"
  ON "ProjectAutomationSettings"("projectId");

CREATE INDEX IF NOT EXISTS "ProjectAutomationSettings_crawlFrequency_idx"
  ON "ProjectAutomationSettings"("crawlFrequency");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAutomationSettings_projectId_fkey'
  ) THEN
    ALTER TABLE "ProjectAutomationSettings"
      ADD CONSTRAINT "ProjectAutomationSettings_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
