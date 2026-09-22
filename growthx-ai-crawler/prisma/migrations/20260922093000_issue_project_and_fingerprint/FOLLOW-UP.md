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
2. Run the backfill against production:

   ```
   npm run script:backfill-issue-identity
   ```

   It is batched, resumable and idempotent. Note the orphan count it prints.
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
