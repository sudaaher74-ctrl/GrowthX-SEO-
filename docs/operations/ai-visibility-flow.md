# Business-led AI Visibility

AI Visibility now follows five stages: business evidence, twenty buyer questions, independent AI answers, competitor gaps, and a lead action plan.

## Evidence and measurement

- A run snapshots the latest completed own-site audit, matching saved business profile, the Google section's 28-day Search Console and GA4 facts, and the Competitor Intelligence comparison. It uses bounded page excerpts and labels missing sources, dates and sample limits.
- Under the [low-cost policy](low-cost-ai-policy.md), direct Gemini Flash-Lite interprets the evidence and prepares twenty distinct, unbranded buyer questions about actual offerings and evidenced service areas. The operator reviews or corrects them before checks start.
- Each available provider receives each question in a separate API request with no business context, brand name or competitor list supplied. Twenty answers per approved model are requested, up to one hundred when all five are available. API model answers are not measurements of consumer applications or Google AI Overviews; only Sonar uses native search; paid search plugins are disabled.
- Separate extraction calls classify saved answers. A recommendation requires a literal supporting quote containing the brand; other brands and links must occur in the answer. Failures and unclassified answers are excluded from rates. Links in model responses are not independently verified citations.
- Gemini Flash-Lite receives the evidence plus the combined measured findings to propose actions. Plans retain evidence references, concrete steps, priorities, timeframes and success measures. Rival explanations are hypotheses, not known model ranking causes. Untracked rivals without crawl evidence must be investigated before asserting website advantages.
- GA4 top-city rows cannot establish the percentage of all visits outside a service area. Parent-city labels can cover nearby neighbourhoods. Search Console is not a city-level visitor source. Missing key events are unknown lead measurement, not zero leads.

## Persistence and retries

The `AiVisibilityJourney` database row stores evidence, reviewed questions, progress, errors and plans. Answer records use the existing visibility scan tables, so existing report readers still work. Generated question sets are historical scan inputs, not extra active prompts silently added to legacy sweeps.

BullMQ uses the shared Redis queue `ai-visibility-journeys`; workers follow the existing `WORKER_MODE`/`DISABLE_WORKERS` settings. Database uniqueness blocks overlapping active runs for a project. Deterministic job and answer IDs avoid duplicate queued work, and saved successful answers are reused on restart or explicit retry. A periodic repair recovers jobs missing after the database/queue handoff. A crash after the vendor accepted a request but before its response was saved can still repeat that single request; external APIs do not offer exactly-once billing.

Provider errors do not trigger hidden fallback to another vendor. Saved business interpretations and plans are checkpointed too; a plan is reused only when its business evidence and measured findings are unchanged. Explicit retries can repeat failed requests and rebuild the analysis when new answers arrive, consuming credits. Completed answers remain available during partial failures.

## Deploy the committed version

1. Back up PostgreSQL and preserve the shared Redis state as described in [move-server.md](move-server.md).
2. Apply the additive `20261014183000_ai_visibility_journey` and `20261015143000_low_cost_ai_policy` Prisma migrations (`prisma migrate deploy`, also run by the container entrypoint).
3. Build and deploy API and worker from the same Git commit. Configure direct Gemini and OpenRouter keys, allowlisted models and shared budgets through private environment settings. Ensure a worker consumes the queue.
4. Deploy the matching frontend after the API routes and migration are ready.
5. Check source coverage and provider availability in AI Visibility. Start business understanding, review the twenty questions, run the checks and verify saved answers and plans after reloading the page.

Rollback can restore the previous API/worker/frontend images while leaving the additive table in place. Do not drop it if saved journeys are needed. No live production migration or paid scan is part of unit/browser fixture tests.

## Validation

Run the AI Visibility Jest suites and backend typecheck; run frontend typecheck, design/data guards, build and `e2e/ai-visibility-journey.spec.ts`. The browser suite uses clearly scoped fixtures and makes no provider calls. `bash growthx-ai-crawler/scripts/test-visibility-migration.sh` tests the new migration and active-run uniqueness in a disposable, isolated PostgreSQL container.
