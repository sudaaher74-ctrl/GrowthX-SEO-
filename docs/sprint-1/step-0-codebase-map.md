# Sprint 1 — Step 0: Codebase Map & Mock-Data Inventory

Produced by reading the code, not the live dashboard. Where this contradicts the
Sprint 1 brief, the codebase is authoritative and the contradiction is called out.

---

## 1. Repository shape

A two-package monorepo, not a single app.

| Path | What it is |
|---|---|
| `growthx-ai-crawler/` | NestJS backend. ~70 feature modules under `src/modules/`. Prisma + Postgres. |
| `growthx-ai-seo/` | Next.js frontend (App Router). ~45 dashboard routes under `src/app/(dashboard)/`. |
| `docs/` | Existing architecture + strategy notes. |

Backend module layout relevant to this sprint:

| Concern | Location |
|---|---|
| Projects | `src/modules/projects/` |
| Crawling | `src/modules/crawler/` (30 files: `discovery/`, `fetch/`, `frontier/`, `url/`) |
| Issue detection | `src/modules/issues/` (`issue-engine.service.ts`, `health-score.util.ts`) |
| Page analysis | `src/modules/analyzer/` (content, image, link, schema-validator) |
| Competitors | `src/modules/market-research/` (discovery/verification), `src/modules/competitor-action-engine/` |
| Google integrations | `src/modules/integrations/google/` (25 files) |
| Opportunities / queue | `src/modules/opportunities/` |
| Local / GBP | `src/modules/local-seo/` |
| Auth | `src/modules/auth/` |
| Queues | `src/modules/queue/` |

**There is no backend dashboard aggregation module.** The dashboard is composed
client-side in `growthx-ai-seo/src/app/(dashboard)/dashboard/page.tsx` from three
independent React Query calls (`api.opportunities`, `api.listCompetitors`,
`api.gscTimeseries`).

---

## 2. Postgres schema

`growthx-ai-crawler/prisma/schema.prisma` — **3,313 lines, ~100 models, ~40 enums.**

Core crawl chain: `Website → CrawlJob → Page → {Issue, Image, Link, Schema, Performance, AeoMetrics}`
plus `InternalGraph` and `CrawlFrontier` (persisted frontier, so crawls survive worker restarts).

Tenancy: `Organization → OrganizationMember → User`, `Organization → Project`.
`Project` carries ~35 relations.

Models that already cover Step 1's proposed tables:

| Step 1 proposes | Already exists | Assessment |
|---|---|---|
| `locations` | `LocalLocation` | Has `projectId`, `businessName`, `address`, `placeId`, `latitude`, `longitude`, `rating`, `reviewCount`. **Missing:** `locality`, `primary_category`, `service_radius_km`, `is_primary`, `gbp_location_id`. |
| `data_connections` | `Integration` | Richer than proposed: AES-256-GCM ciphertext, `grantedScopes[]`, `selectedResourceId`, 5-state `status`, `statusMessage`, plus append-only `IntegrationAuditEvent`. |
| `crawls` | `CrawlJob` | Has status, timings, `pagesCrawled`, `healthScore`, `qualityDiagnostics`. **Missing:** `health_score_version`. |
| `crawl_findings` | `Issue` | Has `issueType`, `severity`, `affectedUrl`, `category`, `dedupKey`. **`evidence` is `String?`, not JSONB.** No `fix_type` / `fix_payload`. No `locationId`. |
| `actions` | `GrowthOpportunity` | Already the source-agnostic unified queue C3 asks for: `source`, `category`, `evidence Json`, `fingerprint`, status machine, `priority`. **Missing:** `regressed` status, `locationId`, `fix_type`/`fix_payload`, and a `source_id` FK to the originating row. |
| `competitors` | `CompetitorDomain` | Has `placeId`, `localRating`, `localReviewCount`, `localAddress`, `city`, `confidenceScore`. **Missing:** `kind` (local/national), `discovery_method`, `distance_km`, `locationId`. |
| `metric_snapshots` | `GscDailyMetric`, `Ga4DailyMetric`, `GbpDailyMetric` | Three typed per-provider tables rather than one generic EAV table. Each already has the dimension-tuple unique constraint that makes re-sync an upsert. |

---

## 3. Mock / hardcoded / fabricated data inventory

This is the deliverable gate G3 re-runs against.

### LIVE VIOLATIONS

