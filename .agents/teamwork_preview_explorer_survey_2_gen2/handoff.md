# Website Audit Core Logic, Services, and Models - Survey & Unit Testing Blueprint

## 1. Observation

### 1.1 Architecture & Database Models (`growthx-ai-crawler/prisma/schema.prisma`)
Direct inspection of `growthx-ai-crawler/prisma/schema.prisma` revealed 12 core database models and 7 primary enums that define the Website Audit domain:

1. **`Website` (Lines 23–56)**:
   - Identifies the audited domain (`domain`, `url`, `isVerified`, `verificationToken`, `webhookSecret`).
   - Audit configuration: `rateLimitDelayMs` (default 500), `maxConcurrency` (default 5), `maxDepth` (default 10), `crawlFrequency` (`OFF | DAILY | WEEKLY | MONTHLY`).
   - Relations: `crawlJobs CrawlJob[]`, `project Project?`, `competitors CompetitorDomain[]`.
2. **`CrawlJob` (Lines 58–101)**:
   - Lifecycle & state machine: `status JobStatus` (`PENDING | RUNNING | COMPLETED | FAILED | CANCELLED`).
   - Audit metrics: `pagesCrawled`, `pagesDiscovered`, `issuesFound`, `healthScore` (0–100), `uniqueIssuesCount`, `resolvedIssuesCount`, `qualityDiagnostics Json?`.
   - Crawl controls: `concurrency`, `depthLimit`, `pageLimit` (ceiling for competitor/budget crawls).
   - Relations: `website Website`, `pages Page[]`, `issues Issue[]`, `internalGraphs InternalGraph[]`, `frontier CrawlFrontier[]`, `socialLinks SiteSocialLink[]`.
3. **`Page` (Lines 103–177)**:
   - Audit target & response: `url`, `finalUrl`, `statusCode`, `responseTimeMs`, `contentType`.
   - On-page SEO signals: `title`, `metaDescription`, `canonicalUrl`, `robotsMeta`, `h1 String[]`, `h2 String[]`, `h3 String[]`, `wordCount`, `readingTimeMin`, `contentHash`, `simHash`, `duplicateScore`.
   - Classification & technical rendering: `pageType` (e.g. `HOME`, `SERVICE`, `BLOG`, `LEGAL`, `OTHER`), `rawHtml`, `renderedHtml`, `jsRequired Boolean`, `discoverySource` (`seed`, `sitemap`, `link`, `bundle`, `robots`), `statusChain Json?`, `blockedSuspected Boolean`, `indexabilityReason Json?`, `fetchErrorKind String?`, `indexability` (`INDEXABLE | NOT_INDEXABLE | UNKNOWN`).
   - Relations: `crawlJob CrawlJob`, `issues Issue[]`, `images Image[]`, `links Link[]`, `schemas Schema[]`, `performance Performance?`, `aeoMetrics AeoMetrics?`.
4. **`Issue` (Lines 190–218)**:
   - Core finding entity: `issueType` (e.g. `MISSING_TITLE`, `BROKEN_LINK_INTERNAL`, `ORPHAN_PAGE`, `SCHEMA_ORG_MISSING`), `severity` (`CRITICAL | HIGH | MEDIUM | LOW`), `status` (`OPEN | RESOLVED | IGNORED`), `confidence` (`CONFIRMED | LIKELY | ADVISORY`), `category` (`TECHNICAL | CONTENT | SCHEMA | LINKS | PERFORMANCE`).
   - Audit details: `affectedUrl`, `description`, `explanation`, `impact`, `recommendation`, `evidence`, `dedupKey`, `aiFixAvailable`.
   - Relations: `crawlJob CrawlJob`, `page Page?`, `aiRecommendation AIRecommendation?`.
5. **`Image` (Lines 220–237)**:
   - Page image audit: `imageUrl`, `altText`, `sizeBytes`, `width`, `height`, `isLazy`, `isMissingAlt`, `isBroken`, `isLarge`.
6. **`Link` (Lines 239–253)**:
   - Hyperlink extraction: `sourcePageId`, `targetUrl`, `linkType` (`INTERNAL | EXTERNAL`), `isBroken`, `isRedirect`, `isNofollow`, `anchorText`.
7. **`Schema` (Lines 255–266)**:
   - Structured data audit: `schemaType` (`ORGANIZATION | LOCAL_BUSINESS | PRODUCT | ARTICLE | BREADCRUMB | FAQ | REVIEW | VIDEO | RECIPE | EVENT | OTHER`), `isValid`, `validationErrors String[]`, `rawJson`.
