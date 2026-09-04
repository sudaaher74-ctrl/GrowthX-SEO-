-- Competitor-to-Action Engine.
--
-- Adds the decision layer: an observation (CompetitorFinding), a run that
-- reads observations (StrategyRun), and an action a person can pick up
-- (StrategyAction). Also the setup fields the engine needs — per-competitor
-- platform identities, and the customer's own goal and audience, which change
-- how every action ranks.

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('TECHNICAL_SEO', 'CONTENT_GAP', 'LOCAL_SEO', 'GOOGLE_BUSINESS_PROFILE', 'YOUTUBE', 'INSTAGRAM', 'AI_SEARCH');
CREATE TYPE "FindingConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "ActionPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "ActionOwner" AS ENUM ('FOUNDER', 'MARKETER', 'SEO_SPECIALIST', 'DESIGNER', 'DEVELOPER');
CREATE TYPE "ActionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE');

-- Competitor setup fields. All nullable: existing rows predate the engine and
-- must keep working untouched.
ALTER TABLE "CompetitorDomain" ADD COLUMN "mapsName" TEXT;
ALTER TABLE "CompetitorDomain" ADD COLUMN "youtubeUrl" TEXT;
ALTER TABLE "CompetitorDomain" ADD COLUMN "instagramHandle" TEXT;
ALTER TABLE "CompetitorDomain" ADD COLUMN "city" TEXT;

-- The customer's own goal and audience.
ALTER TABLE "ProjectBusinessProfile" ADD COLUMN "businessGoal" TEXT;
ALTER TABLE "ProjectBusinessProfile" ADD COLUMN "targetAudience" TEXT;

-- CreateTable
CREATE TABLE "CompetitorFinding" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "competitorId" TEXT,
    "category" "FindingCategory" NOT NULL,
    "summary" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourcePlatform" TEXT NOT NULL,
    "metricName" TEXT,
    "metricValue" DOUBLE PRECISION,
    "customerValue" DOUBLE PRECISION,
    "confidence" "FindingConfidence" NOT NULL DEFAULT 'MEDIUM',
    "observedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorFinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategyRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "businessGoal" TEXT,
    "findingsUsed" INTEGER NOT NULL DEFAULT 0,
    "coverageGaps" TEXT[],
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "StrategyRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StrategyAction" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "steps" TEXT[],
    "rationale" TEXT NOT NULL,
    "expectedImpact" TEXT NOT NULL,
    "effortHours" INTEGER NOT NULL,
    "priority" "ActionPriority" NOT NULL,
    "owner" "ActionOwner" NOT NULL,
    "opportunityScore" INTEGER NOT NULL,
    "scoreExplanation" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyAction_pkey" PRIMARY KEY ("id")
);

-- The evidence behind each action.
CREATE TABLE "_CompetitorFindingToStrategyAction" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "CompetitorFinding_projectId_category_idx" ON "CompetitorFinding"("projectId", "category");
CREATE INDEX "CompetitorFinding_projectId_observedAt_idx" ON "CompetitorFinding"("projectId", "observedAt");
CREATE INDEX "StrategyRun_projectId_startedAt_idx" ON "StrategyRun"("projectId", "startedAt");
CREATE INDEX "StrategyAction_projectId_status_idx" ON "StrategyAction"("projectId", "status");
CREATE INDEX "StrategyAction_runId_opportunityScore_idx" ON "StrategyAction"("runId", "opportunityScore");
CREATE UNIQUE INDEX "_CompetitorFindingToStrategyAction_AB_unique" ON "_CompetitorFindingToStrategyAction"("A", "B");
CREATE INDEX "_CompetitorFindingToStrategyAction_B_index" ON "_CompetitorFindingToStrategyAction"("B");

-- AddForeignKey
ALTER TABLE "CompetitorFinding" ADD CONSTRAINT "CompetitorFinding_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetitorFinding" ADD CONSTRAINT "CompetitorFinding_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "CompetitorDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StrategyRun" ADD CONSTRAINT "StrategyRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StrategyAction" ADD CONSTRAINT "StrategyAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "StrategyRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_CompetitorFindingToStrategyAction" ADD CONSTRAINT "_CompetitorFindingToStrategyAction_A_fkey" FOREIGN KEY ("A") REFERENCES "CompetitorFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_CompetitorFindingToStrategyAction" ADD CONSTRAINT "_CompetitorFindingToStrategyAction_B_fkey" FOREIGN KEY ("B") REFERENCES "StrategyAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
