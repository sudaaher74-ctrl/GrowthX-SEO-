# Reigel low-cost AI policy

## Owner-approved competitor discovery — 20 October 2026

The owner requested automatic competitor suggestions after the website audit,
using the existing Gemini and OpenRouter keys until DataForSEO is connected.
`COMPETITOR_DISCOVERY` uses the already approved `perplexity/sonar` through the
shared INTERNAL usage ledger and provider checks, with a 2,000-token ceiling.
Gemini supplies business interpretation and supplementary candidates. Every
candidate still passes live website verification before it can be selected.
These suggestions do not claim measured Google ranking positions. Tracking and
competitor website crawls begin only after the customer selects businesses.

## Owner-approved visibility preparation update — 16 October 2026

The live Gemini API returns HTTP 404 for `gemini-2.5-flash-lite`, stating it is
no longer available to new users. The owner explicitly approved using the already
allowed `gemini-2.5-flash` for AI Visibility preparation. Accordingly,
`AI_VISIBILITY_ANALYSIS` (business preparation, answer classification and the
visibility action plan) now uses that exact model through the existing INTERNAL
budget and spend reservations. The INR 1,000 monthly cap, all category limits,
fresh visibility identities, and prohibition on automatic upgrades stay in force.
Other routine-analysis tasks retain their existing route; this is a scoped change.

Owner policy received and public tariffs inspected on 15 October 2026. Platform
monthly limit confirmed by the owner: **INR 1,000**. INR 100 per customer per month
is an initial operating target, not a guaranteed cost or entitlement to unlimited
requests. Existing integrations and application flows are retained.

The low-cost policy is active in production. Read `/health` for the running API
revision and the Vercel production deployment for the frontend revision. Earlier
connector access failures were resolved through the authenticated dashboard.

## Inspection findings

The live server used Gemini `gemini-3.1-flash-lite`, OpenRouter
`openai/gpt-4o-mini`, and Sarvam. The provider allowlist was unset. Legacy routing
preferred Mammouth and Anthropic, with an Opus default. Usage recording existed,
but missing tariffs left costs unknown; customer budgets were optional and there
was no shared platform spending reservation. Market Research had a separate SDK
client outside the central ledger. Visibility generated ten questions and asked
each provider to prepare and assess the business as well as answering questions.

## Allowed work and routes

| Work | Model | Connection |
| --- | --- | --- |
| Summaries, prompts, GSC/GA4 interpretation, reports, classification | gemini-2.5-flash-lite | Google API directly |
| Competitor intelligence, root-cause reasoning, moderate code fixes | gemini-2.5-flash | Google API directly |
| Gemini visibility | gemini-2.5-flash | Google API directly |
| OpenAI visibility | openai/gpt-4.1-mini | OpenRouter |
| Claude visibility | anthropic/claude-haiku-4.5 | OpenRouter |
| Search-grounded visibility/citations | perplexity/sonar | OpenRouter |
| Grok visibility | x-ai/grok-4-fast | OpenRouter, only if the exact ID returns to its catalog |

Both Gemini IDs were confirmed in the authenticated Google model list without
making a generation. Grok 4 Fast was absent from OpenRouter's live model catalog,
including its Fast variants. It is shown unavailable; no substitute is chosen.
Plans remain partial when a measured assistant is unavailable. API results do not
measure the consumer ChatGPT, Claude or Grok applications or Google AI Overviews.

Internal analysis always uses direct Gemini, including legacy services which
previously pinned Sarvam or Mammouth. Paid embedding and Tavily research-search
calls are disabled. Retrieval uses the existing local keyword fallback. Crawling,
technical checks, arithmetic, comparisons, GitHub operations and statistics remain
local; Sonar is the sole paid search model allowed by this policy.

## Prices and verification

Text tariffs in USD per million tokens, checked on 15 October 2026:

| Model | Input | Output | Search |
| --- | ---: | ---: | ---: |
| Gemini 2.5 Flash-Lite (selected) | 0.10 | 0.40 | disabled |
| Gemini 2.5 Flash | 0.30 | 2.50 | disabled |
| GPT-4.1 Mini | 0.40 | 1.60 | disabled |
| Claude Haiku 4.5 | 1.00 | 5.00 | disabled |
| Perplexity Sonar | 1.00 | 1.00 | 0.005 per low-context search request |
| Grok 4 Fast | unavailable | unavailable | disabled |