8. **`Performance` (Lines 268–282)**:
   - Core Web Vitals & Lighthouse: `performanceScore`, `accessibilityScore`, `bestPracticesScore`, `seoScore`, `lcpMs` (Largest Contentful Paint), `inpMs` (Interaction to Next Paint), `clsScore` (Cumulative Layout Shift).
9. **`InternalGraph` (Lines 284–297)**:
   - Link equity & depth topology: `sourceUrl`, `targetUrl`, `crawlDepth`, `linkEquityScore`.
10. **`AIRecommendation` (Lines 299–320)**:
    - Remediation proposal: `whyItMatters`, `seoImpact`, `businessImpact`, `priorityScore`, `recommendedFixPatch`, `expectedOutcome`, `generatedByModel`, `status` (`PENDING_APPROVAL | APPROVED | REJECTED | APPLIED`).
11. **`CrawlFrontier` (Lines 3296–3358)**:
    - Durable URL queue: `normalizedUrl`, `url`, `state` (`PENDING | IN_PROGRESS | DONE | SKIPPED | FAILED`), `depth`, `discoverySource`, `sources String[]`, `reason` (exclusion reason), `robotsAllowed`, `rendered`.
12. **`AeoMetrics` (Lines 179–188)**:
    - Answer Engine Optimization: `llmCrawlerHits`, `citationProbability`, `hasStructuredJsonLd`, `hasSemanticHtml`.

---

### 1.2 Core Audit Services (`growthx-ai-crawler/src/modules/`)
Inspection of the backend modules located 10 core domain services and helper utilities governing the audit lifecycle:

| Service / Utility | File Path | Injected Dependencies | Primary Responsibilities |
|---|---|---|---|
| **`CrawlerService`** | `src/modules/crawler/crawler.service.ts` | 19 services (Prisma, Queue, Robots, Sitemap, Fetcher, Analyzers, IssueEngine, Graph, Inventory, etc.) | Central crawler orchestrator: startCrawlJob, processPageFetch, completeJob, rate-limiting, URL normalisation, and completion broadcasts. |
| **`CrawlerProcessor`** | `src/modules/crawler/crawler.processor.ts` | QueueService, CrawlerService | BullMQ queue consumers for `crawl-jobs` and `page-fetch` with render slot concurrency control. |
| **`CrawlEngine`** | `src/modules/crawler/crawl-engine.ts` | FetchService, DiscoveryService | In-process BFS crawler with frontier management, SPA bundle parsing, and fallback crawling. |
| **`IssueEngineService`** | `src/modules/issues/issue-engine.service.ts` | PrismaService | Evaluates 30+ SEO rules (titles, descriptions, canonicals, status codes, headings, schemas, thin content), dedupes findings, and persists `Issue` records. |
| **`HealthScoreCalculator` / `calculateHealthScore`** | `src/modules/issues/health-score.util.ts` | None (pure TS utility) | Computes 0–100 site health score with severity weights (`CRITICAL=20`, `HIGH=8`, `MEDIUM=3`, `LOW=1`), confidence multipliers, and per-URL penalty capping (max 20 pts/page). |
| **`ContentAnalyzerService`** | `src/modules/analyzer/content-analyzer.service.ts` | None (Cheerio & crypto) | Extracts semantic article/main regions, computes word counts, 200 WPM reading time, MD5 contentHash, simHash, heading hierarchy, and boilerplate percentage. |
| **`ImageAnalyzerService`** | `src/modules/analyzer/image-analyzer.service.ts` | None (Cheerio & url) | Analyzes `<img>` tags for `isMissingAlt`, `isLazy`, dimensions, unoptimized large file formats (.bmp, .tiff), and resolves relative image URLs. |
| **`LinkAnalyzerService`** | `src/modules/analyzer/link-analyzer.service.ts` | None (Cheerio & url) | Categorizes internal vs external links, checks `rel="nofollow"`, and validates in-page anchor `#id` fragments against DOM element IDs/names. |
| **`SchemaValidatorService`** | `src/modules/analyzer/schema-validator.service.ts` | None (JSON-LD parser) | Parses `<script type="application/ld+json">` (including `@graph` arrays) and validates properties for Schema.org types (Organization, LocalBusiness, Product, Article, etc.). |
| **`PerformanceService`** | `src/modules/performance/performance.service.ts` | PrismaService, Axios | Invokes Google PageSpeed Insights v5 API for Core Web Vitals (LCP, INP, CLS) and Lighthouse scores; upserts into `Performance` model. |
| **`ValidatorService`** | `src/modules/validator/validator.service.ts` | Axios, TLS | Validates target domain reachability, HTTP status, redirect chains, and TLS/SSL certificate validity/expiry via raw socket. |
| **`RobotsService`** | `src/modules/robots/robots.service.ts` | Axios | Fetches, parses, and caches `robots.txt` directives (Allow, Disallow, Sitemap, Crawl-delay) and evaluates path accessibility with wildcard matching. |
| **`SitemapService`** | `src/modules/sitemap/sitemap.service.ts` | Axios, fast-xml-parser | Discovers and recursively parses XML sitemaps, sitemap indexes, image sitemaps, and video sitemaps up to 5 levels deep. |
| **`GraphService`** | `src/modules/graph/graph.service.ts` | PrismaService | Builds directed internal link graph, calculates in/out degree, BFS crawl depth, link equity scores, and identifies orphan pages. |
| **`HistoryService`** | `src/modules/history/history.service.ts` | PrismaService | Compares two crawl jobs, identifying new, resolved, and recurring SEO audit issues, page count diffs, and issue delta metrics. |
| **`VerificationEngineService`**| `src/modules/crawler/verification-engine.service.ts` | PrismaService, FetcherService | Re-fetches affected URLs to verify issue resolutions, updates `Issue.status = RESOLVED`, and issues a cryptographically signed SHA-256 certificate. |

