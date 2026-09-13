-- CreateEnum
CREATE TYPE "DesignStudioStatus" AS ENUM ('SUGGESTED', 'PREVIEWED', 'AWAITING_APPROVAL', 'APPROVED', 'PUBLISHED', 'VERIFIED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "DesignStudioPublishMethod" AS ENUM ('GITHUB_PR', 'CMS_DRAFT', 'DIRECT', 'DEVELOPER_HANDOFF');

-- CreateEnum
CREATE TYPE "DesignRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "PageSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "htmlSnapshotUrl" TEXT,
    "desktopScreenshotUrl" TEXT,
    "mobileScreenshotUrl" TEXT,
    "capturedStyles" JSONB NOT NULL DEFAULT '{}',
    "capturedSections" JSONB NOT NULL DEFAULT '[]',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSlot" (
    "id" TEXT NOT NULL,
    "pageSnapshotId" TEXT NOT NULL,
    "domSelector" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL DEFAULT 'OTHER',
    "currentText" TEXT NOT NULL DEFAULT '',
    "maxWords" INTEGER,
    "maxChars" INTEGER,
    "maxDesktopLines" INTEGER,
    "maxMobileLines" INTEGER,
    "allowedHtml" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "safeToEdit" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ContentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentSuggestion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageSnapshotId" TEXT NOT NULL,
    "slotId" TEXT,
    "title" TEXT NOT NULL,
    "seoIssue" TEXT NOT NULL,
    "recommendedLocation" TEXT NOT NULL,
    "currentWordCount" INTEGER NOT NULL DEFAULT 0,
    "suggestedWordCount" INTEGER NOT NULL DEFAULT 0,
    "contentType" TEXT NOT NULL DEFAULT 'OVERVIEW',
    "heading" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "variant" TEXT,
    "targetKeyword" TEXT,
    "lockedPhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "designFitScore" INTEGER,
    "seoValue" TEXT,
    "mobileRisk" "DesignRiskLevel",
    "status" "DesignStudioStatus" NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreviewResult" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "designFitScore" INTEGER NOT NULL,
    "scoreBreakdown" JSONB NOT NULL DEFAULT '{}',
    "safetyChecks" JSONB NOT NULL DEFAULT '[]',
    "blockingIssues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreviewResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "publishMethod" "DesignStudioPublishMethod" NOT NULL,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedChange" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "method" "DesignStudioPublishMethod" NOT NULL,
    "status" "DesignStudioStatus" NOT NULL DEFAULT 'APPROVED',
    "pullRequestUrl" TEXT,
    "externalDraftId" TEXT,
    "beforeContent" TEXT NOT NULL DEFAULT '',
    "afterContent" TEXT NOT NULL DEFAULT '',
    "error" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationResult" (
    "id" TEXT NOT NULL,
    "publishedChangeId" TEXT NOT NULL,
    "recrawledAt" TIMESTAMP(3),
    "seoResult" JSONB NOT NULL DEFAULT '{}',
    "visualResult" JSONB NOT NULL DEFAULT '{}',
    "contentFound" BOOLEAN NOT NULL DEFAULT false,
    "status" "DesignStudioStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RollbackRecord" (
    "id" TEXT NOT NULL,
    "publishedChangeId" TEXT NOT NULL,
    "reason" TEXT,
    "succeeded" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "pullRequestUrl" TEXT,
    "rolledBackAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RollbackRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PageSnapshot_projectId_pageUrl_idx" ON "PageSnapshot"("projectId", "pageUrl");

-- CreateIndex
CREATE INDEX "PageSnapshot_projectId_capturedAt_idx" ON "PageSnapshot"("projectId", "capturedAt");

-- CreateIndex
CREATE INDEX "ContentSlot_pageSnapshotId_sectionType_idx" ON "ContentSlot"("pageSnapshotId", "sectionType");

-- CreateIndex
CREATE INDEX "ContentSuggestion_projectId_status_idx" ON "ContentSuggestion"("projectId", "status");

-- CreateIndex
CREATE INDEX "ContentSuggestion_pageSnapshotId_idx" ON "ContentSuggestion"("pageSnapshotId");

-- CreateIndex
CREATE INDEX "PreviewResult_suggestionId_createdAt_idx" ON "PreviewResult"("suggestionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRecord_suggestionId_key" ON "ApprovalRecord"("suggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedChange_suggestionId_key" ON "PublishedChange"("suggestionId");

-- CreateIndex
CREATE INDEX "PublishedChange_projectId_status_idx" ON "PublishedChange"("projectId", "status");

-- CreateIndex
CREATE INDEX "PublishedChange_projectId_createdAt_idx" ON "PublishedChange"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationResult_publishedChangeId_createdAt_idx" ON "VerificationResult"("publishedChangeId", "createdAt");

-- CreateIndex
CREATE INDEX "RollbackRecord_publishedChangeId_idx" ON "RollbackRecord"("publishedChangeId");

-- AddForeignKey
ALTER TABLE "PageSnapshot" ADD CONSTRAINT "PageSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSlot" ADD CONSTRAINT "ContentSlot_pageSnapshotId_fkey" FOREIGN KEY ("pageSnapshotId") REFERENCES "PageSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSuggestion" ADD CONSTRAINT "ContentSuggestion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSuggestion" ADD CONSTRAINT "ContentSuggestion_pageSnapshotId_fkey" FOREIGN KEY ("pageSnapshotId") REFERENCES "PageSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentSuggestion" ADD CONSTRAINT "ContentSuggestion_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ContentSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviewResult" ADD CONSTRAINT "PreviewResult_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "ContentSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRecord" ADD CONSTRAINT "ApprovalRecord_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "ContentSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedChange" ADD CONSTRAINT "PublishedChange_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedChange" ADD CONSTRAINT "PublishedChange_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "ContentSuggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationResult" ADD CONSTRAINT "VerificationResult_publishedChangeId_fkey" FOREIGN KEY ("publishedChangeId") REFERENCES "PublishedChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RollbackRecord" ADD CONSTRAINT "RollbackRecord_publishedChangeId_fkey" FOREIGN KEY ("publishedChangeId") REFERENCES "PublishedChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

