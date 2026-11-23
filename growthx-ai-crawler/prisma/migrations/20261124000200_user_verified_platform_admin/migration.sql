-- Additive migration for verified user ownership and immutable user-ID platform-admin provisioning.
-- Existing rows default to unverified and non-admin; legitimate operators must be explicitly
-- confirmed and provisioned by immutable user ID via scripts/manage-platform-admins.js.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "platformAdminGrantedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "platformAdminRevokedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_isPlatformAdmin_idx" ON "User"("isPlatformAdmin");
