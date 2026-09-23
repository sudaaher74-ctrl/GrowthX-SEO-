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
