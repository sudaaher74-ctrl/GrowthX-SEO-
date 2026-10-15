-- CreateTable FixSnapshot
CREATE TABLE "FixSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "automationRunId" TEXT,
    "url" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "pageId" TEXT,
    "title" TEXT,
    "metaDescription" TEXT,
    "h1" TEXT,
    "canonicalUrl" TEXT,
    "robotsDirectives" TEXT,
    "structuredData" JSONB DEFAULT '[]',
    "headings" JSONB DEFAULT '[]',
    "internalLinksCount" INTEGER DEFAULT 0,
    "issuesCount" INTEGER DEFAULT 0,
    "issuesList" JSONB DEFAULT '[]',
    "contentSnippet" TEXT,
    "htmlContentHash" TEXT,
    "screenshotUrl" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable FixImpactLedgerEvent
CREATE TABLE "FixImpactLedgerEvent" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "automationRunId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actor" TEXT NOT NULL DEFAULT 'SYSTEM',
    "affectedUrl" TEXT,
    "evidenceData" JSONB NOT NULL DEFAULT '{}',
    "pullRequestUrl" TEXT,
    "commitSha" TEXT,
    "verificationStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixImpactLedgerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable FixRegressionRecord
CREATE TABLE "FixRegressionRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "automationRunId" TEXT,
    "url" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "issueCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "FixRegressionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixSnapshot_projectId_url_snapshotType_idx" ON "FixSnapshot"("projectId", "url", "snapshotType");
CREATE INDEX "FixSnapshot_projectId_automationRunId_idx" ON "FixSnapshot"("projectId", "automationRunId");

-- CreateIndex
CREATE INDEX "FixImpactLedgerEvent_projectId_createdAt_idx" ON "FixImpactLedgerEvent"("projectId", "createdAt");
CREATE INDEX "FixImpactLedgerEvent_projectId_automationRunId_idx" ON "FixImpactLedgerEvent"("projectId", "automationRunId");

-- CreateIndex
CREATE INDEX "FixRegressionRecord_projectId_severity_idx" ON "FixRegressionRecord"("projectId", "severity");
CREATE INDEX "FixRegressionRecord_projectId_detectedAt_idx" ON "FixRegressionRecord"("projectId", "detectedAt");

-- AddForeignKey
ALTER TABLE "FixSnapshot" ADD CONSTRAINT "FixSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixImpactLedgerEvent" ADD CONSTRAINT "FixImpactLedgerEvent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixRegressionRecord" ADD CONSTRAINT "FixRegressionRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
