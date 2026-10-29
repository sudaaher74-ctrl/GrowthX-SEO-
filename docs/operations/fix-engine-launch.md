# Fix Engine production release checks

The engineer prepares draft PRs. It does not merge or deploy customer changes. A syntax check or a generated summary is not proof that an issue is fixed.

## Work scheduling

Engineer requests are persisted as PENDING database records and delivered by the `github-engineer` BullMQ queue. Only worker processes execute them. PostgreSQL advisory transaction locks serialize admission per project across API replicas. Queue delivery uses the run ID for deduplication, and worker execution claims PENDING records atomically. A shared concurrency limit of two bounds expensive repository/model work across workers. At 1,000 waiting jobs admission returns an explicit capacity error instead of spawning unbounded work.

The worker reconciles pending records every 30 seconds to recover an API exit between database persistence and queue insertion. Interrupted active jobs fail explicitly instead of automatically replaying a possible GitHub push. Inspect GitHub activity before retrying those jobs. Redis must retain its existing persistent volume, AOF configuration and no-eviction policy. `GET /api/projects/:projectId/automation/engineer/status` reports actual queue availability and counts behind the existing workspace authorization guard.

## Acceptance and truthful evidence

- Title registry edits are checked for runtime integration into the declared React page. The metadata tool uses the customer's existing Helmet provider and preserves visible page content. Unsupported integrations fail closed.
- Generated PRs remain draft, with syntax/build limitations and a required preview check on direct visits and client navigation.
- Verification requires a matching measured page newer than the confirmed GitHub merge. Repository tokens are only used for the connected repository. Missing GitHub/crawl evidence cannot verify deployment.
- Proof screens retain missing values as unavailable. They do not estimate engaged sessions using a fixed percentage, fabricate AI model results, substitute mention rate for citation rate, or assert causal improvement without a control-group analysis.

## Required deployment validation

Run API tests/build, frontend typecheck/lint/build and the metadata regression fixture before deployment. Deploy committed source with `scripts/deploy-compose-release.py`; API and worker must use the same image. Preserve private configuration and data volumes, verify the PostgreSQL backup and migration state, and retain rollback configuration. The backup defaults to custom-format compression 0 to avoid the compression bottleneck on this host; `DEPLOY_BACKUP_COMPRESSION` may select 0–9.

After deployment check API health, worker registration, queue counts, an authenticated real engine run and its PR preview. Do not merge a customer PR that fails navigation checks.

## Capacity boundary

`growthx-ai-crawler/scripts/benchmark-engineer-queue.cjs` exercises 1,000 requests and 1,000 duplicate deliveries against disposable Redis with two workers. It does not invoke AI or the product database and cannot certify 1,000 simultaneous AI fixes or zero downtime. End-to-end launch capacity also depends on host resources, database connections, AI quotas, GitHub limits and workload duration. The current single-host stack is not a highly available deployment; thousands of accounts are different from thousands of simultaneous engineer jobs.
