# Automatic backlink discovery

The Backlinks page now includes **Discover backlinks**. A project website is
the input; manual source imports are optional. A durable background job searches
the public reverse index, Wikimedia external-link references, existing scoped
project crawl evidence, and external profile/partner URLs linked from the
project's public website. Saved candidates feed the existing live verification
queue and analytics. An outbound footprint lead is never counted as a backlink
without a successful publisher-page check.

## Data and coverage

The shared `PublicBacklinkEdge` index contains only HTML anchor relationships
extracted from official Common Crawl WAT archives. It records source URL, target
URL, registrable target domain, archive path and archive timestamp. It does not
copy tenant crawls, imports, OAuth data, or private source lists into a shared
dataset. Project discovery runs, source monitoring and verification remain
tenant scoped behind the existing authentication and project membership guard.

Common Crawl's CDX URL API is **not** a reverse-link API. This implementation
streams WAT metadata and creates an actual database reverse index instead.
Image, script, stylesheet and other resource URLs are excluded. Malformed,
credential-bearing and private-network URLs are rejected. Archive data is a
lead, not proof that a link still exists. The existing robots-aware verifier
supplies current link status, attributes and observations.

Wikimedia lookups use the documented `exturlusage` endpoint on English Wikipedia,
bounded to 50 results per lookup, two own domains and one saved competitor.
Unavailable lookups and continuation beyond the request budget are explicit.
No Google/Bing search-result scraping or paid backlink/search API is required.

This starts a growing, sampled index. It does **not** provide Semrush's global
coverage, authority graph, traffic estimates, or a guarantee of finding links
for every domain. A completed discovery with zero results means no candidates
were found in the searched data, not that the domain has no backlinks. Imports
remain useful for expanding a project's known sources.

## Resource limits and scheduling

- One discovery job globally, at most 20 waiting jobs, one active run per project.
- Six-hour manual cooldown. After a project opts in, an hourly scheduler queues
  refreshes whose latest run is over 24 hours old, oldest first.
- At most 100 external candidate pages per run; verification uses existing
  per-source cooldown, host pacing, robots handling and fair queue scheduling.
- Archive ingestion uses a shared lock and at most four slices per rolling day
  by default. Each slice stops at 120 seconds, 64 MB compressed, 128 MB decoded,
  20,000 HTML pages, 100,000 newly indexed edges, or remaining index capacity.
  Truncation is recorded as PARTIAL and is visible in discovery details.
- The default index capacity is 500,000 distinct source/destination pairs.
  `BACKLINK_INDEX_MAX_EDGES` supports up to 50 million and
  `BACKLINK_ARCHIVE_SLICES_PER_DAY` up to 1,000. Both are passed to API and worker
  by Compose. Increase only after measuring storage, network and worker load.
- The latest 20 terminal discovery runs per project are retained. Worker failure
  updates the run; a minute recovery pass repairs orphaned queued/running jobs.
  Saved sources survive an interrupted run and continue verification.
- Shared index counts are cached for 30 seconds. Project run progress includes
  live checks and checks reused within the ten-minute verification cooldown.

Ingestion and verification use hosting resources even though the data has no
API purchase cost. At the default budgets this index is deliberately small.
Increasing coverage requires sustained archive processing and infrastructure.

## Operator ingestion

Apply `20261022150000_backlink_discovery`, then deploy API and worker from the
same commit. Discovery jobs grow the index automatically within the shared daily
budget. To bootstrap additional allowed slices using the container's existing
private environment:

```sh
docker exec EXISTING_WORKER_CONTAINER node scripts/index-public-backlinks.cjs 4
```

The command works against built `dist` in production; development falls back to
TypeScript sources. It obeys the same locks, capacity and daily limits. It never
publishes tenant data. The command prints ingestion metrics and public archive
coverage, not connection strings or credentials. A partial slice is a documented
sample; later runs select unattempted files from the current official manifest.

Run `npm run test:backlinks` with the isolated PostgreSQL/Redis environment from
[backlink-intelligence.md](backlink-intelligence.md). The browser fixture stubs
only external discovery boundaries; it uses real authentication, API routes,
database, BullMQ workers, local publisher HTML and the UI. A separate live
Common Crawl ingestion check indexed 47,879 link records from 4,215 HTML pages
using 31,406,852 compressed bytes before the slice processing budget was reached.
Those counts describe that test, not any customer's backlink profile.

References: [Common Crawl WAT format and access](https://commoncrawl.org/get-started),
[Common Crawl API access guidance](https://www.commoncrawl.org/faq),
[MediaWiki external URL usage API](https://www.mediawiki.org/wiki/API:Exturlusage).