Sources: [Google pricing](https://ai.google.dev/gemini-api/docs/pricing),
[Google Flash-Lite pricing](https://developers.googleblog.com/en/gemini-25-flash-lite-is-now-stable-and-generally-available/),
[Google Flash pricing announcement](https://developers.googleblog.com/en/gemini-2-5-thinking-model-updates/),
[OpenAI GPT-4.1 Mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini),
[OpenRouter live model catalog](https://openrouter.ai/api/v1/models).

The source allowlist contains price ceilings, not a promise of future pricing.
OpenRouter's live catalog is checked before paid requests and cached for at most
one hour. Unavailable, unpriced, mandatory-reasoning or over-ceiling models fail
closed. Requests also supply provider price ceilings and prohibit provider/model
fallback. No premium model or web-search plugin is enabled.

Google's direct text tariffs require a dated operator review. The implementation
stops paid Google requests when that review is older than seven days. Recheck
Google's published rates before updating `AI_GOOGLE_PRICES_VERIFIED_AT`; changing
the date without verifying prices defeats this safeguard. The original review
expires on 22 October 2026. Gemini 2.5 Flash's availability was verified directly;
its tariff was cross-checked against the current OpenRouter catalog and Google's
published announcement. Do not auto-upgrade when Google retires the model.

## Limits and accounting

Initial defaults (all configurable, identical on API and worker):

| Variable | Default | Meaning |
| --- | ---: | --- |
| AI_LOW_COST_POLICY | true | Production-default policy; false is an explicit legacy opt-out |
| AI_PROVIDERS | gemini,openrouter | Allowed transport integrations |
| AI_PLATFORM_MONTHLY_INR | 1000 | Shared platform monthly ceiling, owner-confirmed |
| AI_CUSTOMER_MONTHLY_INR | 100 | Conservative initial customer ceiling supporting the target |
| AI_VISIBILITY_MONTHLY_INR | 70 | Customer visibility budget |
| AI_INTERNAL_MONTHLY_INR | 20 | Customer internal analysis budget |
| AI_FIX_ENGINE_MONTHLY_INR | 10 | Customer code-generation budget |
| AI_ACCOUNTING_INR_PER_USD | 100 | Conservative accounting conversion; **not a live FX quote** |

Customer means the existing organization/account; its projects share limits.
An existing organization USD ceiling may tighten the customer limit. Months use
UTC, matching existing billing. Global PostgreSQL transaction locks protect
spend reservations across API/worker processes. Actual/estimated spend plus
in-flight worst-case reservations must fit all three ceilings before a paid
request is sent. Missing customer attribution or spending infrastructure blocks
the request. Existing wallet and daily request checks remain in force.

The ledger stores reserved cost, tariff estimate, actual reported provider cost,
search tariff estimate, generation ID and budget category separately. OpenRouter
reported total `usage.cost` is used when present, including provider/search
charges. Google's generation response does not include a final billed amount:
its cost is a token-rate estimate, never mislabeled as actual. Reconcile against
provider billing; external fees, taxes, exchange rates and wallet top-up fees are
not represented as measured model costs. Historical calls without rates remain
unknown, not retroactively free or invented.

Timeout/error reservations remain held for the current month until reconciled;
a failed network response may still have been billed. No automatic transport retry
or upgrade is made. A reservation write failure prevents the provider call. A
settlement failure retains the reservation. Sonar reserves its full possible
retrieved context plus the search tariff, not merely the submitted question.

Output is bounded to 800 tokens for monitoring, 4,000 for code, 2,000 for routine
plain analysis and 6,500 for structured reports. Thinking is disabled for both
selected Gemini models. OpenRouter reasoning is disabled. Truncated
monitoring output is rejected and excluded from measurement rates.

## Monitoring and caching

New plans contain 20 reviewed buyer questions. Each approved model receives each
question independently, without the customer's business context or competitor
list. At most 3 cycles and 300 paid monitoring attempts per customer per UTC month
are allowed. Failed paid attempts count, so retries may reduce completed checks.
The application enforces the cadence limits; it does not silently start paid
recurring scans. Existing operator-driven confirmation remains required.

Grok's current absence means only four models can provide fresh results today;
the unavailable model is not reported as measured. Budget exhaustion can also
leave a cycle partial. Neither the 300-request design nor INR 100 target
guarantees all 300 results at any output length or search cost.

Unchanged internal analysis is cached for 24 hours using a hash of organization,
project, task, exact prompts/evidence, schema, model and output limit. Fresh
visibility calls bypass this cache. Successful answers already saved in a
particular historical scan are retained on explicit recovery; they are not
silently reused as measurements for a new cycle.

## Rollout

Validation completed: focused policy/router/usage/workflow/Market Research tests,
backend and frontend type checks, Prisma schema validation, and real PostgreSQL
parallel-reservation/unknown-failure tests passed. All three AI Visibility browser
tests passed, including twenty-question review, provider filters, missing-source
truth, unavailable Grok and mobile layout. No paid provider generations were used.
The frontend production build passed with `npm run build -- --webpack`.
Windows Turbopack failed while launching its CSS subprocess; the alternative
build reported an existing marketing-page standalone trace-copy warning. The
visibility page itself passed production-build browser tests. Validate the normal
Linux/Vercel build during rollout, and recheck published prices if the review is
stale before activation.

Run the low-cost policy, router, usage, workflow and Market Research tests and
backend/frontend type checks. Test the migration and parallel reservations in an
isolated PostgreSQL database before production. Back up the production database;
deploy the committed API and worker together, then deploy the matching frontend.
Existing secrets stay outside Git. Preserve the previous image/runtime config
for rollback; the additive ledger/cache columns can remain on rollback.

## Model availability repair, 20 October 2026

The owner authorized replacing unavailable Gemini Flash-Lite for the investor
presentation. Production Gemini 2.5 Flash-Lite returned HTTP 404. Verified a real
JSON response from `gemini-3.5-flash-lite` and from `gemini-2.5-flash` using the
existing Google integration. Routine analysis now explicitly selects 3.5
Flash-Lite; competitor reasoning and visibility retain the verified 2.5 Flash.
The 3.5 Flash-Lite standard text tariff is USD 0.30 input / 2.50 output per
million tokens, verified at https://ai.google.dev/gemini-api/docs/pricing.md.
Existing customer attribution, platform caps and fresh measurement rules remain.