---

### 1.3 Test Suite State & Test Gap Analysis
- **Test Framework**: Jest 29.7.0 with `ts-jest` 29.2.5, `@nestjs/testing` 10.4.1. Configured in `growthx-ai-crawler/package.json` with `rootDir: "src"`, `testRegex: ".*\\.spec\\.ts$"`, and setup files `jest-setup.ts`.
- **Existing Test Execution Verified**:
  - `src/modules/issues/health-score.spec.ts`: PASSED (5 tests, 1.518s)
  - `src/modules/robots/robots.service.spec.ts`: PASSED (1 test, 1.614s)
  - `src/modules/graph/graph.service.spec.ts`: PASSED (2 tests, 1.568s)
- **Untested Critical Domain Services Identified**:
  The following 7 core audit domain services currently have **0 unit test coverage** in the repository:
  1. `src/modules/performance/performance.service.ts` (0 tests)
  2. `src/modules/validator/validator.service.ts` (0 tests)
  3. `src/modules/sitemap/sitemap.service.ts` (0 tests)
  4. `src/modules/history/history.service.ts` (0 tests)
  5. `src/modules/analyzer/image-analyzer.service.ts` (0 tests)
  6. `src/modules/analyzer/link-analyzer.service.ts` (0 tests)
  7. `src/modules/crawler/verification-engine.service.ts` (0 tests)

---

## 2. Logic Chain

### 2.1 The End-to-End Website Audit Workflow
From domain submission to resolution verification, the website audit workflow traces through six sequential phases:

```
[Phase 1: Pre-Audit Validation]
Website Domain Input ──> ValidatorService (Reachability, TLS)
                     ──> RobotsService (robots.txt parser)
                     ──> SitemapService (XML sitemap discovery)
                               │
[Phase 2: Crawl Orchestration & Frontier]
CrawlerService ──> CrawlJob created (Status: PENDING -> RUNNING)
               ──> CrawlFrontier populated with Seeds & Sitemaps
               ──> CrawlerProcessor / BullMQ workers dispatch PageFetch
               ──> FetcherService / BrowserPoolService retrieves HTML
                               │
[Phase 3: Page-Level Analysis]
Raw / Rendered HTML ──> HtmlExtractorService (Meta tags, status, H1-H3)
                    ──> ContentAnalyzerService (Word count, read time, contentHash, boilerplate)
                    ──> ImageAnalyzerService (Alt tags, dimensions, lazy loading)
                    ──> LinkAnalyzerService (Internal/External links, anchor check)
                    ──> SchemaValidatorService (JSON-LD syntax & type conformance)
                    ──> Upsert Page, Image, Link, Schema entities
                               │
[Phase 4: Issue Detection & Graph Equity]
Page Findings ──> IssueEngineService (30+ rules: titles, canon, 4xx, redirects)
              ──> Issue entities persisted (Severity, Category, DedupKey)
Crawled Edges ──> GraphService (Directed graph, BFS depth, link equity, Orphan detection)
                               │
[Phase 5: Performance & Finalization]
Key Pages     ──> PerformanceService (PageSpeed API -> Core Web Vitals LCP/INP/CLS)
All Pages Done──> HealthScoreCalculator (0-100 score, capped per URL)
              ──> CrawlJob updated (Status: COMPLETED, healthScore, qualityDiagnostics)
Historical    ──> HistoryService (Diff against prior CrawlJob: new / resolved / recurring)
                               │
[Phase 6: Verification & Certification]
Fixed Issues  ──> VerificationEngineService (Re-fetches URLs, confirms fix)
              ──> Issue.status marked RESOLVED
              ──> Signed VerificationCertificate generated (SHA-256)
```

