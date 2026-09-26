-- Business module (Products Intelligence): product catalogs for the
-- project's own site and its existing competitors, plus on-page marketing
-- signals. Idempotent, like the migrations before it, so a database brought
-- up with `db push` does not fail here.

DO $$ BEGIN
  CREATE TYPE "CatalogFieldStatus" AS ENUM ('FOUND', 'NOT_PUBLISHED', 'NOT_YET_CRAWLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CatalogCtaType" AS ENUM ('ADD_TO_CART', 'BUY_NOW', 'ENQUIRE', 'REQUEST_QUOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CatalogProduct" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "competitorId" TEXT,
    "pageId" TEXT,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "priceStatus" "CatalogFieldStatus" NOT NULL DEFAULT 'NOT_YET_CRAWLED',
    "priceMinorUnits" INTEGER,
    "currency" TEXT,
    "stockStatus" "CatalogFieldStatus" NOT NULL DEFAULT 'NOT_YET_CRAWLED',
    "stockValue" TEXT,
    "category" TEXT,
    "ctaType" "CatalogCtaType",
    "completenessScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchConfidence" DOUBLE PRECISION,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- Not unique: a competitor's crawled Page is shared across every project
-- tracking that domain, so one Page can resolve to one CatalogProduct row
-- per project.
CREATE INDEX IF NOT EXISTS "CatalogProduct_pageId_idx" ON "CatalogProduct"("pageId");

-- Protects the competitor rows: (projectId, competitorId, url) is a real
-- three-value tuple whenever competitorId is set.
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogProduct_projectId_competitorId_url_key" ON "CatalogProduct"("projectId", "competitorId", "url");

-- Protects the own-site rows, where competitorId is NULL on every row and so
-- cannot be part of a normal unique tuple (Postgres never treats two NULLs
-- as a duplicate). A partial index is the standard fix. Not representable in
-- schema.prisma — see the doc comment on CatalogProduct.
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogProduct_own_site_projectId_url_key" ON "CatalogProduct"("projectId", "url") WHERE "competitorId" IS NULL;

CREATE INDEX IF NOT EXISTS "CatalogProduct_projectId_competitorId_idx" ON "CatalogProduct"("projectId", "competitorId");
CREATE INDEX IF NOT EXISTS "CatalogProduct_projectId_category_idx" ON "CatalogProduct"("projectId", "category");

DO $$ BEGIN
  ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "CompetitorDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "MarketingSignal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "competitorId" TEXT,
    "pageId" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingSignal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingSignal_projectId_competitorId_idx" ON "MarketingSignal"("projectId", "competitorId");

DO $$ BEGIN
  ALTER TABLE "MarketingSignal" ADD CONSTRAINT "MarketingSignal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MarketingSignal" ADD CONSTRAINT "MarketingSignal_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "CompetitorDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MarketingSignal" ADD CONSTRAINT "MarketingSignal_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
