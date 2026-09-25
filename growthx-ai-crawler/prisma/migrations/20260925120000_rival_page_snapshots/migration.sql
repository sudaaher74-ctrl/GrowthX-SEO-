-- Daily snapshots of rival pages, written only when a page changes.
-- Idempotent, like the migrations before it, so a database brought up with
-- `db push` does not fail here.
CREATE TABLE IF NOT EXISTS "RivalPageSnapshot" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "title" TEXT,
    "h1" TEXT,
    "metaDescription" TEXT,
    "schemaTypes" TEXT[],
    "wordCount" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RivalPageSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RivalPageSnapshot_domain_url_capturedAt_idx" ON "RivalPageSnapshot"("domain", "url", "capturedAt");
CREATE INDEX IF NOT EXISTS "RivalPageSnapshot_domain_capturedAt_idx" ON "RivalPageSnapshot"("domain", "capturedAt");