### 2.2 Unit Testing Strategy & Isolation Principles
To meet user requirements **R1** (unit tests for core logic and models) and **R2** (using existing framework conventions):
1. **Zero External I/O**: Tests must never execute live HTTP requests or live database queries. All network clients (`axios`, `tls.connect`) and Prisma models must be mocked.
2. **Pure Cheerio Testing**: `ImageAnalyzerService` and `LinkAnalyzerService` are pure DOM evaluation functions. They can be tested synchronously with rich HTML snippets testing edge cases.
3. **Deterministic Math Testing**: `HealthScoreCalculator` and `GraphService` must be tested for edge boundaries (0 pages, 1000 pages, penalty caps, circular link cycles, disconnect graph components).
4. **Mock Templates via `@nestjs/testing`**: Services should be instantiated using Nest's `Test.createTestingModule({ providers: [...] })` with mock providers for `PrismaService`, `FetcherService`, etc.

---

## 3. Caveats
1. **Playwright / Chromium in CI**: While `CrawlEngine` and `BrowserPoolService` have e2e integration tests using `startFixtureServer`, unit tests for audit analysis logic should strictly avoid launching headless browsers to keep execution time under 2 seconds.
2. **Neon Connection Pooling**: In production, `schema.prisma` uses connection pooling (`-pooler` host) for `DATABASE_URL` and direct connection for `DIRECT_URL`. Unit tests mock `PrismaService` methods entirely, bypassing Prisma schema connection details.
3. **PageSpeed Insights Quota**: `PerformanceService` handles both unkeyed (shared rate limit) and keyed API calls. Unit tests must mock `axios.get` for 200 responses, 429 quota exhaustion, and 500 error scenarios.
4. **TLS Raw Socket Mocking**: `ValidatorService.checkSslCertificate` uses Node's native `tls.connect`. Unit tests must mock `tls.connect` to return simulated peer certificates with specific `valid_to` dates and authorized flags without opening real network sockets.

---

## 4. Conclusion & Unit Testing Blueprints

To achieve comprehensive test coverage for the core Website Audit models and logic, the following unit test suites should be implemented in `growthx-ai-crawler/src/modules/`:

### 4.1 Unit Test Blueprint: `ImageAnalyzerService`
- **File**: `src/modules/analyzer/image-analyzer.service.spec.ts`
- **Target Logic**: `ImageAnalyzerService.analyzeImages($, pageUrl)`
- **Test Cases**:
  1. Detect missing `alt` attribute or whitespace-only `alt`.
  2. Detect valid `alt` text and trim appropriately.
  3. Detect lazy loading via `loading="lazy"` or `data-src`.
  4. Flag unoptimized image formats (`.bmp`, `.tiff`) or oversized dimensions (`width > 1920`) as `isLarge: true`.
  5. Correctly resolve relative URLs (`/images/hero.png` -> `https://example.com/images/hero.png`).
  6. Ignore `data:image` inline base64 images.

