# Full coverage, recovery and scheduling

The crawler supports own and competitor sites through the same coverage policy.
Competitors no longer have a separate 150-page, 20-render or twelve-minute cutoff.
Request pacing, URL/robots/depth safeguards, explicit caller limits and finite
retry attempts remain in place. Inaccessible pages produce partial coverage;
unlimited mode cannot guarantee access to blocked websites.

Deployment settings, passed to both API and worker by Docker Compose:

| Setting | Default | Purpose |
| --- | --- | --- |
| `CRAWL_UNLIMITED_PAGES` | false | Remove the default page count cutoff |
| `CRAWL_RENDER_ALL_PAGES` | false | Render every needed page without a default render count cutoff |
| `CRAWL_FAIR_SCHEDULING` | false | Publish a bounded window from the persistent database frontier |
| `CRAWL_DISPATCH_WINDOW` | 12 | Maximum published unfinished page tasks |
| `CRAWL_TENANT_PAGE_SLOTS` | 4 | Organization reservations across own and competitor sites |
| `CRAWL_STATE_RETENTION_SECONDS` | 604800 | Bounded active-state retention, renewed during running jobs |

Fair scheduling groups sites by organization, rotates turns and enforces site
concurrency. It recovers stale database reservations when their queue jobs are
missing. Sitemap and robots snapshots are stored with the job for Redis recovery.
Task ownership prevents interrupted attempts from claiming another task's URL;
successful page upserts do not double-count pages. Retry attempts settle only
after successful or terminal outcomes. Transient fetch/render failures retry.

Browser initialization has a timeout and failed-launch cooldown. Late disconnects
from an older browser cannot clear the replacement browser's context.

## Validation

The isolated integrated workload used 500 own-site pages, three competitors with
600 pages each, and a second user's 40-page site. All 2,340 pages completed,
including 585 browser-rendered pages, in 483 seconds. A forced worker crash and
staging Redis reset recovered. The smaller user finished while larger jobs ran.
Across 871 samples, queue tasks never exceeded eight and organization reservations
never exceeded four. The latest targeted regression runs passed 89 tests.

Fixtures used actual HTTP, Chromium, Postgres and BullMQ with short local delays.
External PageSpeed and downstream AI callbacks were disabled. These results
verify controlled-fixture behavior, not real-world throughput or million-user
capacity.

## Google configuration

Preserve `INTEGRATION_TOKEN_KEY` across releases; replacing it invalidates saved
encrypted tokens. Both services need that key, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `API_BASE_URL` and `APP_BASE_URL`.
Compose passes existing deployment values through; secrets must not be committed.

The Google connector callback is `/api/integrations/google/callback`. Google
sign-in's callback is configured separately through `GOOGLE_CALLBACK_URL`.
