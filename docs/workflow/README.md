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
