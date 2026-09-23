-- Reverses 20260923014500_issue_group_key.
--
-- Additive-only forward, so this loses nothing that existed before it ran.
-- groupKey is derivable from projectId and issueType, so re-running the
-- backfill rebuilds it exactly.
DROP INDEX IF EXISTS "Issue_projectId_groupKey_status_idx";
ALTER TABLE "Issue" DROP COLUMN IF EXISTS "groupKey";