```typescript
import { ImageAnalyzerService } from './image-analyzer.service';
import * as cheerio from 'cheerio';

describe('ImageAnalyzerService', () => {
  let service: ImageAnalyzerService;

  beforeEach(() => {
    service = new ImageAnalyzerService();
  });

  it('detects missing alt text and unoptimized formats', () => {
    const html = `
      <img src="/assets/hero.bmp" width="2000" height="1000" />
      <img src="https://example.com/logo.png" alt="Company Logo" loading="lazy" />
      <img src="/avatar.jpg" alt="   " />
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA" />
    `;
    const $ = cheerio.load(html);
    const results = service.analyzeImages($, 'https://example.com/blog/post-1');

    expect(results).toHaveLength(3); // data URI ignored
    // First image: bmp + >1920 width => isLarge=true, isMissingAlt=true
    expect(results[0].imageUrl).toBe('https://example.com/assets/hero.bmp');
    expect(results[0].isMissingAlt).toBe(true);
    expect(results[0].isLarge).toBe(true);
    expect(results[0].width).toBe(2000);

    // Second image: valid alt, lazy
    expect(results[1].altText).toBe('Company Logo');
    expect(results[1].isMissingAlt).toBe(false);
    expect(results[1].isLazy).toBe(true);

    // Third image: blank whitespace alt => isMissingAlt=true
    expect(results[2].isMissingAlt).toBe(true);
  });
});
```

---

### 4.2 Unit Test Blueprint: `LinkAnalyzerService`
- **File**: `src/modules/analyzer/link-analyzer.service.spec.ts`
- **Target Logic**: `LinkAnalyzerService.analyzeLinks($, pageUrl)`
- **Test Cases**:
  1. Accurately classify internal links vs external links based on origin.
  2. Detect `rel="nofollow"`, `rel="sponsored"`, and `rel="ugc"`.
  3. Detect broken same-page anchor links (`#pricing`) when `#pricing` does not exist in the DOM.
  4. Verify valid same-page anchor links when matching `<div id="pricing">` or `<a name="pricing">` exists.
  5. Ignore `javascript:`, `mailto:`, and `tel:` links.

```typescript
import { LinkAnalyzerService } from './link-analyzer.service';
import * as cheerio from 'cheerio';

describe('LinkAnalyzerService', () => {
  let service: LinkAnalyzerService;

  beforeEach(() => {
    service = new LinkAnalyzerService();
  });

  it('classifies internal/external links and identifies broken anchor references', () => {
    const html = `
      <div id="features">Features Section</div>
      <a href="/about">About Us</a>
      <a href="https://external-partner.com" rel="nofollow">Partner</a>
      <a href="#features">Jump to features</a>
      <a href="#non-existent-section">Jump to missing</a>
      <a href="mailto:support@example.com">Email</a>
    `;
    const $ = cheerio.load(html);
    const result = service.analyzeLinks($, 'https://example.com/product');

    expect(result.internalCount).toBe(1); // /about
    expect(result.externalCount).toBe(1); // external-partner.com
    expect(result.nofollowLinks).toHaveLength(1);
    expect(result.brokenAnchors).toHaveLength(1);
    expect(result.brokenAnchors[0].rawHref).toBe('#non-existent-section');
    expect(result.brokenAnchors[0].isBrokenAnchor).toBe(true);
  });
});
```

---

### 4.3 Unit Test Blueprint: `ValidatorService`
- **File**: `src/modules/validator/validator.service.spec.ts`
- **Target Logic**: `ValidatorService.validateWebsite(targetDomainOrUrl)`
- **Dependencies to Mock**: `axios.get`, `tls.connect`
- **Test Cases**:
  1. Return `isReachable: true`, `statusCode: 200`, `isHttps: true`, and valid SSL when site is healthy.
  2. Return `isReachable: false` and error message when HTTP response is >= 500 or connection fails.
  3. Capture redirect chains (e.g. `http://` -> `https://` -> `https://www.`).
  4. Handle expired or unauthorized SSL certificates (`sslValid: false`).

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ValidatorService } from './validator.service';
import axios from 'axios';
import * as tls from 'tls';

jest.mock('axios');
jest.mock('tls');

