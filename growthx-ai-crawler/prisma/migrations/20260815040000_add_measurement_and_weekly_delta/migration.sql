-- CreateEnum
CREATE TYPE "OutcomeStatus" AS ENUM ('PENDING', 'MEASURED', 'INCONCLUSIVE');

-- CreateTable
CREATE TABLE "MarketActionOutcome" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "OutcomeStatus" NOT NULL DEFAULT 'PENDING',
    "baselineAt" TIMESTAMP(3) NOT NULL,
    "baselineCitationSharePct" DOUBLE PRECISION,
    "baselineAveragePosition" DOUBLE PRECISION,
    "baselineTrackedPrompts" INTEGER NOT NULL DEFAULT 0,
    "measuredAt" TIMESTAMP(3),
    "citationSharePct" DOUBLE PRECISION,
    "averagePosition" DOUBLE PRECISION,
    "deltaPt" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketActionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyDelta" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "content" JSONB NOT NULL,
    "generatedByModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyDelta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketActionOutcome_actionId_key" ON "MarketActionOutcome"("actionId");

-- CreateIndex
CREATE INDEX "MarketActionOutcome_organizationId_projectId_status_idx" ON "MarketActionOutcome"("organizationId", "projectId", "status");

-- CreateIndex
CREATE INDEX "WeeklyDelta_organizationId_projectId_periodEnd_idx" ON "WeeklyDelta"("organizationId", "projectId", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyDelta_projectId_periodStart_key" ON "WeeklyDelta"("projectId", "periodStart");

-- AddForeignKey
ALTER TABLE "MarketActionOutcome" ADD CONSTRAINT "MarketActionOutcome_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "MarketAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyDelta" ADD CONSTRAINT "WeeklyDelta_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

