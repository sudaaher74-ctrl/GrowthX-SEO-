-- Stored Website Audit reports. Idempotent, like the migrations before it.
CREATE TABLE IF NOT EXISTS "AuditReportSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "report" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditReportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditReportSnapshot_projectId_createdAt_idx" ON "AuditReportSnapshot"("projectId", "createdAt");
