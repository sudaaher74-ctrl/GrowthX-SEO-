# Task 1 — Give `Issue` a project and a stable identity

> Paste this whole file into Claude Code as your prompt, from the repo root.
> Read `docs/workflow/00-ARCHITECTURE.md` first.
> Backend paths below are relative to `growthx-ai-crawler/`.

## Goal

`Issue` is currently scoped to `crawlJobId` only. Every re-crawl creates a new
set of rows with new ids, so the product cannot answer "how long has this been
open", "did we fix it", or "did it come back". Add `projectId` and `fingerprint`
so a finding survives across crawls.

**This is the blocker for tasks 2, 3 and 4. Nothing else works until it lands.**

## Current state

`prisma/schema.prisma`:

```prisma
model Issue {
  id               String            @id @default(uuid())
  crawlJobId       String
  pageId           String?
  issueType        String
  severity         IssueSeverity
  affectedUrl      String
  description      String
  recommendation   String
  status           IssueStatus       @default(OPEN)
  aiFixAvailable   Boolean           @default(false)
  confidence       String            @default("LIKELY")
  impact           String?
  explanation      String?
  evidence         String?
  dedupKey         String?
  category         String?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  aiRecommendation AIRecommendation?
  crawlJob         CrawlJob          @relation(fields: [crawlJobId], references: [id], onDelete: Cascade)
  page             Page?             @relation(fields: [pageId], references: [id])

  @@index([crawlJobId, severity])
  @@index([affectedUrl, status])
  @@index([issueType])
  @@index([crawlJobId, dedupKey])
  @@index([crawlJobId, category])
}
```

Relationship path to a project: `Issue.crawlJobId → CrawlJob.websiteId → Website.projectId`.

## Changes

### 1. Schema

Add to `model Issue`:

```prisma
  /// The client this finding belongs to. Denormalised from
  /// crawlJob -> website -> project so a finding can be queried and tracked
  /// without joining through the crawl that happened to discover it.
  projectId        String

  /// Stable identity across crawls: projectId::issueType::normalisedUrl.
  /// dedupKey deduplicates within one crawl; fingerprint is what lets the
  /// same finding be recognised in the NEXT crawl, which is what makes
  /// firstDetectedAt, resolvedAt and regression detection possible.
  fingerprint      String

  /// When this finding was first seen, ever — not when this row was written.
  /// Carried forward when a later crawl re-detects the same fingerprint.
  firstDetectedAt  DateTime @default(now())

  /// Refreshed every crawl that still finds it. A fingerprint present in
  /// crawl N and absent in crawl N+1 has resolved itself.
  lastSeenAt       DateTime @default(now())

  /// Set when a crawl no longer finds a fingerprint that was previously open.
  resolvedAt       DateTime?

  /// Incremented when a fingerprint is re-detected after having been
  /// resolved. A regression is a different conversation with the client than
  /// a new finding, and the report must be able to tell them apart.
  regressionCount  Int @default(0)

  project          Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
```

Add indexes:

```prisma
  @@index([projectId, status, severity])
  @@index([projectId, fingerprint])
  @@index([projectId, issueType, status])
```

Add to `model Project`:

```prisma
  issues Issue[]
```

Do **not** make `[projectId, fingerprint]` unique. The same fingerprint
legitimately appears once per crawl job while history is retained. Uniqueness is
enforced at the `GrowthOpportunity` level in task 3.

### 2. Fingerprint helper

New file `src/modules/issues/fingerprint.util.ts`:

```ts
/**
 * Stable identity for a finding across crawls.
 *
 * URL normalisation matters more than it looks: the same page reached as
 * http/https, with or without www, with a trailing slash, or carrying a
 * utm_* query string must produce ONE fingerprint, or every crawl reports
 * the same problem as new.
 */
export function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
    u.hash = '';
    // Drop tracking params; keep everything else, because ?page=2 is a
    // different page and ?utm_source=x is not.
    const drop = [/^utm_/i, /^fbclid$/i, /^gclid$/i, /^msclkid$/i, /^ref$/i];
    [...u.searchParams.keys()].forEach((k) => {
      if (drop.some((re) => re.test(k))) u.searchParams.delete(k);
    });
    u.searchParams.sort();
    let path = u.pathname.replace(/\/+$/, '');
    if (path === '') path = '/';
    u.pathname = path;
    return u.toString();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function issueFingerprint(
  projectId: string,
  issueType: string,
  affectedUrl: string,
): string {
  return `${projectId}::${issueType}::${normaliseUrl(affectedUrl)}`;
}

/** Site-wide findings (robots.txt, sitemap) are not per-URL. */
export function siteFingerprint(projectId: string, issueType: string): string {
  return `${projectId}::${issueType}::__site__`;
}
```

