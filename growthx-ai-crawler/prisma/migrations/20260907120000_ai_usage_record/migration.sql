-- CreateTable
CREATE TABLE "AiUsageRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "projectId" TEXT,
    "taskType" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION,
    "latencyMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageRecord_organizationId_createdAt_idx" ON "AiUsageRecord"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageRecord_projectId_createdAt_idx" ON "AiUsageRecord"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageRecord_taskType_createdAt_idx" ON "AiUsageRecord"("taskType", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageRecord_provider_createdAt_idx" ON "AiUsageRecord"("provider", "createdAt");

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "aiMonthlyBudgetUsd" DOUBLE PRECISION;
