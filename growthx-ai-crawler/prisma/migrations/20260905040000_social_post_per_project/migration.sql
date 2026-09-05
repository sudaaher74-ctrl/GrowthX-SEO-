-- Scopes a collected social post to the project that collected it.
--
-- The old key was [platform, postId] alone, so one competitor's video could
-- exist in this table only once across the whole installation: the second
-- project to track the same channel overwrote the first project's row and took
-- the post out of that project's analysis with it. Competitor sites are shared
-- between projects by design, so two projects reading the same channel is the
-- normal case.
--
-- Duplicates cannot exist under the old key, so widening it needs no cleanup.
DROP INDEX "SocialPost_platform_postId_key";
CREATE UNIQUE INDEX "SocialPost_projectId_platform_postId_key" ON "SocialPost"("projectId", "platform", "postId");
