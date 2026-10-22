# Backlink intelligence

GrowthX turns observed external links into actions in its existing audit →
Opportunities → verification → Proof of Impact workflow. This release uses no
Semrush, DataForSEO, search scraping service, paid model, or backlink data API.
Existing PostgreSQL, Redis, workers, CPU, bandwidth and disk are still required.

## Customer workflow

1. Audit the customer's own website and save relevant competitors.
2. Open **Backlink Intelligence** in the sidebar. Paste external referring-page
   URLs, upload a Search Console Links CSV, or scan project crawl evidence.
   The Google connection does not supply the Search Console Links report.
3. Save candidates, then verify them. The minute scheduler also picks up new
   candidates automatically when a worker is running. One source fetch extracts
   links to both the customer's domains and their saved competitors.
4. Inspect source history, anchors, rel attributes, freshness and destination
   readiness. A recent audit is required to establish a healthy destination.
5. Repair verified backlinks pointing to broken/non-indexable destinations.
   Confirmed lost links generate recovery actions. Both enter the existing
   Opportunities queue with a stable fingerprint and inspectable evidence.
6. Review an observed competitor source for relevance, choose a destination on
   the customer's site, and save a plan. GrowthX checks destination readiness
   before recommending publisher/listing work. Unknown or unhealthy destinations
   get an audit prerequisite. No outreach or publication happens automatically.
7. After the user completes the action, verify the source again. Reconciliation
   resolves tasks only from observed link presence or fresh audit evidence.
   Verified resolutions and recurrences append events to the existing Proof of
   Impact ledger, with a compare-and-set update preventing duplicate events.

The customer builds a private history of useful sources, reviewed destinations,
actions and verified results. This accumulated evidence is the differentiator;
the interface and workflow cannot be guaranteed uncopyable.

## Evidence rules

- A submitted URL is a candidate, not a verified backlink. Source-only exports
  discover exact destinations when inspected; no homepage link is assumed.
- Only HTTP/HTTPS URLs without embedded credentials are accepted. Query strings
  and trailing slashes remain significant; fragments are removed.
- A successful source HTML response supplies actual anchor evidence. Multiple
  occurrences are retained in the observation, including differing rel values.
  The destination summary combines observed rel attributes; it is not a claim
  that every occurrence has the same attributes.
- `firstObservedAt` is when GrowthX first verified the link, not its creation
  date. `lastVerifiedAt` is never erased by timeouts or access blocks.
- An imported target never found on a source is not called lost. A previously
  verified link becomes `MISSING` after one successful absence check, and `LOST`
  only after at least two successful absence checks spanning at least 24 hours.
- HTTP 404/410 are source absence evidence. 401/403/429, unreadable robots,
  transient errors, challenge pages, probable JS shells, incomplete extraction
  and exceeded budgets are blocked/unknown, not proof of loss. Static HTML does
  not establish whether a JavaScript-rendered link exists; no renderer is used.
- Readiness requires a completed own-site audit within seven days, HTTP 200 and
  `INDEXABLE`. Failed/blocked/stale/unmeasured audits stay unknown. Readiness is
  not proof of Google indexing or publisher acceptance.
- Own-site and competitor-host comparisons only cover this project's observed
  sources. Subdomain matching uses explicit configured domain boundaries;
  referring-host counts combine www aliases, not all registrable subdomains.
- Lost-link, repair and planned-link findings preserve user dismissal and snooze
  state. Only previously system-resolved findings can be reopened automatically.
  A transient block cannot reopen a completed acquisition plan as a lost link.
- Resolution verifies the task condition. It does not attribute subsequent
  rankings, traffic, conversions or revenue to a backlink. Causal attribution,
  automatic referral ingestion, unlinked-mention discovery and global web-index
  ingestion are outside this release.

Priorities are transparent policy weights, not predictions: destination repairs
90, confirmed recovery 80, plans needing prerequisites 70, and ready plans 60.
Confidence is an evidence band (90 for observed repair/loss, 60 for reviewed
prospects), not a statistical probability of ranking improvement or acceptance.

## Architecture and budgets

`BacklinksModule` owns the tenant-scoped API, verifier, queue and data. Project
membership and view-only restrictions use the existing `JwtAuthGuard`; browser
requests retain the platform's CSRF guard. Every source lookup is project-scoped.
No imports or observations are shared between customers.

`BacklinkSource` survives individual crawl lifecycles. `Backlink` records each
source/destination pair and its presence history. `BacklinkObservation` records
the fetch result, final URL, status, exact matched anchors and SHA-256 evidence
hash. It stores no fetched HTML and retains the latest 30 observations per
source. First-seen/last-verified dates survive observation retention. Removing a
source deletes its observations, links and related backlink opportunity rows;
already recorded append-only impact-ledger events remain as action audit history.

Requests reuse the platform's SSRF-protected DNS/HTTP agents, disable environment
proxies, use explicit transport abort deadlines, bound redirects, and check robots
at every source redirect hop. Redis paces source and robots requests across
workers. A dedicated queue avoids consuming the main website crawl queue.

