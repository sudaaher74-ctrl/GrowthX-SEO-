-- Voice autopilot runs and stored competitor reports.
-- Idempotent, like the migrations before it.
CREATE TABLE IF NOT EXISTS "AutopilotRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "competitors" JSONB NOT NULL DEFAULT '[]',
    "ownCrawlJobId" TEXT,
    "log" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "reportId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AutopilotRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AutopilotRun_projectId_startedAt_idx" ON "AutopilotRun"("projectId", "startedAt");
CREATE INDEX IF NOT EXISTS "AutopilotRun_status_idx" ON "AutopilotRun"("status");

CREATE TABLE IF NOT EXISTS "CompetitorReportSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorReportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompetitorReportSnapshot_projectId_createdAt_idx" ON "CompetitorReportSnapshot"("projectId", "createdAt");
