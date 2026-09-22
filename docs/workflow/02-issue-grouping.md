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
