-- One Website row per owner, not per domain.
--
-- A domain was one row for the whole platform. Two customers tracking the
-- same competitor shared its crawls, so a new customer was shown pages "read"
-- that they never crawled; and a competitor that was also somebody's own site
-- was linked straight to that customer's own audit. Every row now says whose
-- it is (see Website.scope), and each customer's existing links are separated:
-- the first project to track a competitor keeps its record, every other
-- project is unlinked and gets its own crawl, and what those projects had
-- derived from someone else's crawl is cleared.

ALTER TABLE "Website" ADD COLUMN IF NOT EXISTS "scope" TEXT;

-- Customers' own sites.
UPDATE "Website" SET "scope" = 'own' WHERE "projectId" IS NOT NULL AND "scope" IS NULL;

-- Competitor links that will not survive: any pointing at somebody's own site,
-- and any pointing at a shared competitor site from a project that was not the
-- first to track it.
CREATE TEMP TABLE "_unlinked_competitor" AS
  SELECT c."id", c."projectId"
    FROM "CompetitorDomain" c
    JOIN "Website" w ON w."id" = c."websiteId"
   WHERE w."projectId" IS NOT NULL
  UNION
  SELECT c."id", c."projectId"
    FROM "CompetitorDomain" c
    JOIN "Website" w ON w."id" = c."websiteId"
   WHERE w."projectId" IS NULL
     AND c."projectId" <> (
           SELECT first."projectId" FROM "CompetitorDomain" first
            WHERE first."websiteId" = w."id"
            ORDER BY first."createdAt" ASC, first."id" ASC
            LIMIT 1
         );

-- Shared competitor sites belong to the project that tracked them first.
UPDATE "Website" w
   SET "scope" = 'competitor:' || (
         SELECT first."projectId" FROM "CompetitorDomain" first
          WHERE first."websiteId" = w."id"
          ORDER BY first."createdAt" ASC, first."id" ASC
          LIMIT 1
       )
 WHERE w."projectId" IS NULL
   AND w."scope" IS NULL
   AND EXISTS (SELECT 1 FROM "CompetitorDomain" c WHERE c."websiteId" = w."id");

-- Everything else is a leftover nobody tracks: never claimable again.
UPDATE "Website" SET "scope" = 'legacy:' || "id" WHERE "scope" IS NULL;

-- What the unlinked competitors had derived from another customer's crawl.
DELETE FROM "CatalogProduct" WHERE "competitorId" IN (SELECT "id" FROM "_unlinked_competitor");
DELETE FROM "MarketingSignal" WHERE "competitorId" IN (SELECT "id" FROM "_unlinked_competitor");
DELETE FROM "CompetitorFinding"
 WHERE "competitorId" IN (SELECT "id" FROM "_unlinked_competitor") AND "sourcePlatform" = 'WEBSITE';
-- Reports written for those projects quoted the same crawls.
DELETE FROM "CompetitorReportSnapshot" WHERE "projectId" IN (SELECT "projectId" FROM "_unlinked_competitor");
DELETE FROM "BusinessStrategySnapshot" WHERE "projectId" IN (SELECT "projectId" FROM "_unlinked_competitor");

-- Unlink them. With no website, the competitor list starts a crawl of their
-- own the next time it is opened.
UPDATE "CompetitorDomain"
   SET "websiteId" = NULL, "status" = 'PENDING', "lastAnalyzedAt" = NULL
 WHERE "id" IN (SELECT "id" FROM "_unlinked_competitor");

DROP TABLE "_unlinked_competitor";

ALTER TABLE "Website" ALTER COLUMN "scope" SET NOT NULL;
DROP INDEX IF EXISTS "Website_domain_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Website_domain_scope_key" ON "Website"("domain", "scope");