Site-wide issue types that must use `siteFingerprint`: `INCORRECT_ROBOTS`,
`HTTPS_ISSUE`. Everything else is per-URL.

### 3. Migration + backfill

Write the migration in two parts so it can ship safely on a live database.

**Part A — additive, nullable.** Add all new columns as nullable, no constraints.
Deploy. Nothing breaks.

**Part B — backfill, then tighten.** A standalone script at
`src/modules/issues/scripts/backfill-issue-identity.ts`, runnable with
`npm run script:backfill-issue-identity`:

- Page through `Issue` in batches of 1,000 ordered by `id`, with a resumable
  cursor written to a `_backfill_progress` row or a local file. Do **not**
  `updateMany` the whole table.
- For each batch, resolve `projectId` via
  `crawlJob.website.projectId` (one join, batched).
- Compute `fingerprint` with the helper above.
- Set `firstDetectedAt` to the **earliest** `createdAt` across all rows sharing
  that fingerprint, not the row's own `createdAt`.
- Set `lastSeenAt` to the latest `createdAt` for that fingerprint.
- Log progress every batch. Make it idempotent — safe to re-run from the start.

Then a second migration makes `projectId` and `fingerprint` `NOT NULL` and adds
the indexes.

Rows whose `crawlJob.website.projectId` cannot be resolved (orphaned crawls):
log them, leave them nullable, and report the count. Do not delete them and do
not invent a project.

### 4. Write path

In `src/modules/issues/issue-engine.service.ts`:

- `DetectedIssueInput` gains `fingerprint: string`.
- `evaluateAndPersistIssues(...)` gains a `projectId: string` parameter and sets
  `projectId` and `fingerprint` on every issue it pushes. Update all callers.

New method on `IssueEngineService`:

```ts
/**
 * Called once per crawl, after all pages are evaluated. Compares this crawl's
 * fingerprints against the last crawl's and closes what is gone.
 */
async reconcileAgainstPreviousCrawl(
  projectId: string,
  currentCrawlJobId: string,
): Promise<{ resolved: number; regressed: number; carried: number }>
```

Behaviour:
- Fingerprints in the previous crawl but **not** this one → `status = RESOLVED`,
  `resolvedAt = now()`.
- Fingerprints in this crawl that were `RESOLVED` in a previous crawl →
  `regressionCount + 1`, `status = OPEN`, `resolvedAt = null`.
- Fingerprints in both → carry `firstDetectedAt` forward, bump `lastSeenAt`.

Call it at the end of the crawl pipeline, in the same place `healthScore` and
`uniqueIssuesCount` are written to `CrawlJob`.

## Acceptance criteria

- [ ] `npx prisma migrate dev` runs clean; `down` migration tested against a
      production-shaped dump.
- [ ] Backfill script completes on a table with ≥100k rows without timing out,
      and is safe to re-run.
- [ ] Every non-orphaned `Issue` row has a non-null `projectId` and `fingerprint`.
- [ ] Crawling the same site twice with no changes produces **zero** new
      fingerprints and zero regressions.
- [ ] Fixing one issue and re-crawling marks exactly that fingerprint
      `RESOLVED` with a `resolvedAt`, and leaves the others untouched.
- [ ] Breaking it again bumps `regressionCount` to 1 and reopens it, preserving
      the original `firstDetectedAt`.

## Tests to add

`src/modules/issues/fingerprint.util.spec.ts`
- `http://www.x.com/a/`, `https://x.com/a`, `https://x.com/a?utm_source=g` all
  normalise to one string.
- `https://x.com/a?page=2` does **not** collapse into `https://x.com/a`.
- Malformed input returns something stable rather than throwing.

`src/modules/issues/issue-engine.reconcile.spec.ts`
- Crawl twice unchanged → `{ resolved: 0, regressed: 0, carried: n }`.
- Issue disappears → resolved.
- Issue reappears after resolution → regressed, `firstDetectedAt` preserved.

## Do not

- Do not drop, rename or repurpose `dedupKey`. It still does within-crawl
  deduplication and `health-score.util.ts` depends on it.
- Do not change `IssueStatus` values in this task. Task 4 handles lifecycle.
- Do not touch the frontend in this task.
