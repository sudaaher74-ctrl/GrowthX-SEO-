# GrowthX Workflow Spec — complete hand-off pack

Single-file version. Everything needed to take GrowthX from eleven parallel
finding tables to one ranked queue with a proof ledger.

Derived from `sudaaher74-ctrl/GrowthX-SEO-` at HEAD (22 Sep 2026), read from
`prisma/schema.prisma`, `src/modules/issues/issue-engine.service.ts`,
`src/modules/opportunities/`, and the Next.js app under
`growthx-ai-seo/src/app/(dashboard)/`, plus a live walkthrough of
`growth-x-seo.vercel.app` on the Aiva project.

**How to use this file with Claude Code.** The sections below are also split
into one file per task in this same directory, so a task can be pasted whole as
a prompt. For each task, tell Claude Code:

> Read `docs/workflow/SPEC.md`. Implement **Task 1 — Give `Issue` a project and
> a stable identity**, following its acceptance criteria and its Do-not list.
> Do not start any other task.

Work one task per branch, one task per PR. Tasks 1 and 2 are blockers; 3 needs
1; 4 needs 3; 5 and 6 are independent of each other.

**Paths.** Backend paths are written as `prisma/schema.prisma` and
`src/modules/...`; in this repository they live under `growthx-ai-crawler/`.
Frontend paths (`growthx-ai-seo/src/...`) are correct as written. See
`docs/workflow/README.md`.

---

## Contents

