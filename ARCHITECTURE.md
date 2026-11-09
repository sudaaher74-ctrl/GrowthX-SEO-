# GrowthX SEO — Developer & Architecture Handbook

Welcome to the **GrowthX SEO** codebase. This document outlines the monorepo architecture, directory topology, design conventions, state management rules, and quality gates so any developer can immediately navigate, build, and contribute.

---

## 1. Monorepo Topology & High-Level Architecture

The repository is organized as an npm workspaces monorepo containing two core services:

```
GrowthX-SEO/
├── package.json              # Monorepo root workspace configuration & unified scripts
├── docker-compose.yml        # Full-stack orchestrator (PostgreSQL, Redis, NestJS, Next.js)
├── render.yaml               # Cloud infrastructure blueprint
├── ARCHITECTURE.md           # This developer architecture handbook
├── README.md                 # Project overview and deployment guide
│
├── growthx-ai-seo/           # [Frontend] Next.js 16 + React 19 App Router dashboard & landing
│   ├── src/
│   │   ├── app/              # Next.js App Router (Routes & Route Groups)
│   │   ├── components/       # Feature-driven UI components & Console design system
│   │   ├── hooks/            # Shared React Query hooks & custom abstractions
│   │   └── lib/              # API clients, staging engine, domain calculation engines
│   ├── scripts/              # CI checkers: check-no-fabricated-data & check-design-tokens
│   └── e2e/                  # Playwright end-to-end test suites
│
└── growthx-ai-crawler/       # [Backend] NestJS 11 enterprise crawler, API & worker engine
    ├── src/
    │   ├── modules/          # Domain micro-modules (Crawler, AI, Backlinks, Search, etc.)
    │   ├── database/         # Prisma client & PostgreSQL database schema
    │   ├── storage/          # Local / S3 blob storage integrations
    │   ├── main.ts           # HTTP REST & WebSocket API entrypoint (Port 3000)
    │   └── main-worker.ts    # Headless Playwright & BullMQ background crawl worker
    └── prisma/               # Database migrations and Prisma schema
```

---

## 2. Quick Start for Developers

From the repository root, you can control the entire stack:

```bash
# 1. Install all dependencies across both packages
npm install

# 2. Run developer servers
npm run dev:frontend          # Runs Next.js dashboard on http://localhost:3001
npm run dev:backend           # Runs NestJS API on http://localhost:3000

# 3. Quality & Safety Verification
npm run check                 # Runs check:data (no mock data) & check:design (token compliance)
npm run build                 # Builds frontend (all 56 static routes)
```

---

## 3. Frontend Architecture (`growthx-ai-seo`)

### 3.1 Routing Structure (`src/app/`)
The frontend uses the Next.js App Router with Route Groups:
- `(dashboard)/`: Authenticated client workspace. Includes the 9 primary platform pillars:
  1. `/dashboard`: Portfolio overview, quick-jump navigation, active telemetry beacons.
  2. `/website`: Deep technical audit, crawl issues, and content quality.
  3. `/traffic`: Google Analytics 4 traffic telemetry, attribution ribbon, and geo visitor map.
  4. `/competitor-intelligence`: Live rival crawler, SERP gap radar, and side-by-side battleground matrix.
  5. `/organic-search`: Google Search Console rankings, SERP position distribution, striking distance radar.
  6. `/ai-visibility`: LLM recommendation monitoring (ChatGPT, Gemini, Claude, Perplexity), GEO playbook.
  7. `/backlinks`: Live link verifier, competitor link gap intersect, authority link outreach.
  8. `/fix-engine`: Autonomous orchestrator uniting staged fixes with GitHub PR and CMS deployments.
  9. `/monthly-report`: Client-ready deliverable report with verified proof and executive telemetry.
- `(marketing)/`: Public landing page, pricing, feature highlights, and conversion flows.
- `api/`: Lightweight proxy endpoints (e.g. GitHub OAuth callback).

