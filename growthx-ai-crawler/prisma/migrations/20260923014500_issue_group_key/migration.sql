-- The unit the queue is displayed in.
--
-- The live priority queue shows five rows, all of them the same schema defect
-- on five product URLs, while 150 findings of other kinds go unmentioned. One
-- fixable problem eats the whole list and the user never learns the rest
-- exist. Grouping by type within a site turns those five rows into
-- "Product schema missing offers — 29 pages" and leaves room for what else is
-- wrong.
--
-- Nullable on the same terms as fingerprint: the write path fills it from here
-- on, and the backfill fills existing rows. Nothing reads it before it is
-- populated, because a group query filters the nulls out.
ALTER TABLE "Issue" ADD COLUMN "groupKey" TEXT;

-- Serves the queue's own query: one project's open groups, ordered by whatever
-- the caller asks for.
CREATE INDEX "Issue_projectId_groupKey_status_idx" ON "Issue"("projectId", "groupKey", "status");
