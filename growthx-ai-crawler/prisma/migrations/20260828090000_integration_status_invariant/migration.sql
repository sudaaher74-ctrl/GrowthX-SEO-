-- A connection cannot be CONNECTED without a property selected.
--
-- This state was reached in production and it was a dead end: the property
-- picker only renders for NEEDS_SELECTION, so once a connection was wrongly
-- promoted the screen that sets a property disappeared, and every sync failed
-- with "no property has been selected" and no route back. The cause was a
-- token refresh setting status unconditionally, which meant that merely
-- opening the picker destroyed the picker.
--
-- The code path is fixed and tested. This is the belt: the invariant is now
-- enforced by the database, so no future write — from any code path, any
-- migration, any hand-run UPDATE — can recreate it.

-- Repair anything already in the bad state before constraining it, so the
-- migration cannot fail on data that predates the rule.
UPDATE "Integration"
   SET status = 'NEEDS_SELECTION'
 WHERE status = 'CONNECTED' AND "selectedResourceId" IS NULL;

ALTER TABLE "Integration"
  ADD CONSTRAINT "Integration_connected_requires_resource"
  CHECK (status <> 'CONNECTED' OR "selectedResourceId" IS NOT NULL);
