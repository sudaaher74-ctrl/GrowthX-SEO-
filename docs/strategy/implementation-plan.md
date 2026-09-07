# GrowthX — AI SEO Automation: Implementation Plan

Written after inspecting the codebase (spec STEP 1–4), before building (STEP 5+).
It records what already exists, what must not be touched, and what is genuinely
missing — so that later phases extend rather than rebuild.

**Baseline at time of writing:** 44 backend modules, 51 frontend routes,
104 test suites / 1093 tests passing.

---

## 1. What already exists

The single most important finding: **most of the spec is already built.** The
plan below is therefore mostly about connecting and correcting, not creating.

| Spec section | Status | Where it lives |
|---|---|---|
| §6 AI Router | **Exists** | `ai-search/multi-ai-router/` — provider chain, refusal fallback, JSON-validity fallback, per-model rates with honest nulls |
| §7 Task routing | **Extended** | 14 spec task types added, mapped to 3 routing profiles |
| §9 Cost tracking | **Built now** | `AiUsageRecord` + `AiUsageService` |
| §10 AI visibility | Partial | `ai-visibility/` — citation detector, AEO analysis, scheduler |
| §17 Fix engine | **Exists** | `autonomous-engineer/` — issue-analysis, repository-understanding, file-selection, validation, verification, git agents + orchestrator |
| §18 Crawler | **Exists** | `crawler/` (19 files) — reuse, do not duplicate |
| §19 Issue engine | **Exists** | `issues/`, `analyzer/` |
| §20 Opportunity engine | **Exists** | `opportunities/` — detection service + scheduler |
| §23–24 PR flow | **Exists** | `automation/`, `autonomous-engineer/agents/git/` |
| §27–30 Local SEO | Partial | `local-seo/` — gbp-analyzer, gbp-autofix, geo-grid, reviews |
| §32 Competitor Intelligence | **Exists — protected** | `competitor-action-engine/` (19 files) + `/competitor-intelligence` |
| §46 Integrations | Partial | `integrations/` — google, GBP (+ facebook/youtube, now out of scope) |

---

## 2. What must not be touched

Per spec §2, §55:

- `/website` route, `crawler/`, `analyzer/`, `issues/` — **Website Audit**
- `/competitor-intelligence` route, `competitor-action-engine/` — **Competitor Intelligence**

Both are treated as read-only for the purposes of this plan. New features
connect *to* them; nothing rewrites them.

---

## 3. Real gaps, in priority order

These are the things the spec asks for that the code genuinely cannot do today.
Ordered by what blocks the most downstream work.

### ~~G1 — The citation schema cannot record the product's core loop~~ **(closed)**

`PromptCheck` stores `cited`, `position`, `citedUrl`, `competitorsCited`,
`answerExcerpt`. It has **no geographic dimension**, **no foreign key to the page
state at check time**, and **no link to the fix that shipped**.

The loop in §5 and §48 is measure → fix → re-measure delta. The schema records
term one and term three as unrelated rows and discards term two. §33 (Impact
Engine) and §34 (Experiments) cannot be built on it, because "which change
preceded which citation movement" is not reconstructable after the fact.

Everything in §15 ("Why Did I Lose?"), §33 and §34 depends on fixing this first.
Every week run in the current shape is a week of measurement that can never be
turned into evidence.

**Closed.** `PromptCheck` now carries `locationId`, `metroId`, `latitude` and
`longitude`. `FixIntervention` records each change under a closed `ChangeClass`
vocabulary with an `InterventionArm` of TREAT or HOLD, pointing at the `Page`
rows either side of it — `Page` is already a per-crawl snapshot with a
contentHash, headings, metadata and schemas, so it is reused rather than
duplicated. `InterventionOutcome` stores the measured result per engine per
window. `ImpactService` computes difference-in-differences against the hold arm
and returns `lift: null` with an `OBSERVED_CHANGE` interpretation when there are
no holds, rather than passing a raw before/after difference off as an effect.

### ~~G2 — `LocalLocation.projectId` is `@unique`~~ **(closed)**

**Closed.** Locations are many-per-project, keyed on (project, place) so
reconnecting a listing updates it rather than adding a duplicate to the bill.
Coordinates and a Places id were added, which is what makes a geo grid centre on
the right storefront. Bulk operations across locations (§31) are still to build,
but they are now representable.

### ~~G3 — Geo-grid results are never persisted~~ **(closed — and it was worse than that)**

The grid did not merely fail to persist — it was **entirely fabricated**. Ranks
came from `1 + distancePenalty + quadrantBias`, competitor names from a template
pool, and ratings and review counts were hardcoded. Nothing queried a ranking
source. Persisting that would have poisoned the one asset worth having, because
a fabricated history cannot be told apart from a real one afterwards.

