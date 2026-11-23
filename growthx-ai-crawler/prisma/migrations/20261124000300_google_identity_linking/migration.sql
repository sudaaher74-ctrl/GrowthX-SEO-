-- Additive migration for verified Google subject binding, password-auth disablement,
-- session invalidation timestamps, and single-use account linking/recovery challenges.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "googleSub" TEXT,
  ADD COLUMN IF NOT EXISTS "googleEmailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "passwordAuthEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "sessionsInvalidatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub");

CREATE TABLE IF NOT EXISTS "IdentityRecoveryChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerSub" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT,
  "lastName" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IdentityRecoveryChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IdentityRecoveryChallenge_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "IdentityRecoveryChallenge_userId_idx" ON "IdentityRecoveryChallenge"("userId");
CREATE INDEX IF NOT EXISTS "IdentityRecoveryChallenge_expiresAt_idx" ON "IdentityRecoveryChallenge"("expiresAt");