| # | File | Symbol | What it fakes |
|---|---|---|---|
| M1 | `growthx-ai-crawler/src/modules/opportunities/opportunity-detection.service.ts:784` | `domainBaselineSynthesis()` | **Explicit fallback synthesizer.** When every real detector returns zero, invents 3 generic opportunities ("Conduct initial on-page SEO audit", "Deploy Organization and Service Schema JSON-LD on {domain}", "Create comprehensive pillar content & FAQ section") and **persists them to `GrowthOpportunity`** so they are indistinguishable from detected findings. This is C4 exactly. |
| M2 | same file, `localSeoPresence()` ~line 441 | `local-nap-citations` | Pushed **unconditionally** — no crawl gate, no NAP comparison performed. "Evidence" is a generic claim ("NAP consistency is among the top 3 ranking factors", source: *Local Search Ranking Factors*). This is the NAP card on the live dashboard. |
| M3 | same file, `businessAndMarketGrowth()` ~line 500 | `biz-ai-geo-visibility` | Pushed **unconditionally**. Fabricated statistic: "Over 30% of commercial buyer research queries now originate in LLM search interfaces", source *GrowthX AI Search Intelligence*. |
| M4 | same file, `businessAndMarketGrowth()` ~line 512 | `biz-cro-funnel` | Pushed **unconditionally**. This is the WhatsApp lead-widget card. Fabricated statistic: "increase lead conversion rate by 2.4x", source *CRO Benchmark Data*. |
| M5 | same file, `localSeoPresence()` ~line 464 | `local-review-velocity` | Fires when `localReviews.length === 0` — i.e. **absence of data is treated as a finding**. Fabricated statistic: "Businesses with 20+ recent reviews rank 50% higher". |
| M6 | `growthx-ai-seo/src/lib/api-client.ts:2991` | `listProjects()` | On any error **or empty result**, returns six hardcoded fake projects with fake IDs: `proj-1 milquufresh`, `proj-2 Aivaenterprises`, `proj-3 OS interior`, `proj-4 dronarcheryacedeamy`, `proj-5 brandkettle`, `proj-6 immunitygroup`. Masks API failure with fiction and yields IDs that resolve to nothing. |
| M7 | `growthx-ai-seo/src/lib/api-client.ts:2985` | `listOrganizations()` | Same pattern: falls back to `{id:"org-1", name:"GrowthX"}`. |
| M8 | `growthx-ai-seo/src/app/login/page.tsx:328-341` | Founder testimonial card | Quotes **Sudarshan Aher, Founder & CEO of GrowthX**, praising GrowthX, styled as a customer testimonial. |

Additionally, several detectors that *are* gated cite invented provenance in
otherwise-real findings: sources named `GrowthX Content Intelligence`,
`GrowthX Strategy Engine`, `GrowthX SEO Engine`, `Industry Benchmark`,
`CRO Benchmark Data`, `Local Search Ranking Factors` do not resolve to any row
or document. That is a C5 violation inside findings whose *counts* are real.

### NOT violations (already cleaned)

The codebase has clearly been through a de-fabrication pass. Most `grep` hits for
mock/hardcoded are **comments recording a removal** — e.g.
`reporting.service.ts:35` ("No placeholder report is seeded here"),
`geo-grid.service.ts:127`, `auto-fix-modal.tsx:30`, `reports/page.tsx:90`,
`property-picker.tsx:82`. There is also a dedicated regression test:
`src/modules/local-seo/no-fabricated-data.spec.ts`.

Detectors that correctly gate on a completed crawl and return `[]` when there is
no data: `technicalCrawlIssues`, `onpageSeoGaps`, `structuredDataAndAeo`,
`contentDepthAndQuality`. The FAQ-hub card comes from `contentDepthAndQuality`
and **is** crawl-gated — so it is real if a crawl ran, and cannot appear if none did.

---

## 4. The crawler

Per page, `Page` persists: `finalUrl`, `statusCode`, `responseTimeMs`,
`contentType`, `title`, `metaDescription`, `canonicalUrl`, `robotsMeta`,
`h1[]`/`h2[]`/`h3[]`, `wordCount`, `readingTimeMin`, `duplicateScore`,
`contentHash`, `simHash`, `pageType` (HOME/SERVICE/PRODUCT/LOCATION/BLOG/
CASE_STUDY/FAQ/ABOUT/CONTACT/LEGAL/OTHER), plus raw + rendered HTML snapshots.
Side tables capture images (with `isMissingAlt`), links (with `isBroken`,
`isRedirect`), JSON-LD schemas (typed + validation errors) and performance.

**Findings are half-typed.** `Issue` has a typed `issueType` discriminator and a
typed `severity`/`confidence`, which is better than the brief assumes — but
`description`, `recommendation`, `explanation` and `impact` are prose columns and
`evidence` is `String?`, not JSONB. Detection logic lives in one 646-line
procedural method chain in `issue-engine.service.ts`, not a registry.