**Closed.** Ranks now come from a Google Places query issued at each coordinate,
biased to that coordinate. Absence is recorded as null rather than a sentinel
rank. The scan refuses when Places is unconfigured or the location has no
coordinates, instead of defaulting to central Mumbai as it did. Runs are stored
as `GeoGridRun` / `GeoGridPoint` / `GeoGridCompetitor` with history endpoints.

### ~~G4 — Two competing AI provider abstractions~~ **(closed)**

`ai-engine/AiProviderFactory` (env-configured chain, 4 providers) and
`ai-search/MultiAiRouterService` (task-routed, 6 providers, cost-aware) both
exist. §6 requires that the rest of the application talk to *one* router.
**Closed.** `UnifiedAiService` now runs every intelligence task through
`MultiAiRouterService`, so task routing, refusal and JSON-validity fallback,
budget enforcement and the spend ledger apply to them — previously the most
expensive calls in the product were the ones nobody could account for. Each task
is filed under its own `AiTask`, so the ledger reads by product surface.
`AiProviderFactory`, its four vendor classes and `IAiProvider` are deleted.
`generateSocialStrategy` and `generateMarketingStrategy` went with them, per §3
and §49.

### G5 — No engine adapters for the public answer surfaces *(§10)*

§10 is explicit that calling a model API is not the same as measuring that
product's public answer experience. Asking the Claude API what it recommends
does not measure what ChatGPT's search product shows a user. Today's checks
conflate the two. Separate adapters per engine, with each one's real access
method, are needed before AEV numbers can be claimed to mean what §12 says.

### G6 — Missing measurement surfaces *(§33, §34)*

No routes or models for Impact, Experiments, Deployments, or standalone Pull
Requests. These are the §51 Phase 7 items and depend entirely on G1.

---

## 4. Sequencing

Following spec §51, corrected for what already exists.

| Phase | Work | Status |
|---|---|---|
| 1 | Protect and stabilise: verify Website Audit, Competitor Intelligence, crawler, auth, database | **Done** — 104/1093 green baseline established and re-verified |
| 2 | AI Router: task types, usage tracking, budgets | **Done** |
| 2b | Retire the duplicate provider abstraction (G4) | **Done** |
| 3 | AI Visibility: geo dimension (G1) done; engine adapters (G5) outstanding | **G5 is the remaining gap** |
| 4 | Opportunity / Winning Page / "Why Did I Lose?" — extend `opportunities/` and Competitor Intelligence, do not duplicate | Next |
| 5 | Fix Engine — substantially built; needs to call `ImpactService.recordIntervention` when it opens a PR so the ledger fills | Next |
| 6 | Local SEO — geo grid (G3) and multi-location (G2) done; bulk operations across locations outstanding | Partly done |
| 7 | Impact + Experiments (§33, §34) with a control arm | **Done** (service + API; no UI yet) |
| 8 | Alerts, reporting | Last |

**G1, G2, G3 and G4 are closed.** The remaining work, in order:

1. **Wire the fix engine to the ledger.** `ImpactService.recordIntervention` is
   built and nothing calls it yet. Until the autonomous engineer records a
   `FixIntervention` when it opens a PR, and a `HOLD` when a fix is identified
   and declined, the ledger stays empty and none of §33 or §34 has anything to
   measure. This is the highest-value remaining ticket and it is small.
2. **G5 — engine adapters.** Still the correctness problem: asking the Claude
   API a question does not measure what ChatGPT's search product shows a user,
   and today's checks conflate the two.
3. Impact and Experiments UI; bulk operations across locations.

---

## 5. Done in this change

- **§3/§4** — Content Studio and Social Media removed from primary navigation.
  Their routes still resolve, so existing links do not 404, and their source is
  untouched per "deprecate, do not necessarily delete". Navigation regrouped
  into SEO / Local SEO / Measurement / Automation. Website Audit and Competitor
  Intelligence keep their existing routes, aliases and issue-count badge.
  Only routes that actually exist are linked — no navigation to unbuilt pages.
- **§7** — 14 task types added to the router, mapped to three routing profiles.
  The three original task names still route exactly as before.
- **§9** — `AiUsageRecord` ledger: org, project, task, provider, model, tokens,
  cost, latency, status. Written for failures as well as successes. Recording
  is best-effort and never fails the AI call.
- **§8** — Per-organization monthly budget (`Organization.aiMonthlyBudgetUsd`),
  enforced *before* the provider call rather than reported after.
- **§7** — `allowFallback: false` for callers whose configuration prohibits
  silent vendor switching.
- Cost reporting states how many calls it could not price rather than guessing
  (§42 applied to spend, not just metrics).

Not done, deliberately: nothing in G1–G6. Those are separate changes, and G1
should be argued through before it is built, because it decides what the
product can ever prove.
