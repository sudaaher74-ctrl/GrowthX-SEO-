# Reigel Recommendation Intelligence 3.0

Reigel extends its production Backlink Intelligence suite into an evidence-based
recommendation intelligence engine. Rather than merely reporting raw link counts,
Reigel identifies which publishers recommend competing businesses, explains why
they were selected based on visible article criteria, surfaces actionable presentation
gaps on the customer's own website, computes an explainable recommendation readiness
score, provides a personalized improvement plan, and manages controlled, human-approved
editorial outreach.

This capability operates entirely within Reigel's existing self-hosted infrastructure:
it requires **no Semrush, Ahrefs, DataForSEO, paid model subscriptions, or search engine scraping**.

## 1. Core Workflow

```text
DISCOVER (monitored sources linking to competitors)
  ↓
VERIFY (live robots-aware, SSRF-protected fetch via BacklinkFetcher)
  ↓
ANALYZE (extract featured competitors, stated selection criteria vs observed topics, sponsorship)
  ↓
COMPARE (cross-reference with customer's audited site profile and business profile)
  ↓
IDENTIFY GAPS (Why Not Us? – delivery coverage, pricing, quality, reviews, product variety)
  ↓
ASSESS READINESS (explainable 0–100 readiness score; never masquerades as Google DA)
  ↓
GENERATE ACTION PLAN (5-step checklist synced directly to Reigel's GrowthOpportunities)
  ↓
PREPARE OUTREACH (personalized pitch draft; strict human approval; automated spam forbidden)
  ↓
MONITOR & MEASURE (track editorial inclusion, live verified backlink status, referral traffic)
```

## 2. Evidence Classification Rules

Every extracted finding carries an explicit evidence classification:
- **CONFIRMED**: Stated explicitly by the publisher in a dedicated selection methodology,
  numbered criteria list, or explicit evaluation heading.
- **OBSERVED**: Visible in the article content (e.g. topic discussed or competitor mentioned),
  but not asserted as an editorial selection factor.
- **INFERRED**: Reasonable deduction based on observable website differences; labeled accordingly.
- **UNKNOWN**: Insufficient evidence from readable static HTML. Never invent missing certifications
  or fabricated review sentiment.

Mentioned vs. Linked distinction:
- An article mentioning a competing brand without a hyperlink is recorded as `role: "MENTIONED"`,
  `linked: false`.
- A brand appearing in a ranked list with a live link is recorded as `role: "LISTED"`, `linked: true`
  with exact observed `rel` attributes (e.g. `nofollow`, `ugc`, `sponsored`).
- A customer brand found in the article is independently classified as `ownMentioned` and `ownLinked`.

## 3. Data Model & Architecture

### Prisma Model: `RecommendationAnalysis`
```prisma
model RecommendationAnalysis {
  id              String         @id @default(uuid())
  sourceId        String         @unique
  analysisVersion String
  contentHash     String
  analysis        Json
  analyzedAt      DateTime       @default(now())
  source          BacklinkSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@index([analyzedAt])
}
```
Migration: `20261023090000_recommendation_analysis` (strictly additive, zero data reset).

### Modules and Services
- `growthx-ai-crawler/src/modules/backlinks/recommendation-article.ts`:
  Pure deterministic article parser using `cheerio` and `tldts`. Extracts title, word count,
  publication date, listicle format, featured businesses, criteria with evidence labels,
  sponsorship disclosures, and readability limits.
- `growthx-ai-crawler/src/modules/backlinks/recommendation-gap-engine.ts`:
  Compares article criteria against `ProjectBusinessProfile` and `SiteProfile`. Calculates
  4-factor explainable readiness score, generates 5-step action plan, drafts customized
  editorial pitch, and computes realistic outcome metrics.
- `growthx-ai-crawler/src/modules/backlinks/recommendation.service.ts`:
  Tenant-isolated service managing cache, idempotency, content hash deduplication,
  opportunity synchronization (`growthOpportunity`), and outreach tracking.
- `growthx-ai-crawler/src/modules/backlinks/backlinks.controller.ts`:
  REST endpoints under `/api/projects/:projectId/backlinks/recommendations`.

## 4. REST API Reference

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/projects/:id/backlinks/recommendations/stats` | Header KPI metrics (Total Opportunities, Competitors Featured, High Fit, Earned Backlinks) |
| `GET` | `/api/projects/:id/backlinks/recommendations?offset=0` | Paginated candidate publisher pages linking to competitors |
| `GET` | `/api/projects/:id/backlinks/recommendations/:sourceId` | Full enriched intelligence report (criteria, gaps, readiness, pitch) |
| `POST` | `/api/projects/:id/backlinks/recommendations/:sourceId/analyze` | Executes robots-aware fetch & analysis (cached for 10m unless content changes) |
| `POST` | `/api/projects/:id/backlinks/recommendations/:sourceId/opportunity` | Pushes primary action plan into Reigel's `GrowthOpportunity` queue |
| `POST` | `/api/projects/:id/backlinks/recommendations/:sourceId/outreach` | Updates outreach status, logs contact details, and stores user approval |

## 5. UI Architecture & Navigation

The interface integrates directly into the existing `/backlinks` route in `growthx-ai-seo`:
- Preserves all existing tabs: **Profile & reports** (`BacklinkAnalysis`), **Source evidence**,
  **Next actions**, and **Observed competitor sources**.
- Adds the **Recommendation discovery** tab with the 5-stage workflow:
  1. Top KPI Summary Cards
  2. Competitor Recommendation Discovery Table with fit badges
  3. Why They Are Recommended (Key Selection Criteria + Featured Competitors Table)
  4. Why Not Us? Gap Analysis (Factor, Competitor Evidence, Your Status, Gap, Priority)
  5. AI Action Plan (Add to Opportunities button, Step-by-step checklist)
  6. Expected Outcome & Controlled Publisher Outreach Workspace modal

## 6. Verification and Deployment

### Run Unit Tests
```sh
cd growthx-ai-crawler
npm run test:backlinks
```
Runs 8 test suites (51 unit tests passed), verifying article parsing, gap generation,
readiness scoring, opportunity creation, cache idempotency, and tenant isolation.

### Build Verification
```sh
# Crawler backend
cd growthx-ai-crawler
npm run build

# Next.js frontend
cd ../growthx-ai-seo
npm run check:data
npm run check:design
npm run build
```

### Production Deployment
Follow [docs/operations/move-server.md](operations/move-server.md):
1. Commit all durable changes to Git (`feat/recommendation-intelligence`).
2. Run database migration in production: `npx prisma migrate deploy`.
3. Build API, worker, and frontend from the same commit.
4. Verify `/api/health` and live `/backlinks` navigation before closing release.