`issueType` values already implemented (26):
`MISSING_TITLE`, `DUPLICATE_TITLE`, `SHORT_TITLE`, `LONG_TITLE`,
`MISSING_META_DESCRIPTION`, `LONG_META_DESCRIPTION`, `MISSING_H1`, `MULTIPLE_H1`,
`MISSING_CANONICAL`, `BROKEN_CANONICAL`, `CANONICAL_CROSS_DOMAIN`,
`NOINDEX_DETECTED`, `REDIRECT_CHAIN`, `REDIRECT_LOOP`, `BROKEN_IMAGE`,
`MISSING_ALT_TEXT`, `NOT_IN_SITEMAP`, `ORPHAN_PAGE`, `THIN_CONTENT`,
`MISSING_SCHEMA`, `INCORRECT_ROBOTS`, `HTTPS_ISSUE`, `MIXED_CONTENT`,
`EXCESSIVE_CRAWL_DEPTH`, `LARGE_HTML`, `URL_STRUCTURE_ISSUE`,
plus fetch-diagnostic types (`FETCH_FAILED`, `JS_RENDER_REQUIRED`, …).

**Every *local* rule in Step 2 is missing** — no `LocalBusiness` JSON-LD check,
no `geo`, no `areaServed`, no NAP cross-source comparison, no `tel:` format check,
no `openingHoursSpecification`. This is the product wedge and it is the genuine gap.

Health score (`health-score.util.ts`) is already deterministic: severity weights
(CRITICAL 20 / HIGH 8 / MEDIUM 3 / LOW 1) × confidence multipliers
(CONFIRMED 1.0 / LIKELY 0.8 / ADVISORY 0.5), per-URL dedup, `MAX_PENALTY_PER_URL = 20`,
normalised by pages crawled, clamped 0–100, with a passing spec. **Missing only a
`health_score_version` stamp.**

---

## 5. What selected `bigbasket.com`

`src/modules/market-research/competitor-discovery.service.ts`.

Competitors are discovered by **SERP overlap**, not by a picker: the service
takes the client's own buyer keywords, appends a place string, runs up to 4
Tavily web searches, and treats whoever ranks as a competitor. `placeFor()`
derives the place from `ProjectBusinessProfile.city || state`, falling back to
`'Maharashtra'` / `'India'` / country.

There is a 90-entry `NOT_A_COMPANY` blocklist that strips directories and
marketplaces — it **does** contain `blinkit.com`, `zeptonow.com`, `jiomart.com`,
`amazon.in`, `flipkart.com`. It **does not** contain `bigbasket.com`.

So BigBasket ranks nationally for "milk delivery Panvel"-shaped queries, survives
the blocklist, and is stored as a competitor. **There is no geography in the
pipeline at all**: no radius, no `distance_km`, no physical-presence test, no
local/national distinction — confirmed by grep, zero hits for radius/distance in
either discovery or `competitor-local.service.ts`.

`CompetitorLocalService` *enriches* already-known competitors with their Places
listing, but performs no nearby **discovery**. Step 5's source 1 genuinely does
not exist. Adding `bigbasket.com` to the blocklist would fix this one symptom and
none of the cause.

---

## 6. Social & Video module — scope

**This is not a module. It is ~85 files, 6 frontend routes and ~17 Prisma models,
and it is load-bearing.**

Backend: `content-intelligence/` (32 files), `competitor-action-engine/` (20),
`discovery-pipeline/` (10), `integrations/youtube.{controller,service}.ts`,
`integrations/facebook.service.ts`, `crawler/social-links.ts`.

Frontend: `(dashboard)/social-media/`, `(dashboard)/content-intelligence/{calendar,campaigns,competitors,creators,outreach,strategy}/`,
`components/social/` (8 components incl. `social-viral-spy-panel.tsx`,
`social-creators-panel.tsx`, `video-script-generator-modal.tsx`).

Models: `SocialAccount`, `SocialMetric`, `SocialPost`, `SiteSocialLink`,
`CompetitorAccount`, `CompetitorContent`, `ContentClassification`,
`CreativePattern`, `PatternContentLink`, `ContentGap`, `CompetitorChangeAlert`,
`ContentStrategy`, `ContentCalendarItem`, `Campaign`, `Creator`, `CreatorMatch`,
`CreatorOutreach`.

**Entanglement:** `opportunity-detection.service.ts` — the file Step 3 rewrites —
imports `topic-match` from `content-intelligence/`. `competitor-action-engine`
supplies the content-gap analysis Step 5 explicitly wants to **keep**. A blanket
delete takes the keyword/topic matching and the content-gap engine with it.

---

## 7. BullMQ inventory

Only **two** queues exist, both crawl-related, in `src/modules/queue/queue.service.ts`:

| Queue | Payload |
|---|---|
| `crawl-jobs` | `CrawlJobPayload` |
| `page-fetch` | `PageFetchPayload` |

Redis via `ioredis`, `maxRetriesPerRequest: null`, `lazyConnect`, TLS for
`rediss://`. A `ready` promise resolves the module-ordering race that previously
left crawls enqueued with no consumer. There is a synchronous fallback path when
Redis is absent. **No dead-letter queue, and no per-queue retry/backoff config.**