describe('ValidatorService', () => {
  let service: ValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidatorService],
    }).compile();

    service = module.get<ValidatorService>(ValidatorService);
  });

  it('validates a reachable domain with valid SSL certificate', async () => {
    // Mock TLS socket
    const mockSocket: any = {
      authorized: true,
      getPeerCertificate: jest.fn().mockReturnValue({
        valid_to: new Date(Date.now() + 86400000 * 30).toISOString(),
      }),
      end: jest.fn(),
      setTimeout: jest.fn(),
      on: jest.fn(),
    };
    (tls.connect as jest.Mock).mockImplementation((port, host, opts, callback) => {
      callback();
      return mockSocket;
    });

    // Mock Axios response
    (axios.get as jest.Mock).mockResolvedValue({
      status: 200,
      request: { res: { responseUrl: 'https://example.com/' } },
    });

    const result = await service.validateWebsite('example.com');
    expect(result.isReachable).toBe(true);
    expect(result.isHttps).toBe(true);
    expect(result.sslValid).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('handles unreachable domain gracefully with error message', async () => {
    (tls.connect as jest.Mock).mockImplementation(() => {
      throw new Error('TLS Handshake timeout');
    });
    (axios.get as jest.Mock).mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

    const result = await service.validateWebsite('invalid-domain-xyz.com');
    expect(result.isReachable).toBe(false);
    expect(result.errorMessage).toContain('ENOTFOUND');
  });
});
```

---

### 4.4 Unit Test Blueprint: `SitemapService`
- **File**: `src/modules/sitemap/sitemap.service.spec.ts`
- **Target Logic**: `SitemapService.discoverAndParseSitemaps(domain, knownUrls)`
- **Dependencies to Mock**: `axios.get`
- **Test Cases**:
  1. Parse standard XML `<urlset>` and extract `<loc>`, `<lastmod>`, `<priority>`.
  2. Parse `<sitemapindex>` and recursively fetch and parse nested child sitemaps.
  3. Extract embedded image extensions (`<image:loc>`, `<image:title>`).
  4. Deduplicate URLs across multiple sitemap files.
  5. Handle XML parse errors or 404 responses gracefully without throwing.

```typescript
import { SitemapService } from './sitemap.service';
import axios from 'axios';

jest.mock('axios');

describe('SitemapService', () => {
  let service: SitemapService;

  beforeEach(() => {
    service = new SitemapService();
  });

  it('parses sitemap index and recursively discovers URLs', async () => {
    const sitemapIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
      <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <sitemap><loc>https://example.com/sub-sitemap.xml</loc></sitemap>
      </sitemapindex>`;

    const childSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
        <url>
          <loc>https://example.com/page-1</loc>
          <priority>0.8</priority>
          <image:image><image:loc>https://example.com/img1.jpg</image:loc></image:image>
        </url>
      </urlset>`;

    (axios.get as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('sub-sitemap.xml')) {
        return Promise.resolve({ data: childSitemapXml });
      }
      if (url.includes('sitemap.xml')) {
        return Promise.resolve({ data: sitemapIndexXml });
      }
      return Promise.reject(new Error('Not found'));
    });

    const result = await service.discoverAndParseSitemaps('https://example.com');
    expect(result.sitemapsDiscovered).toContain('https://example.com/sitemap.xml');
    expect(result.sitemapsDiscovered).toContain('https://example.com/sub-sitemap.xml');
    expect(result.urls).toHaveLength(1);
    expect(result.urls[0].loc).toBe('https://example.com/page-1');
    expect(result.urls[0].priority).toBe(0.8);
    expect(result.urls[0].images?.[0].loc).toBe('https://example.com/img1.jpg');
  });
});
```

---

### 4.5 Unit Test Blueprint: `HistoryService`
- **File**: `src/modules/history/history.service.spec.ts`
- **Target Logic**: `HistoryService.compareCrawlJobs(currentJobId, previousJobId)`
- **Dependencies to Mock**: `PrismaService` (`crawlJob.findUnique`, `issue.findMany`)
- **Test Cases**:
  1. Throw `NotFoundException` if either current or previous crawl job does not exist.
  2. Accurately categorize new issues present in current job but absent in previous.
  3. Accurately categorize resolved issues present in previous job but absent in current.
  4. Accurately categorize recurring issues present in both jobs.
  5. Correctly calculate `pageCountDiff` and `issuesCountDiff`.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HistoryService } from './history.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('HistoryService', () => {
  let service: HistoryService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      crawlJob: { findUnique: jest.fn() },
      issue: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<HistoryService>(HistoryService);
  });

  it('throws NotFoundException when job is missing', async () => {
    mockPrisma.crawlJob.findUnique.mockResolvedValueOnce(null);
    await expect(service.compareCrawlJobs('job_2', 'job_1')).rejects.toThrow(NotFoundException);
  });

  it('correctly calculates new, resolved, and recurring issues', async () => {
    mockPrisma.crawlJob.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === 'job_2') return Promise.resolve({ id: 'job_2', pagesCrawled: 15 });
      if (where.id === 'job_1') return Promise.resolve({ id: 'job_1', pagesCrawled: 10 });
      return Promise.resolve(null);
    });

    // Previous job has issue A and issue B
    const prevIssues = [
      { issueType: 'MISSING_TITLE', affectedUrl: 'https://example.com/p1', severity: 'HIGH', description: 'desc1' },
      { issueType: 'BROKEN_LINK', affectedUrl: 'https://example.com/p2', severity: 'MEDIUM', description: 'desc2' },
    ];
    // Current job has issue A (recurring) and issue C (new); issue B is resolved
    const currIssues = [
      { issueType: 'MISSING_TITLE', affectedUrl: 'https://example.com/p1', severity: 'HIGH', description: 'desc1' },
      { issueType: 'SLOW_PAGE', affectedUrl: 'https://example.com/p3', severity: 'LOW', description: 'desc3' },
    ];

    mockPrisma.issue.findMany.mockImplementation(({ where }: any) => {
      if (where.crawlJobId === 'job_2') return Promise.resolve(currIssues);
      if (where.crawlJobId === 'job_1') return Promise.resolve(prevIssues);
      return Promise.resolve([]);
    });

    const diff = await service.compareCrawlJobs('job_2', 'job_1');

    expect(diff.pageCountDiff).toBe(5); // 15 - 10
    expect(diff.issuesCountDiff).toBe(0); // 2 - 2
    expect(diff.recurringIssues).toHaveLength(1);
    expect(diff.recurringIssues[0].issueType).toBe('MISSING_TITLE');
    expect(diff.newIssues).toHaveLength(1);
    expect(diff.newIssues[0].issueType).toBe('SLOW_PAGE');
    expect(diff.resolvedIssues).toHaveLength(1);
    expect(diff.resolvedIssues[0].issueType).toBe('BROKEN_LINK');
  });
});
```

