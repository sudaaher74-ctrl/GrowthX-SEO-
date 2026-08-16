# GrowthX AI Enterprise Website Crawler 🚀

An enterprise-grade, high-performance Technical SEO audit platform and distributed website crawler built for **GrowthX AI**. Designed to rival industry leaders like Screaming Frog, Semrush Site Audit, Ahrefs Site Audit, and Search Atlas.

---

## 🌟 Key Features

1. **Enterprise Security & Verification**: Strict DNS TXT token challenge authentication ensuring customers only audit domains they own or control. AES-GCM-256 encryption for sensitive credentials.
2. **Distributed Queue Engine**: Powered by **BullMQ** and **Redis Cluster**, supporting horizontally scalable workers, automatic retries, exponential backoff, rate limiting, and crawl delay controls.
3. **Hybrid Fetcher Architecture**: Intelligent routing between high-speed static HTML parsing (**Cheerio** & Axios) and headless browser rendering (**Playwright** Chromium) for Single Page Applications (SPAs) and dynamic JavaScript frameworks (React, Vue, Angular, Next.js).
4. **Deep Technical SEO Extraction**:
   - Meta tags, Open Graph, Twitter Cards, Canonical URLs, and Robots meta directives.
   - H1-H6 heading hierarchy trees and jump detection.
   - Image analysis (alt attribute validation, lazy loading checks, broken image detection, unoptimized hero sizing).
   - Link classification (internal vs. external, nofollow detection, broken anchor `#target` verification, redirect chain tracking, redirect loop prevention).
5. **Structured Data Validator**: Deep validation of 10 schema types: `Organization`, `LocalBusiness`, `Product`, `Article`, `BreadcrumbList`, `FAQPage`, `Review`, `VideoObject`, `Recipe`, and `Event`.
6. **Core Web Vitals & Performance**: Native Google PageSpeed Insights API integration evaluating **LCP** (Largest Contentful Paint), **INP** (Interaction to Next Paint), and **CLS** (Cumulative Layout Shift).
7. **25+ Automated Issue Engine**: Automated grading into Critical, High, Medium, and Low severity tiers with actionable recommendations and AI auto-fix eligibility.
8. **Internal Link Graph & PageRank Proxy**: Directed graph computation determining exact BFS shortest-path click depth, orphan pages (0 incoming links), excessive crawl depth (> 3 clicks), and iterative PageRank link equity distribution.
9. **AI Analysis & Auto-Fix Lifecycle**:
   - **AI Explanations**: Deep analysis of root causes, SEO impact, business pipeline impact, and priority grading (1-100) using Google Gemini or OpenAI GPT-4o.
   - **Auto-Fix Patches**: Automated generation of drop-in HTML `<head>` code snippets, schema JSON-LD payloads, and alt text patches.
   - **Lifecycle Gating**: Strict `PENDING_APPROVAL` -> `APPROVED` -> `APPLIED` workflow ensuring no changes occur without user authorization.
10. **Historical Diff Reports & Scheduling**: Automated job-to-job diff comparisons highlighting new, resolved, and recurring issues. Built-in daily/weekly/monthly cron scheduler and webhook triggers for CI/CD deployment pipelines.

---

## 🛠️ Architecture & Tech Stack

- **Framework**: NestJS 10 (TypeScript, Modular Architecture)
- **Database**: PostgreSQL 16 with Prisma ORM
- **Cache & Queue**: Redis 7 & BullMQ
- **Scraping Engine**: Cheerio (Static HTML) + Playwright Chromium (Dynamic SPAs)
- **Observability**: OpenTelemetry metrics exported to Prometheus & Grafana
- **API Documentation**: OpenAPI / Swagger (`/api/docs`)

---

## 🚀 Quick Start (Docker Compose)

The easiest way to launch the complete GrowthX AI Crawler stack (API, PostgreSQL, Redis, Prometheus, and Grafana) is via Docker Compose:

```bash
# 1. Clone repo and enter directory
cd growthx-ai-crawler

# 2. Start the full infrastructure
docker-compose up --build -d

# 3. Check logs
docker-compose logs -f crawler-api
```

### Accessing Services:
- **Crawler REST API & Swagger Docs**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Prometheus Metrics**: [http://localhost:9090](http://localhost:9090)
- **Grafana Dashboard**: [http://localhost:3001](http://localhost:3001) *(Login: `admin` / `admin`)*

---

## 💻 Local Development Setup

If running locally outside of Docker:

```bash
# 1. Install dependencies
npm install

# 2. Install Playwright browser binaries
npx playwright install chromium

# 3. Copy environment variables
cp .env.example .env

# 4. Generate Prisma Client and apply migrations
npm run prisma:generate
npm run prisma:migrate

# 5. Start development server
npm run start:dev
```

---

## 🗄️ Database migrations

The container applies pending migrations on start (`docker-entrypoint.sh` runs
`prisma migrate deploy` before the API boots). Schema changes therefore ship
with the code — do not use `prisma db push` against a deployed environment.

To change the schema:

```bash
# Edit prisma/schema.prisma, then generate a migration from it
npx prisma migrate dev --name describe_your_change
```

### One-time baseline for the existing production database

The production database was previously maintained with `db push`, so its tables
exist but are not all recorded in Prisma's `_prisma_migrations` ledger. A plain
`migrate deploy` there will fail with "relation already exists" — the migration
is correct, the ledger just does not know it has effectively been applied.

Run this **once**, against production, before the first deploy of this change:

```bash
npx prisma migrate resolve --applied 20260810100711_init
npx prisma migrate resolve --applied 20260815000000_add_local_outreach_reporting_integrations
```

Marking a migration `--applied` records it as done without executing its SQL.
If the first command reports it is already recorded, skip it and run the second.
After this, deploys apply migrations normally.

A failure here is loud and transactional — nothing is half-applied — so if the
deploy stops on this step, run the commands above and redeploy.

---

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run e2e tests
npm run test:e2e
```
