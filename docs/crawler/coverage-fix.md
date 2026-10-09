# Competitor crawl coverage fix

Competitor crawls previously forced a 150-page ceiling, a 12-minute deadline,
20 browser renders and depth four. The screenshot's `LIMIT_REACHED 150/252`
matches the page ceiling. The separate HTTP 403 and exhausted-render messages
indicate that removing the page ceiling alone cannot ensure readable content.

Competitor crawls now inherit the ordinary audit deployment limits, use audit
depth ten, and retain concurrency two and a one-second request delay. Existing
competitor website records with depth four are overridden at crawl dispatch.
Queue dispatch errors propagate instead of returning a fabricated job ID.
Responses report the stored job's actual page limit.

Defaults still cap audits at 2,000 pages, with an operator maximum of 5,000 and
100 browser renders. Positive environment values can change these ceilings.
This patch does not claim unlimited crawling, production load capacity, or
the ability to read every page of a site that refuses crawler requests.
The 252-page and 1,000-page tests use controlled successful responses; they
verify frontier drainage, not live WAF behavior or infrastructure throughput.

## Validation

Run the competitor-crawl, crawl-large-site, page-limit, crawl-capacity and
crawler-v2-wiring Jest suites, then build the Nest application.

## Deployment

The patch is prepared in the Windows workspace clone. It has not changed the
running WSL checkout or restarted its containers. Apply the patch to a clean
checkout and rebuild through the deployment's existing compose configuration.
New limits apply to newly started jobs; already queued jobs retain their payload.

## Remaining work for full coverage at scale

Large sites need a persisted frontier processed in bounded batches with
continuation rather than exclusion at a batch boundary. Continuation must
survive Redis restarts, deployment restarts and counters expiring (current
per-job Redis state expires after 24 hours). Completion must wait for all
pending and retryable work; blocked, robots-excluded and failed URLs need
separate outcomes. Add fair scheduling across tenants and domains, global
host pacing across worker processes, and browser capacity controls before
claiming service capacity for millions of users. Load and crash-recovery
tests must verify those guarantees.
