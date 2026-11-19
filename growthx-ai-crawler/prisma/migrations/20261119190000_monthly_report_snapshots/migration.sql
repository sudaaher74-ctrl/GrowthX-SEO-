-- CreateTable
CREATE TABLE IF NOT EXISTS "MonthlyReportSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "agencyNotes" TEXT,
    "shareToken" TEXT,
    "shareExpiresAt" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyReportSnapshot_shareToken_key" ON "MonthlyReportSnapshot"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyReportSnapshot_projectId_month_key" ON "MonthlyReportSnapshot"("projectId", "month");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonthlyReportSnapshot_projectId_month_idx" ON "MonthlyReportSnapshot"("projectId", "month");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MonthlyReportSnapshot_shareToken_idx" ON "MonthlyReportSnapshot"("shareToken");
