-- The unified opportunity surface. A new table only; MarketOpportunity and
-- ContentGap are left exactly as they are. The unique key on (projectId,
-- fingerprint) is what lets detection re-run daily without duplicating a
-- finding or resurrecting one the customer dismissed.
-- CreateTable
CREATE TABLE "GrowthOpportunity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "potential" TEXT NOT NULL DEFAULT 'MEDIUM',
    "effort" TEXT NOT NULL DEFAULT 'MEDIUM',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "priority" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "affectedPages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dismissedAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrowthOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GrowthOpportunity_projectId_status_priority_idx" ON "GrowthOpportunity"("projectId", "status", "priority");

-- CreateIndex
CREATE INDEX "GrowthOpportunity_projectId_source_idx" ON "GrowthOpportunity"("projectId", "source");

-- CreateIndex
CREATE INDEX "GrowthOpportunity_organizationId_projectId_idx" ON "GrowthOpportunity"("organizationId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthOpportunity_projectId_fingerprint_key" ON "GrowthOpportunity"("projectId", "fingerprint");

-- AddForeignKey
ALTER TABLE "GrowthOpportunity" ADD CONSTRAINT "GrowthOpportunity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

