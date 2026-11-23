-- Provider snapshots are separate from directly verified backlink evidence.
CREATE TABLE "BacklinkDomainSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL DEFAULT 'OWN',
    "provider" TEXT NOT NULL DEFAULT 'dataforseo',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "backlinks" INTEGER NOT NULL DEFAULT 0,
    "referringDomains" INTEGER NOT NULL DEFAULT 0,
    "referringMainDomains" INTEGER NOT NULL DEFAULT 0,
    "referringIps" INTEGER NOT NULL DEFAULT 0,
    "referringSubnets" INTEGER NOT NULL DEFAULT 0,
    "referringPages" INTEGER NOT NULL DEFAULT 0,
    "dofollow" INTEGER NOT NULL DEFAULT 0,
    "nofollow" INTEGER NOT NULL DEFAULT 0,
    "brokenBacklinks" INTEGER NOT NULL DEFAULT 0,
    "brokenPages" INTEGER NOT NULL DEFAULT 0,
    "spamScore" DOUBLE PRECISION,
    "topAnchors" JSONB NOT NULL DEFAULT '[]',
    "topReferringDomains" JSONB NOT NULL DEFAULT '[]',
    "backlinksList" JSONB NOT NULL DEFAULT '[]',
    "rawSummary" JSONB NOT NULL DEFAULT '{}',
    "costUsd" DOUBLE PRECISION,
    "error" TEXT,
    CONSTRAINT "BacklinkDomainSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BacklinkDomainSnapshot_projectId_domain_checkedAt_idx"
    ON "BacklinkDomainSnapshot"("projectId", "domain", "checkedAt");
CREATE INDEX "BacklinkDomainSnapshot_domain_checkedAt_idx"
    ON "BacklinkDomainSnapshot"("domain", "checkedAt");
CREATE INDEX "BacklinkDomainSnapshot_projectId_checkedAt_idx"
    ON "BacklinkDomainSnapshot"("projectId", "checkedAt");

ALTER TABLE "BacklinkDomainSnapshot" ADD CONSTRAINT "BacklinkDomainSnapshot_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
