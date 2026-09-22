# Follow-up: make `Issue.fingerprint` NOT NULL

Deliberately **not** shipped in the same pull request as the migration beside it.

`start:render` runs `prisma migrate deploy` on every boot. A `SET NOT NULL` in
the same deploy as the `ADD COLUMN` would run before a single row had been
backfilled and fail on the first one, taking the deploy with it. The constraint
can only land once the data satisfies it.

## Order of operations

1. Deploy `20260922093000_issue_project_and_fingerprint` (additive, nullable).
   Nothing breaks: the new write path fills the columns for every crawl from
   this point on, and old rows keep working with NULLs.
2. Run the backfill against production by setting `RUN_ISSUE_IDENTITY_BACKFILL=true`
   on `growthx-crawler-api` and restarting it. The entrypoint runs
   `node scripts/backfill-issue-identity.js` after migrations, in the
   background, so it does not hold up the port bind. Unset the variable once it
   has finished — it is idempotent, but there is no reason to walk the table on
   every boot.

   Locally, `npm run script:backfill-issue-identity` does the same thing
   (it builds first, because the runner reads the compiled output).

   It is batched, resumable and idempotent. Note the orphan count it prints.

   The runner is plain JS on purpose: `ts-node` is a devDependency and the
   production image is built with `npm ci --omit=dev`, so a TypeScript entry
   point cannot run there at all. The logic itself is required from `dist/`
   rather than duplicated, because a second copy of the URL normalisation
   drifting by one trailing slash would silently break the continuity this is
   for.
3. Confirm nothing is left:

   ```sql
   SELECT count(*) FROM "Issue" WHERE "fingerprint" IS NULL;
   ```

4. Only if that count is zero, ship the migration below as its own PR.

## The migration

```sql
-- Every finding now has a name that survives a re-crawl. Enforcing it stops a
-- write path added later from quietly skipping it, which would leave findings
-- that can never resolve and never regress.
ALTER TABLE "Issue" ALTER COLUMN "fingerprint" SET NOT NULL;
```

and in `schema.prisma`, `fingerprint String?` becomes `fingerprint String`.

## Verified

The forward migration, the `down.sql` beside it and the backfill were all run
against a local PostgreSQL 16 with the full migration history applied:

- `prisma migrate deploy` applies this migration last in the chain, clean.
- The backfill collapses `http://www.example.com/a/` and
  `https://example.com/a?utm_source=g` to one fingerprint, and sets
  `firstDetectedAt` to the earliest `createdAt` across both rather than each
  row's own.
- Re-running it writes identical data (idempotent).
- An unwritable `BACKFILL_PROGRESS_FILE` warns and continues rather than
  failing the run.
- `down.sql` drops every added column, index and constraint, preserves the
  pre-existing rows, and the forward migration re-applies cleanly afterwards.

## What about the orphans?

Rows whose `crawlJob` or `website` has been deleted cannot be given a project,
and the backfill leaves them alone rather than inventing one. They still get a
fingerprint — it is scoped to the website id, which survives on the crawl job —
so they do not block this constraint.

Rows with no crawl job at all are the exception. If step 3 returns a non-zero
count, inspect them before going further:

```sql
SELECT i.id, i."issueType", i."createdAt"
FROM "Issue" i LEFT JOIN "CrawlJob" c ON c.id = i."crawlJobId"
WHERE i."fingerprint" IS NULL AND c.id IS NULL;
```

These are rows referencing a crawl that no longer exists. Deleting them is
reasonable, but that is a data decision for a human, not something the backfill
should do on its own.

## `projectId` stays nullable

Permanently, and not for want of backfilling. `Website.projectId` is itself
nullable because a competitor's site is crawled with no project attached, and
that null is exactly what keeps a rival's pages out of the customer's analysis.
Findings from those crawls have no project to point at. Their fingerprints are
scoped to the website instead, so they still reconcile correctly.
