# Project: Automated Unit Test Suite for Core Workflows & Models

## Architecture
The project backend is located at `growthx-ai-crawler` (NestJS 10.4.1, Prisma 5.19.1, Jest 29.7.0).
Unit tests use Jest with `ts-jest` and `@nestjs/testing`, employing in-memory mocks (`fakePrisma()` or mocked `PrismaService`, `MultiAiRouterService`, and `axios`).
Tests are hermetic, executing in sandbox without requiring network or live database connections.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Website Audit: Link Analysis | Unit tests for LinkAnalyzerService (internal vs external link classification, rel=nofollow/sponsored/ugc, broken anchor fragment detection) invoking Page and Link data structures. | M1 | Survey 2 |
| 2 | Website Audit: Target Validation | Unit tests for ValidatorService (domain reachability, SSL certificate validity, redirect chain capturing, failure handling) verifying Website pre-audit validation. | M1 | Survey 2 |
| 3 | Website Audit: Sitemap Parsing | Unit tests for SitemapService (XML sitemap parsing, sitemap indexes, image/video sitemaps, URL discovery, deduplication) verifying Page discovery frontier. | M1 | Survey 2 |
| 4 | Website Audit: Crawl History Diffing | Unit tests for HistoryService (crawl job comparison, new/resolved/recurring issue categorisation, page/issue count diffs) invoking CrawlJob and Issue models. | M1 | Survey 2 |
| 5 | Website Audit: Performance Metrics | Unit tests for PerformanceService (Core Web Vitals LCP/INP/CLS and Lighthouse scores parsing, quota exhaustion handling) invoking Performance and Page models. | M1 | Survey 2 |
| 6 | GBP: Profile AI Analyzer | Unit tests for GbpAnalyzerService (profile fetching, AI prompt generation, JSON schema validation, markdown code fence parsing, proposal persistence) invoking GbpFixProposal and Project models. | M2 | Survey 3 |
| 7 | GBP: Autofix State Machine | Unit tests for GbpAutofixService (proposal approval, gbp.patchLocation invocation, PENDING -> APPROVED -> PUSHED transitions, rollback on patch failure, rejection) invoking GbpFixProposal model. | M2 | Survey 3 |
| 8 | GBP: Reviews & Reputation Management | Unit tests for ReviewsService (review retrieval, AI reply drafting across WARM/DE_ESCALATION/default tones, review publishing via Google API, status updates) invoking LocalReview and Integration models. | M2 | Survey 3 |
| 9 | GBP: Local Location Connection | Unit tests for LocalSeoService.connectBusiness (upserting storefront locations, coordinate updates, zeroing citations count) invoking LocalLocation model. | M2 | Survey 3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Website Audit Unit Test Suite | Implement comprehensive unit tests for Website Audit services and models (`link-analyzer.service.spec.ts`, `validator.service.spec.ts`, `sitemap.service.spec.ts`, `history.service.spec.ts`, `performance.service.spec.ts`). | none | DONE |
| M2 | Google Business Profile Unit Test Suite | Implement comprehensive unit tests for GBP services and models (`gbp-analyzer.service.spec.ts`, `gbp-autofix.service.spec.ts`, `reviews.service.spec.ts`, `local-seo-connect.spec.ts`). | none | DONE |
| M3 | Full Test Suite Execution & Verification | Run the complete test runner across all newly written and existing unit tests, ensuring zero syntax/import errors, 100% pass rate, and model invocations. | M1, M2 | DONE |

## Interface Contracts
- **Test Runner Entry Point**: `npm test` or `npx jest` inside `growthx-ai-crawler/`.
- **Test File Location Convention**: Colocated with services in `src/modules/<module-name>/<service-name>.spec.ts`.
- **Mocking Conventions**:
  - `PrismaService`: Mocked methods (`findUnique`, `findMany`, `upsert`, `create`, `update`, etc.) or `fakePrisma()`.
  - `MultiAiRouterService`: Mocked `generate({ task, ... })` returning expected JSON or text strings.
  - `axios`: Mocked `get`, `post`, `patch` using `jest.mock('axios')`.
  - Zero external I/O: No live network calls, no live DB connections.

## Code Layout
- `growthx-ai-crawler/src/modules/analyzer/link-analyzer.service.spec.ts`
- `growthx-ai-crawler/src/modules/validator/validator.service.spec.ts`
- `growthx-ai-crawler/src/modules/sitemap/sitemap.service.spec.ts`
- `growthx-ai-crawler/src/modules/history/history.service.spec.ts`
- `growthx-ai-crawler/src/modules/performance/performance.service.spec.ts`
- `growthx-ai-crawler/src/modules/local-seo/gbp-analyzer.service.spec.ts`
- `growthx-ai-crawler/src/modules/local-seo/gbp-autofix.service.spec.ts`
- `growthx-ai-crawler/src/modules/local-seo/reviews.service.spec.ts`
- `growthx-ai-crawler/src/modules/local-seo/local-seo-connect.spec.ts`
