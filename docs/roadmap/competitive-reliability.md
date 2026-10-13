# Reigel competitive roadmap and release criteria

This roadmap tracks product work in the Git repository. The current laptop and
WSL deployment is temporary. A change is complete only after the acceptance
criteria below pass in a release environment; a code change or a UI label alone
does not complete an item. Do not commit customer credentials or machine paths.

## 1. Dependable core

- Show a distinct state for unavailable provider, disconnected integration,
  expired grant, stale cached data, failed request, and truly unmeasured data.
- A failed refresh keeps dated cached results visible with a recovery action.
- Provider claims in the UI are generated from the deployed capability and
  credential state; an absent provider does not produce a synthetic score.
- Acceptance: simulate provider outage, revoked Google grant, and API timeout;
  each state preserves truthful data and offers the right next action. Repeat
  from two API replicas sharing the same data services.

## 2. Explainable audit findings

- Show affected URL, observed value or evidence, crawl timestamp, confidence,
  and the reason for priority. Separate confirmed defects from advisory checks.
- Rendering succeeded during a crawl is an advisory observation; failed render
  is a separate incomplete-measurement state.
- Acceptance: a reviewer can reproduce a finding from its URL and evidence;
  the dashboard counts distinct affected pages separately from issue instances.

## 3. Safe Fix Engine

- Detect the application root and framework from the selected file and actual
  manifests. A successful validation result names the checks actually run.
- A missing file, unsupported format, malformed manifest, or unrun build cannot
  be shown as a verified build. A review PR includes the validation result and
  uses the repository's default branch. Canonicals require human review.
- Acceptance: test a nested Node app, a non-Node site, a failing build, and a
  skipped build; each produces an honest review state. Preview and rollback
  instructions exist before customer approval. No patch is described as live
  merely because a PR was opened.

## 4. Proof workflow

- Track prepared, approved, live, issue resolved, and performance observed as
  separate events with actor, timestamp, target revision and supporting link.
- Acceptance: a merged PR alone never marks the issue resolved. A later crawl
  checks the issue; later search data is dated and described as observed change,
  without claiming the fix caused it.

## 5. Agency-first experience

- Validate Indian SEO and web agencies as an initial customer hypothesis.
- Acceptance: interviews and a pilot establish their actual onboarding needs;
  users can switch client sites without cross-client data or authorization leaks.

## 6. Supported implementation integrations

- Publish a support matrix for WordPress, Shopify, Webflow and code repositories
  that distinguishes detection, preparation, preview, validation and release.
- Acceptance: add connectors in customer-demand order and test representative
  sites. Unsupported stacks receive review guidance rather than a claimed fix.

## 7. Business-based prioritization

- Combine available impressions, page purpose, conversion evidence, effort and
  confidence; display unavailable inputs instead of inventing revenue.
- Acceptance: a priority score can be explained from its inputs and changes
  predictably when those inputs change.

## 8. Credible AI measurement

- Store prompt, provider/model, search setting, timestamp, repeated samples and
  source URLs. Keep mentions, citations and referrals as distinct measures.
- Acceptance: reports disclose API versus consumer UI differences and sample
  sizes, and never show a zero score for an unmeasured provider.

## 9. Competitor changes to useful response

- Link an alert to a captured page difference and an original, evidence-based
  proposed response; deduplicate repeated or trivial changes.
- Acceptance: reviewers can inspect before/after evidence and tune alert noise.

## 10. Permissioned learning

- Record consent and tenant boundary for any outcome learning, benchmark or
  case study; provide deletion and export controls.
- Acceptance: no customer information enters a cross-customer report or public
  case study without a recorded grant, and revocation stops further use.

## Multi-server release gate

The production topology must survive retirement of the current WSL host:

1. Put API replicas behind one stable public API origin. Configure frontend
   `NEXT_PUBLIC_API_URL`, API `FRONTEND_URL`, CORS origins, OAuth callback URLs
   and signing/encryption keys through per-environment configuration. Do not
   embed the laptop or a replica address in application code.
2. Use shared PostgreSQL and Redis/Valkey reachable by every API and worker.
   Back up and restore PostgreSQL before cutover. Keep Redis queue state durable
   through a migration or drain in-flight jobs; never point a replacement worker
   at an empty queue while reporting old jobs as running.
3. Run scheduled jobs on exactly one designated API instance using
   `SCHEDULER_ENABLED=true`; set it to `false` on other API replicas. Workers
   disable scheduler registration through `WORKER_MODE=true`. Add a distributed
   lease before enabling multiple scheduler instances for failover.
4. Snapshot storage is currently a local Docker volume. It is unsuitable for
   independently hosted API/worker replicas. The former `s3` option only
   returned a fictitious URL; it now fails startup. Implement and test real
   shared object storage, read/delete/retention, and migrate existing snapshot
   files before moving the worker to another host. Until then, keep snapshot
   writers and readers on the same mounted storage or leave this release gate
   open. A shared filesystem is an interim choice only when all hosts can mount
   it consistently.
5. Run the same release image and schema version on each host. Check health,
   queue consumption, OAuth, authenticated audit reads, snapshot reads, and
   one sample Fix Engine review flow from the public origin. Shift traffic,
   observe, then retire the old host. The Windows keepalive task is only for
   the temporary laptop deployment and has no role in the new topology.

## Initial batch status

- Implemented in this batch: honest render advisory copy, exact unique affected-page
  count, validation failure for unsupported/unreadable files and malformed
  manifests, nested Node manifest detection, accurate PR validation text/default
  branch, Google and repository connection loading/error states, neutral
  onboarding defaults, portable temporary repository cleanup, scheduler gating, and
  refusal of fictitious S3 writes.
- Still open: live investigation of provider and Google integration state;
  real shared snapshot storage; proof-state model and release flow; priorities 5 through
  10. The multi-host cutover remains open and needs the release gates above.
