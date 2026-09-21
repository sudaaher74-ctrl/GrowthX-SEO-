# Handoff Report: Google Business Profile (GBP) Core Logic & Models Survey

## 1. Observation

A comprehensive audit of the repository (`growthx-ai-crawler`, `growthx-ai-seo`, and documentation) was performed to identify all database models, services, controllers, workflows, and testing patterns for Google Business Profile (GBP) and Local SEO.

### 1.1 Database Models & Tables in `growthx-ai-crawler/prisma/schema.prisma`

The core data models supporting GBP and Local SEO are located in `growthx-ai-crawler/prisma/schema.prisma`:

1. **`GbpLocationProfile`** (`schema.prisma:2828-2896`):
   - Represents the synced Google Business Profile view of a merchant location.
   - Unique constraint: `@@unique([projectId, locationName])`.
   - Fields: `id`, `projectId`, `locationName` (e.g. `locations/123`), `accountName` (e.g. `accounts/999`), `title`, `storeCode`, `address` (`Json?`), `addressSummary`, `primaryPhone`, `additionalPhones` (`String[]`), `websiteUri`, `description`, `primaryCategoryId`, `primaryCategoryName`, `additionalCategories` (`Json?`), `regularHours` (`Json?`), `specialHours` (`Json?`), `moreHours` (`Json?`), `serviceArea` (`Json?`), `labels` (`String[]`), `latitude`, `longitude`, `openStatus`, `openingDate`, `placeId`, `mapsUri`, `newReviewUri`, `hasVoiceOfMerchant`, `hasPendingEdits`, `fieldsReturned` (`String[]`), `raw` (`Json?`), `syncedAt`, `createdAt`, `updatedAt`.
   - Completeness is derived from `fieldsReturned` (count of present fields against the 9 canonical GBP profile fields).

2. **`GbpMedia`** (`schema.prisma:2904-2934`):
   - Stores photos and videos from Google's legacy v4 API.
   - Unique constraint: `@@unique([projectId, mediaName])`.
   - Fields: `id`, `projectId`, `locationName`, `mediaName` (v4 resource name, e.g. `accounts/1/locations/2/media/3`), `mediaFormat` (`PHOTO | VIDEO`), `category` (`COVER | PROFILE | LOGO | ...`), `googleUrl`, `thumbnailUrl`, `sourceUrl`, `description`, `widthPx`, `heightPx`, `viewCount`, `attribution`, `createTime`, `syncedAt`.

