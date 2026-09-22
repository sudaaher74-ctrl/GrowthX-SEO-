-- Give a finding an identity that outlives the crawl that found it.
--
-- `Issue` is scoped to `crawlJobId` and nothing else, so every re-crawl writes
-- a fresh set of rows with fresh ids and no link back to the ones before. The
-- product cannot answer how long something has been open, whether a fix held,
-- or whether a problem came back, because each crawl starts the history over.
-- What it produces is a report that regenerates, not a workflow.
--
-- This migration is additive and nullable on purpose. It is Part A of two:
-- existing rows get NULLs, the backfill script fills them
-- (src/modules/issues/scripts/backfill-issue-identity.ts), and only then does a
-- follow-up migration make `fingerprint` NOT NULL. Shipping the constraint in
-- the same deploy would fail on the first existing row, because
-- `start:render` runs `prisma migrate deploy` before anything has been
-- backfilled.

-- The client this finding belongs to, denormalised from
-- crawlJob -> website -> project so a finding can be queried without joining
-- through the crawl that happened to discover it.
--
-- Nullable permanently, not just until the backfill: `Website.projectId` is
-- itself nullable, because a competitor's site is crawled with no project on
-- purpose. That null is what keeps a rival's pages out of the customer's
-- analysis, so findings from those crawls have no project to point at.
ALTER TABLE "Issue" ADD COLUMN "projectId" TEXT;

-- Stable identity across crawls: scope::issueType::normalisedUrl.
--
-- Computed in TypeScript rather than here. URL normalisation decides whether
-- two crawls agree, and a SQL implementation that drifted from the TypeScript
-- one by a single trailing slash would silently break the continuity this
-- column exists to create.
ALTER TABLE "Issue" ADD COLUMN "fingerprint" TEXT;

-- When this finding was first seen, ever — not when this row was written.
-- Existing rows default to now() and are corrected by the backfill to the
-- earliest createdAt across every row sharing their fingerprint.
ALTER TABLE "Issue" ADD COLUMN "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Refreshed by every crawl that still finds it. A fingerprint present in crawl
-- N and absent in crawl N+1 has resolved itself.
ALTER TABLE "Issue" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Set when a crawl stops finding a fingerprint that was previously open.
ALTER TABLE "Issue" ADD COLUMN "resolvedAt" TIMESTAMP(3);

-- Bumped when a fingerprint is re-detected after having been resolved. A
-- regression is a different conversation with the client than a new finding.
ALTER TABLE "Issue" ADD COLUMN "regressionCount" INTEGER NOT NULL DEFAULT 0;

-- Deliberately NOT unique on (projectId, fingerprint): the same fingerprint
-- legitimately appears once per crawl job while history is retained. That is
-- the point — the rows are the history. Uniqueness belongs at the
-- GrowthOpportunity level, where one row means one finding.
CREATE INDEX "Issue_projectId_status_severity_idx" ON "Issue"("projectId", "status", "severity");
CREATE INDEX "Issue_projectId_fingerprint_idx" ON "Issue"("projectId", "fingerprint");
CREATE INDEX "Issue_projectId_issueType_status_idx" ON "Issue"("projectId", "issueType", "status");

-- ON DELETE CASCADE matches Website -> Project: deleting a client takes its
-- findings with it rather than leaving rows pointing at nothing.
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
