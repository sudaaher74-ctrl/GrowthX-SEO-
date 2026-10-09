# Unlimited page-count mode

Set `CRAWL_UNLIMITED_PAGES=true` in the deployment environment to remove the
default page-count cutoff for both own websites and competitor websites.
Docker Compose passes this setting to both the API and worker containers.

With the setting enabled, a new crawl without an explicit page limit stores
`pageLimit: null` and sends no `pageLimit` to page-fetch workers. The existing
Redis and local visited-URL logic already support this no-ceiling mode.
Competitor crawls inherit it through the common crawler service. Voice-started
website audits no longer silently impose a separate 200-page limit.

An explicit finite caller page limit still applies. Leaving the setting off
preserves existing default and maximum page-count limits.

This setting does not change depth, memory controls,
request pacing, robots rules or handling of inaccessible pages. It does not
guarantee that every page of any site can be read. In particular, the default
100-render budget still limits JavaScript content coverage unless
`CRAWL_RENDER_ALL_PAGES=true` is also enabled. That setting removes the default
render count cutoff while the browser pool still bounds simultaneous renders.

New jobs inherit the setting; already running or queued jobs retain their
original payloads. Active Redis state now has a renewable seven-day lease.
`CRAWL_FAIR_SCHEDULING=true` uses the database frontier for bounded page dispatch,
organization turns, per-site concurrency and recovery of missing queue tasks.
These controls are not a proven million-user scheduler. Removing the page cutoff
allows large jobs to occupy the queue for longer, so runtime and disk capacity
must be monitored.