### 3.2 Component Architecture (`src/components/`)
Components are strictly grouped by domain feature:
```
src/components/
├── ui/                       # Universal Design System (Console primitives & truthful states)
│   ├── index.ts              # Clean barrel export for all UI primitives
│   ├── console.tsx           # ActionButton, Panel, Pill, Kpi, Table, StatusNote, Tabs
│   ├── query-state.tsx       # Standardized TanStack Query wrapper (loading/empty/error states)
│   └── truthful-state.tsx    # Truthful state handlers (NoDataState, LoadingState, FailedState)
├── layout/                   # Topnav, Sidebar, NavItems, Admin header
├── dashboard/                # Dashboard overview cards & jump bar
├── website/                  # Audit tables, content inspector, crawl views
├── google/                   # Organic search, keywords view, Google Search Console & GA4
├── competitor/               # Rival radar, gap finder, battleground matrix
├── backlinks/                # Backlink workspace, competitor link gap, overview
├── ai-visibility/            # Visibility journey, multi-LLM head-to-head cards
└── fix-engine/               # Milestone stepper, plan view, self-healing pipeline
```

### 3.3 State Management & Staging Engine (`src/lib/staging-engine.ts`)
- **Server Data**: Fetched using `@tanstack/react-query` (`useQuery`, `useMutation`).
- **Autonomous Staging Engine**: Staged fixes (from Website Audit, Competitors, Organic Keywords, AI Visibility, Backlinks) are persisted via `stagingEngine`.
- **Sync Architecture**: Staged fixes are written optimistically to `memoryStore` and browser storage, then flushed to `/api/projects/:id/saved-plans` on the backend. This ensures the UI is responsive, works offline, and syncs across team members.

### 3.4 Design Token Enforcement
- **Zero Raw Hex Colors**: The project strictly prohibits raw `#hex` codes in application code.
- **Tokens**: Use semantic Tailwind classes (`bg-surface-1`, `border-brand-200`, `text-brand-950`, `bg-signal-400`, `text-signal-ink`, `bg-success-500`, `text-error-700`).
- **Verification**: Run `npm run check:design` to audit against baselined design token rules.

### 3.5 Truthful Data Policy (Zero Fabricated Data)
- Every metric, figure, and chart must originate from a verified crawl, Google API, or LLM evaluation.
- Never inject fake placeholder charts or hardcoded demo values.
- **Verification**: Run `npm run check:data` before committing (11 automated AST verification rules).

---

## 4. Backend Architecture (`growthx-ai-crawler`)

### 4.1 NestJS Modular Design
The backend is organized into high-cohesion domain modules in `src/modules/`:
- `crawler/`: Headless Playwright crawler with rate limiting, canonical resolution, and DOM extraction.
- `ai/` & `ai-visibility/`: Model evaluation pipelines connecting Gemini, OpenAI, Claude, and Perplexity.
- `search-intelligence/`: Google Search Console and DataForSEO SERP data pipelines.
- `backlinks/`: Link verifier, link gap intersect engine, and outreach pitch generator.
- `issues/`: Deterministic technical SEO detector rules (404s, redirect chains, schema defects).
- `automation/` & `autonomous-engineer/`: GitHub PR generation, CMS patchers (WordPress, Shopify, Webflow).

### 4.2 Data Storage & Workers
- **Database**: PostgreSQL 15 accessed via Prisma ORM (`prisma/schema.prisma`).
- **Task Queue**: Redis 7 running BullMQ for crawl job orchestration and rate-limited API calls.
- **Workers**: `main-worker.ts` operates as an independent background worker process.

---

## 5. Adding New Features: Step-by-Step

When creating a new feature or tab:
1. **Define Types & API Call**: Add request/response types in `src/lib/api-types.ts` and method in `src/lib/api-client.ts`.
2. **Create Hook**: Wrap the API call with TanStack Query in `src/hooks/` and export in `src/hooks/index.ts`.
3. **Build Feature Components**: Place in `src/components/<feature-name>/`, using `Panel`, `Kpi`, `ActionButton` from `@/components/ui`.
4. **Connect Staging Engine**: If the feature uncovers an actionable opportunity, provide a 1-click `stagingEngine.stage(projectId, {...})` trigger so users can stage it directly into Fix Engine.
5. **Verify**:
   ```bash
   npm run check
   npm run build
   ```
