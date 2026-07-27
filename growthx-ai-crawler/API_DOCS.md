# GrowthX AI Enterprise Website Crawler — API Reference 📚

Base URL: `http://localhost:3000/api`  
OpenAPI / Swagger Interactive UI: `http://localhost:3000/api/docs`

---

## 1. Website Verification & Security

### `POST /api/websites`
Register a new customer website for SEO auditing.
- **Request Body**:
  ```json
  {
    "url": "https://growthx.ai",
    "domain": "growthx.ai"
  }
  ```
- **Response**:
  ```json
  {
    "id": "cm0a1b2c3d4e5f6g7h8i9j0k",
    "domain": "growthx.ai",
    "url": "https://growthx.ai",
    "isVerified": false,
    "verificationToken": "growthx-verify-a1b2c3d4e5f6...",
    "instructions": "Add a DNS TXT record for _growthx-challenge.growthx.ai with value: growthx-verify-a1b2c3..."
  }
  ```

### `POST /api/websites/:id/verify`
Verify domain ownership by checking DNS TXT records.
- **Path Parameter**: `id` (Website UUID)
- **Response**:
  ```json
  {
    "success": true,
    "isVerified": true,
    "message": "Domain growthx.ai verified successfully."
  }
  ```

---

## 2. Crawl Execution & Status

### `POST /api/crawls/start`
Initiate a new high-concurrency crawl job for a verified website.
- **Request Body**:
  ```json
  {
    "websiteId": "cm0a1b2c3d4e5f6g7h8i9j0k",
    "maxConcurrency": 10,
    "maxDepth": 5,
    "useSitemap": true
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "jobId": "cm0job999888777666555444",
    "message": "Crawl job initiated and dispatched to BullMQ distributed workers."
  }
  ```

### `GET /api/crawls/:id`
Retrieve progress, status, and summary metrics for a crawl job.
- **Response**:
  ```json
  {
    "id": "cm0job999888777666555444",
    "websiteId": "cm0a1b2c3d4e5f6g7h8i9j0k",
    "status": "COMPLETED",
    "pagesCrawled": 142,
    "issuesFound": 38,
    "concurrency": 10,
    "depthLimit": 5,
    "startedAt": "2026-07-27T08:00:00.000Z",
    "finishedAt": "2026-07-27T08:02:15.000Z"
  }
  ```

---

## 3. SEO Issues & Link Graph Reports

### `GET /api/crawls/:id/issues`
Retrieve paginated list of Technical SEO issues detected during crawl.
- **Query Parameters**:
  - `severity` (Optional): `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
  - `page`: Page number (Default: `1`)
  - `limit`: Items per page (Default: `50`)
- **Response**:
  ```json
  {
    "data": [
      {
        "id": "issue_101",
        "issueType": "MISSING_TITLE",
        "severity": "CRITICAL",
        "affectedUrl": "https://growthx.ai/pricing",
        "description": "Page does not have an HTML <title> tag.",
        "recommendation": "Add a unique, descriptive <title> tag between 30 and 60 characters.",
        "status": "OPEN",
        "aiFixAvailable": true
      }
    ],
    "meta": { "total": 38, "page": 1, "limit": 50, "totalPages": 1 }
  }
  ```

### `GET /api/crawls/:id/graph`
Retrieve directed internal link graph, crawl depth, link equity scores, and orphan page report.
- **Response**:
  ```json
  {
    "jobId": "cm0job999888777666555444",
    "totalNodes": 142,
    "totalEdges": 850,
    "orphanPages": ["https://growthx.ai/hidden-promo"],
    "excessiveDepthPages": ["https://growthx.ai/deep/category/item/4"],
    "nodes": [
      {
        "url": "https://growthx.ai",
        "crawlDepth": 0,
        "inDegree": 141,
        "outDegree": 25,
        "linkEquityScore": 8.4512,
        "isOrphan": false,
        "isExcessiveDepth": false
      }
    ]
  }
  ```

### `GET /api/crawls/:id/diff?compareWith=:previousId`
Compare current crawl against a previous audit report.
- **Response**:
  ```json
  {
    "currentJobId": "cm0job_curr",
    "previousJobId": "cm0job_prev",
    "pageCountDiff": 12,
    "issuesCountDiff": -5,
    "newIssues": [],
    "resolvedIssues": [
      {
        "issueType": "BROKEN_LINK_4XX",
        "severity": "CRITICAL",
        "affectedUrl": "https://growthx.ai/old-link",
        "description": "Page returned HTTP status code 404."
      }
    ],
    "recurringIssues": [],
    "summaryMessage": "Comparison complete: 0 new issues detected, 1 issues resolved, and 37 issues remain open."
  }
  ```

---

## 4. AI Analysis & Auto-Fix Workflows

### `POST /api/issues/:id/analyze`
Trigger AI explanation (root causes, SEO impact, business impact, priority grading).
- **Response**:
  ```json
  {
    "whyItMatters": "The HTML <title> tag is the single most critical on-page SEO element...",
    "seoImpact": "Improper titles cause immediate drops in keyword relevancy...",
    "businessImpact": "Lower SERP click-through rates directly reduce organic pipeline...",
    "priorityScore": 95,
    "recommendedFix": "Craft a compelling title tag between 50-58 characters...",
    "expectedOutcome": "15-25% increase in organic SERP click-through rate within 14 days."
  }
  ```

### `POST /api/issues/:id/autofix`
Generate drop-in code snippet / text patch for an automated fix.
- **Response**:
  ```json
  {
    "fixType": "META_TITLE",
    "targetUrl": "https://growthx.ai/pricing",
    "originalValue": "None",
    "proposedValue": "Pricing | Enterprise Software Solutions - GrowthX AI",
    "codeSnippet": "<title>Pricing | Enterprise Software Solutions - GrowthX AI</title>"
  }
  ```

### `POST /api/issues/:id/approve`
Approve AI recommendation patch to be executed and applied.
- **Request Body**:
  ```json
  {
    "userId": "admin_user_1"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Successfully approved and applied AI fix patch for issue on https://growthx.ai/pricing. Issue marked RESOLVED.",
    "patch": {
      "fixType": "META_TITLE",
      "codeSnippet": "<title>Pricing | Enterprise Software Solutions - GrowthX AI</title>"
    }
  }
  ```