---

### 4.6 Unit Test Blueprint: `PerformanceService`
- **File**: `src/modules/performance/performance.service.spec.ts`
- **Target Logic**: `PerformanceService.fetchPageSpeedMetrics(pageId, targetUrl, strategy)`
- **Dependencies to Mock**: `PrismaService` (`performance.upsert`), `axios.get`
- **Test Cases**:
  1. Parse Google PageSpeed Insights API response and calculate rounded Lighthouse scores and Core Web Vitals (LCP, INP, CLS).
  2. Persist metrics via `prisma.performance.upsert({ where: { pageId } })`.
  3. Return empty object and log warning on 429 quota exhaustion without crashing.
  4. Return empty object when PageSpeed API returns non-200 or missing category metrics.

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceService } from './performance.service';
import { PrismaService } from '../../database/prisma.service';
import axios from 'axios';

jest.mock('axios');

describe('PerformanceService', () => {
  let service: PerformanceService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      performance: { upsert: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PerformanceService>(PerformanceService);
  });

  it('fetches and parses Core Web Vitals and persists to database', async () => {
    (axios.get as jest.Mock).mockResolvedValue({
      status: 200,
      data: {
        lighthouseResult: {
          categories: {
            performance: { score: 0.85 },
            accessibility: { score: 0.92 },
            'best-practices': { score: 0.90 },
            seo: { score: 0.95 },
          },
          audits: {
            'largest-contentful-paint': { numericValue: 1850.4 },
            'interaction-to-next-paint': { numericValue: 120.2 },
            'cumulative-layout-shift': { numericValue: 0.0456 },
          },
        },
      },
    });

    const metrics = await service.fetchPageSpeedMetrics('page_123', 'https://example.com');
    expect(metrics.performanceScore).toBe(85);
    expect(metrics.accessibilityScore).toBe(92);
    expect(metrics.lcpMs).toBe(1850.4);
    expect(metrics.clsScore).toBe(0.046);

    expect(mockPrisma.performance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pageId: 'page_123' },
        create: expect.objectContaining({ performanceScore: 85, lcpMs: 1850.4 }),
      }),
    );
  });

  it('handles 429 quota exhaustion gracefully without writing invalid metrics', async () => {
    (axios.get as jest.Mock).mockRejectedValue({ response: { status: 429 } });

    const metrics = await service.fetchPageSpeedMetrics('page_123', 'https://example.com');
    expect(metrics).toEqual({});
    expect(mockPrisma.performance.upsert).not.toHaveBeenCalled();
  });
});
```

---

### 4.7 Unit Test Blueprint: `VerificationEngineService`
- **File**: `src/modules/crawler/verification-engine.service.spec.ts`
- **Target Logic**: `VerificationEngineService.runVerification(orgId, projectId, options)`
- **Dependencies to Mock**: `PrismaService` (`website.findFirst`, `issue.findMany`, `issue.updateMany`), `FetcherService` (`fetchPage`)
- **Test Cases**:
  1. Throw `NotFoundException` if no website exists for project.
  2. Verify resolved issue when page now has title, meta description, and canonical.
  3. Mark verified issues as `status = 'RESOLVED'` via `prisma.issue.updateMany`.
  4. Generate signed `VerificationCertificate` with SHA-256 checksum and items breakdown.
  5. Handle unverified/failing issue scenarios (`status = 'PARTIAL'` or `'FAILED'`).

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { VerificationEngineService } from './verification-engine.service';
import { PrismaService } from '../../database/prisma.service';
import { FetcherService } from './fetcher.service';

describe('VerificationEngineService', () => {
  let service: VerificationEngineService;
  let mockPrisma: any;
  let mockFetcher: any;

  beforeEach(async () => {
    mockPrisma = {
      website: { findFirst: jest.fn() },
      crawlJob: { findFirst: jest.fn() },
      issue: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    mockFetcher = {
      fetchPage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FetcherService, useValue: mockFetcher },
      ],
    }).compile();

    service = module.get<VerificationEngineService>(VerificationEngineService);
  });

  it('re-crawls affected URL, marks issue as RESOLVED, and generates certificate', async () => {
    mockPrisma.website.findFirst.mockResolvedValue({
      id: 'web_1',
      domain: 'example.com',
      url: 'https://example.com',
      project: { id: 'proj_1' },
    });

    mockPrisma.issue.findMany.mockResolvedValue([
      {
        id: 'iss_1',
        issueType: 'MISSING_TITLE',
        severity: 'HIGH',
        affectedUrl: 'https://example.com/page-1',
        description: 'Missing title',
        recommendation: 'Add title',
        status: 'OPEN',
        evidence: null,
      },
    ]);

    mockFetcher.fetchPage.mockResolvedValue({
      url: 'https://example.com/page-1',
      finalUrl: 'https://example.com/page-1',
      statusCode: 200,
      responseTimeMs: 95,
      html: '<!doctype html><html><head><title>Now Has Title</title><meta name="description" content="Desc"></head><body><h1>Hello</h1></body></html>',
      redirectChain: ['https://example.com/page-1'],
      engine: 'cheerio',
    });

    const cert = await service.runVerification('org_1', 'proj_1', { issueIds: ['iss_1'] });

    expect(cert.status).toBe('PASSED');
    expect(cert.passedCount).toBe(1);
    expect(cert.checksum).toHaveLength(64); // Valid SHA-256 hex
    expect(mockPrisma.issue.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['iss_1'] } },
      data: { status: 'RESOLVED' },
    });
  });
});
```

