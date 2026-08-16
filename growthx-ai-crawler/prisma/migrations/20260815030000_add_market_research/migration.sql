-- CreateEnum
CREATE TYPE "ResearchIntent" AS ENUM ('MARKET_TREND', 'COMPETITOR_COMPARISON', 'CUSTOMER_INSIGHT', 'AI_VISIBILITY_GAP', 'CONTENT_OPPORTUNITY', 'STRATEGIC_RECOMMENDATION');

-- CreateEnum
CREATE TYPE "ResearchRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ResearchSourceType" AS ENUM ('PUBLIC_WEB', 'CLIENT_WEBSITE', 'UPLOADED_FILE', 'AI_VISIBILITY_CHECK', 'INTEGRATION_DATA');

-- CreateEnum
CREATE TYPE "ResearchConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ResearchClaimKind" AS ENUM ('VERIFIED', 'INFERENCE');

-- CreateEnum
CREATE TYPE "MarketActionType" AS ENUM ('CONTENT_BRIEF', 'PAGE_REFRESH', 'TECHNICAL_TASK', 'TRACK_PROMPT', 'COMPETITOR_WATCH', 'OUTREACH_OPPORTUNITY');

-- CreateEnum
CREATE TYPE "MarketActionStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "MarketWatchKind" AS ENUM ('COMPETITOR', 'TOPIC');

-- CreateEnum
CREATE TYPE "ResearchMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "MarketResearchThread" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketResearchThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketResearchMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "ResearchMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketResearchMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketResearchRun" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "intent" "ResearchIntent",
    "status" "ResearchRunStatus" NOT NULL DEFAULT 'RUNNING',
    "deepResearch" BOOLEAN NOT NULL DEFAULT false,
    "plan" JSONB,
    "answer" JSONB,
    "confidence" "ResearchConfidence",
    "modelUsage" JSONB,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MarketResearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchSource" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "type" "ResearchSourceType" NOT NULL,
    "url" TEXT,
    "internalDocId" TEXT,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "publishedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "excerpt" TEXT NOT NULL,
    "qualityScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchClaim" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ResearchClaimKind" NOT NULL,
    "text" TEXT NOT NULL,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketOpportunity" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "gap" TEXT NOT NULL,
    "competitorsWinning" TEXT[],
    "recommendedResponse" TEXT NOT NULL,
    "impact" "ResearchConfidence" NOT NULL DEFAULT 'MEDIUM',
    "effort" "ResearchConfidence" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT,
    "opportunityId" TEXT,
    "type" "MarketActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expectedImpact" TEXT,
    "confidence" "ResearchConfidence" NOT NULL DEFAULT 'MEDIUM',
    "status" "MarketActionStatus" NOT NULL DEFAULT 'PROPOSED',
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "convertedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketWatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "MarketWatchKind" NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchEmbedding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "vector" DOUBLE PRECISION[],
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ClaimCitations" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "MarketResearchThread_organizationId_projectId_updatedAt_idx" ON "MarketResearchThread"("organizationId", "projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "MarketResearchMessage_threadId_createdAt_idx" ON "MarketResearchMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketResearchMessage_organizationId_projectId_idx" ON "MarketResearchMessage"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "MarketResearchRun_organizationId_projectId_startedAt_idx" ON "MarketResearchRun"("organizationId", "projectId", "startedAt");

-- CreateIndex
CREATE INDEX "MarketResearchRun_threadId_idx" ON "MarketResearchRun"("threadId");

-- CreateIndex
CREATE INDEX "ResearchSource_organizationId_projectId_idx" ON "ResearchSource"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchSource_runId_sourceKey_key" ON "ResearchSource"("runId", "sourceKey");

-- CreateIndex
CREATE INDEX "ResearchClaim_runId_kind_idx" ON "ResearchClaim"("runId", "kind");

-- CreateIndex
CREATE INDEX "ResearchClaim_organizationId_projectId_idx" ON "ResearchClaim"("organizationId", "projectId");

-- CreateIndex
CREATE INDEX "MarketOpportunity_organizationId_projectId_createdAt_idx" ON "MarketOpportunity"("organizationId", "projectId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketAction_organizationId_projectId_status_idx" ON "MarketAction"("organizationId", "projectId", "status");

-- CreateIndex
CREATE INDEX "MarketWatch_organizationId_projectId_isActive_idx" ON "MarketWatch"("organizationId", "projectId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MarketWatch_projectId_kind_value_key" ON "MarketWatch"("projectId", "kind", "value");

-- CreateIndex
CREATE INDEX "ResearchEmbedding_organizationId_projectId_kind_idx" ON "ResearchEmbedding"("organizationId", "projectId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ResearchEmbedding_projectId_kind_refId_key" ON "ResearchEmbedding"("projectId", "kind", "refId");

-- CreateIndex
CREATE UNIQUE INDEX "_ClaimCitations_AB_unique" ON "_ClaimCitations"("A", "B");

-- CreateIndex
CREATE INDEX "_ClaimCitations_B_index" ON "_ClaimCitations"("B");

-- AddForeignKey
ALTER TABLE "MarketResearchThread" ADD CONSTRAINT "MarketResearchThread_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketResearchMessage" ADD CONSTRAINT "MarketResearchMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MarketResearchThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketResearchRun" ADD CONSTRAINT "MarketResearchRun_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MarketResearchThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchSource" ADD CONSTRAINT "ResearchSource_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MarketResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchClaim" ADD CONSTRAINT "ResearchClaim_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MarketResearchRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOpportunity" ADD CONSTRAINT "MarketOpportunity_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MarketResearchRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOpportunity" ADD CONSTRAINT "MarketOpportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketAction" ADD CONSTRAINT "MarketAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MarketResearchRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketAction" ADD CONSTRAINT "MarketAction_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "MarketOpportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketAction" ADD CONSTRAINT "MarketAction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketWatch" ADD CONSTRAINT "MarketWatch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClaimCitations" ADD CONSTRAINT "_ClaimCitations_A_fkey" FOREIGN KEY ("A") REFERENCES "ResearchClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClaimCitations" ADD CONSTRAINT "_ClaimCitations_B_fkey" FOREIGN KEY ("B") REFERENCES "ResearchSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