| Resource | Current limit |
| --- | --- |
| Monitored source pages | 2,000 per project |
| Import | 200 rows, 500 KB |
| Tracked destinations / extracted relevant occurrences | 500 per source |
| Source HTTP body / robots body | 2 MB / 512 KB |
| Verification | 25 seconds total; at most 8 seconds per HTTP request |
| Source redirects | At most five inspected page hops |
| Shared host request spacing | At least 1.5 seconds, respecting supported crawl delay |
| Worker concurrency / global job admission | 2 / one start per 1.5 seconds |
| Manual verification batch / source cooldown | 25 / 10 minutes |
| Scheduler | Every minute; interleaves up to 10 projects, five sources each |
| Scheduled refresh | Successful HTML: seven days; other results: one day |
| Observation retention | Latest 30 per source |
| Dashboard | 25 sources/page; 100 destination summaries/source |
| Competitor comparison | Up to 10,000 fresh observed links; truncation is disclosed |
| Actions reconciliation | Up to 100 recently checked sources per sweep |

An oversized or incompletely extracted source cannot establish missing links.
Unsupported long crawl delays leave verification unknown. Existing completed
own/competitor crawls supply discovery candidates, scoped by the project's own
website association or `competitor:<projectId>` website scope. Discovery scans
up to 10 latest per-website completed jobs and 5,000 external link rows, importing
at most 200 referring pages. It does not discover reverse links simply by
crawling the customer's site, and never launches an unrestricted web crawl.

## Deploy

Deploy this Git commit using the existing API, worker and frontend deployment
process. No new provider credentials or infrastructure service are needed.

From `growthx-ai-crawler`, with the deployment's database URLs supplied securely:

```sh
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
```

Deploy/restart the API and worker from the same release so both know the new
queue and schema. The existing `WORKER_MODE=false` or `DISABLE_WORKERS=true`
settings keep consumers off API-only processes. At least one worker must run.
Redis must use `noeviction`. The dashboard shows a paused state if Redis or a
consumer is unavailable, and candidates remain saved. Start the worker before
opening verification to customers. Build and deploy `growthx-ai-seo` through its
existing process with the intended `NEXT_PUBLIC_API_URL`.

Rollback application code without dropping the additive tables. Retaining the
tables preserves observations and allows a later redeployment. Never run the
test setup against a customer database.

## Verify

Backend unit tests (integration suite is skipped without explicit opt-in):

```sh
cd growthx-ai-crawler
npm run test:backlinks
```

The integration test uses real HTTP, PostgreSQL, Redis, BullMQ and the production
JWT/project-membership guard. It creates and removes its own tenants. Start
disposable local PostgreSQL and Redis containers (use your host's Docker CLI):

```sh
docker run --rm -d --name growthx-backlinks-test-postgres -p 127.0.0.1:55439:5432 -e POSTGRES_USER=backlinks_test -e POSTGRES_PASSWORD=backlinks_test_only -e POSTGRES_DB=backlinks_test postgres:16-alpine
docker run --rm -d --name growthx-backlinks-test-redis -p 127.0.0.1:56389:6379 redis:7-alpine redis-server --maxmemory-policy noeviction
```

Set these variables in the **test process only**, then migrate and test:

```sh
export DATABASE_URL=postgresql://backlinks_test:backlinks_test_only@127.0.0.1:55439/backlinks_test
export DIRECT_URL="$DATABASE_URL"
export REDIS_URL=redis://127.0.0.1:56389
export BACKLINKS_INTEGRATION=true
npx prisma migrate deploy
npm run test:backlinks
```

PowerShell uses `$env:NAME='value'` instead of `export`. The test suite refuses
non-local or non-test database names. Its private-network allowance is confined
to the test process and must never be enabled for the deployed application.

For the real browser → API → queue → data → UI story, set an absolute temporary
`BACKLINKS_TEST_MANIFEST` file path and run:

```sh
# In growthx-ai-crawler, with the local test database/Redis variables above:
node scripts/backlinks-test-server.cjs
# In growthx-ai-seo, same BACKLINKS_TEST_MANIFEST path:
NEXT_PUBLIC_API_URL=http://127.0.0.1:3412 npm run dev -- --hostname 127.0.0.1 --port 3211
SMOKE_BASE_URL=http://127.0.0.1:3211 npm run test:backlinks
```

The frontend and Playwright processes must use the same test API origin. The
harness creates a disposable organization and two local publishers, uses real
JWT authentication and queue workers, and exposes test-only publisher/audit
fixture controls. It refuses other database/Redis ports and is never imported
by the application. It shuts down after 20 minutes; use its authenticated
`POST /__test__/shutdown` endpoint to clean up sooner. Remove the temporary
manifest afterward; it contains an expiring token for the disposable test user.
The browser test is skipped unless its manifest is explicitly supplied.

Finally stop only the two named disposable containers:

```sh
docker stop growthx-backlinks-test-postgres growthx-backlinks-test-redis
```
