-- Detected business profile: what a client sells, read off their own website.
-- Lets Market Research open on the client's real market instead of asking the
-- operator to pick a niche from a list.
CREATE TABLE "ProjectBusinessProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "summary" TEXT,
    "offerings" TEXT[],
    "businessModel" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "suggestedRegion" TEXT NOT NULL DEFAULT 'worldwide',
    "seedKeywords" TEXT[],
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "signals" TEXT[],
    "source" TEXT NOT NULL DEFAULT 'heuristic',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBusinessProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectBusinessProfile_projectId_key" ON "ProjectBusinessProfile"("projectId");

CREATE INDEX "ProjectBusinessProfile_domain_idx" ON "ProjectBusinessProfile"("domain");

ALTER TABLE "ProjectBusinessProfile" ADD CONSTRAINT "ProjectBusinessProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
