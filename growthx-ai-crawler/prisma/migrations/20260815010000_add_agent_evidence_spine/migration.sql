-- CreateEnum
CREATE TYPE "AgentKind" AS ENUM ('SEO_AUDITOR', 'LOCAL_SEO', 'MARKET_INTELLIGENCE', 'STRATEGY', 'CONTENT');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('CRAWL_PAGE', 'CRAWL_ISSUE', 'PERFORMANCE', 'AI_VISIBILITY_CHECK', 'TRACKED_PROMPT', 'DATAFORSEO_SERP', 'DATAFORSEO_KEYWORD', 'DATAFORSEO_REVIEW', 'GBP_PROFILE', 'GBP_REVIEW', 'SEARCH_CONSOLE', 'ANALYTICS');

-- CreateEnum
CREATE TYPE "RecommendationHorizon" AS ENUM ('DAYS_30', 'DAYS_60', 'DAYS_90');

-- CreateEnum
CREATE TYPE "RecommendationEffort" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RecommendationImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'DONE', 'DISMISSED');

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "agent" "AgentKind" NOT NULL,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "generatedByModel" TEXT,
    "inputSummary" JSONB,
    "error" TEXT,

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT,
    "source" "EvidenceSource" NOT NULL,
    "reference" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agent" "AgentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "horizon" "RecommendationHorizon" NOT NULL,
    "effort" "RecommendationEffort" NOT NULL,
    "impact" "RecommendationImpact" NOT NULL,
    "owner" TEXT NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PROPOSED',
    "primaryEvidenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SupportingEvidence" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "AgentRun_projectId_agent_startedAt_idx" ON "AgentRun"("projectId", "agent", "startedAt");

-- CreateIndex
CREATE INDEX "Evidence_projectId_source_observedAt_idx" ON "Evidence"("projectId", "source", "observedAt");

-- CreateIndex
CREATE INDEX "Evidence_runId_idx" ON "Evidence"("runId");

-- CreateIndex
CREATE INDEX "Recommendation_projectId_horizon_status_idx" ON "Recommendation"("projectId", "horizon", "status");

-- CreateIndex
CREATE INDEX "Recommendation_runId_idx" ON "Recommendation"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "_SupportingEvidence_AB_unique" ON "_SupportingEvidence"("A", "B");

-- CreateIndex
CREATE INDEX "_SupportingEvidence_B_index" ON "_SupportingEvidence"("B");

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_primaryEvidenceId_fkey" FOREIGN KEY ("primaryEvidenceId") REFERENCES "Evidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SupportingEvidence" ADD CONSTRAINT "_SupportingEvidence_A_fkey" FOREIGN KEY ("A") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SupportingEvidence" ADD CONSTRAINT "_SupportingEvidence_B_fkey" FOREIGN KEY ("B") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

