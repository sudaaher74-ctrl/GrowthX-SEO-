-- Additive migration for expiring, single-use, browser-bound OAuth transactions with PKCE.
CREATE TABLE IF NOT EXISTS "OAuthTransaction" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "browserNonceHash" TEXT NOT NULL,
  "userId" TEXT,
  "organizationId" TEXT,
  "projectId" TEXT,
  "pkceVerifier" TEXT,
  "returnTo" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OAuthTransaction_expiresAt_idx" ON "OAuthTransaction"("expiresAt");
CREATE INDEX IF NOT EXISTS "OAuthTransaction_userId_provider_idx" ON "OAuthTransaction"("userId", "provider");
