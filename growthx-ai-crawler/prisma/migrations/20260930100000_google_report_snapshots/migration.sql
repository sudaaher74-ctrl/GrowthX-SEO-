-- Stored Google improvement reports (Search Console + Analytics 4, written by
-- Sarvam). Idempotent, like the migrations before it.
CREATE TABLE IF NOT EXISTS "GoogleReportSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleReportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GoogleReportSnapshot_projectId_createdAt_idx" ON "GoogleReportSnapshot"("projectId", "createdAt");