Scheduled work does **not** use BullMQ — it uses `@nestjs/schedule` `@Cron`:
`google-sync.scheduler.ts` (`0 4 * * *`), `opportunity-detection.scheduler.ts`,
`content-intelligence.scheduler.ts`, `market-research.scheduler.ts`,
`ai-visibility.scheduler.ts`, `scheduler.service.ts`, plus two in
`discovery-pipeline/`. Each guards re-entry with a `running` flag.

---

## 8. Auth & secrets

App auth: JWT (`@nestjs/jwt`) + bcrypt, `JwtStrategy`/`JwtAuthGuard`, `RolesGuard`
+ `@Roles()`, `google.strategy.ts` for Google *login* (distinct from data OAuth).
Secret from `src/config/secrets.ts`.

Google **data** OAuth is separate and already built: `google-oauth.service.ts`,
`google-oauth.controller.ts`, signed `oauth-state.ts`, `google-provider.ts`.
Scopes are **per-provider and incremental**, not one combined grant:

- `search_console` → `webmasters.readonly`
- `analytics` → `analytics.readonly`
- `business_profile` → `business.manage`

Tokens: `token-crypto.ts`, AES-256-GCM, 96-bit random IV per encryption,
`v1` format prefix, key from `INTEGRATION_TOKEN_KEY`, read per-call so a process
without the key still boots. A prior connector that stored plaintext tokens was
removed and its rows deleted by migration.

---

## 9. Contradictions with the brief

Ordered by how much they change the plan.

**C-1 — Step 4 is ~90% already built.** OAuth, encrypted tokens, incremental
scopes, three provider services, daily cron sync, `GscDailyMetric` /
`Ga4DailyMetric` / `GbpDailyMetric`, `DataSyncJob` failure history,
`IntegrationAuditEvent`, and a `connection-lifecycle.spec.ts`. The brief
sequences this last because of Google verification latency; most of the *code*
does not need writing. Remaining real work: GA4 `sessionSource` capture, GBP
quota-pending as a distinct state, dead-letter/backoff.

**C-2 — The unified action queue already exists.** `GrowthOpportunity` is
documented in-schema as "the unified surface: search, competitor, website, local
and analytics findings in one list", with a stable `fingerprint` that survives
dismissal. Creating a new `actions` table would duplicate it and violate C3's own
spirit. Recommend **extending** it (`regressed` status, `locationId`, `sourceId`
FK, `fixType`/`fixPayload`) rather than adding a table.

**C-3 — "Delete the Social & Video module" is far larger than stated** (§6) and
would destroy the content-gap engine Step 5 depends on. Recommend deleting the
*user-facing surface* (routes, nav, `components/social/`, creator/viral/video
features) while keeping `topic-match` and the competitor content-gap internals,
then removing tables in a second pass once nothing imports them.

**C-4 — G1 cannot be run as written.** There is no
`GET /api/projects/:id/dashboard`; the dashboard composes client-side. Separately,
`"Not Configured"` / `"Not Connected"` are **not fabricated API values** — they
are labels in `components/ui/truthful-state.tsx`, an existing honest-empty-state
library with a `MetricState` union (`MEASURED | ESTIMATED | UNAVAILABLE |
NOT_CONFIGURED | NOT_CONNECTED`) that already renders "what is missing / why it
matters / what to do / which button". The dashboard reading "Not Connected" is the
system working. G1 should be restated as: no endpoint returns a *fabricated*
value in place of an empty state.

**C-5 — The four cards are not hardcoded UI.** They are unconditional detectors
plus an explicit fallback synthesizer (M1–M4). The mechanism matters: they are
*persisted* as `GrowthOpportunity` rows, so deleting frontend code would not
remove them — the rows must be deleted and the detectors gated.

**C-6 — Findings are already typed, just not structured.** `issueType` +
`severity` + `dedupKey` exist with 26 rule types covering nearly all of Step 2's
technical and content lists. C1's real gap is `evidence String?` → JSONB, plus
`fixType`/`fixPayload`, plus extracting the 646-line procedural chain into the
declarative registry. Not a rebuild.

**C-7 — Health score is already deterministic and tested.** Only
`health_score_version` is missing. G5's first half largely passes today.

**C-8 — The genuine greenfield work is smaller and sharper than the brief
assumes**, and it is exactly the wedge:
1. The six **local** SEO rules (none exist).
2. **Geo-aware competitor discovery** — Places Nearby, `distance_km`,
   local/national classification (none exists).
3. **Location as a first-class dimension** — extend `LocalLocation`, thread
   `locationId` through findings/opportunities/competitors/metrics.
4. Deleting M1–M8.