0. [GrowthX Workflow Spec — Claude Code hand-off pack](#growthx-workflow-spec--claude-code-hand-off-pack)  
   `README.md`
1. [GrowthX workflow architecture](#growthx-workflow-architecture)  
   `00-ARCHITECTURE.md`
2. [Task 1 — Give `Issue` a project and a stable identity](#task-1--give-issue-a-project-and-a-stable-identity)  
   `01-issue-identity.md`
3. [Task 2 — Group the queue by issue type, and make one count true everywhere](#task-2--group-the-queue-by-issue-type-and-make-one-count-true-everywhere)  
   `02-issue-grouping.md`
4. [Task 3 — Every detector dual-writes into `GrowthOpportunity`](#task-3--every-detector-dual-writes-into-growthopportunity)  
   `03-unified-findings.md`
5. [Task 4 — One lifecycle, three buckets, and the queue becomes the home screen](#task-4--one-lifecycle-three-buckets-and-the-queue-becomes-the-home-screen)  
   `04-lifecycle.md`
6. [Task 5 — Rewrite all 25 issue types for someone who doesn't know what a meta tag is](#task-5--rewrite-all-25-issue-types-for-someone-who-doesnt-know-what-a-meta-tag-is)  
   `05-copy-layer.md`
7. [Task 6 — Turn on the hold arm](#task-6--turn-on-the-hold-arm)  
   `06-hold-arm.md`

---

# GrowthX Workflow Spec — Claude Code hand-off pack

Six implementation tasks that turn GrowthX from eleven parallel finding tables
into one ranked queue with a proof ledger.

Derived from `sudaaher74-ctrl/GrowthX-SEO-` at HEAD (22 Sep 2026), read from
`prisma/schema.prisma`, `src/modules/issues/issue-engine.service.ts`,
`src/modules/opportunities/`, and the Next.js app under `growthx-ai-seo/src/app/(dashboard)/`.

---

## Repository paths

The task files name backend paths as `prisma/schema.prisma` and
`src/modules/...`. In this repository the NestJS backend lives in a
subdirectory, so prefix every backend path with `growthx-ai-crawler/`:

| As written in the task files | Actual path |
|---|---|
| `prisma/schema.prisma` | `growthx-ai-crawler/prisma/schema.prisma` |
| `src/modules/issues/issue-engine.service.ts` | `growthx-ai-crawler/src/modules/issues/issue-engine.service.ts` |
| `src/modules/opportunities/` | `growthx-ai-crawler/src/modules/opportunities/` |
| `src/modules/impact/` | `growthx-ai-crawler/src/modules/impact/` |

Frontend paths (`growthx-ai-seo/src/...`) are already correct as written.

---

## How to use this with Claude Code

**Step 1 — the architecture doc is already in the repo** at
`docs/workflow/00-ARCHITECTURE.md`. Every task refers back to it by section.

**Step 2 — run one task at a time.** Open Claude Code in the repo root and paste
the contents of a task file as your prompt. Each task file is self-contained:
it names the files to touch, the exact schema changes, and the acceptance
criteria. Start every task with a clean working tree.

**Step 3 — do not skip the order.** Tasks 1 and 2 are blockers. Task 3 depends
on 1. Task 4 depends on 3. Tasks 5 and 6 are independent of each other but both
assume 1–4 are done.

**Step 4 — one task, one branch, one PR.** These are database migrations on a
live product. Do not batch them.

---

## The tasks

| # | File | What it does | Est. | Risk |
|---|------|--------------|------|------|
| 1 | `01-issue-identity.md` | Give `Issue` a `projectId` and a `fingerprint` so findings survive a re-crawl | ~2 days | Medium — migration + backfill |
| 2 | `02-issue-grouping.md` | Group the queue by issue type × site instead of one row per URL | ~3 days | Low |
| 3 | `03-unified-findings.md` | Every detector dual-writes into `GrowthOpportunity` | ~1 week | Low — additive only |
| 4 | `04-lifecycle.md` | One lifecycle enum replacing eight; three-bucket UI | ~4 days | Medium |
| 5 | `05-copy-layer.md` | Rewrite all 25 issue types in plain language | ~2 days | None |
| 6 | `06-hold-arm.md` | Turn on the TREAT/HOLD measurement that is the moat | ~1 week | Low |

---

## Non-negotiables for every task

Give these to Claude Code with each prompt, or put them in `CLAUDE.md`:

1. **Nothing is deleted.** Every existing table, endpoint and page keeps working
   through all six tasks. This is dual-write and promote, never rip-and-replace.
2. **Every migration is reversible** and ships with a `down` path that has been
   tested against a copy of production data.
3. **Backfills run in batches** with a resumable cursor. `aivaenterprises.com`
   alone has 156 issues across 35 pages; a client with 10,000 pages will time out
   a naive `updateMany`.
4. **No new mock data.** If a value cannot be computed, the API returns `null`
   and the UI renders an honest empty state. `/monitoring` is currently 694 lines
   of fabricated uptime data — do not add a second one. There is a
   `no-fabricated-data.spec.ts` in the repo; keep it passing.
5. **Tests before merge.** Each task names the specs it must add. The repo uses
   Jest with `*.spec.ts` next to the source file.

---

## Known bugs to fix along the way

These were found on the live app at `growth-x-seo.vercel.app` (client: Aiva) and
are called out inside the relevant task files. Listed here so none get lost.

| Bug | Where | Task |
|-----|-------|------|
| Dashboard shows `CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0` directly above a list of issues labelled HIGH | `/dashboard` — Technical SEO Health card | 2 |
| Same crawl reports 100 issues (Audit), 156 (Dashboard), 100 fixes (Fix Engine) | three screens | 2 |
| Fix Engine says "Plan Approved & Active / Executing" and "Needs Generation" simultaneously | `/fix-engine` | 4 |
| Fix Engine promises "Technical Issues 100 → 0" and "SEO Health 89 → 100" as an estimate | `/fix-engine` Impact Forecast | 4 |
| Priority queue shows 5 rows, all the same issue type on 5 URLs | `/dashboard` Priority Action Queue | 2 |
| `/action-queue` is fully built and wired but has zero inbound links | `growthx-ai-seo/src` | 4 |
| `/monitoring` has 694 lines and zero data fetches; `useMonitoring` hook exists unused | `/monitoring` | — |

---

## What this pack does not cover

- Navigation restructure (45 routes → ~24, GBP 11 tabs → 4). That is a separate
  front-end task and is described in the teardown document, not here.
- Onboarding wizard. The `4/6` setup checklist on the dashboard already works;
  gating the dashboard behind a first scan is a follow-up.
- Billing, admin, and the free SEO tools.

---

# GrowthX workflow architecture

Reference document. Every Claude Code session working on this pack should read
it first. Task files refer back to it by section.

> **Paths.** Backend paths below are written as `src/modules/...`; in this
> repository they live under `growthx-ai-crawler/`. See
> `docs/workflow/README.md`.

---

## 1. The problem

Four detectors write findings into **eleven different tables** with **eight
different status enums**:

| Table | Scoped to | Status type |
|-------|-----------|-------------|
| `Issue` | `crawlJobId` **only** | `IssueStatus` |
| `GrowthOpportunity` | `projectId` | `String` |
| `GbpFixProposal` | `projectId` | `String` |
| `CompetitorFinding` | `projectId` | none |
| `ContentGap` | `projectId` | `String` |
| `MarketAction` | `projectId` | `MarketActionStatus` |
| `MarketOpportunity` | `projectId` | none |
| `Recommendation` | `projectId` | `RecommendationStatus` |
| `AIRecommendation` | none | `FixStatus` |
| `StrategyAction` | `projectId` | `ActionStatus` |
| `ContentSuggestion` | `projectId` | `DesignStudioStatus` |

Two consequences:

**A finding cannot be ranked against a finding from another detector.** There is
no shared shape and no shared score, so no single queue can exist.

**`Issue` is scoped to a crawl job, not a client.** Every re-crawl produces a new
set of rows with new ids. The product cannot answer: how long has this been open,
did we fix it, did it come back, is it getting worse. Without continuity across
crawls there is no workflow — only a report that regenerates.

---

## 2. The spine

`GrowthOpportunity` is already the right shape and is already multi-source. It is
promoted to the single finding table. Everything else keeps existing as
**evidence detail** and stops being a queue.

```prisma
model GrowthOpportunity {
  id             String @id @default(uuid())
  organizationId String
  projectId      String
  fingerprint    String   // stable identity across detection runs
  source         String   // SEARCH_CONSOLE | COMPETITOR | WEBSITE | ANALYTICS | LOCAL | MARKET
  category       String   // SEO | CONTENT | LOCAL | TECHNICAL | MARKETING | BUSINESS | COMPETITOR
  title             String
  summary           String
  evidence          Json     // [{ label, value, source }]
  recommendedAction String
  potential  String @default("MEDIUM")  // HIGH | MEDIUM | LOW
  effort     String @default("MEDIUM")
  confidence Int    @default(50)        // 0-100
  priority   Float  @default(0)
  affectedPages String[] @default([])
  status      String    @default("OPEN")
  dismissedAt DateTime?
  detectedAt DateTime @default(now())
  lastSeenAt DateTime @default(now())

  @@unique([projectId, fingerprint])
  @@index([projectId, status, priority])
}
```

Tasks 3 and 4 extend it with `fixClass`, `impact`, and a real lifecycle enum.

---

## 3. The pipeline

Six stages. Every feature belongs to exactly one. If it fits none, it is not in
the main flow.

```
1 CONNECT    site URL, GSC, GA4, GBP, code host, competitor domains
                 └─> project with connected sources

2 DETECT     four detectors, one schedule, four workers
                 └─> raw rows in detail tables (Issue, GbpFixProposal, ...)

3 NORMALISE  one GrowthOpportunity row per finding, grouped by type × site,
             fingerprinted so re-scans update rather than duplicate, scored once
                 └─> ranked list

4 DECIDE     the only stage a human touches
             three buttons per row: Fix it / Not now / Why?
             one bulk action: "Fix all safe (n)"
                 └─> APPROVED | SNOOZED | DISMISSED(reason)

5 EXECUTE    Fix Engine routes by effort class, never by source module
                 └─> FixIntervention + PublishedChange, snapshot first

6 PROVE      re-crawl, verify, certify, then measure at +7/+30 days
                 └─> VerificationResult -> InterventionOutcome.lift
```

---

## 4. Lifecycle

One state machine for every finding, whatever detector produced it.

```
DETECTED → QUEUED → APPROVED → APPLYING → VERIFYING → VERIFIED → MEASURED
             │                                │
             ├→ SNOOZED (returns on a date)   └→ FAILED → back to QUEUED
             └→ DISMISSED (reason required)
```

The user never sees ten states. They see three buckets:

| Bucket | States | Rule |
|--------|--------|------|
| **Needs you** | `QUEUED`, `FAILED` | The only bucket with a number on it |
| **We're on it** | `APPROVED`, `APPLYING`, `VERIFYING` | Visible, never demanding. No badges, no red |
| **Done** | `VERIFIED`, `MEASURED`, `DISMISSED` | What goes in the client report |

---

## 5. Fix routing

Route by **effort class**, never by which module found it.

| Class | When | Behaviour | Button |
|-------|------|-----------|--------|
| `AUTO` | Invisible to visitors, reversible, low blast radius: meta descriptions, alt text, schema, canonicals, robots, sitemap | Applies directly. Snapshot first. One-click undo that never expires | **Fix it** |
| `APPROVAL` | Touches code or anything a visitor sees: headings, internal links, templates, redirects | Opens a PR or staged change with a before/after diff. Never auto-merges | **Review change** |
| `MANUAL` | Needs judgement or an account we don't hold: new pages, GBP posts, review replies | Drafts the content in full, hands it over | **Open draft** |

`Issue.aiFixAvailable` already gets most of the AUTO / not-AUTO split. Task 5
adds the full static map.

### Safety rails (required before AUTO ships to any client)

- Snapshot before every change; undo works a year later. `PageSnapshot` and
  `RollbackRecord` already exist.
- **Blast radius cap**: never change more than `N` pages in one run without a
  human confirming. Default `N = 25`.
- **Never-touch list**, on by default: pricing, contact details, legal pages,
  checkout paths.
- **Per-client autonomy setting**: `AUTOMATIC` | `ASK_FIRST` | `DRAFTS_ONLY`.
  Default new clients to `ASK_FIRST`.
- **Pause everything**: one switch on the client screen that halts all
  automation instantly.

---

## 6. Scoring

One number orders the queue. Severity and confidence already exist; reach comes
from Search Console.

```
impact = ((0.45 × reach) + (0.35 × severity) + (0.20 × confidence))
         × { AUTO: 1.00, APPROVAL: 0.92, MANUAL: 0.78 }[fixClass]

reach      0-100  share of impressions/sessions on affectedPages (GscDailyMetric)
                  null GSC connection => reach = 50 (neutral), and the UI says
                  "connect Search Console for traffic-weighted priority"
severity   0-100  SEVERITY_WEIGHTS normalised: CRITICAL 100, HIGH 40, MEDIUM 15, LOW 5
confidence 0-100  CONFIDENCE_MULTIPLIERS × 100: CONFIRMED 100, LIKELY 80, ADVISORY 50
```

The effort multiplier is deliberate: when two findings score close, push the
user toward the one we can fix for them. That is what makes
**"Fix all safe (12)"** the primary button.

Existing weights live in `src/modules/issues/health-score.util.ts` — reuse them,
do not redefine.

---

## 7. How the detectors feed each other

Not four parallel products. Each sharpens the others through the shared project
graph (`src/modules/graph/`).

| Detector | Gives the others |
|----------|------------------|
| **Search Console** (the weight, not a detector) | Impressions and clicks per URL. Turns "34 issues" into "these 3 sit on 31% of your traffic". Without it every finding is equally important, which means none are |
| **Website Audit** | Page inventory and entity map. AI Visibility uses it to pick prompts; Competitor Intel uses it to compute gaps |
| **Competitor Intel** | Rival list and the keywords they own. Those keywords become prompts to sweep and briefs to write |
| **AI Visibility** | Which brands LLMs actually name for this category — often a different competitor set than the client named. Should write back into Competitor Intel automatically |
| **GBP** | Locations, categories, review themes. Review complaints are content topics; service gaps are page gaps |

Build these as writes into one shared graph, not point-to-point integrations.
Five modules with ten connections is unmaintainable; five modules reading one
graph is not.

---

## 8. The moat

Not the crawler — that is a commodity. Not AI visibility tracking — that will be
a checkbox feature within a year.

`FixIntervention` has `arm: TREAT | HOLD`. `InterventionOutcome` stores
`preCitationRate`, `postCitationRate`, `controlPreRate`, `controlPostRate` and
`lift`, described in the schema as *"difference-in-differences against the hold
arm"*.

That is a randomised controlled experiment framework inside an SEO product. It
allows deliberately **not** fixing a random subset, then measuring what the fixed
ones gained against them.

Every other SEO tool reports correlation. GrowthX can report causation on its own
customers' sites, because it is the one making the change and the one measuring
after. A competitor who only diagnoses can never build this dataset — they never
touch the site, so they have no intervention to measure.

What it compounds into:

- A priority model trained on measured outcomes rather than a guessed formula.
- Marketing claims a competitor can copy the wording of but not the number.
- A fix library curated by evidence — interventions that never move anything get
  demoted automatically.
- Switching cost that is not lock-in: leaving means losing the record.

**Product promise:** *Everyone else tells you what's wrong. We fix it, and we
prove it worked.*

This makes the verification certificate the product, not a tab inside Fix Engine.

---

## 9. Weekly cadence

Design the rhythm, not just the screens. Target: an agency with ten clients
spends under three hours a week and every client gets a report.

| When | What |
|------|------|
| Mon 06:00 | All four detectors, every client, one schedule. Nobody clicks anything (`src/modules/scheduler/`) |
| Mon 09:00 | **One** digest email per agency, not per client. "10 clients · 14 new · 9 we can fix · 3 need your call". Every line deep-links to a filtered queue |
| Tue, ~10 min | "Fix all safe (9)" clears most of it. What remains genuinely needs a human |
| Wed–Thu | Fixes apply, re-crawls confirm, certificates get written. Agency does nothing |
| Fri 16:00 | White-label report drafts per client, built from cleared findings, waiting on one Send (`WeeklyDelta`, `ClientPortalConfig`) |
| Always | A read-only client URL showing score, movement and fixes |

---

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

---

# Task 2 — Group the queue by issue type, and make one count true everywhere

> Paste this whole file into Claude Code as your prompt, from the repo root.
> **Requires task 1.** Backend paths are relative to `growthx-ai-crawler/`.

## Goal

Two things, because they are the same bug seen from two sides.

**A. The queue is unreadable.** On the live dashboard the Priority Action Queue
shows five rows — all `SCHEMA PRODUCT OFFERS`, on `/products/tomato`,
`/onion`, `/mint`, `/coriander-green-chilli`, `/9mm-french-fries`. One fixable
problem eats the whole list and the user never learns there are 150 other
findings of other kinds. Group by issue type × project so one row reads
"Product schema missing offers — 29 pages".

**B. No two screens agree on the count.** Same crawl of aivaenterprises.com:

| Screen | Says |
|--------|------|
| Website Audit Overview | 100 open issues, "0 critical" |
| Dashboard | 156 unique issues, 156 total findings, `CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0` |
| Fix Engine | 100 fixes in the plan |

And the dashboard renders `HIGH 0` directly above five rows each tagged `HIGH`.
That is a credibility bug on the landing page. One endpoint, one definition.

## Changes

### 1. Grouping key

Add to `model Issue` in `prisma/schema.prisma`:

```prisma
  /// projectId::issueType — the unit the queue is displayed in. One row per
  /// problem, not per affected page.
  groupKey String

  @@index([projectId, groupKey, status])
```

Populate in `issue-engine.service.ts` at write time, and backfill existing rows
in the same batched, resumable style as task 1.

### 2. One counting service

New file `src/modules/issues/issue-count.service.ts`. **Every screen reads from
this. No screen counts issues itself.**

```ts
export interface IssueCounts {
  /** Distinct fingerprints with status OPEN. THE headline number. */
  openFindings: number;
  /** Distinct groupKeys with at least one open fingerprint. Queue length. */
  openGroups: number;
  /** By severity, distinct fingerprints, open only. Must sum to openFindings. */
  bySeverity: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
  /** Open findings whose issueType maps to fixClass AUTO. Drives "Fix all safe (n)". */
  autoFixable: number;
  resolvedThisPeriod: number;
  regressedThisPeriod: number;
  pagesCrawled: number;
  healthScore: number;
}

@Injectable()
export class IssueCountService {
  async countsForProject(projectId: string, periodDays = 28): Promise<IssueCounts>
}
```

Rules, applied identically everywhere:

- The unit is a **distinct fingerprint**, never a raw row. History rows from old
  crawls must not inflate the number.
- Only the **latest completed** `CrawlJob` per website contributes open findings.
- A project with several websites sums across them.
- `bySeverity` **must** sum exactly to `openFindings`. Add a runtime assertion in
  development that throws if it does not — this is the bug that produced
  `0/0/0/0` next to 156.

### 3. Expose it

In the issues controller (create one if the module has none — mirror the style
of `src/modules/opportunities/opportunities.controller.ts`):

```
GET /projects/:projectId/issues/counts
    -> IssueCounts

GET /projects/:projectId/issues/groups?status=OPEN&source=&severity=&limit=50
    -> IssueGroup[]

GET /projects/:projectId/issues/groups/:groupKey/pages?limit=100&cursor=
    -> paginated affected pages for one group
```

```ts
export interface IssueGroup {
  groupKey: string;
  issueType: string;
  category: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; // highest in the group
  confidence: 'CONFIRMED' | 'LIKELY' | 'ADVISORY';  // lowest in the group
  affectedCount: number;
  sampleUrls: string[];      // first 5, for the collapsed row
  aiFixAvailable: boolean;   // true only if EVERY member can be auto-fixed
  fixClass: 'AUTO' | 'APPROVAL' | 'MANUAL';
  impact: number;            // 0-100, see §6 of 00-ARCHITECTURE.md
  firstDetectedAt: string;
  regressionCount: number;   // max across the group
  title: string;             // plain language — task 5 fills this in
  summary: string;
  action: string;
}
```

`severity` is the **highest** in the group and `confidence` the **lowest** — a
group is as urgent as its worst member and as trustworthy as its weakest
evidence.

### 4. Impact score

New file `src/modules/issues/impact-score.util.ts`, implementing §6 of
`00-ARCHITECTURE.md`. Reuse `SEVERITY_WEIGHTS` and `CONFIDENCE_MULTIPLIERS` from
`health-score.util.ts` — import them, do not redefine.

`reach` comes from `GscDailyMetric`: the share of the project's total
impressions over `periodDays` that lands on the group's affected URLs, scaled
0–100. **When Search Console is not connected, `reach = 50`** and the response
sets `reachAvailable: false` so the UI can say "connect Search Console for
traffic-weighted priority" instead of showing a confidently wrong ordering.

### 5. Fix the three screens

- `growthx-ai-seo/src/app/(dashboard)/dashboard/page.tsx` — Technical SEO Health
  card reads `IssueCounts`. The severity tiles now populate. Priority Action
  Queue renders `IssueGroup[]`, max 5 groups.
- `growthx-ai-seo/src/app/(dashboard)/website/page.tsx` — Overview and Issues tab
  read the same endpoint. The "Technical SEO **100**" tab badge currently reads
  as a score; make it `openGroups` and label it.
- `growthx-ai-seo/src/app/(dashboard)/fix-engine/page.tsx` — plan size reads
  `openGroups` / `autoFixable`, not its own count.

Add hooks to `growthx-ai-seo/src/hooks/use-growthx.ts` following the existing
pattern: `useIssueCounts(projectId)`, `useIssueGroups(projectId, filters)`,
`useIssueGroupPages(projectId, groupKey)`.

### 6. Explain the health score

The audit screen shows `89/100` labelled **Good** next to **100 open issues**.
The maths is right — `health-score.util.ts` caps penalty per URL at 20 and
multiplies by confidence, so many low-confidence findings barely move it — but
nothing on screen says so, and the user stops trusting both numbers.

Add a one-line explanation under the score, from the existing
`HealthScoreBreakdown.summary`: *"89/100 — 156 findings, mostly low severity.
Capped at 20 penalty points per page so one broken page can't sink the score."*

## Acceptance criteria

- [ ] `bySeverity` sums to `openFindings` for every project in the database.
      A test asserts this across seeded fixtures.
- [ ] Dashboard, Website Audit and Fix Engine display the **same** number for
      the same project, read from one endpoint.
- [ ] The Aiva priority queue shows distinct problems, not five rows of the same
      issue type.
- [ ] A group row expands to its affected URL list, paginated past 100.
- [ ] With GSC disconnected, ordering still works and the UI says why it is not
      traffic-weighted.
- [ ] No screen calls `prisma.issue.count()` directly any more. Grep to confirm.

## Tests to add

`src/modules/issues/issue-count.service.spec.ts`
- Severity buckets sum to the total — the regression test for this bug.
- History rows from superseded crawls do not inflate counts.
- Multi-website project sums correctly.

`src/modules/issues/impact-score.util.spec.ts`
- AUTO outranks MANUAL when severity and reach are equal.
- Missing GSC yields `reach = 50` and `reachAvailable: false`.
- Score stays within 0–100 for all severity/confidence combinations.

## Do not

- Do not change `health-score.util.ts` arithmetic. It is correct; it was only
  ever unexplained.
- Do not delete the per-URL `Issue` rows. The group is a view over them.

---

# Task 3 — Every detector dual-writes into `GrowthOpportunity`

> Paste this whole file into Claude Code as your prompt, from the repo root.
> **Requires tasks 1 and 2.** Backend paths are relative to `growthx-ai-crawler/`.

## Goal

Four detectors currently write findings into eleven tables that cannot be ranked
against each other. Promote `GrowthOpportunity` to the single finding table by
having each detector **also** write a normalised row there.

This is additive. Nothing is deleted, no endpoint changes behaviour, and every
existing screen keeps working. The detail tables become evidence.

## Extend the model

`GrowthOpportunity` is close but is missing execution routing. Add to
`prisma/schema.prisma`:

```prisma
  /// AUTO | APPROVAL | MANUAL — how the Fix Engine should handle this,
  /// independent of which detector produced it. See §5 of the architecture doc.
  fixClass String @default("MANUAL")

  /// 0-100 composite used to order the queue. Distinct from `priority`, which
  /// predates this and is derived only from potential/confidence/effort.
  impact Float @default(0)

  /// Where the detail lives, so the row can link back to its evidence without
  /// eleven nullable foreign keys.
  /// ISSUE_GROUP | GBP_PROPOSAL | COMPETITOR_FINDING | CONTENT_GAP | MARKET_ACTION
  detailType String?
  /// Issue.groupKey, GbpFixProposal.id, CompetitorFinding.id, ...
  detailRef  String?

  /// Number of pages/locations/prompts this concerns. Denormalised so the
  /// queue can render "29 pages" without a second query.
  affectedCount Int @default(0)

  @@index([projectId, status, impact])
  @@index([projectId, fixClass, status])
```

## The adapter contract

New file `src/modules/opportunities/finding-adapter.interface.ts`:

```ts
export interface NormalisedFinding {
  projectId: string;
  organizationId: string;
  fingerprint: string;   // MUST be stable across detection runs
  source: 'WEBSITE' | 'LOCAL' | 'COMPETITOR' | 'SEARCH_CONSOLE' | 'ANALYTICS' | 'MARKET';
  category: 'SEO' | 'CONTENT' | 'LOCAL' | 'TECHNICAL' | 'MARKETING' | 'BUSINESS' | 'COMPETITOR';
  title: string;             // plain language, see task 5
  summary: string;
  recommendedAction: string;
  evidence: Array<{ label: string; value: string; source: string }>;
  potential: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;        // 0-100
  impact: number;            // 0-100
  fixClass: 'AUTO' | 'APPROVAL' | 'MANUAL';
  affectedPages: string[];
  affectedCount: number;
  detailType: string;
  detailRef: string;
}

export interface FindingAdapter {
  readonly source: NormalisedFinding['source'];
  /** Everything this detector currently considers open for the project. */
  collect(projectId: string): Promise<NormalisedFinding[]>;
}
```

## Four adapters

Each lives beside its own module, not in a shared folder — the adapter is that
detector's responsibility.

| Adapter | File | Reads | Fingerprint |
|---------|------|-------|-------------|
| `WebsiteAuditAdapter` | `src/modules/issues/website-audit.adapter.ts` | `IssueGroup[]` from task 2 | `Issue.groupKey` |
| `GbpAdapter` | `src/modules/local-seo/gbp.adapter.ts` | `GbpFixProposal` where `status = PENDING`, plus derived gaps (no posts in N days, unanswered reviews, missing hours/categories) | `${projectId}::GBP::${field}::${locationId}` |
| `CompetitorAdapter` | `src/modules/market-intelligence/competitor.adapter.ts` | `CompetitorFinding`, `ContentGap` | `${projectId}::COMPETITOR::${category}::${slug(summary)}` |
| `AiVisibilityAdapter` | `src/modules/ai-visibility/ai-visibility.adapter.ts` | `TrackedPrompt` + `PromptCheck` where the brand is absent and a rival is present | `${projectId}::AIVIS::${promptId}` |

**Fingerprint stability is the whole job.** If a fingerprint changes between
runs, a dismissed finding comes back and the queue becomes worthless — the
schema comment on `GrowthOpportunity.fingerprint` already says this. Never
include a timestamp, a crawl id, a row id that is regenerated, or a count in a
fingerprint.

### AI Visibility — mind the honest zero

The live dashboard shows "AI Citation Share **0%**" labelled **Measured** for a
project that has never run a sweep. A real zero and an unmeasured zero must not
look identical. The adapter emits findings only when `PromptCheck` rows exist.
When none do, the module reports "no sweep run yet", not `0%`.

## The reconciler

New file `src/modules/opportunities/finding-sync.service.ts`:

```ts
@Injectable()
export class FindingSyncService {
  /**
   * Runs after every detection cycle. Upserts on [projectId, fingerprint],
   * which is already a unique constraint.
   */
  async syncProject(projectId: string): Promise<{
    created: number; updated: number; resolved: number;
  }>
}
```

Rules:

- **Present and no existing row** → create, `status = OPEN`,
  `detectedAt = lastSeenAt = now()`.
- **Present and row exists** → update the mutable fields (`impact`, `summary`,
  `affectedCount`, `affectedPages`, `evidence`), bump `lastSeenAt`. **Never
  touch `status`.** A finding the user dismissed stays dismissed when the
  detector sees it again — this is the single most important rule in the file.
- **Absent and row is `OPEN`** → `status = RESOLVED`, `resolvedAt = now()`.
- **Absent and row is `DISMISSED`** → leave alone.
- **Absent and row is mid-execution** (`APPROVED`, `APPLYING`, `VERIFYING`) →
  leave alone. Disappearing during a fix is expected; task 4's verifier decides.

Wire `syncProject` into the scheduler after a crawl completes, after a GBP sync,
after an AI sweep, and after a competitor run. Fan-in is fine — the upsert is
idempotent.

## Read path

Extend `src/modules/opportunities/opportunities.controller.ts` (existing:
`GET /`, `POST /detect`, `PATCH /:id/status`, `GET /executive-summary`):

```
GET /projects/:projectId/findings
      ?status=OPEN&source=&fixClass=&category=&limit=50&cursor=
      -> { items: Finding[], nextCursor, counts: { bySource, byFixClass, total } }

POST /projects/:projectId/findings/sync      -> force a resync
GET  /projects/:projectId/findings/:id       -> one finding with full evidence + detail
```

Default ordering: `impact DESC, detectedAt ASC`. Ties break toward the older
finding — something open for three weeks should not sit below a new arrival with
the same score.

## Acceptance criteria

- [ ] Running detection twice with no site changes produces zero new
      `GrowthOpportunity` rows. This is the fingerprint-stability test and it is
      the one that matters.
- [ ] Dismissing a finding, then re-running detection, leaves it dismissed.
- [ ] `GET /findings` returns items from all four sources in one ranked list.
- [ ] `counts.bySource` matches what each module's own screen reports.
- [ ] Every existing endpoint and screen still works unchanged.
- [ ] A project with no GSC connection still returns a sensibly ordered list.

## Tests to add

One spec per adapter — `collect()` on a seeded fixture returns stable
fingerprints across two invocations.

`src/modules/opportunities/finding-sync.service.spec.ts`
- Twice with identical input → `{ created: n, updated: 0, resolved: 0 }` then
  `{ created: 0, updated: n, resolved: 0 }`.
- Dismissed rows survive a resync that still detects them.
- Findings mid-execution are not resolved by disappearing.

## Do not

- Do not delete or stop writing any existing table. This task is purely additive.
- Do not point the frontend at `/findings` yet. That is task 4.
- Do not put all four adapters in one file. They belong to their modules.

---

# Task 4 — One lifecycle, three buckets, and the queue becomes the home screen

> Paste this whole file into Claude Code as your prompt, from the repo root.
> **Requires tasks 1–3.** Backend paths are relative to `growthx-ai-crawler/`.

## Goal

Replace eight status enums with one lifecycle, surface it to users as three
buckets, and make the already-built `/action-queue` page the client landing
screen it was written to be.

## Background

`/action-queue` exists at
`growthx-ai-seo/src/app/(dashboard)/action-queue/page.tsx` — 276 lines, wired to
`useMarketActions` / `useMarketActionDecision`, with a working
approve / reject / convert flow. **Nothing in the codebase links to it.** Grep
for `action-queue` outside its own folder and you get zero hits. The screen is
built; it is fed by the wrong pipe and hidden.

## Changes

### 1. One enum

In `prisma/schema.prisma`:

```prisma
enum FindingLifecycle {
  DETECTED    // written by an adapter, not yet shown
  QUEUED      // visible, waiting on a human
  SNOOZED     // returns on snoozeUntil
  DISMISSED   // user said no; never auto-reopens
  APPROVED    // user said go, not started
  APPLYING    // fix in flight
  VERIFYING   // applied, re-crawl in progress
  VERIFIED    // confirmed live
  MEASURED    // outcome recorded at +7/+30d
  FAILED      // attempt failed, needs a human
  RESOLVED    // detector stopped seeing it; no fix of ours
}
```

On `GrowthOpportunity`:

```prisma
  lifecycle        FindingLifecycle @default(DETECTED)
  snoozeUntil      DateTime?
  dismissReason    String?
  lastTransitionAt DateTime @default(now())
  /// Append-only audit trail: [{ from, to, at, actor, reason }]
  transitions      Json     @default("[]")

  @@index([projectId, lifecycle, impact])
```

Keep the legacy `status` string column and write both for now. Map:
`OPEN → QUEUED`, `ACTIONED → APPROVED`, `DISMISSED → DISMISSED`. Remove the
legacy column in a later cleanup, not here.

### 2. Transition service

New file `src/modules/opportunities/lifecycle.service.ts`. **All lifecycle
changes go through this.** No controller writes `lifecycle` directly.

```ts
const ALLOWED: Record<FindingLifecycle, FindingLifecycle[]> = {
  DETECTED:  ['QUEUED'],
  QUEUED:    ['APPROVED', 'SNOOZED', 'DISMISSED', 'RESOLVED'],
  SNOOZED:   ['QUEUED', 'DISMISSED'],
  DISMISSED: ['QUEUED'],                       // only on explicit user un-dismiss
  APPROVED:  ['APPLYING', 'QUEUED', 'FAILED'], // QUEUED = user changed their mind
  APPLYING:  ['VERIFYING', 'FAILED'],
  VERIFYING: ['VERIFIED', 'FAILED'],
  VERIFIED:  ['MEASURED', 'QUEUED'],           // QUEUED = regression
  MEASURED:  ['QUEUED'],                       // QUEUED = regression
  FAILED:    ['QUEUED', 'DISMISSED'],
  RESOLVED:  ['QUEUED'],                       // QUEUED = regression
};

@Injectable()
export class LifecycleService {
  async transition(
    findingId: string,
    to: FindingLifecycle,
    actor: { type: 'USER' | 'SYSTEM'; id?: string },
    reason?: string,
  ): Promise<GrowthOpportunity>
}
```

- Reject illegal transitions with a 409 naming both states. Do not silently
  no-op — a silent no-op here is how a queue quietly stops working.
- Append to `transitions` on every change. This is what the client report and
  the certificate are built from.
- `DISMISSED` requires a non-empty `reason`.
- A nightly job moves `SNOOZED` rows past `snoozeUntil` back to `QUEUED`.

### 3. Three buckets

`src/modules/opportunities/bucket.util.ts`:

```ts
export type Bucket = 'NEEDS_YOU' | 'IN_PROGRESS' | 'DONE';

export const BUCKET_OF: Record<FindingLifecycle, Bucket | null> = {
  DETECTED:  null,          // not shown
  QUEUED:    'NEEDS_YOU',
  FAILED:    'NEEDS_YOU',
  SNOOZED:   null,          // hidden until it returns
  APPROVED:  'IN_PROGRESS',
  APPLYING:  'IN_PROGRESS',
  VERIFYING: 'IN_PROGRESS',
  VERIFIED:  'DONE',
  MEASURED:  'DONE',
  RESOLVED:  'DONE',
  DISMISSED: 'DONE',
};
```

**Only `NEEDS_YOU` carries a count badge anywhere in the UI.** In-progress work
must never demand attention — no red, no badge, no notification.

### 4. Repoint and promote the queue

Rewrite `growthx-ai-seo/src/app/(dashboard)/action-queue/page.tsx`:

- Data source changes from `useMarketActions` to `useFindings(projectId)` hitting
  `GET /projects/:id/findings` from task 3. Keep the existing layout language
  (`PageHeader`, `Panel`, `Pill`, `Tabs`, `NotConnected` from
  `@/components/ui/console`) — it already matches the app.
- Tabs become the three buckets: **Needs you (n) · We're on it · Done**.
- Filter chips within a bucket: source (Audit / AI Visibility / GBP /
  Competitors) and fix class (Fix it / Review / Draft). Filters, never navigation.
- Header action: **"Fix all safe (n)"** — bulk-approves every `QUEUED` finding
  with `fixClass = AUTO`. This is the primary button in the product.
- Each row: severity stripe, plain-language title, source chip, "29 pages",
  impact score, and **at most three controls**: `Fix it` / `Not now` / `Why?`.
- `Why?` expands in place. It must not navigate. Four blocks, same order every
  time, whatever the source:
  1. **What's wrong** — plain sentence plus evidence
  2. **What it matters** — the traffic or revenue number, or an honest "we can't
     measure this without Search Console"
  3. **The fix** — diff preview, drafted copy, or the GBP field, shown *before*
     anything changes
  4. **Apply** — Fix it · Create PR · Assign · Dismiss (reason required)
- `Not now` opens a small snooze menu: 1 week / 1 month / until it gets worse.

Route: make `/action-queue` the default landing route for a selected client, and
add it to `growthx-ai-seo/src/components/layout/sidebar.tsx` as the first item
under the client switcher, labelled **Action Queue**, with the `NEEDS_YOU` count
as its `tag` and `tagTone: "danger"` only when a CRITICAL is present.

### 5. Fix the Fix Engine contradiction

`/fix-engine` currently renders, in one viewport: *"Plan Activated · Running ·
Autonomous remediation is queued · Plan Approved & Active · Plan Status:
Executing 0%"* and, lower, *"Evidence-Backed 30-Day Plan **Needs Generation** →
Generate Strategy Plan"*. It is simultaneously approved-and-executing and
not-yet-generated.

Introduce one plan state and render exactly one of these:

```
NOT_GENERATED  -> "Generate plan" and nothing else
GENERATED      -> plan summary + "Approve plan"
EXECUTING      -> progress, current item, "Pause"
COMPLETE       -> results + certificates
```

Also on that page:

- **Remove the guaranteed forecast.** "Technical Issues 100 → 0, −100%" and
  "SEO Health 89 → 100" are presented as estimates; an agency will quote them to
  a client. Replace with a range and a caveat, or remove the panel. Never
  promise a perfect score.
- Fix the category maths. Days 1–7 is titled "Critical Fixes & Technical SEO"
  for a plan whose Technical SEO count is `0`. Categories must be derived from
  the actual approved findings.
- Collapse three navigation layers (5-step stepper + 5 sub-tabs + 4 sidebar
  children) to one. Keep the stepper — it communicates state — and drop the
  sub-tabs.
- Fix Engine stops being a destination for deciding. Its job is now: show the
  running plan, and show Fix History with certificates and rollback.

## Acceptance criteria

- [ ] Every lifecycle change goes through `LifecycleService`. Grep for direct
      `lifecycle:` writes outside it and find none.
- [ ] An illegal transition returns 409 with both state names.
- [ ] Dismissing requires a reason; the reason appears in the audit trail.
- [ ] Snoozing for a week hides the row and returns it in seven days.
- [ ] `/action-queue` is reachable from the sidebar and is the default client
      route.
- [ ] "Fix all safe" approves only `fixClass = AUTO` and nothing else.
- [ ] Fix Engine shows exactly one plan state at a time.
- [ ] No screen promises a specific future score.

## Tests to add

`src/modules/opportunities/lifecycle.service.spec.ts`
- Every legal transition succeeds; a representative illegal set throws 409.
- `transitions` is append-only and never loses an entry.
- Dismiss without a reason is rejected.
- Snooze expiry returns the row to `QUEUED`.

`src/modules/opportunities/bucket.util.spec.ts`
- Every `FindingLifecycle` value maps to a bucket or explicit `null`. This test
  fails when someone adds a state and forgets the mapping.

## Do not

- Do not delete the legacy `status` column in this task.
- Do not delete `/action-engine`, `/geo-tracking` or any other route here. Route
  consolidation is a separate task.
- Do not add a notification for anything in `IN_PROGRESS`.

---

# Task 5 — Rewrite all 25 issue types for someone who doesn't know what a meta tag is

> Paste this whole file into Claude Code as your prompt, from the repo root.
> Independent of task 6. Assumes tasks 1–4.
> Backend paths are relative to `growthx-ai-crawler/`.

## Goal

The product's stated goal is that a non-technical business owner can run it.
Today a queue row reads:

> **SCHEMA PRODUCT OFFERS** — `https://www.aivaenterprises.com/products/tomato`
> Missing `offers` property in Product schema. **HIGH**

Nobody outside SEO knows what that means or whether to click. This task adds a
presentation layer that turns every finding into three sentences, and costs
nothing but discipline.

## The three-sentence rule

Always these three, always in this order:

| Sentence | Answers | Rule |
|----------|---------|------|
| **1 · What's wrong** | "What is broken, in my words?" | No SEO vocabulary at all — no *schema*, *canonical*, *H1*, *crawl budget*, *indexation*, *GEO*. Name the business consequence, not the technical fact. Lead with the count |
| **2 · What it costs** | "Why should I care today?" | Tie to traffic, money or reputation using a real Search Console number. **If there is no number, say so.** Never invent one |
| **3 · What we'll do** | "What happens if I click?" | What changes, what does **not** change, how long, and that it is reversible. Fear of breaking the site is the number one reason auto-fix goes unused |

Keep the technical string. Put `issueType`, `dedupKey`, affected URLs and raw
evidence behind a **Technical details** expander. The agency owner never opens
it; the agency's developer opens it every time. Both are served.

## Implementation

New file `src/modules/issues/issue-copy.ts`:

```ts
export interface IssueCopy {
  /** Sentence 1. `{n}` is replaced with affectedCount. */
  title: string;
  /** Sentence 2. `{traffic}` replaced with the GSC share, or the whole clause
   *  dropped when reach is unavailable. */
  cost: string;
  /** Sentence 3. */
  action: string;
  fixClass: 'AUTO' | 'APPROVAL' | 'MANUAL';
  /** Shown only in the Technical details expander. */
  technical: string;
}

export const ISSUE_COPY: Record<string, IssueCopy> = { /* table below */ };

export function renderCopy(
  issueType: string,
  ctx: { n: number; traffic?: number | null },
): { title: string; cost: string; action: string } {
  // {n} -> ctx.n, pluralise "page"/"pages"
  // {traffic} -> `${ctx.traffic}% of your search traffic`
  // when ctx.traffic is null, drop the sentence containing {traffic} and
  // fall back to the type's trafficless variant — never print "null%".
}
```

Wire `renderCopy` into `IssueGroup` (task 2) and the `WebsiteAuditAdapter`
(task 3) so `title`, `summary` and `recommendedAction` are populated at the
source. The frontend renders strings; it never builds them.

A unit test must assert **every** `issueType` emitted by
`issue-engine.service.ts` has an entry in `ISSUE_COPY`. That test is what stops
this decaying the next time someone adds a check.

## The table — all 25 types

Copy these verbatim. `{n}` = affected page count, `{traffic}` = GSC traffic share.

| issueType | Title (sentence 1) | Cost (sentence 2) | Action (sentence 3) | fixClass |
|---|---|---|---|---|
| `MISSING_TITLE` | {n} pages have no name in Google search results | These pages get {traffic}. Google invents a title from whatever text it finds, and it is usually wrong | We'll write a clear title for each page using what the page is actually about. This shows in the browser tab and in search results — nothing on the page itself changes. Reversible any time | AUTO |
| `LONG_TITLE` | {n} page titles get cut off halfway in Google | Shoppers see "Fresh Organic Tomatoes — Best Quality Whole…" and can't tell what you sell. These pages get {traffic} | We'll shorten each title to fit, keeping the important words at the front. Your page content doesn't change | AUTO |
| `SHORT_TITLE` | {n} page titles are too short to tell Google what the page is | A two-word title competes badly against a competitor's descriptive one. These pages get {traffic} | We'll expand each title with what the page actually covers. Nothing on the page changes | AUTO |
| `DUPLICATE_TITLE` | {n} pages share the same name in search results | Google can't tell these pages apart and often shows only one of them, so the rest never appear | We'll make each title specific to its own page. Page content is untouched | AUTO |
| `MISSING_META_DESCRIPTION` | {n} pages let Google write their own description — usually badly | The grey text under your link in search results is your sales pitch. Right now Google picks a random sentence. These pages get {traffic} | We'll write a short description for each page that says what's on it and why to click. Invisible on your site, visible in Google | AUTO |
| `LONG_META_DESCRIPTION` | {n} search descriptions get cut off mid-sentence | Your pitch ends in "…" before it reaches the point | We'll trim each to fit, keeping the strongest part. Nothing on your site changes | AUTO |
| `MISSING_ALT_TEXT` | {n} images are invisible to Google and to blind visitors | Image search sends free traffic you're not collecting, and screen readers skip these entirely — which is also an accessibility risk | We'll describe each image in a short line of hidden text. Your images look exactly the same | AUTO |
| `MISSING_CANONICAL` | {n} pages don't tell Google which version is the real one | When the same page is reachable by several addresses, Google splits the credit between them and all versions rank worse | We'll mark the main version of each page. Invisible to visitors | AUTO |
| `BROKEN_CANONICAL` | {n} pages point Google at a page that doesn't exist | Google is being told "the real version of this page is over there" — and there is nothing there, so it may drop the page entirely | We'll point each page at itself or at the correct version | AUTO |
| `CANONICAL_CROSS_DOMAIN` | {n} pages tell Google the real version is on someone else's website | You are handing your search credit to another domain. If this wasn't deliberate, it is costing you every ranking on those pages | We'll point each page back to your own site. Flagged for your confirmation first if the other domain is one of yours | APPROVAL |
| `NOT_IN_SITEMAP` | {n} pages aren't on the map you give Google | Google may take weeks to find these pages, or never find them. New pages suffer most | We'll add them to your sitemap. Nothing visible changes | AUTO |
| `NOINDEX_DETECTED` | {n} pages are telling Google not to show them at all | These pages cannot appear in search results, no matter how good they are. Often left over from a site build | We'll remove the instruction after you confirm each page should be public — some pages are hidden on purpose | APPROVAL |
| `INCORRECT_ROBOTS` | Your site is blocking Google from parts of it | Anything blocked cannot rank. This is a site-wide setting, so the damage is broad | We'll propose a corrected rules file for your approval. This one is worth a careful look before it ships | APPROVAL |
| `MISSING_H1` | {n} pages have no headline | The main heading tells both visitors and Google what the page is about in one line. Without it, both are guessing. These pages get {traffic} | We'll add a headline to each page. **This is visible on your site**, so you'll see a preview and approve it first | APPROVAL |
| `MULTIPLE_H1` | {n} pages have several competing headlines | When everything is the headline, nothing is. Google can't work out the page's main subject | We'll keep the most relevant one as the headline and demote the rest. Visible change — you'll approve a preview | APPROVAL |
| `BROKEN_LINK_4XX` | {n} links on your site lead to pages that don't exist | Visitors hit a dead end and leave. Google reads broken links as a sign the site is unmaintained | We'll show you each broken link with a suggested replacement, and fix them once you confirm | APPROVAL |
| `BROKEN_IMAGE` | {n} images don't load | Visitors see a broken icon where a product photo should be. On a product page this kills the sale | We'll list each one so you can re-upload, and remove any that are genuinely gone | APPROVAL |
| `REDIRECT_CHAIN` | {n} pages bounce visitors through several addresses before arriving | Every extra hop slows the page and leaks a little ranking strength. On mobile this is felt | We'll point the first address straight at the final one | APPROVAL |
| `REDIRECT_LOOP` | {n} pages send visitors round in circles and never load | These pages are completely unreachable — for visitors and for Google | This needs a look at your redirect rules, which usually live in your hosting settings. We'll show you exactly which rules conflict | MANUAL |
| `SERVER_ERROR_5XX` | {n} pages are returning an error instead of loading | Your server is failing on these pages. If Google keeps hitting errors it stops crawling the site as often | This is a hosting or application problem we can't patch from here. We'll show you the failing addresses and the error so your developer can act | MANUAL |
| `MIXED_CONTENT` | {n} secure pages are loading insecure content | Browsers show a "not secure" warning, and some block the content outright. On a checkout page this loses orders | We'll switch each insecure reference to its secure version. Visual check before it ships | APPROVAL |
| `HTTPS_ISSUE` | Your site's security certificate has a problem | Visitors may see a full-page browser warning before they reach you. Almost nobody clicks past that | This is fixed with your hosting provider, not in your site's code. We'll show you exactly what's wrong so you can pass it on | MANUAL |
| `LARGE_HTML` | {n} pages are unusually heavy and slow to load | Slow pages lose visitors before they see anything, and Google uses speed as a ranking signal. Worst on mobile data | We'll identify what's making each page heavy and propose specific reductions for your approval | APPROVAL |
| `THIN_CONTENT` | {n} pages have too little content to rank for anything | Google treats near-empty pages as low value, and having many of them can drag down the whole site | We'll draft fuller content for each page. **You review and publish** — we never publish words in your voice without you reading them | MANUAL |
| `URL_STRUCTURE_ISSUE` | {n} page addresses are hard for people and Google to read | Addresses full of codes and numbers get fewer clicks than readable ones and say nothing about the page | We'll propose cleaner addresses with redirects from the old ones, so no existing link breaks. Approve before it ships | APPROVAL |

### The dynamic `SCHEMA_*` namespace

The 25 types in the table are the complete set emitted as string literals by
`issue-engine.service.ts`. They are **not** the complete set the queue shows.
`src/modules/ai/fix-generator.ts` also produces types named
`SCHEMA_<schemaType>_<PROPERTY>` — `SCHEMA_PRODUCT_OFFERS` is the one filling the
Aiva priority queue in task 2's bug report. These are generated, so no static
table can enumerate them.

Handle them with a pattern fallback rather than 25 more rows:

- `renderCopy` matches `/^SCHEMA_(.+?)_(.+)$/` and builds copy from the two
  captures — "{n} product pages don't tell Google the price and stock status",
  with `fixClass: 'AUTO'` (structured data is invisible to visitors).
- The completeness test asserts every **static** literal has a table entry, and
  separately that a representative `SCHEMA_*` type renders all three sentences
  with no leftover `{}` placeholders and no raw underscored token in the output.

### Beyond the crawler

The other three detectors need the same treatment. Add these to their adapters
in task 3:

| Finding | Title | Cost | Action |
|---|---|---|---|
| AI Visibility — brand absent | ChatGPT names {n} competitors when asked about "{prompt}", and never you | People increasingly ask an AI instead of searching. In this category you currently don't exist in that answer | We'll draft the page and the facts these tools look for when answering this question. You review before it's published |
| GBP — no recent posts | Your Google listing has been silent for {n} days | Google favours active listings in the local map results, and a stale listing looks closed | We'll draft posts for you. One click to publish each |
| GBP — unanswered reviews | {n} reviews have no reply | Replying publicly is the cheapest reputation work there is, and Google counts engagement | We'll draft a reply to each in your tone. You read it and send it |
| Competitor — keyword gap | {competitor} shows up for {n} searches where you have no page at all | These are customers actively looking for what you sell, going somewhere else | We'll write a brief for each page worth creating, ranked by how much traffic it could bring |

## Style rules

- **Lead with the number.** "{n} pages…" every time. Scale is what makes someone act.
- **Second person, active voice.** "Your listing", "we'll write", never "the
  meta description should be optimised".
- **Never promise a ranking outcome.** "This helps Google understand the page",
  never "this will get you to page one".
- **Say what does not change.** For every AUTO fix, state explicitly that the
  page looks the same. This single sentence is what gets auto-fix switched on.
- **Be honest about missing data.** With no Search Console connection, the cost
  sentence becomes "We can't measure how much traffic this affects until
  Search Console is connected" — never a guessed percentage.
- **Never say the product found "issues".** Say what's wrong. "Issues" is a
  number that scares people without telling them anything.

## Acceptance criteria

- [ ] All 25 types have entries; the completeness test passes.
- [ ] No string in `ISSUE_COPY` contains: schema, canonical, H1, meta, crawl,
      index, SERP, GEO, LLM, 4XX, 5XX — outside the `technical` field. Write a
      lint test for this list.
- [ ] `{traffic}` never renders as `null`, `undefined` or `NaN`.
- [ ] Pluralisation is correct at `n = 1` ("1 page has", not "1 pages have").
- [ ] Every queue row has at most three controls.
- [ ] The Technical details expander still exposes the raw `issueType`,
      `dedupKey`, evidence and full URL list.

## Tests to add

`src/modules/issues/issue-copy.spec.ts`
- Every `issueType` in `issue-engine.service.ts` has copy. Derive the list by
  reading the source, so a new check without copy fails the build.
- Jargon blocklist test over `title`, `cost` and `action`.
- `renderCopy` with `traffic: null` produces no placeholder artefacts.
- `n = 1` pluralisation.

---

# Task 6 — Turn on the hold arm

> Paste this whole file into Claude Code as your prompt, from the repo root.
> Independent of task 5. Assumes tasks 1–4.
> Backend paths are relative to `growthx-ai-crawler/`.

## Goal

`FixIntervention.arm` already exists with values `TREAT` and `HOLD`.
`InterventionOutcome` already stores `preCitationRate`, `postCitationRate`,
`controlPreRate`, `controlPostRate` and `lift`, described in your own schema as
*"difference-in-differences against the hold arm"*. The schema comment on
`FixIntervention` says it plainly: *"the row that makes the product's central
claim checkable."*

**None of it is being written.** This task switches it on.

## Why this is the priority it is

A crawler is a commodity. AI visibility tracking will be a checkbox feature
within a year. Neither is defensible.

Measured causal lift is. Every other SEO tool reports correlation, because they
only diagnose — they never touch the site, so they have no intervention to
measure. GrowthX makes the change and measures after, which means it can hold
back a random subset and report what the fixed ones actually gained.

The dataset only has value once it has history. **The clock does not start until
this ships**, so ship it at low volume rather than waiting for the perfect
design.

## Changes

### 1. Assign an arm at approval

New file `src/modules/impact/arm-assignment.service.ts`:

```ts
@Injectable()
export class ArmAssignmentService {
  /**
   * Decides TREAT or HOLD for a finding about to be fixed.
   *
   * Deterministic on the finding id, so the same finding always lands in the
   * same arm — re-running assignment must never move a page between arms, or
   * the measurement is worthless.
   */
  assign(finding: GrowthOpportunity, config: HoldConfig): 'TREAT' | 'HOLD'
}

export interface HoldConfig {
  /** Share held back, 0-1. Start at 0.10. */
  holdRate: number;
  /** Issue types never held back. */
  neverHold: string[];
  /** Minimum group size before any member is held. Below this, all TREAT. */
  minGroupSize: number;
}
```

Rules:

- Hash `finding.id` to a stable 0–1 value; `HOLD` when below `holdRate`.
- **Never hold** anything user-visibly broken or harmful:
  `SERVER_ERROR_5XX`, `REDIRECT_LOOP`, `HTTPS_ISSUE`, `MIXED_CONTENT`,
  `BROKEN_IMAGE`, `BROKEN_LINK_4XX`, `NOINDEX_DETECTED`. Withholding a fix for
  a broken checkout to learn something is not a trade worth making.
- Only hold within groups of at least `minGroupSize` (default 8). Holding 1 of 2
  pages measures nothing and costs the client half the fix.
- Only hold `AUTO` and `APPROVAL` classes. `MANUAL` work is done by a human and
  cannot be cleanly withheld.
- Per-client opt-out, default **on**, surfaced honestly in settings — see §4.

### 2. Write the intervention

In the Fix Engine execution path, at the point a fix is applied, write a
`FixIntervention` for **both** arms:

| Field | TREAT | HOLD |
|-------|-------|------|
| `arm` | `TREAT` | `HOLD` |
| `url` | affected URL | affected URL |
| `changeClass` | mapped from `issueType` | same |
| `beforePageId` | Page row from the pre-fix crawl | same |
| `shippedAt` | when it reached production | **`null` — a HOLD never ships** |
| `pullRequestUrl` / `mergedSha` | when it came from a PR | null |
| `summary` | one line of what changed | one line of what *would* have changed |

The `ChangeClass` enum already exists: `SCHEMA_MARKUP`, `FAQ_BLOCK`,
`ENTITY_DISAMBIGUATION`, `HEADING_STRUCTURE`, `COMPARISON_TABLE`,
`AUTHOR_CREDENTIALS`, `INTERNAL_LINKS`, `FRESHNESS_UPDATE`. Add a static map
from `issueType` → `ChangeClass` in
`src/modules/impact/change-class.ts` alongside the existing code there.

A `HOLD` row is created and then deliberately left alone. It is the control.

### 3. Measure at +7 and +30

New file `src/modules/impact/outcome-measurement.service.ts`, scheduled daily:

```ts
@Injectable()
export class OutcomeMeasurementService {
  /** Finds interventions due for measurement and writes InterventionOutcome. */
  async measureDue(windowDays: 7 | 30 | 60 | 90): Promise<number>
}
```

For each intervention whose `shippedAt` (or, for a HOLD, whose creation) is
exactly `windowDays` old:

- `preCitationRate` / `postCitationRate` — from `PromptCheck` for AI visibility
  change classes; from `GscDailyMetric` (clicks or impressions per URL) for
  search-facing ones. Pre-window is the same length immediately before.
- `controlPreRate` / `controlPostRate` — the same measurement over the `HOLD`
  arm of the **same change class, same project, same window**.
- `lift` — difference-in-differences:
  `(post − pre) − (controlPost − controlPre)`.
- `preSampleSize` / `postSampleSize` / `controlSampleSize` — actual counts.

**Write `lift = null` when there is no matching hold arm** or when any sample
size is below a floor (default 5). A lift computed from three pages is noise
with a decimal point, and publishing it once destroys the credibility of every
number that follows.

Write one row per `assistant` **and** one with `assistant = null` meaning "across
every engine" — the schema comment already notes these are different
measurements and Postgres treats the NULLs as distinct, so guard duplicate
insertion in the service rather than relying on a unique index.

### 4. Tell the client the truth

Withholding a fix from a paying client's site requires consent. Get it properly,
because doing this quietly is the one thing that could turn the moat into a
scandal.

- A per-project setting, **Measurement holdback**, on by default, in project
  settings, worded plainly: *"We hold back a small random share of low-risk
  fixes for 30 days so we can measure what the others actually gained. Nothing
  urgent or customer-facing is ever held back, and held items are applied
  automatically at the end of the window. Turn this off and your fixes all ship
  immediately — you'll still get results, just not measured ones."*
- **Held items are applied automatically when the measurement window closes.**
  A hold is a delay, never a cancellation. Add a scheduled job that promotes
  `HOLD` interventions to shipped at `+windowDays` and enqueues the fix.
- Held findings appear in the client's queue as **"Measuring — applies in N
  days"**, in the *We're on it* bucket. Never hidden.
- Never hold on a client whose setting is off, and never hold a `neverHold`
  type regardless of the setting.

### 5. Surface the results

- **Fix History** row: "Applied 12 Aug · verified 12 Aug · **+14% impressions vs
  held-back control, 30 days**". When `lift` is null, show "measured, no control
  group" and nothing more.
- **Client report**: a section listing measured outcomes only. No lift, no claim.
- **Aggregate view**, internal first: average lift by `changeClass` across all
  projects, with sample sizes. This is the asset. When it is large enough it
  becomes the pricing page.

## Acceptance criteria

- [ ] Arm assignment is deterministic — running it twice on the same finding
      gives the same arm, always.
- [ ] No `neverHold` type is ever assigned `HOLD`, at any hold rate including 1.0.
- [ ] Groups below `minGroupSize` are all `TREAT`.
- [ ] A `HOLD` intervention has `shippedAt = null` until its window closes, then
      is applied automatically.
- [ ] `lift` is null whenever there is no matching control or a sample is under
      the floor. A test asserts this rather than producing a number.
- [ ] Clients with holdback off get zero `HOLD` rows.
- [ ] Held findings are visible in the queue with their apply date.

## Tests to add

`src/modules/impact/arm-assignment.service.spec.ts`
- Determinism across repeated calls.
- `neverHold` respected at `holdRate = 1.0` — the safety test.
- `minGroupSize` boundary at n−1, n, n+1.
- Distribution lands within tolerance of `holdRate` over 10,000 synthetic ids.

`src/modules/impact/outcome-measurement.service.spec.ts`
- Difference-in-differences arithmetic against a hand-computed fixture.
- Null lift with no control arm.
- Null lift below the sample floor.
- No duplicate rows for the same `(intervention, assistant, windowDays)`.

## Do not

- Do not hold back a fix on a client who has not been shown the setting.
- Do not report a lift without its sample size next to it.
- Do not let a hold expire without applying the fix.
- Do not start with `holdRate` above 0.10.
