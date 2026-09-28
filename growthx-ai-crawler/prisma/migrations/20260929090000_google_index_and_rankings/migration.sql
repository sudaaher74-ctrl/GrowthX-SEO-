-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "searchCountry" TEXT,
ADD COLUMN     "searchLanguage" TEXT NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "UrlIndexInspection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verdict" TEXT,
    "coverageState" TEXT,
    "indexingState" TEXT,
    "pageFetchState" TEXT,
    "robotsTxtState" TEXT,
    "googleCanonical" TEXT,
    "userCanonical" TEXT,
    "lastCrawlTime" TIMESTAMP(3),
    "crawledAs" TEXT,
    "sitemaps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "referringUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inspectionLink" TEXT,
    "error" TEXT,

    CONSTRAINT "UrlIndexInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackedKeyword" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackedKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerpSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT 'desktop',
    "provider" TEXT NOT NULL DEFAULT 'dataforseo',
    "results" JSONB NOT NULL DEFAULT '[]',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownPosition" INTEGER,
    "ownUrl" TEXT,
    "competitorPositions" JSONB NOT NULL DEFAULT '{}',
    "costUsd" DOUBLE PRECISION,
    "error" TEXT,

    CONSTRAINT "SerpSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordGapSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "competitorDomain" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "country" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "rows" JSONB NOT NULL DEFAULT '[]',
    "competitorKeywordsRead" INTEGER NOT NULL DEFAULT 0,
    "ownKeywordsRead" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION,
    "error" TEXT,

    CONSTRAINT "KeywordGapSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordDiagnosis" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "serpSnapshotId" TEXT,
    "result" JSONB NOT NULL,

    CONSTRAINT "KeywordDiagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UrlIndexInspection_projectId_url_inspectedAt_idx" ON "UrlIndexInspection"("projectId", "url", "inspectedAt");

-- CreateIndex
CREATE INDEX "UrlIndexInspection_projectId_inspectedAt_idx" ON "UrlIndexInspection"("projectId", "inspectedAt");

-- CreateIndex
CREATE INDEX "TrackedKeyword_projectId_isActive_idx" ON "TrackedKeyword"("projectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrackedKeyword_projectId_keyword_key" ON "TrackedKeyword"("projectId", "keyword");

-- CreateIndex
CREATE INDEX "SerpSnapshot_projectId_keyword_checkedAt_idx" ON "SerpSnapshot"("projectId", "keyword", "checkedAt");

-- CreateIndex
CREATE INDEX "SerpSnapshot_projectId_checkedAt_idx" ON "SerpSnapshot"("projectId", "checkedAt");

-- CreateIndex
CREATE INDEX "KeywordGapSnapshot_projectId_competitorDomain_fetchedAt_idx" ON "KeywordGapSnapshot"("projectId", "competitorDomain", "fetchedAt");

-- CreateIndex
CREATE INDEX "KeywordDiagnosis_projectId_createdAt_idx" ON "KeywordDiagnosis"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "UrlIndexInspection" ADD CONSTRAINT "UrlIndexInspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackedKeyword" ADD CONSTRAINT "TrackedKeyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpSnapshot" ADD CONSTRAINT "SerpSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordGapSnapshot" ADD CONSTRAINT "KeywordGapSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordDiagnosis" ADD CONSTRAINT "KeywordDiagnosis_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

