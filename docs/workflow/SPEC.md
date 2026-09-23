# GrowthX Workflow Spec — Complete Hand-Off Pack

Six implementation tasks that turn GrowthX from eleven parallel finding tables into one ranked queue with a proof ledger.

Derived from `sudaaher74-ctrl/GrowthX-SEO-` at HEAD (22 Sep 2026), read from `prisma/schema.prisma`, `src/modules/issues/issue-engine.service.ts`, `src/modules/opportunities/`, and the Next.js app under `growthx-ai-seo/src/app/(dashboard)/`, plus a live walkthrough of `growth-x-seo.vercel.app` on the Aiva project.

---

## How to use this file with Claude Code

Commit it to the repo at `docs/workflow/SPEC.md`. Then for each task, tell Claude Code:

> Read `docs/workflow/SPEC.md`. Implement **Task 1 — Give Issue a project and a stable identity**, following its acceptance criteria and its Do-not list. Do not start any other task.

Work one task per branch, one task per PR. Tasks 1 and 2 are blockers; 3 needs 1; 4 needs 3; 5 and 6 are independent of each other.

---

## Contents

| # | Section |
|---|---------|
| — | [README](#readme) |
| 00 | [Architecture](#00-architecture) |
| 01 | [Task 1 — Give Issue a project and a stable identity](#task-1) |
| 02 | [Task 2 — Group the queue, make one count true everywhere](#task-2) |
| 03 | [Task 3 — Every detector dual-writes into GrowthOpportunity](#task-3) |
| 04 | [Task 4 — One lifecycle, three buckets, queue becomes home screen](#task-4) |
| 05 | [Task 5 — Rewrite all 25 issue types in plain language](#task-5) |
| 06 | [Task 6 — Turn on the hold arm](#task-6) |

---

## README

### The tasks

| # | What it does | Est. | Risk |
|---|-------------|------|------|
| 1 | Give Issue a `projectId` and a `fingerprint` so findings survive a re-crawl | ~2 days | Medium — migration + backfill |
| 2 | Group the queue by issue type × site instead of one row per URL | ~3 days | Low |
| 3 | Every detector dual-writes into `GrowthOpportunity` | ~1 week | Low — additive only |
| 4 | One lifecycle enum replacing eight; three-bucket UI | ~4 days | Medium |
| 5 | Rewrite all 25 issue types in plain language | ~2 days | None |
| 6 | Turn on the TREAT/HOLD measurement that is the moat | ~1 week | Low |

### Non-negotiables for every task

1. **Nothing is deleted.** Every existing table, endpoint and page keeps working through all six tasks. This is dual-write and promote, never rip-and-replace.
2. **Every migration is reversible** and ships with a down path that has been tested against a copy of production data.
3. **Backfills run in batches** with a resumable cursor. `aivaenterprises.com` alone has 156 issues across 35 pages; a client with 10,000 pages will time out a naive `updateMany`.
4. **No new mock data.** If a value cannot be computed, the API returns `null` and the UI renders an honest empty state. `/monitoring` is currently 694 lines of fabricated uptime data — do not add a second one. There is a `no-fabricated-data.spec.ts` in the repo; keep it passing.
5. **Tests before merge.** Each task names the specs it must add. The repo uses Jest with `*.spec.ts` next to the source file.

### Known bugs to fix along the way

| Bug | Where | Task |
|-----|-------|------|
| Dashboard shows `CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0` directly above a list of issues labelled `HIGH` | `/dashboard` — Technical SEO Health card | 2 |
| Same crawl reports 100 issues (Audit), 156 (Dashboard), 100 fixes (Fix Engine) | three screens | 2 |
| Fix Engine says "Plan Approved & Active / Executing" and "Needs Generation" simultaneously | `/fix-engine` | 4 |
| Fix Engine promises "Technical Issues 100 → 0" and "SEO Health 89 → 100" as an estimate | `/fix-engine` Impact Forecast | 4 |
| Priority queue shows 5 rows, all the same issue type on 5 URLs | `/dashboard` Priority Action Queue | 2 |
| `/action-queue` is fully built and wired but has zero inbound links | `growthx-ai-seo/src` | 4 |
| `/monitoring` has 694 lines and zero data fetches; `useMonitoring` hook exists unused | `/monitoring` | — |

### What this pack does not cover

- Navigation restructure (45 routes → ~24, GBP 11 tabs → 4). That is a separate front-end task.
- Onboarding wizard.
- Billing, admin, and the free SEO tools.

---

## 00 Architecture

> Reference document. Also lives at `docs/workflow/00-ARCHITECTURE.md`.

### 1. The problem

Four detectors write findings into eleven different tables with eight different status enums:

| Table | Scoped to | Status type |
|-------|-----------|-------------|
| `Issue` | `crawlJobId` only | `IssueStatus` |
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

Two consequences: (1) A finding cannot be ranked against a finding from another detector. (2) `Issue` is scoped to a crawl job, not a client — the product cannot answer how long a finding has been open, whether it was fixed, or whether it came back.

### 2. The spine

`GrowthOpportunity` is promoted to the single finding table. Everything else keeps existing as evidence detail and stops being a queue.

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

### 3. The pipeline

```
1 CONNECT    site URL, GSC, GA4, GBP, code host, competitor domains
                 -> project with connected sources

2 DETECT     four detectors, one schedule, four workers
                 -> raw rows in detail tables (Issue, GbpFixProposal, ...)

3 NORMALISE  one GrowthOpportunity row per finding, grouped by type x site,
             fingerprinted so re-scans update rather than duplicate, scored once
                 -> ranked list

4 DECIDE     the only stage a human touches
             three buttons per row: Fix it / Not now / Why?
             one bulk action: "Fix all safe (n)"
                 -> APPROVED | SNOOZED | DISMISSED(reason)

5 EXECUTE    Fix Engine routes by effort class, never by source module
                 -> FixIntervention + PublishedChange, snapshot first

6 PROVE      re-crawl, verify, certify, then measure at +7/+30 days
                 -> VerificationResult -> InterventionOutcome.lift
```

### 4. Lifecycle

```
DETECTED -> QUEUED -> APPROVED -> APPLYING -> VERIFYING -> VERIFIED -> MEASURED
              |                                 |
              |-> SNOOZED (returns on a date)   -> FAILED -> back to QUEUED
              -> DISMISSED (reason required)
```

The user never sees ten states. They see three buckets:

| Bucket | States | Rule |
|--------|--------|------|
| **Needs you** | `QUEUED`, `FAILED` | The only bucket with a number on it |
| **We're on it** | `APPROVED`, `APPLYING`, `VERIFYING` | Visible, never demanding. No badges, no red |
| **Done** | `VERIFIED`, `MEASURED`, `DISMISSED` | What goes in the client report |

### 5. Fix routing

| Class | When | Behaviour | Button |
|-------|------|-----------|--------|
| `AUTO` | Invisible to visitors, reversible, low blast radius: meta descriptions, alt text, schema, canonicals, robots, sitemap | Applies directly. Snapshot first. One-click undo that never expires | **Fix it** |
| `APPROVAL` | Touches code or anything a visitor sees: headings, internal links, templates, redirects | Opens a PR or staged change with a before/after diff. Never auto-merges | **Review change** |
| `MANUAL` | Needs judgement or an account we don't hold: new pages, GBP posts, review replies | Drafts the content in full, hands it over | **Open draft** |

**Safety rails (required before AUTO ships to any client)**
- Snapshot before every change; undo works a year later. `PageSnapshot` and `RollbackRecord` already exist.
- Blast radius cap: never change more than N pages in one run without a human confirming. Default N = 25.
- Never-touch list, on by default: pricing, contact details, legal pages, checkout paths.
- Per-client autonomy setting: `AUTOMATIC | ASK_FIRST | DRAFTS_ONLY`. Default new clients to `ASK_FIRST`.
- Pause everything: one switch on the client screen that halts all automation instantly.

### 6. Scoring

```
impact = ((0.45 x reach) + (0.35 x severity) + (0.20 x confidence))
         x { AUTO: 1.00, APPROVAL: 0.92, MANUAL: 0.78 }[fixClass]

reach      0-100  share of impressions/sessions on affectedPages (GscDailyMetric)
                  null GSC connection => reach = 50 (neutral)
severity   0-100  SEVERITY_WEIGHTS normalised: CRITICAL 100, HIGH 40, MEDIUM 15, LOW 5
confidence 0-100  CONFIDENCE_MULTIPLIERS x 100: CONFIRMED 100, LIKELY 80, ADVISORY 50
```

Existing weights live in `src/modules/issues/health-score.util.ts` — reuse them, do not redefine.

### 7. How the detectors feed each other

| Detector | Gives the others |
|----------|-----------------|
| **Search Console** | Impressions and clicks per URL — turns "34 issues" into "these 3 sit on 31% of your traffic" |
| **Website Audit** | Page inventory and entity map. AI Visibility uses it to pick prompts; Competitor Intel uses it to compute gaps |
| **Competitor Intel** | Rival list and the keywords they own. Those keywords become prompts to sweep and briefs to write |
| **AI Visibility** | Which brands LLMs actually name for this category — should write back into Competitor Intel automatically |
| **GBP** | Locations, categories, review themes. Review complaints are content topics; service gaps are page gaps |

### 8. The moat

`FixIntervention` has `arm: TREAT | HOLD`. `InterventionOutcome` stores `preCitationRate`, `postCitationRate`, `controlPreRate`, `controlPostRate` and `lift` — "difference-in-differences against the hold arm".

That is a **randomised controlled experiment framework** inside an SEO product. Every other SEO tool reports correlation. GrowthX can report causation.

**Product promise:** Everyone else tells you what's wrong. We fix it, and we prove it worked.

### 9. Weekly cadence

| When | What |
|------|------|
| Mon 06:00 | All four detectors, every client, one schedule |
| Mon 09:00 | One digest email per agency. "10 clients · 14 new · 9 we can fix · 3 need your call" |
| Tue, ~10 min | "Fix all safe (9)" clears most of it |
| Wed–Thu | Fixes apply, re-crawls confirm, certificates get written |
| Fri 16:00 | White-label report drafts per client, waiting on one Send |

---

## Task 1

### Give Issue a project and a stable identity

> **Blocker for tasks 2, 3 and 4.** Paste this section into Claude Code from the repo root.

### Goal

`Issue` is currently scoped to `crawlJobId` only. Every re-crawl creates a new set of rows with new ids. Add `projectId` and `fingerprint` so a finding survives across crawls.

### Current state

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

Relationship path to a project: `Issue.crawlJobId -> CrawlJob.websiteId -> Website.projectId`.

### Changes

#### 1. Schema

Add to `model Issue`:

```prisma
  projectId        String
  fingerprint      String
  firstDetectedAt  DateTime @default(now())
  lastSeenAt       DateTime @default(now())
  resolvedAt       DateTime?
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

Do NOT make `[projectId, fingerprint]` unique. Uniqueness is enforced at the `GrowthOpportunity` level in task 3.

#### 2. Fingerprint helper

New file `src/modules/issues/fingerprint.util.ts`:

```typescript
export function normaliseUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.protocol = 'https:';
    u.hostname = u.hostname.replace(/^www\./, '').toLowerCase();
    u.hash = '';
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

Site-wide issue types that must use `siteFingerprint`: `INCORRECT_ROBOTS`, `HTTPS_ISSUE`.

#### 3. Migration + backfill

**Part A — additive, nullable.** Add all new columns as nullable, no constraints. Deploy.

**Part B — backfill, then tighten.** Standalone script at `src/modules/issues/scripts/backfill-issue-identity.ts`, runnable with `npm run script:backfill-issue-identity`:

- Page through `Issue` in batches of 1,000 ordered by `id`, with a resumable cursor.
- Resolve `projectId` via `crawlJob.website.projectId` (one join, batched).
- Compute `fingerprint` with the helper above.
- Set `firstDetectedAt` to the earliest `createdAt` across all rows sharing that fingerprint.
- Set `lastSeenAt` to the latest `createdAt` for that fingerprint.
- Log progress every batch. Make it idempotent.

Then a second migration makes `projectId` and `fingerprint` NOT NULL and adds the indexes.

Orphaned rows (unresolvable `projectId`): log them, leave nullable, report count. Do not delete.

#### 4. Write path

In `src/modules/issues/issue-engine.service.ts`:

- `DetectedIssueInput` gains `fingerprint: string`.
- `evaluateAndPersistIssues(...)` gains a `projectId: string` parameter. Update all callers.

New method:

```typescript
async reconcileAgainstPreviousCrawl(
  projectId: string,
  currentCrawlJobId: string,
): Promise<{ resolved: number; regressed: number; carried: number }>
```

- Fingerprints in previous crawl but not this one -> `status = RESOLVED`, `resolvedAt = now()`.
- Fingerprints in this crawl that were `RESOLVED` -> `regressionCount + 1`, `status = OPEN`, `resolvedAt = null`.
- Fingerprints in both -> carry `firstDetectedAt` forward, bump `lastSeenAt`.

Call at the end of the crawl pipeline.

### Acceptance criteria

- [ ] `npx prisma migrate dev` runs clean; down migration tested against a production-shaped dump.
- [ ] Backfill script completes on a table with >= 100k rows without timing out, and is safe to re-run.
- [ ] Every non-orphaned `Issue` row has a non-null `projectId` and `fingerprint`.
- [ ] Crawling the same site twice with no changes produces zero new fingerprints and zero regressions.
- [ ] Fixing one issue and re-crawling marks exactly that fingerprint `RESOLVED` with a `resolvedAt`.
- [ ] Breaking it again bumps `regressionCount` to 1 and reopens it, preserving the original `firstDetectedAt`.

### Tests to add

**`src/modules/issues/fingerprint.util.spec.ts`**
- `http://www.x.com/a/`, `https://x.com/a`, `https://x.com/a?utm_source=g` all normalise to one string.
- `https://x.com/a?page=2` does not collapse into `https://x.com/a`.
- Malformed input returns something stable rather than throwing.

**`src/modules/issues/issue-engine.reconcile.spec.ts`**
- Crawl twice unchanged -> `{ resolved: 0, regressed: 0, carried: n }`.
- Issue disappears -> resolved.
- Issue reappears after resolution -> regressed, `firstDetectedAt` preserved.

### Do not

- Do not drop, rename or repurpose `dedupKey`. It still does within-crawl deduplication.
- Do not change `IssueStatus` values. Task 4 handles lifecycle.
- Do not touch the frontend in this task.

---

## Task 2

### Group the queue by issue type, and make one count true everywhere

> Requires Task 1. Paste this section into Claude Code from the repo root.

### Goal

**A. The queue is unreadable.** Priority Action Queue shows five rows — all `SCHEMA PRODUCT OFFERS`, on five product URLs. Group by issue type x project so one row reads "Product schema missing offers — 29 pages".

**B. No two screens agree on the count.** Same crawl of `aivaenterprises.com`:

| Screen | Says |
|--------|------|
| Website Audit Overview | 100 open issues, "0 critical" |
| Dashboard | 156 unique issues, `CRITICAL 0 · HIGH 0 · MEDIUM 0 · LOW 0` |
| Fix Engine | 100 fixes in the plan |

Dashboard renders `HIGH 0` directly above five rows each tagged `HIGH`. One endpoint, one definition.

### Changes

#### 1. Grouping key

Add to `model Issue`:

```prisma
  groupKey String  // projectId::issueType

  @@index([projectId, groupKey, status])
```

Populate at write time and backfill existing rows in batches.

#### 2. One counting service

New file `src/modules/issues/issue-count.service.ts`. Every screen reads from this. No screen counts issues itself.

```typescript
export interface IssueCounts {
  openFindings: number;     // distinct fingerprints, OPEN only — the headline number
  openGroups: number;       // distinct groupKeys with at least one open fingerprint
  bySeverity: { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number };
  autoFixable: number;      // drives "Fix all safe (n)"
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

Rules:
- Unit is a distinct fingerprint, never a raw row. History rows must not inflate the number.
- Only the latest completed `CrawlJob` per website contributes open findings.
- A project with several websites sums across them.
- `bySeverity` must sum exactly to `openFindings`. Add a runtime assertion in development.

#### 3. Expose it

```
GET /projects/:projectId/issues/counts         -> IssueCounts
GET /projects/:projectId/issues/groups?status=OPEN&severity=&limit=50  -> IssueGroup[]
GET /projects/:projectId/issues/groups/:groupKey/pages?limit=100&cursor=  -> paginated pages
```

```typescript
export interface IssueGroup {
  groupKey: string;
  issueType: string;
  category: string | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; // highest in the group
  confidence: 'CONFIRMED' | 'LIKELY' | 'ADVISORY';   // lowest in the group
  affectedCount: number;
  sampleUrls: string[];      // first 5
  aiFixAvailable: boolean;   // true only if EVERY member can be auto-fixed
  fixClass: 'AUTO' | 'APPROVAL' | 'MANUAL';
  impact: number;            // 0-100
  firstDetectedAt: string;
  regressionCount: number;   // max across the group
  title: string;
  summary: string;
  action: string;
}
```

#### 4. Impact score

New file `src/modules/issues/impact-score.util.ts`. Reuse `SEVERITY_WEIGHTS` and `CONFIDENCE_MULTIPLIERS` from `health-score.util.ts` — import them, do not redefine.

`reach` from `GscDailyMetric` scaled 0–100. When GSC not connected, `reach = 50` and response sets `reachAvailable: false`.

#### 5. Fix the three screens

- `dashboard/page.tsx` — severity tiles read `IssueCounts`. Priority Action Queue renders `IssueGroup[]`, max 5 groups.
- `website/page.tsx` — Overview and Issues tab read the same endpoint. Tab badge = `openGroups`.
- `fix-engine/page.tsx` — plan size reads `openGroups` / `autoFixable`.

Add hooks: `useIssueCounts(projectId)`, `useIssueGroups(projectId, filters)`, `useIssueGroupPages(projectId, groupKey)`.

#### 6. Explain the health score

Add one line under the score: "89/100 — 156 findings, mostly low severity. Capped at 20 penalty points per page so one broken page can't sink the score."

### Acceptance criteria

- [ ] `bySeverity` sums to `openFindings` for every project. A test asserts this.
- [ ] Dashboard, Website Audit and Fix Engine display the same number.
- [ ] The Aiva priority queue shows distinct problems.
- [ ] A group row expands to its affected URL list, paginated past 100.
- [ ] With GSC disconnected, ordering still works and the UI says why.
- [ ] No screen calls `prisma.issue.count()` directly. Grep to confirm.

### Tests to add

**`src/modules/issues/issue-count.service.spec.ts`**
- Severity buckets sum to the total.
- History rows from superseded crawls do not inflate counts.
- Multi-website project sums correctly.

**`src/modules/issues/impact-score.util.spec.ts`**
- `AUTO` outranks `MANUAL` when severity and reach are equal.
- Missing GSC yields `reach = 50` and `reachAvailable: false`.
- Score stays within 0–100 for all severity/confidence combinations.

### Do not

- Do not change `health-score.util.ts` arithmetic.
- Do not delete the per-URL `Issue` rows. The group is a view over them.

---

## Task 3

### Every detector dual-writes into GrowthOpportunity

> Requires Tasks 1 and 2. Paste this section into Claude Code from the repo root.

### Goal

Four detectors currently write findings into eleven tables that cannot be ranked against each other. Promote `GrowthOpportunity` to the single finding table by having each detector also write a normalised row there. This is purely additive.

### Extend the model

Add to `GrowthOpportunity` in `prisma/schema.prisma`:

```prisma
  fixClass      String @default("MANUAL")   // AUTO | APPROVAL | MANUAL
  impact        Float  @default(0)          // 0-100 composite
  detailType    String?                     // ISSUE_GROUP | GBP_PROPOSAL | ...
  detailRef     String?                     // Issue.groupKey, GbpFixProposal.id, ...
  affectedCount Int    @default(0)

  @@index([projectId, status, impact])
  @@index([projectId, fixClass, status])
```

### The adapter contract

New file `src/modules/opportunities/finding-adapter.interface.ts`:

```typescript
export interface NormalisedFinding {
  projectId: string;
  organizationId: string;
  fingerprint: string;
  source: 'WEBSITE' | 'LOCAL' | 'COMPETITOR' | 'SEARCH_CONSOLE' | 'ANALYTICS' | 'MARKET';
  category: 'SEO' | 'CONTENT' | 'LOCAL' | 'TECHNICAL' | 'MARKETING' | 'BUSINESS' | 'COMPETITOR';
  title: string;
  summary: string;
  recommendedAction: string;
  evidence: Array<{ label: string; value: string; source: string }>;
  potential: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  impact: number;
  fixClass: 'AUTO' | 'APPROVAL' | 'MANUAL';
  affectedPages: string[];
  affectedCount: number;
  detailType: string;
  detailRef: string;
}

export interface FindingAdapter {
  readonly source: NormalisedFinding['source'];
  collect(projectId: string): Promise<NormalisedFinding[]>;
}
```

### Four adapters

| Adapter | File | Reads | Fingerprint pattern |
|---------|------|-------|---------------------|
| `WebsiteAuditAdapter` | `src/modules/issues/website-audit.adapter.ts` | `IssueGroup[]` from task 2 | `Issue.groupKey` |
| `GbpAdapter` | `src/modules/local-seo/gbp.adapter.ts` | `GbpFixProposal` (PENDING) + derived gaps | `${projectId}::GBP::${field}::${locationId}` |
| `CompetitorAdapter` | `src/modules/market-intelligence/competitor.adapter.ts` | `CompetitorFinding`, `ContentGap` | `${projectId}::COMPETITOR::${category}::${slug(summary)}` |
| `AiVisibilityAdapter` | `src/modules/ai-visibility/ai-visibility.adapter.ts` | `TrackedPrompt` + `PromptCheck` where brand absent | `${projectId}::AIVIS::${promptId}` |

**Fingerprint stability is the whole job.** Never include a timestamp, crawl id, regenerated row id, or count in a fingerprint.

**AI Visibility — the honest zero:** The live dashboard shows "AI Citation Share 0%" labelled *Measured* for a project that has never run a sweep. The adapter emits findings only when `PromptCheck` rows exist. When none do, report "no sweep run yet", not 0%.

### The reconciler

New file `src/modules/opportunities/finding-sync.service.ts`:

```typescript
@Injectable()
export class FindingSyncService {
  async syncProject(projectId: string): Promise<{
    created: number; updated: number; resolved: number;
  }>
}
```

Rules:
- **Present, no existing row** -> create, `status = OPEN`.
- **Present, row exists** -> update mutable fields, bump `lastSeenAt`. **Never touch `status`.** A dismissed finding stays dismissed — this is the single most important rule in the file.
- **Absent, row is `OPEN`** -> `status = RESOLVED`, `resolvedAt = now()`.
- **Absent, row is `DISMISSED`** -> leave alone.
- **Absent, row is mid-execution** (`APPROVED`, `APPLYING`, `VERIFYING`) -> leave alone.

Wire `syncProject` into the scheduler after crawl, GBP sync, AI sweep, and competitor run.

### Read path

Extend `src/modules/opportunities/opportunities.controller.ts`:

```
GET /projects/:projectId/findings?status=OPEN&source=&fixClass=&category=&limit=50&cursor=
    -> { items: Finding[], nextCursor, counts: { bySource, byFixClass, total } }

POST /projects/:projectId/findings/sync
GET  /projects/:projectId/findings/:id
```

Default ordering: `impact DESC`, `detectedAt ASC`. Ties break toward the older finding.

### Acceptance criteria

- [ ] Running detection twice with no site changes produces zero new `GrowthOpportunity` rows.
- [ ] Dismissing a finding, then re-running detection, leaves it dismissed.
- [ ] `GET /findings` returns items from all four sources in one ranked list.
- [ ] `counts.bySource` matches what each module's own screen reports.
- [ ] Every existing endpoint and screen still works unchanged.

### Tests to add

One spec per adapter — `collect()` returns stable fingerprints across two invocations.

**`src/modules/opportunities/finding-sync.service.spec.ts`**
- Twice with identical input -> `{ created: n, updated: 0, resolved: 0 }` then `{ created: 0, updated: n, resolved: 0 }`.
- Dismissed rows survive a resync that still detects them.
- Findings mid-execution are not resolved by disappearing.

### Do not

- Do not delete or stop writing any existing table. Purely additive.
- Do not point the frontend at `/findings` yet. That is task 4.
- Do not put all four adapters in one file.

---

## Task 4

### One lifecycle, three buckets, and the queue becomes the home screen

> Requires Tasks 1–3. Paste this section into Claude Code from the repo root.

### Goal

Replace eight status enums with one lifecycle, surface it to users as three buckets, and make the already-built `/action-queue` page the client landing screen it was written to be.

`/action-queue` exists at `growthx-ai-seo/src/app/(dashboard)/action-queue/page.tsx` — 276 lines, fully wired, with a working approve / reject / convert flow. Grep for `action-queue` outside its own folder and you get zero hits. The screen is built; it is fed by the wrong pipe and hidden.

### Changes

#### 1. One enum

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
  transitions      Json     @default("[]")  // append-only audit trail

  @@index([projectId, lifecycle, impact])
```

Keep the legacy `status` string column and write both. Map: `OPEN -> QUEUED`, `ACTIONED -> APPROVED`, `DISMISSED -> DISMISSED`. Remove the legacy column in a later cleanup.

#### 2. Transition service

New file `src/modules/opportunities/lifecycle.service.ts`. All lifecycle changes go through this.

```typescript
const ALLOWED: Record<FindingLifecycle, FindingLifecycle[]> = {
  DETECTED:  ['QUEUED'],
  QUEUED:    ['APPROVED', 'SNOOZED', 'DISMISSED', 'RESOLVED'],
  SNOOZED:   ['QUEUED', 'DISMISSED'],
  DISMISSED: ['QUEUED'],
  APPROVED:  ['APPLYING', 'QUEUED', 'FAILED'],
  APPLYING:  ['VERIFYING', 'FAILED'],
  VERIFYING: ['VERIFIED', 'FAILED'],
  VERIFIED:  ['MEASURED', 'QUEUED'],
  MEASURED:  ['QUEUED'],
  FAILED:    ['QUEUED', 'DISMISSED'],
  RESOLVED:  ['QUEUED'],
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

- Reject illegal transitions with 409 naming both states. No silent no-ops.
- Append to `transitions` on every change.
- `DISMISSED` requires a non-empty reason.
- A nightly job moves `SNOOZED` rows past `snoozeUntil` back to `QUEUED`.

#### 3. Three buckets

New file `src/modules/opportunities/bucket.util.ts`:

```typescript
export type Bucket = 'NEEDS_YOU' | 'IN_PROGRESS' | 'DONE';

export const BUCKET_OF: Record<FindingLifecycle, Bucket | null> = {
  DETECTED:  null,
  QUEUED:    'NEEDS_YOU',
  FAILED:    'NEEDS_YOU',
  SNOOZED:   null,
  APPROVED:  'IN_PROGRESS',
  APPLYING:  'IN_PROGRESS',
  VERIFYING: 'IN_PROGRESS',
  VERIFIED:  'DONE',
  MEASURED:  'DONE',
  RESOLVED:  'DONE',
  DISMISSED: 'DONE',
};
```

Only `NEEDS_YOU` carries a count badge anywhere. In-progress work must never demand attention — no red, no badge, no notification.

#### 4. Repoint and promote the queue

Rewrite `growthx-ai-seo/src/app/(dashboard)/action-queue/page.tsx`:

- Data source: `useFindings(projectId)` hitting `GET /projects/:id/findings` from task 3. Keep existing layout language (`PageHeader`, `Panel`, `Pill`, `Tabs`, `NotConnected`).
- Tabs: **Needs you (n) · We're on it · Done**.
- Filter chips: source (Audit / AI Visibility / GBP / Competitors) and fix class (Fix it / Review / Draft).
- Primary action: **"Fix all safe (n)"** — bulk-approves every `QUEUED` finding with `fixClass = AUTO`.
- Each row: severity stripe, plain-language title, source chip, "29 pages", impact score, three controls: **Fix it / Not now / Why?**
- **Why?** expands in place — never navigates. Four blocks in order:
  1. What's wrong — plain sentence plus evidence
  2. What it matters — traffic or revenue number, or honest "connect Search Console"
  3. The fix — diff preview, drafted copy, or the GBP field
  4. Apply — Fix it / Create PR / Assign / Dismiss (reason required)
- **Not now**: snooze menu — 1 week / 1 month / until it gets worse.

Route `/action-queue` as the default landing route for a selected client. Add to `sidebar.tsx` as the first item, labelled **Action Queue**, with `NEEDS_YOU` count as tag and `tagTone: "danger"` only when a `CRITICAL` is present.

#### 5. Fix the Fix Engine contradiction

Currently renders both "Plan Approved & Active / Executing" and "Needs Generation" in one viewport. Replace with exactly one plan state:

| State | Shows |
|-------|-------|
| `NOT_GENERATED` | "Generate plan" and nothing else |
| `GENERATED` | plan summary + "Approve plan" |
| `EXECUTING` | progress, current item, "Pause" |
| `COMPLETE` | results + certificates |

Also:
- **Remove the guaranteed forecast.** Replace "Technical Issues 100 → 0" and "SEO Health 89 → 100" with a range and caveat, or remove. Never promise a perfect score.
- **Fix category maths.** Derive categories from actual approved findings.
- **Collapse navigation** from 5-step stepper + 5 sub-tabs + 4 sidebar children to: keep the stepper, drop the sub-tabs.
- Fix Engine's job: show the running plan and Fix History with certificates and rollback.

### Acceptance criteria

- [ ] Every lifecycle change goes through `LifecycleService`. Grep for direct `lifecycle:` writes outside it.
- [ ] An illegal transition returns 409 with both state names.
- [ ] Dismissing requires a reason; appears in the audit trail.
- [ ] Snoozing for a week hides the row and returns it in seven days.
- [ ] `/action-queue` is reachable from the sidebar and is the default client route.
- [ ] "Fix all safe" approves only `fixClass = AUTO`.
- [ ] Fix Engine shows exactly one plan state at a time.
- [ ] No screen promises a specific future score.

### Tests to add

**`src/modules/opportunities/lifecycle.service.spec.ts`**
- Every legal transition succeeds; a representative illegal set throws 409.
- `transitions` is append-only and never loses an entry.
- Dismiss without a reason is rejected.
- Snooze expiry returns the row to `QUEUED`.

**`src/modules/opportunities/bucket.util.spec.ts`**
- Every `FindingLifecycle` value maps to a bucket or explicit null. Fails when someone adds a state and forgets the mapping.

### Do not

- Do not delete the legacy `status` column in this task.
- Do not delete `/action-engine`, `/geo-tracking` or any other route. Route consolidation is a separate task.
- Do not add a notification for anything in `IN_PROGRESS`.

---

## Task 5

### Rewrite all 25 issue types for someone who doesn't know what a meta tag is

> Independent of Task 6. Assumes Tasks 1–4. Paste this section into Claude Code from the repo root.

### Goal

Today a queue row reads:

> `SCHEMA PRODUCT OFFERS — https://www.aivaenterprises.com/products/tomato`
> `Missing offers property in Product schema. HIGH`

Nobody outside SEO knows what that means. This task adds a presentation layer that turns every finding into three sentences.

### The three-sentence rule

| Sentence | Answers | Rule |
|----------|---------|------|
| **1 · What's wrong** | "What is broken, in my words?" | No SEO vocabulary — no schema, canonical, H1, crawl budget, indexation, GEO. Lead with the count |
| **2 · What it costs** | "Why should I care today?" | Real Search Console number, or say there isn't one. Never invent one |
| **3 · What we'll do** | "What happens if I click?" | What changes, what does not, how long, and that it is reversible |

Keep the technical string behind a **Technical details** expander.

### Implementation

New file `src/modules/issues/issue-copy.ts`:

```typescript
export interface IssueCopy {
  title: string;     // {n} replaced with affectedCount
  cost: string;      // {traffic} replaced with GSC share, or dropped if null
  action: string;
  fixClass: 'AUTO' | 'APPROVAL' | 'MANUAL';
  technical: string; // shown only in Technical details expander
}

export const ISSUE_COPY: Record<string, IssueCopy> = { /* table below */ };

export function renderCopy(
  issueType: string,
  ctx: { n: number; traffic?: number | null },
): { title: string; cost: string; action: string }
// {n} -> ctx.n, pluralise "page"/"pages"
// {traffic} -> `${ctx.traffic}% of your search traffic`
// when ctx.traffic is null, drop the sentence containing {traffic}; never print "null%"
```

Wire `renderCopy` into `IssueGroup` (task 2) and `WebsiteAuditAdapter` (task 3). Frontend renders strings; it never builds them.

A unit test must assert every `issueType` emitted by `issue-engine.service.ts` has an entry in `ISSUE_COPY`.

### The table — all 25 types

`{n}` = affected page count, `{traffic}` = GSC traffic share.

| `issueType` | Title (sentence 1) | Cost (sentence 2) | Action (sentence 3) | `fixClass` |
|-------------|-------------------|-------------------|---------------------|-----------|
| `MISSING_TITLE` | {n} pages have no name in Google search results | These pages get {traffic}. Google invents a title from whatever text it finds, and it is usually wrong | We'll write a clear title for each page using what the page is actually about. This shows in the browser tab and in search results — nothing on the page itself changes. Reversible any time | `AUTO` |
| `LONG_TITLE` | {n} page titles get cut off halfway in Google | Shoppers see "Fresh Organic Tomatoes — Best Quality Whole…" and can't tell what you sell. These pages get {traffic} | We'll shorten each title to fit, keeping the important words at the front. Your page content doesn't change | `AUTO` |
| `SHORT_TITLE` | {n} page titles are too short to tell Google what the page is | A two-word title competes badly against a competitor's descriptive one. These pages get {traffic} | We'll expand each title with what the page actually covers. Nothing on the page changes | `AUTO` |
| `DUPLICATE_TITLE` | {n} pages share the same name in search results | Google can't tell these pages apart and often shows only one of them, so the rest never appear | We'll make each title specific to its own page. Page content is untouched | `AUTO` |
| `MISSING_META_DESCRIPTION` | {n} pages let Google write their own description — usually badly | The grey text under your link in search results is your sales pitch. Right now Google picks a random sentence. These pages get {traffic} | We'll write a short description for each page that says what's on it and why to click. Invisible on your site, visible in Google | `AUTO` |
| `LONG_META_DESCRIPTION` | {n} search descriptions get cut off mid-sentence | Your pitch ends in "..." before it reaches the point | We'll trim each to fit, keeping the strongest part. Nothing on your site changes | `AUTO` |
| `MISSING_ALT_TEXT` | {n} images are invisible to Google and to blind visitors | Image search sends free traffic you're not collecting, and screen readers skip these entirely — which is also an accessibility risk | We'll describe each image in a short line of hidden text. Your images look exactly the same | `AUTO` |
| `MISSING_CANONICAL` | {n} pages don't tell Google which version is the real one | When the same page is reachable by several addresses, Google splits the credit between them and all versions rank worse | We'll mark the main version of each page. Invisible to visitors | `AUTO` |
| `BROKEN_CANONICAL` | {n} pages point Google at a page that doesn't exist | Google is being told "the real version of this page is over there" — and there is nothing there, so it may drop the page entirely | We'll point each page at itself or at the correct version | `AUTO` |
| `CANONICAL_CROSS_DOMAIN` | {n} pages tell Google the real version is on someone else's website | You are handing your search credit to another domain. If this wasn't deliberate, it is costing you every ranking on those pages | We'll point each page back to your own site. Flagged for your confirmation first if the other domain is one of yours | `APPROVAL` |
| `NOT_IN_SITEMAP` | {n} pages aren't on the map you give Google | Google may take weeks to find these pages, or never find them. New pages suffer most | We'll add them to your sitemap. Nothing visible changes | `AUTO` |
| `NOINDEX_DETECTED` | {n} pages are telling Google not to show them at all | These pages cannot appear in search results, no matter how good they are. Often left over from a site build | We'll remove the instruction after you confirm each page should be public — some pages are hidden on purpose | `APPROVAL` |
| `INCORRECT_ROBOTS` | Your site is blocking Google from parts of it | Anything blocked cannot rank. This is a site-wide setting, so the damage is broad | We'll propose a corrected rules file for your approval. This one is worth a careful look before it ships | `APPROVAL` |
| `MISSING_H1` | {n} pages have no headline | The main heading tells both visitors and Google what the page is about in one line. Without it, both are guessing. These pages get {traffic} | We'll add a headline to each page. This is visible on your site, so you'll see a preview and approve it first | `APPROVAL` |
| `MULTIPLE_H1` | {n} pages have several competing headlines | When everything is the headline, nothing is. Google can't work out the page's main subject | We'll keep the most relevant one as the headline and demote the rest. Visible change — you'll approve a preview | `APPROVAL` |
| `BROKEN_LINK_4XX` | {n} links on your site lead to pages that don't exist | Visitors hit a dead end and leave. Google reads broken links as a sign the site is unmaintained | We'll show you each broken link with a suggested replacement, and fix them once you confirm | `APPROVAL` |
| `BROKEN_IMAGE` | {n} images don't load | Visitors see a broken icon where a product photo should be. On a product page this kills the sale | We'll list each one so you can re-upload, and remove any that are genuinely gone | `APPROVAL` |
| `REDIRECT_CHAIN` | {n} pages bounce visitors through several addresses before arriving | Every extra hop slows the page and leaks a little ranking strength. On mobile this is felt | We'll point the first address straight at the final one | `APPROVAL` |
| `REDIRECT_LOOP` | {n} pages send visitors round in circles and never load | These pages are completely unreachable — for visitors and for Google | This needs a look at your redirect rules, which usually live in your hosting settings. We'll show you exactly which rules conflict | `MANUAL` |
| `SERVER_ERROR_5XX` | {n} pages are returning an error instead of loading | Your server is failing on these pages. If Google keeps hitting errors it stops crawling the site as often | This is a hosting or application problem we can't patch from here. We'll show you the failing addresses and the error so your developer can act | `MANUAL` |
| `MIXED_CONTENT` | {n} secure pages are loading insecure content | Browsers show a "not secure" warning, and some block the content outright. On a checkout page this loses orders | We'll switch each insecure reference to its secure version. Visual check before it ships | `APPROVAL` |
| `HTTPS_ISSUE` | Your site's security certificate has a problem | Visitors may see a full-page browser warning before they reach you. Almost nobody clicks past that | This is fixed with your hosting provider, not in your site's code. We'll show you exactly what's wrong so you can pass it on | `MANUAL` |
| `LARGE_HTML` | {n} pages are unusually heavy and slow to load | Slow pages lose visitors before they see anything, and Google uses speed as a ranking signal. Worst on mobile data | We'll identify what's making each page heavy and propose specific reductions for your approval | `APPROVAL` |
| `THIN_CONTENT` | {n} pages have too little content to rank for anything | Google treats near-empty pages as low value, and having many of them can drag down the whole site | We'll draft fuller content for each page. You review and publish — we never publish words in your voice without you reading them | `MANUAL` |
| `URL_STRUCTURE_ISSUE` | {n} page addresses are hard for people and Google to read | Addresses full of codes and numbers get fewer clicks than readable ones and say nothing about the page | We'll propose cleaner addresses with redirects from the old ones, so no existing link breaks. Approve before it ships | `APPROVAL` |

### Beyond the crawler

| Finding | Title | Cost | Action |
|---------|-------|------|--------|
| AI Visibility — brand absent | ChatGPT names {n} competitors when asked about "{prompt}", and never you | People increasingly ask an AI instead of searching. In this category you currently don't exist in that answer | We'll draft the page and the facts these tools look for when answering this question. You review before it's published |
| GBP — no recent posts | Your Google listing has been silent for {n} days | Google favours active listings in the local map results, and a stale listing looks closed | We'll draft posts for you. One click to publish each |
| GBP — unanswered reviews | {n} reviews have no reply | Replying publicly is the cheapest reputation work there is, and Google counts engagement | We'll draft a reply to each in your tone. You read it and send it |
| Competitor — keyword gap | {competitor} shows up for {n} searches where you have no page at all | These are customers actively looking for what you sell, going somewhere else | We'll write a brief for each page worth creating, ranked by how much traffic it could bring |

### Style rules

1. Lead with the number. `{n} pages...` every time.
2. Second person, active voice. "Your listing", "we'll write", never "the meta description should be optimised".
3. Never promise a ranking outcome. "This helps Google understand the page", never "this will get you to page one".
4. Say what does not change. For every `AUTO` fix, state the page looks the same.
5. Be honest about missing data. With no GSC, cost sentence becomes "We can't measure how much traffic this affects until Search Console is connected".
6. Never say the product found "issues". Say what's wrong.

### Acceptance criteria

- [ ] All 25 types have entries; the completeness test passes.
- [ ] No string in `ISSUE_COPY` contains: `schema`, `canonical`, `H1`, `meta`, `crawl`, `index`, `SERP`, `GEO`, `LLM`, `4XX`, `5XX` — outside the `technical` field. Write a lint test.
- [ ] `{traffic}` never renders as `null`, `undefined` or `NaN`.
- [ ] Pluralisation correct at n = 1 ("1 page has", not "1 pages have").
- [ ] Every queue row has at most three controls.
- [ ] Technical details expander exposes raw `issueType`, `dedupKey`, evidence and full URL list.

### Tests to add

**`src/modules/issues/issue-copy.spec.ts`**
- Every `issueType` in `issue-engine.service.ts` has copy. Derive the list by reading the source.
- Jargon blocklist test over `title`, `cost` and `action`.
- `renderCopy` with `traffic: null` produces no placeholder artefacts.
- n = 1 pluralisation.

---

## Task 6

### Turn on the hold arm

> Independent of Task 5. Assumes Tasks 1–4. Paste this section into Claude Code from the repo root.

### Goal

`FixIntervention.arm` already exists with values `TREAT` and `HOLD`. `InterventionOutcome` already stores the difference-in-differences fields. None of it is being written. This task switches it on.

### Why this is the priority it is

A crawler is a commodity. AI visibility tracking will be a checkbox feature within a year. Measured causal lift is not. Every other SEO tool reports correlation. GrowthX can report causation because it makes the change and measures after.

The dataset only has value once it has history. **The clock does not start until this ships.**

### Changes

#### 1. Assign an arm at approval

New file `src/modules/impact/arm-assignment.service.ts`:

```typescript
@Injectable()
export class ArmAssignmentService {
  assign(finding: GrowthOpportunity, config: HoldConfig): 'TREAT' | 'HOLD'
}

export interface HoldConfig {
  holdRate: number;       // share held back, 0-1. Start at 0.10
  neverHold: string[];    // issue types never held back
  minGroupSize: number;   // minimum group size before any member is held
}
```

Rules:
- Hash `finding.id` to a stable 0–1 value; `HOLD` when below `holdRate`.
- **Never hold:** `SERVER_ERROR_5XX`, `REDIRECT_LOOP`, `HTTPS_ISSUE`, `MIXED_CONTENT`, `BROKEN_IMAGE`, `BROKEN_LINK_4XX`, `NOINDEX_DETECTED`.
- Only hold within groups of at least `minGroupSize` (default 8).
- Only hold `AUTO` and `APPROVAL` classes.
- Per-client opt-out, default on — see section 4.

#### 2. Write the intervention

At fix execution time, write a `FixIntervention` for both arms:

| Field | `TREAT` | `HOLD` |
|-------|---------|--------|
| `arm` | `TREAT` | `HOLD` |
| `url` | affected URL | affected URL |
| `changeClass` | mapped from `issueType` | same |
| `beforePageId` | pre-fix Page row | same |
| `shippedAt` | when shipped | `null` — a HOLD never ships |
| `summary` | one line of what changed | one line of what would have changed |

Add static map `issueType -> ChangeClass` in `src/modules/impact/change-class.ts`. Existing `ChangeClass` enum: `SCHEMA_MARKUP`, `FAQ_BLOCK`, `ENTITY_DISAMBIGUATION`, `HEADING_STRUCTURE`, `COMPARISON_TABLE`, `AUTHOR_CREDENTIALS`, `INTERNAL_LINKS`, `FRESHNESS_UPDATE`.

#### 3. Measure at +7 and +30

New file `src/modules/impact/outcome-measurement.service.ts`, scheduled daily:

```typescript
@Injectable()
export class OutcomeMeasurementService {
  async measureDue(windowDays: 7 | 30 | 60 | 90): Promise<number>
}
```

For each intervention due:
- `preCitationRate` / `postCitationRate` — from `PromptCheck` (AI visibility) or `GscDailyMetric` (search). Pre-window = same length immediately before.
- `controlPreRate` / `controlPostRate` — same measurement over the HOLD arm.
- `lift` — difference-in-differences: `(post - pre) - (controlPost - controlPre)`.
- Sample sizes — actual counts.

Write `lift = null` when no matching hold arm or any sample below floor (default 5).

Write one row per `assistant` and one with `assistant = null`. Guard duplicate insertion in the service.

#### 4. Tell the client the truth

A per-project setting **Measurement holdback**, on by default, worded plainly:

> "We hold back a small random share of low-risk fixes for 30 days so we can measure what the others actually gained. Nothing urgent or customer-facing is ever held back, and held items are applied automatically at the end of the window. Turn this off and your fixes all ship immediately — you'll still get results, just not measured ones."

- Held items are **applied automatically** when the measurement window closes. A scheduled job promotes `HOLD` interventions to shipped at `+windowDays`.
- Held findings appear in the queue as "Measuring — applies in N days", in the **We're on it** bucket.
- Never hold on a client whose setting is off.

#### 5. Surface the results

- **Fix History row:** "Applied 12 Aug · verified 12 Aug · +14% impressions vs held-back control, 30 days". When `lift` is null: "measured, no control group".
- **Client report:** measured outcomes only. No lift, no claim.
- **Aggregate view, internal first:** average lift by `changeClass` across all projects with sample sizes. This is the asset.

### Acceptance criteria

- [ ] Arm assignment is deterministic — running twice on the same finding gives the same arm, always.
- [ ] No `neverHold` type is ever assigned `HOLD`, at any `holdRate` including 1.0.
- [ ] Groups below `minGroupSize` are all `TREAT`.
- [ ] A `HOLD` intervention has `shippedAt = null` until its window closes, then applied automatically.
- [ ] `lift` is null whenever there is no matching control or a sample is under the floor.
- [ ] Clients with holdback off get zero `HOLD` rows.
- [ ] Held findings are visible in the queue with their apply date.

### Tests to add

**`src/modules/impact/arm-assignment.service.spec.ts`**
- Determinism across repeated calls.
- `neverHold` respected at `holdRate = 1.0` — the safety test.
- `minGroupSize` boundary at n−1, n, n+1.
- Distribution within tolerance of `holdRate` over 10,000 synthetic ids.

**`src/modules/impact/outcome-measurement.service.spec.ts`**
- Difference-in-differences arithmetic against a hand-computed fixture.
- Null lift with no control arm.
- Null lift below the sample floor.
- No duplicate rows for the same `(intervention, assistant, windowDays)`.

### Do not

- Do not hold back a fix on a client who has not been shown the setting.
- Do not report a lift without its sample size next to it.
- Do not let a hold expire without applying the fix.
- Do not start with `holdRate` above 0.10.

---

*End of GrowthX Workflow Spec — generated from HEAD 22 Sep 2026.*