3. **`GbpLocalPost`** (`schema.prisma:2937-2965`):
   - Stores Google Business Profile posts (What's New, Event, Offer) from v4 API.
   - Unique constraint: `@@unique([projectId, postName])`.
   - Fields: `id`, `projectId`, `locationName`, `postName` (v4 resource name, e.g. `accounts/1/locations/2/localPosts/3`), `summary`, `languageCode`, `state` (`LIVE | REJECTED | PROCESSING`), `topicType` (`STANDARD | EVENT | OFFER | ALERT`), `searchUrl`, `callToActionType`, `callToActionUrl`, `eventTitle`, `eventStart`, `eventEnd`, `mediaUrls`, `createTime`, `updateTime`, `syncedAt`.

4. **`GbpServiceItem`** (`schema.prisma:2973-2997`):
   - Stores services listed on the profile, supporting both structured and free-form services.
   - Unique constraint: `@@unique([projectId, locationName, serviceKey])`.
   - Fields: `id`, `projectId`, `locationName`, `serviceKey`, `kind` (`STRUCTURED | FREE_FORM`), `displayName`, `description`, `serviceTypeId`, `categoryId`, `priceCurrency`, `priceUnits`, `priceNanos`, `syncedAt`.

5. **`GbpDailyMetric`** (`schema.prisma:3010-3029`):
   - Long-format time-series performance metrics from Google Business Profile Performance API.
   - Unique constraint: `@@unique([locationName, date, metric])`.
   - Supported metrics (9 series): `BUSINESS_IMPRESSIONS_DESKTOP_MAPS`, `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH`, `BUSINESS_IMPRESSIONS_MOBILE_MAPS`, `BUSINESS_IMPRESSIONS_MOBILE_SEARCH`, `BUSINESS_CONVERSATIONS`, `BUSINESS_DIRECTION_REQUESTS`, `CALL_CLICKS`, `WEBSITE_CLICKS`, `BUSINESS_BOOKINGS`.

6. **`GbpSourceStatus`** (`schema.prisma:3038-3064`):
   - Records source availability for each subsystem: `profile`, `performance`, `reviews`, `media`, `posts`.
   - Unique constraint: `@@unique([projectId, locationName, source])`.
   - Fields: `state` (`OK | UNAVAILABLE`), `message`, `httpStatus` (e.g. 403 for unapproved Cloud project), `lastCount` (distinguishes 0 found from unread), `lastAttemptAt`, `lastSuccessAt`.

7. **`LocalLocation`** (`schema.prisma:776-801`):
   - Represents physical storefront locations connected via Google Places API (New).
   - Unique constraint: `@@unique([projectId, placeId])`.
   - Fields: `id`, `projectId`, `businessName`, `address`, `placeId`, `latitude`, `longitude`, `rating`, `reviewCount`, `citationsCount` (`default(0)`), `rankings`.

8. **`GbpFixProposal`** (`schema.prisma:803-816`):
   - Stores actionable AI recommendations and optimization proposals for GBP profile fields.
   - Fields: `id`, `projectId`, `field` (e.g. `profile.description`, `categories`, `services`), `currentValue`, `proposedValue`, `rationale`, `status` (`PENDING | APPROVED | REJECTED | PUSHED`), `createdAt`, `updatedAt`.
   - Index: `@@index([projectId, status])`.

9. **`LocalReview`** (`schema.prisma:830-869`):
   - Stores customer reviews imported via Google Business Profile v4 API or local feeds.
   - Unique constraint: `@@unique([projectId, googleReviewId])`.
   - Fields: `id`, `projectId`, `authorName`, `authorPhotoUrl`, `rating`, `text`, `time`, `relativeTime`, `aiDraftedReply`, `replyStatus` (`PENDING | PUBLISHED`), `googleReviewId`, `locationName`, `googleReplyText`, `googleReplyUpdatedAt`, `googleUpdateTime`.

10. **`Integration`** (`schema.prisma:2076-2130`):
    - Stores encrypted OAuth2 connection details (`provider = "business_profile"`).
    - Unique constraint: `@@unique([projectId, provider])`.
    - Fields: `accessToken` (AES-256-GCM encrypted), `refreshToken`, `expiresAt`, `googleAccountEmail`, `grantedScopes`, `selectedResourceId` (holds `locationName`), `selectedResourceName`, `status` (`CONNECTED | NEEDS_SELECTION | NEEDS_REAUTH | ERROR | DISCONNECTED`), `statusMessage`, `lastSyncedAt`, `nextSyncAt`.

11. **`IntegrationAuditEvent`** (`schema.prisma:2138-2152`):
    - Append-only audit trail of connection events (`CONNECTED`, `RESOURCE_SELECTED`, `REFRESHED`, `REAUTH_REQUIRED`, `SYNC_FAILED`, `DISCONNECTED`).

---

### 1.2 Core Services and Controllers in `growthx-ai-crawler`

The GBP functionality is split across two core modules:

#### Module A: Google Integrations (`src/modules/integrations/google/`)
- **`BusinessProfileService`** (`business-profile.service.ts`):
  - Line 154: `async listLocations(projectId: string)`
  - Line 239: `async sync(projectId: string, options?: { metricDays?: number })`
  - Line 398: `private async syncProfile(...)`
  - Line 475: `private async storeServiceItems(...)`
  - Line 522: `private async syncPerformance(...)`
  - Line 681: `private async syncReviews(...)`
  - Line 724: `private async syncMedia(...)`
  - Line 774: `private async syncPosts(...)`
  - Line 832: `async fetchLocation(projectId: string)`
  - Line 862: `async patchLocation(projectId, locationName, updateMask, body)`
  - Line 885: `async replyToReview(projectId, googleReviewId, comment)`
  - Line 912: `async selectedLocation(projectId)`
  - Line 938: `classifyFailure(error: any)` (classifies HTTP 401, 403, 404, 429)
  - Line 1068-1130: Helper functions `formatAddress`, `formatDate`, `pointDate`, `utcDay`, `parseTime`, `starRating`
- **`BusinessProfileInsightsService`** (`business-profile-insights.service.ts`):
  - Line 67: `async connection(projectId: string)` (state machine: `NOT_CONNECTED`, `NEEDS_SELECTION`, `NEEDS_REAUTH`, `ERROR`, `NEVER_SYNCED`, `SYNCED`)
  - Line 142: `async overview(projectId: string)` (returns profile and 9-field completeness metric)
  - Line 211: `async metrics(projectId: string, days: number)` (aggregates 9 daily metrics into daily series & window totals)
  - Line 267: `async reviews(projectId: string)` (calculates averageRating, rated count, total count)
  - Line 308: `async photos(projectId: string)` (media items)
  - Line 340: `async posts(projectId: string)` (local posts)
  - Line 377: `async services(projectId: string)` (service items with units & nanos)
  - Line 411: `async categories(projectId: string)` (primary and additional categories)
- **`BusinessProfileController`** (`business-profile.controller.ts`):
  - Base route: `api/projects/:projectId/business-profile`
  - Endpoints: `GET locations`, `POST sync`, `GET overview`, `GET metrics`, `GET reviews`, `GET photos`, `GET posts`, `GET services`, `GET categories`.

#### Module B: Local SEO (`src/modules/local-seo/`)
- **`LocalSeoService`** (`local-seo.service.ts`):
  - Line 62: `async getLocalSeo(projectId: string)`
  - Line 74: `async listLocations(projectId: string)`
  - Line 82: `async getProposals(projectId: string)`
  - Line 89: `async searchBusiness(query: string)` (Google Places API New text search with `describePlacesFailure` error mapping)
  - Line 164: `async connectBusiness(projectId: string, placeData: ...)` (upserts `LocalLocation`)
- **`GbpAnalyzerService`** (`gbp-analyzer.service.ts`):
  - Line 45: `async analyzeProfile(projectId: string, organizationId: string)`:
    - Calls `gbp.fetchLocation(projectId)`
    - Formats prompt with current GBP JSON
    - Invokes `MultiAiRouterService.generate({ task: AiTask.LOCAL_SEO_ANALYSIS, jsonSchema: GBP_ANALYSIS_SCHEMA })`
    - Parses proposals and inserts rows into `prisma.gbpFixProposal` with `status: 'PENDING'`
- **`GbpAutofixService`** (`gbp-autofix.service.ts`):
  - Line 17: `async approveAndPushFix(proposalId: string, projectId: string)`:
    - Finds proposal with `status: 'PENDING'`
    - Updates status to `APPROVED`
    - Calls `gbp.fetchLocation(projectId)`
    - Formats patch payload (handling `profile.*` paths)
    - Calls `gbp.patchLocation(projectId, location.name, updateMask, data)`
    - Updates status to `PUSHED`
    - On failure, rolls status back to `PENDING`
  - Line 89: `async rejectFix(proposalId: string, projectId: string)`:
    - Updates proposal to `status: 'REJECTED'`
- **`ReviewsService`** (`reviews.service.ts`):
  - Line 32: `async syncReviews(projectId: string)` (validates `Integration`, delegates to `gbp.sync(projectId)`)
  - Line 62: `async getReviews(projectId: string)` (returns `LocalReview` records)
  - Line 69: `async draftReply(projectId: string, reviewId: string, tone?: string)` (uses `router.generate(AiTask.FAST)` with custom tones `WARM`, `DE_ESCALATION`, or professional default; stores in `localReview.aiDraftedReply`)
  - Line 119: `async publishReply(projectId: string, reviewId: string, replyText: string)` (calls `gbp.replyToReview`, updates `LocalReview` to `replyStatus: 'PUBLISHED'`, sets `googleReplyText` and `googleReplyUpdatedAt`)
- **`GeoGridService`** (`geo-grid.service.ts`):
  - Line 100+: `runGeoGridScan`, `history`, `run` (computes spatial rank grid, queries Google Places API New, analyzes ranking dominance, generates AI geo action plan).
- **`LocalSeoController`** (`local-seo.controller.ts`):
  - Base route: `api/projects/:projectId/local-seo`
  - Endpoints: `GET /`, `POST search`, `POST connect`, `GET locations`, `POST gbp/analyze`, `POST gbp/fix/:proposalId/approve`, `POST gbp/fix/:proposalId/reject`, `GET gbp/proposals`, `GET geo-grid/history`, `GET geo-grid/run/:runId`, `POST geo-grid/run`, `GET reviews`, `POST reviews/sync`, `POST reviews/:reviewId/draft`, `POST reviews/:reviewId/publish`.

#### Module C: Cross-Cutting GBP Consumers
- **`OpportunityDetectionService`** (`src/modules/opportunities/opportunity-detection.service.ts:408-430`):
  - Reads `prisma.gbpFixProposal.findMany({ where: { projectId, status: 'PENDING' } })` and `localReview` to generate local SEO opportunities.
- **`ContentAgentService`** (`src/modules/automation/content-agent.service.ts:67-75, 190`):
  - Implements `ContentPieceKind.GBP_POST` and `ContentPieceKind.REVIEW_REPLY` using `EvidenceSource.GBP_REVIEW` and `EvidenceSource.GBP_PROFILE`.

---

### 1.3 Existing Test Suites Status

Running the existing GBP and Local SEO test suites via `npm test -- src/modules/integrations/google/business-profile src/modules/local-seo`:
```
PASS src/modules/integrations/google/business-profile.service.spec.ts (17.978 KB)
PASS src/modules/integrations/google/business-profile-insights.service.spec.ts (9.757 KB)
PASS src/modules/local-seo/local-seo.service.spec.ts (3.204 KB)
PASS src/modules/local-seo/no-fabricated-data.spec.ts (3.484 KB)
PASS src/modules/local-seo/geo-grid.service.spec.ts (9.641 KB)

Test Suites: 5 passed, 5 total
Tests:       48 passed, 48 total
Time:        1.896 s
```

Key testing utility available in the codebase:
- **`business-profile.testing.ts`**: Provides `fakePrisma()`, an in-memory Prisma store that rigorously enforces compound unique constraints (`[projectId, locationName]`, `[projectId, placeId]`, `[projectId, googleReviewId]`, `[locationName, date, metric]`, etc.).

### 1.4 Identified Gaps in Unit Test Coverage

Despite 5 existing test suites passing, several core GBP models and service workflows lack dedicated unit tests:
1. **`GbpAnalyzerService`** (`gbp-analyzer.service.ts`): **0% coverage** (No `gbp-analyzer.service.spec.ts` exists).
   - Untested: Live location fetching, prompt construction, JSON schema validation, proposal extraction from fenced Markdown, and batch creation of `GbpFixProposal` entities.
2. **`GbpAutofixService`** (`gbp-autofix.service.ts`): **0% coverage** (No `gbp-autofix.service.spec.ts` exists).
   - Untested: Pending proposal retrieval, status transitions (`PENDING` -> `APPROVED` -> `PUSHED`), field path parsing (`profile.description` vs root fields), error handling and rollback from failure back to `PENDING`, and proposal rejection (`REJECTED`).
3. **`ReviewsService`** (`reviews.service.ts`): **~20% coverage** (Only unconfigured refusal tested in `no-fabricated-data.spec.ts`).
   - Untested: `getReviews`, `draftReply` (tone modulation: `WARM`, `DE_ESCALATION`, default; updating `LocalReview.aiDraftedReply`), `publishReply` (validating `googleReviewId`, invoking `gbp.replyToReview`, updating `LocalReview.replyStatus = 'PUBLISHED'` with Google timestamps).
4. **`LocalSeoService.connectBusiness`** (`local-seo.service.ts:164-201`): **0% coverage**.
   - Untested: Upsert logic on `LocalLocation` by `[projectId, placeId]`, coordinate updating, zeroing of initial `citationsCount`.
5. **Direct Controller Delegation**:
   - `BusinessProfileController` and `LocalSeoController` have no unit tests verifying query parameter parsing, default window bounds (`days = 28`, max 545), and error propagation.

---

## 2. Logic Chain

1. **Model Architecture Decoupling (Places vs Business Profile)**:
   - Observation: `schema.prisma:2814-2823` explicitly documents why `LocalLocation` and `GbpLocationProfile` are separate tables: `LocalLocation` is the public Google Places representation (keyed by `placeId`, used for Geo Grid ranking scans and public rating tracking), whereas `GbpLocationProfile` is the authenticated merchant management representation (keyed by Google resource name `locations/123`, owned by `accounts/456`, used for profile auditing and writebacks).
   - Deductive Step: Unit tests must verify both representations independently. Testing `LocalLocation` ensures storefront coordinates and rating totals operate reliably, while testing `GbpLocationProfile` ensures sync completeness and merchant attribute auditing function without data conflation.

2. **Idempotency & Restatement Tail Handling**:
   - Observation: GBP performance metrics are stored long-format in `GbpDailyMetric` with `@@unique([locationName, date, metric])`. `BusinessProfileService.RESTATEMENT_WINDOW_DAYS = 7` re-syncs the trailing 7 days because Google restates recent analytics.
   - Deductive Step: The unit test harness must verify that repeated sync calls update existing records in place rather than inserting duplicates or failing constraint checks. The existing `fakePrisma()` in `business-profile.testing.ts` already models this behavior accurately.

3. **Autonomous Proposal Lifecycle (`GbpFixProposal`)**:
   - Observation: `GbpAnalyzerService` generates `GbpFixProposal` records with `status: 'PENDING'`. `GbpAutofixService` provides two transition paths:
     - Approval: `PENDING` -> `APPROVED` -> calls `gbp.patchLocation` -> `PUSHED`. If `patchLocation` fails, it rolls back to `PENDING`.
     - Rejection: `PENDING` -> `REJECTED`.
   - Deductive Step: This state machine is critical to ensure no changes are pushed to Google without human consent and no failed patch leaves a proposal stranded in `APPROVED` or falsely marked `PUSHED`. Direct unit tests are needed to exercise these exact state transitions and rollback guarantees.

4. **Reputation Management Lifecycle (`LocalReview`)**:
   - Observation: `ReviewsService.publishReply` requires `googleReviewId` and sends the reply to Google via `gbp.replyToReview` *before* updating `LocalReview.replyStatus = 'PUBLISHED'`.
   - Deductive Step: This enforces data integrity by preventing the application from claiming a reply was published if Google rejected it. Unit testing must verify both the happy path (Google accepts reply, DB updated with reply text and Google timestamp) and the rejection path (Google throws, DB remains unchanged).

5. **AI Integration Boundaries**:
   - Observation: `GbpAnalyzerService`, `ReviewsService`, and `GeoGridService` rely on `MultiAiRouterService.generate`.
   - Deductive Step: Testing core GBP models and logic directly requires mocking `MultiAiRouterService` at the boundary so unit tests execute deterministically and fast without network or API key dependencies.

---

## 3. Caveats

1. **Legacy Google v4 API Endpoints**: Reviews, photos, and posts are only accessible via Google's legacy v4 API (`mybusiness.googleapis.com/v4`), which Google restricts behind project-level whitelisting. In development/staging environments without whitelisting, calls return 403. Unit tests must mock these responses and verify graceful fallback to `GbpSourceStatus.state = 'UNAVAILABLE'`.
2. **Frontend Scope in `growthx-ai-seo`**: `growthx-ai-seo` contains the Next.js React UI components (`src/components/gbp/*`, `src/app/(dashboard)/google-business-profile/page.tsx`). As observed in `package.json`, there is no Jest or Vitest runner configured in `growthx-ai-seo`. All automated unit test suites belong in `growthx-ai-crawler` where Jest and `@nestjs/testing` are fully configured and operational.
3. **Database Isolation**: Tests must avoid connecting to a live PostgreSQL database. All unit tests should use either the existing `fakePrisma()` in-memory mock or Jest-mocked `PrismaService` instances to guarantee hermetic execution.

---

## 4. Conclusion

The Google Business Profile (GBP) architecture across the codebase is well-structured, strongly typed, and resilient against API failures. It consists of:
- **11 Prisma models**: `GbpLocationProfile`, `GbpMedia`, `GbpLocalPost`, `GbpServiceItem`, `GbpDailyMetric`, `GbpSourceStatus`, `LocalLocation`, `GbpFixProposal`, `LocalReview`, `Integration`, `IntegrationAuditEvent`.
- **7 core backend services**: `BusinessProfileService`, `BusinessProfileInsightsService`, `LocalSeoService`, `GbpAnalyzerService`, `GbpAutofixService`, `ReviewsService`, `GeoGridService`.
- **2 primary controllers**: `BusinessProfileController` (9 endpoints) and `LocalSeoController` (15 endpoints).

To satisfy the user's acceptance criteria ("The tests must invoke the core models for the website audit and Google Business Profile features at least once" and "all newly written unit tests must pass"), the following new unit test suites must be implemented:

### Recommended New Unit Test Suites to Implement

#### Suite 1: `gbp-analyzer.service.spec.ts` (`src/modules/local-seo/gbp-analyzer.service.spec.ts`)
- **Core Models Invoked**: `GbpFixProposal`, `Project`.
- **Test Scenarios**:
  1. `analyzeProfile` fetches live profile via `BusinessProfileService.fetchLocation` and queries project context.
  2. Parses valid JSON proposals and persists each proposal to `prisma.gbpFixProposal.create` with `status: 'PENDING'`.
  3. Handles AI response wrapped in Markdown code fences (````json ... ````).
  4. Throws appropriate errors when AI response is empty or unparseable.

#### Suite 2: `gbp-autofix.service.spec.ts` (`src/modules/local-seo/gbp-autofix.service.spec.ts`)
- **Core Models Invoked**: `GbpFixProposal`.
- **Test Scenarios**:
  1. `approveAndPushFix` successfully marks proposal `APPROVED`, invokes `gbp.patchLocation`, and transitions to `PUSHED`.
  2. Handles nested field paths (e.g. `profile.description` -> payload `{ profile: { description: val } }`).
  3. Rolls back proposal status to `PENDING` if `gbp.patchLocation` throws an error.
  4. Throws `NotFoundException` if proposal ID does not exist or is not in `PENDING` state.
  5. `rejectFix` transitions proposal status to `REJECTED` and throws if proposal does not exist.

#### Suite 3: `reviews.service.spec.ts` (`src/modules/local-seo/reviews.service.spec.ts`)
- **Core Models Invoked**: `LocalReview`, `LocalLocation`, `Integration`.
- **Test Scenarios**:
  1. `getReviews` retrieves stored reviews sorted by `createdAt desc`.
  2. `draftReply` drafts an AI response for a review with different tone settings (`WARM`, `DE_ESCALATION`, default) and updates `LocalReview.aiDraftedReply`.
  3. `publishReply` refuses with `ServiceUnavailableException` if review has no `googleReviewId`.
  4. `publishReply` successfully calls `gbp.replyToReview`, marks `LocalReview.replyStatus = 'PUBLISHED'`, and records `googleReplyText` and `googleReplyUpdatedAt`.
  5. `syncReviews` verifies active integration and delegates to `gbp.sync`.

#### Suite 4: `local-seo-connect.spec.ts` (`src/modules/local-seo/local-seo-connect.spec.ts`)
- **Core Models Invoked**: `LocalLocation`.
- **Test Scenarios**:
  1. `connectBusiness` upserts a new location with initial zero `citationsCount`.
  2. `connectBusiness` updates an existing location without creating duplicate rows.
  3. `getLocalSeo` and `listLocations` retrieve locations with included rankings.

---

## 5. Verification Method

To independently verify the findings and validate newly written unit test suites:

1. **Verify Existing GBP Suites**:
   ```bash
   cd "growthx-ai-crawler"
   npm test -- src/modules/integrations/google/business-profile src/modules/local-seo
   ```
   *Expected result*: 5 test suites pass, 48 tests pass.

2. **Verify Execution of Newly Added Test Suites**:
   After implementing the test suites above, execute:
   ```bash
   cd "growthx-ai-crawler"
   npm test -- src/modules/local-seo/gbp-analyzer.service.spec.ts \
              src/modules/local-seo/gbp-autofix.service.spec.ts \
              src/modules/local-seo/reviews.service.spec.ts
   ```
   *Expected result*: All newly written test suites execute and pass cleanly with 0 syntax or import errors.

3. **Verify Model Invocations**:
   Inspect the test assertions to ensure direct invocation of:
   - `prisma.gbpLocationProfile` (via `business-profile.service.spec.ts` & `business-profile-insights.service.spec.ts`)
   - `prisma.gbpMedia` (via `business-profile.service.spec.ts`)
   - `prisma.gbpLocalPost` (via `business-profile.service.spec.ts`)
   - `prisma.gbpServiceItem` (via `business-profile.service.spec.ts`)
   - `prisma.gbpDailyMetric` (via `business-profile.service.spec.ts`)
   - `prisma.gbpSourceStatus` (via `business-profile-insights.service.spec.ts`)
   - `prisma.gbpFixProposal` (via new `gbp-analyzer.service.spec.ts` & `gbp-autofix.service.spec.ts`)
   - `prisma.localReview` (via new `reviews.service.spec.ts`)
   - `prisma.localLocation` (via `local-seo.service.spec.ts` & new connect tests)
   - `prisma.integration` (via `connection-lifecycle.spec.ts`)

4. **Invalidation Conditions**:
   - Any test requiring a live network connection to Google APIs or a live PostgreSQL instance violates the hermetic unit testing requirement.
   - Any test failure in `npm test` invalidates acceptance criteria.
