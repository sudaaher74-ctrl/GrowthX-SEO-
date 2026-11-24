-- Add server-owned subscriptionTier on Organization so plan entitlements and
-- quotas are derived strictly from server records, never from client headers.
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "subscriptionTier" TEXT NOT NULL DEFAULT 'founder_free';
