-- Additive migration for revision-bound human approval and atomic publication claims on ContentPiece.
ALTER TABLE "ContentPiece"
  ADD COLUMN IF NOT EXISTS "revisionHash" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedRevisionHash" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "publishClaimToken" TEXT,
  ADD COLUMN IF NOT EXISTS "publishClaimedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
