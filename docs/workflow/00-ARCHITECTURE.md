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
