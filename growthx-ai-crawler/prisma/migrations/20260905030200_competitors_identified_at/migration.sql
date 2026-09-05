-- Records that automatic competitor identification has run for a project.
--
-- Identification runs once, off the project's first completed crawl. Without a
-- marker the only way to ask "has this run?" is to count the competitors, and
-- that cannot tell a project nobody has looked at yet from one whose owner
-- reviewed the suggestions and deleted them — so every recurring crawl would
-- put back competitors the customer had removed on purpose.
ALTER TABLE "Project" ADD COLUMN "competitorsIdentifiedAt" TIMESTAMP(3);
