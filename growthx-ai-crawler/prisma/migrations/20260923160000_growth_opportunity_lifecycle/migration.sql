-- The finding lifecycle (commit 78aeaa9) added these to schema.prisma without
-- a migration. A database built by `prisma migrate deploy` therefore lacked
-- them, and because Prisma selects every column, any read of GrowthOpportunity
-- failed with "column does not exist".
--
-- Written to be idempotent: a database that was brought up with `db push`
-- already has some or all of this, and must not fail here.
DO $$ BEGIN
  CREATE TYPE "FindingLifecycle" AS ENUM ('DETECTED', 'QUEUED', 'SNOOZED', 'DISMISSED', 'APPROVED', 'APPLYING', 'VERIFYING', 'VERIFIED', 'MEASURED', 'FAILED', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "GrowthOpportunity"
  ADD COLUMN IF NOT EXISTS "affectedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "detailRef" TEXT,
  ADD COLUMN IF NOT EXISTS "detailType" TEXT,
  ADD COLUMN IF NOT EXISTS "dismissReason" TEXT,
  ADD COLUMN IF NOT EXISTS "fixClass" TEXT NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "impact" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastTransitionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lifecycle" "FindingLifecycle" NOT NULL DEFAULT 'DETECTED',
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "snoozeUntil" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "transitions" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "GrowthOpportunity_projectId_lifecycle_impact_idx" ON "GrowthOpportunity"("projectId", "lifecycle", "impact");
CREATE INDEX IF NOT EXISTS "GrowthOpportunity_projectId_status_impact_idx" ON "GrowthOpportunity"("projectId", "status", "impact");
CREATE INDEX IF NOT EXISTS "GrowthOpportunity_projectId_fixClass_status_idx" ON "GrowthOpportunity"("projectId", "fixClass", "status");
