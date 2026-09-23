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
