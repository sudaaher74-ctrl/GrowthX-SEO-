-- Quarantine legacy SiteRepository credentials whose tenant provenance cannot be established,
-- and record owning organization + authorizing user on every newly verified connection.
ALTER TABLE "SiteRepository"
  ADD COLUMN IF NOT EXISTS "connectedOrganizationId" TEXT,
  ADD COLUMN IF NOT EXISTS "connectedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "credentialProvenance" TEXT NOT NULL DEFAULT 'LEGACY_UNVERIFIED',
  ADD COLUMN IF NOT EXISTS "credentialVerifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "SiteRepository_connectedOrganizationId_idx"
  ON "SiteRepository"("connectedOrganizationId");
