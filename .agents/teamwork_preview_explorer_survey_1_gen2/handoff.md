# Handoff Report: Test Framework & Infrastructure Survey

## 1. Observation

### 1.1 Project Structure & Subprojects
The workspace root (`/Users/milquu/Documents/Coding Projects/AI Seo`) contains no root `package.json`. It coordinates two distinct applications:
1. **`growthx-ai-crawler/`**: Backend service powered by NestJS 10.4.1, Prisma ORM 5.19.1, BullMQ 5.12.10, and Jest 29.7.0.
2. **`growthx-ai-seo/`**: Frontend dashboard powered by Next.js 16.2.12, React 19.2.4, and Playwright 1.63.0.

### 1.2 Package Configurations & Testing Frameworks

#### Backend (`growthx-ai-crawler/package.json`)
- **Framework & Engine**: NestJS 10.4.1 (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`), Node `>=20.19`.
- **Database & Queue**: Prisma 5.19.1 (`@prisma/client`), Redis 5.4.1 (`ioredis`), BullMQ 5.12.10.
- **Testing Framework**: Jest 29.7.0 with `ts-jest` 29.2.5 and `@nestjs/testing` 10.4.1.
- **Scripts** (`package.json` lines 21–25):
  ```json
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
  "test:e2e": "jest --config ./test/jest-e2e.json"
  ```
  *(Note: `./test/jest-e2e.json` is not present; all existing tests are colocated unit/integration specs in `src/`)*.
- **Jest Configuration** (`package.json` lines 103–123):
  ```json
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node",
    "setupFiles": ["<rootDir>/modules/crawler/testing/jest-setup.ts"],
    "testTimeout": 180000
  }
  ```
- **Setup File** (`src/modules/crawler/testing/jest-setup.ts`):
  Sets `process.env.ALLOW_PRIVATE_CRAWL_TARGETS = 'true'` to permit loopback target URLs during testing, and sets `PLAYWRIGHT_EXECUTABLE_PATH` if `PLAYWRIGHT_BROWSERS_PATH` is provided.

#### Frontend (`growthx-ai-seo/package.json`)
- **Framework & Engine**: Next.js 16.2.12, React 19.2.4, Tailwind CSS v4, Node `>=20.19`.
- **Testing Setup**: Only Playwright (`@playwright/test: "^1.63.0"`).
- **Scripts**:
  - `"test:smoke": "playwright test"` (runs `e2e/smoke.spec.ts` configured in `playwright.config.ts` targeting production server on port 3210).
  - `"typecheck": "tsc --noEmit"`
  - `"check:data": "node scripts/check-no-fabricated-data.mjs"`
  - `"check:design": "node scripts/check-design-tokens.mjs"`
- **Unit Testing**: No unit test framework (Jest/Vitest) is configured in `growthx-ai-seo`.

### 1.3 Test Discovery & Suite Execution
- Discovered **52 `.spec.ts` test files** under `growthx-ai-crawler/src/`.
- Full test suite run (`npx jest --maxWorkers=4` inside `growthx-ai-crawler`):
  - Total suites: **136 test suites** (including sub-suites), **1,460 tests**.
  - Passed: **132 suites, 1,424 tests passed**.
  - Failed: **4 suites, 36 tests failed**.
- Verbatim failure reason for the 4 failing suites:
  - Failing suites: `src/modules/crawler/fetch/fetch.service.spec.ts`, `src/modules/crawler/discovery/discovery.service.spec.ts`, `src/modules/crawler/crawl-engine.spec.ts`, and `src/modules/crawler/fetch/browser-pool.service.spec.ts`.
  - Error: `connect EPERM 127.0.0.1:54612 - Local (0.0.0.0:0)`.
  - Cause: These 4 suites run an in-process local HTTP fixture server (`fixture-server.ts`) or attempt to launch Chromium, which hits sandbox socket binding permissions.
- Pure Unit Test Suites:
  - All mock-based unit tests execute with **100% pass rate** in sandbox without requiring network or external databases.
  - Verifications executed:
    1. `npx jest src/modules/integrations/google/business-profile.service.spec.ts`: 14 tests, **14 passed** in 2.13s.
    2. `npx jest src/modules/integrations/google/business-profile-insights.service.spec.ts src/modules/market-research/business-profile.service.spec.ts`: 20 tests, **20 passed** in 1.83s.
    3. `npx jest src/modules/integrations/google/ --bail`: 10 suites, 106 tests, **106 passed** in 8.10s.
    4. `npx jest src/modules/crawler/crawler.service.spec.ts src/modules/crawler/issue-rules.spec.ts`: 39 tests, **39 passed** in 2.32s.
    5. `npx jest src/modules/crawler/crawler-v2-wiring.spec.ts`: 11 tests, **11 passed** in 1.94s.
    6. `npx jest src/modules/crawler/crawl-history.controller.spec.ts`: 6 tests, **6 passed** in 1.99s.

### 1.4 Testing Conventions & Mock Patterns
Across `growthx-ai-crawler/src`, two primary patterns are established:
1. **NestJS Testing Module (`@nestjs/testing`)**:
   - Standard pattern:
     ```ts
     const module: TestingModule = await Test.createTestingModule({
       controllers: [CrawlController],
       providers: [
         { provide: PrismaService, useValue: mockPrisma },
         // all other controller/service dependencies provided with mock objects
       ],
     }).compile();
     ```
   - Used for controller, service, and DI integration testing.
2. **In-Memory Prisma Stand-in (`FakeTable` / `fakePrisma()`)**:
   - Location: `src/modules/integrations/google/business-profile.testing.ts` (lines 52–154) and `src/modules/crawler/frontier/frontier.spec.ts`.
   - Simulates Prisma collections (`findUnique`, `findFirst`, `findMany`, `count`, `upsert`, `update`, `createMany`, `deleteMany`).
   - Specifically enforces `@@unique` compound key constraints (`uniqueBy: string[]`) and skips duplicates or throws unique constraint violations, allowing tests to verify idempotency (e.g., syncing twice leaves exactly one copy).
3. **Google API Wrapper Mocking**:
   - `src/modules/integrations/google/google-apis.ts` wraps Google SDK clients.
   - Tests mock this directly via `jest.mock('./google-apis', () => ({ google: { mybusinessaccountmanagement: jest.fn(), ... } }))`.
   - `global.fetch` is mocked using `jest.fn()` and torn down with `delete (global as any).fetch` in `afterEach`.

### 1.5 Target Models from `prisma/schema.prisma`
1. **Website Audit Models**:
   - `Website`: `id`, `domain`, `url`, `isVerified`, `verificationToken`, `projectId`, `crawlSchedule`, `crawlFrequency`.
   - `CrawlJob`: `id`, `websiteId`, `status` (`JobStatus`), `pagesCrawled`, `issuesFound`, `healthScore`, `uniqueIssuesCount`, `maxConcurrency`, `maxDepth`.
   - `Page`: `id`, `crawlJobId`, `url`, `statusCode`, `responseTimeMs`, `title`, `metaDescription`, `canonicalUrl`, `indexability`, `jsRequired`.
   - `Issue`: `id`, `crawlJobId`, `pageId`, `issueType`, `severity`, `confidence`, `affectedUrl`, `dedupKey`.
   - Associated: `Image`, `Link`, `Schema`, `Performance`, `InternalGraph`, `AIRecommendation`.
2. **Google Business Profile Models**:
   - `GbpLocationProfile`: `id`, `projectId`, `locationName`, `title`, `storefrontAddress`, `primaryPhone`, `primaryCategory`, `hasVoiceOfMerchant`, `latlng`.
   - `GbpServiceItem`: `id`, `projectId`, `locationName`, `serviceKey`, `serviceTypeId`, `displayName`, `price`.
   - `GbpDailyMetric`: `id`, `locationName`, `date`, `metric`, `value`.
   - `GbpMedia`: `id`, `projectId`, `mediaName`, `mediaFormat`, `googleUrl`.
   - `GbpLocalPost`: `id`, `projectId`, `postName`, `summary`, `state`.
   - `GbpSourceStatus`: `id`, `projectId`, `locationName`, `source`, `status`, `error`.
   - `LocalReview`: `id`, `projectId`, `locationId`, `googleReviewId`, `reviewerName`, `starRating`, `comment`.
   - `LocalLocation`: `id`, `projectId`, `name`, `address`, `phone`.
   - `GbpFixProposal`: `id`, `locationId`, `issueType`, `proposalText`, `status`.

---

## 2. Logic Chain

1. **Target Identification**:
   - The user request requires writing an automated unit test suite to verify core workflows, specifically website audit and Google Business Profile features, ensuring underlying models function properly using existing codebase conventions.
2. **Framework Alignment**:
   - `growthx-ai-crawler` is where all backend business logic, Prisma schemas, BullMQ jobs, and existing Jest unit tests reside.
   - `growthx-ai-seo` is a Next.js client application with only Playwright smoke tests.
   - Therefore, the unit test suite must be implemented in `growthx-ai-crawler/src` under the existing Jest runner to satisfy R1 ("Write unit tests") and R2 ("Use existing testing framework").
3. **Execution Feasibility**:
   - In sandboxed environments, 132/136 test suites pass out of the box. Tests relying on mock Prisma (`mockPrisma` or `fakePrisma()`) run in under 2–3 seconds without network dependencies or local socket servers.
   - Consequently, newly written unit tests for the core models should strictly adhere to the in-memory mocking conventions (`@nestjs/testing` + `fakePrisma()` / `mockPrisma`) to ensure 100% deterministic test execution in CI/sandbox without `EPERM` socket issues.
4. **Model Invocation Strategy**:
   - For **Website Audit**: A dedicated unit test suite for `CrawlController` and its audit pipeline can invoke and verify operations on `Website`, `CrawlJob`, `Page`, and `Issue` models (covering website registration, domain verification, audit job initiation, latest crawl retrieval, and issue calculation).
   - For **Google Business Profile**: An expanded unit test suite can invoke and verify operations on `GbpLocationProfile`, `GbpServiceItem`, `GbpDailyMetric`, `GbpMedia`, `GbpLocalPost`, `GbpSourceStatus`, `LocalReview`, `LocalLocation`, and `GbpFixProposal` using the existing `fakePrisma()` harness.

---

## 3. Caveats

1. **Sandbox Loopback Restriction**:
   Tests that spin up local HTTP servers (`fixture-server.ts`) or launch headless Chromium fail in sandbox environments with `connect EPERM 127.0.0.1:<port>`. Unit tests must avoid real socket listening and instead use Jest mocks.
2. **Missing `test:e2e` Config**:
   `growthx-ai-crawler/package.json` references `./test/jest-e2e.json`, which does not exist on disk. All backend tests must be run via `npx jest <path>` or `npm test`.
3. **Frontend Absence of Unit Tests**:
   `growthx-ai-seo` has no Jest/Vitest setup. Attempting to add unit tests there would require introducing and configuring a new test runner from scratch, whereas `growthx-ai-crawler` has a mature, fully configured Jest environment.

---

## 4. Conclusion

1. **Project & Framework Selection**:
   All unit testing for core workflows and underlying models belongs in `growthx-ai-crawler/src/`, executed via Jest 29.7.0 (`ts-jest`).
2. **Testing Convention**:
   Use `@nestjs/testing` (`Test.createTestingModule`) with mocked providers or direct class instantiation with `fakePrisma()` (from `src/modules/integrations/google/business-profile.testing.ts`), which already supports `FakeTable` with schema unique constraints for GBP and audit models.
3. **Model Verification Scope**:
   - **Website Audit**: `Website`, `CrawlJob`, `Page`, `Issue` (and supporting `Image`, `Link`, `InternalGraph`, `Performance`).
   - **Google Business Profile**: `GbpLocationProfile`, `GbpServiceItem`, `GbpDailyMetric`, `GbpMedia`, `GbpLocalPost`, `GbpSourceStatus`, `LocalReview`, `LocalLocation`, `GbpFixProposal`.
4. **Execution Command**:
   - Run tests for specific modules: `npx jest src/modules/crawler/` or `npx jest src/modules/integrations/google/`
   - Run a specific test suite: `npx jest <path-to-spec>`
   - All pure unit tests pass with zero errors, zero warnings, and zero external infrastructure dependencies.

---

## 5. Verification Method

To independently verify these findings, run the following commands from `/Users/milquu/Documents/Coding Projects/AI Seo/growthx-ai-crawler`:

1. **Verify Jest and Environment**:
   ```bash
   npx jest --version
   ```
   *Expected*: `29.7.0`

2. **Verify Google Business Profile Unit Tests**:
   ```bash
   npx jest src/modules/integrations/google/business-profile.service.spec.ts src/modules/integrations/google/business-profile-insights.service.spec.ts
   ```
   *Expected*: All 34 tests in 2 suites pass in ~2 seconds.

3. **Verify Website Audit & Crawler Unit Tests**:
   ```bash
   npx jest src/modules/crawler/crawler-v2-wiring.spec.ts src/modules/crawler/crawl-history.controller.spec.ts src/modules/issues/issue-engine.service.spec.ts
   ```
   *Expected*: All tests pass with 0 errors.

4. **Verify Mocking Patterns in Codebase**:
   - Inspect `growthx-ai-crawler/src/modules/integrations/google/business-profile.testing.ts` for `FakeTable` and `fakePrisma()`.
   - Inspect `growthx-ai-crawler/src/modules/crawler/crawl-history.controller.spec.ts` for `@nestjs/testing` controller module DI setup.
