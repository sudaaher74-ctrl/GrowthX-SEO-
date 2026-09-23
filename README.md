# GrowthX SEO

AI-assisted SEO for real businesses. Three products are in production:

- **Website Audit** — crawls a site, raises technical and on-page issues, groups
  them into a prioritised queue, re-checks fixes, and exports a client-ready PDF.
- **Competitor Intelligence** — finds real competitors from live search results,
  crawls them, and compares their pages, structure and weaknesses with yours.
- **Google Business Profile** — connects a listing through Google, audits it,
  tracks local rankings on a geo grid, and drafts review replies.

Every figure the product shows comes from a crawl, a Google API, or a model
call made for that customer. When something has not been measured, the screen
says so — there is no demo or placeholder data, and `npm run check:data`
(frontend) and `src/no-fabricated-data.spec.ts` (backend) fail the build if a
placeholder dataset is added.

## Repository layout

| Path | What it is |
| --- | --- |
| `growthx-ai-crawler/` | NestJS API and crawl worker (PostgreSQL via Prisma, Redis/BullMQ, Playwright) |
| `growthx-ai-seo/` | Next.js dashboard and marketing site |
| `render.yaml` | Render blueprint for the API, database and Redis |
| `vercel.json` | Vercel settings for the dashboard |
| `docker-compose.yml` | Whole stack on one machine |

## Run it with Docker Compose

```bash
cp .env.example .env
# Fill in the REQUIRED block (openssl rand -hex 32 for each secret),
# plus at least one AI key and your Google OAuth credentials.
docker compose up --build -d
```

- Dashboard: http://localhost:3001
- API: http://localhost:3000 (health check at `/health`)

Compose will not start while `POSTGRES_PASSWORD`, `ENCRYPTION_KEY` or
`JWT_SECRET` is empty. That is deliberate: no working secret is committed to
this repository.

## Deploy

**API (Render).** `render.yaml` defines the API service, PostgreSQL and Redis.
Every secret is `sync: false`, so Render asks for it on first deploy. Migrations
run on boot from `growthx-ai-crawler/docker-entrypoint.sh`.

**Dashboard (Vercel).** Set `NEXT_PUBLIC_API_URL` to the API's public URL
before building — `NEXT_PUBLIC_*` values are baked in at build time.

### Configuration

The full list, with explanations, is in `growthx-ai-crawler/.env.example`. The
ones each product depends on:

| Setting | Needed for |
| --- | --- |
| `ENCRYPTION_KEY`, `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL` | Everything (the API will not boot without them) |
| `CORS_ALLOWED_ORIGINS` | The dashboard's origin, in production |
| One of `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `MAMMOUTH_API_KEY` | AI explanations, competitor suggestions, review replies |
| `TAVILY_API_KEY` | Finding competitors from live search results (without it, only model suggestions are verified and shown) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google sign-in, Business Profile, Search Console |
| `GOOGLE_PLACES_API_KEY` | Geo-grid local rankings |

A feature whose provider is not configured reports itself as unavailable; it
does not fall back to sample output.

## Development

```bash
# API
cd growthx-ai-crawler
npm ci && npx prisma generate
npm run start:dev          # needs Postgres and Redis; see .env.example
npm test                   # unit tests
npx tsc --noEmit

# Dashboard
cd growthx-ai-seo
npm ci
npm run dev
npm run typecheck && npm run lint
```

`growthx-ai-crawler/README.md` covers the crawler's architecture, migrations
and test setup in more depth.
