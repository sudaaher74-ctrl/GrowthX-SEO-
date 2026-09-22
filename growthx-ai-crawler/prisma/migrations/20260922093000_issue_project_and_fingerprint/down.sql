-- Reverses 20260922093000_issue_project_and_fingerprint.
--
-- Additive-only forward, so the reverse drops what it added and loses nothing
-- that existed before it ran. Dropping `fingerprint` discards the continuity
-- history built since the deploy; re-running the backfill rebuilds it from
-- createdAt, which is why the backfill is written to be idempotent.
ALTER TABLE "Issue" DROP CONSTRAINT IF EXISTS "Issue_projectId_fkey";

DROP INDEX IF EXISTS "Issue_projectId_issueType_status_idx";
DROP INDEX IF EXISTS "Issue_projectId_fingerprint_idx";
DROP INDEX IF EXISTS "Issue_projectId_status_severity_idx";

ALTER TABLE "Issue" DROP COLUMN IF EXISTS "regressionCount";
ALTER TABLE "Issue" DROP COLUMN IF EXISTS "resolvedAt";
ALTER TABLE "Issue" DROP COLUMN IF EXISTS "lastSeenAt";
ALTER TABLE "Issue" DROP COLUMN IF EXISTS "firstDetectedAt";
ALTER TABLE "Issue" DROP COLUMN IF EXISTS "fingerprint";
ALTER TABLE "Issue" DROP COLUMN IF EXISTS "projectId";