---

## 5. Verification Method

### 5.1 Test Execution Verification Commands
All existing and future unit tests in `growthx-ai-crawler` can be independently verified using the standard Jest test runner:

```bash
# In directory: growthx-ai-crawler
cd "growthx-ai-crawler"

# Run a specific spec file:
npx jest src/modules/issues/health-score.spec.ts
npx jest src/modules/robots/robots.service.spec.ts
npx jest src/modules/graph/graph.service.spec.ts

# Run newly authored unit test specs:
npx jest src/modules/analyzer/image-analyzer.service.spec.ts
npx jest src/modules/analyzer/link-analyzer.service.spec.ts
npx jest src/modules/validator/validator.service.spec.ts
npx jest src/modules/sitemap/sitemap.service.spec.ts
npx jest src/modules/history/history.service.spec.ts
npx jest src/modules/performance/performance.service.spec.ts
npx jest src/modules/crawler/verification-engine.service.spec.ts

# Run the full crawler test suite:
npm test
```

### 5.2 Invalidation Conditions
- Any unit test that fails to mock external HTTP (`axios.get`), socket connections (`tls.connect`), or database calls (`PrismaService`) and attempts live external network I/O will fail in offline or sandboxed environments.
- Any unit test using hardcoded URLs without origin normalization will break if the underlying normalizer changes.
- Tests creating real BullMQ workers or connecting to live Redis without mocking `QueueService` will deadlock on module initialization.
