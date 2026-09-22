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
