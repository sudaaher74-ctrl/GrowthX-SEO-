# Tokens

Every workspace (organization) has a token balance. AI use and geo-grid scans
draw it down; a monthly allowance refills it; an operator can add more. This
page is for the people who run and extend it. Customers see the plain-language
version on the **Tokens** screen (`/tokens`).

- [What a customer sees](#what-a-customer-sees)
- [How it works](#how-it-works)
- [What is metered, and what is not](#what-is-metered-and-what-is-not)
- [Rolling it out](#rolling-it-out)
- [Settings](#settings)
- [Operator tasks](#operator-tasks)
- [Adding something that costs tokens](#adding-something-that-costs-tokens)
- [Decisions worth knowing](#decisions-worth-knowing)
- [Testing](#testing)

## What a customer sees

- A **Tokens** chip in the sidebar: what is available now, and when it refills.
- A **Tokens** page: available now, monthly tokens left, bonus tokens, usage by
  feature this month, what each thing costs, and the full history.
- A banner on every screen when the balance is low (under 10% of the month's
  allowance) or empty, because several features quietly fall back to a simpler
  answer when the AI refuses, and an empty balance would otherwise look like
  those features getting worse.
- A `402` with `error: "INSUFFICIENT_TOKENS"` and a message written for a
  business owner ("...Tokens refill on 1 October 2026, or an administrator can
  add more.") wherever a refusal reaches the screen.

## How it works

**Two buckets per workspace.** The *monthly allowance* is granted at the start of
each UTC month and lapses at the end of it. *Bonus tokens* (grants, and later
purchases) never lapse. A spend takes from the allowance first, because it is the
perishable one. Keeping them apart is what lets the allowance refill without
swallowing tokens someone was given.

**An append-only ledger.** Every change is one `TokenTransaction` row, written in
the same transaction as the balance change, with the balance *after* it. The
ledger can always be replayed into the wallet, and `scripts/tokens.ts --verify`
does exactly that. Kinds: `ALLOWANCE`, `EXPIRY`, `GRANT`, `ADJUSTMENT`, `SPEND`,
`REFUND`.

**A row lock, not a check.** Every balance change starts with an `UPDATE` of the
wallet row, which holds the lock until the transaction ends. Concurrent spends
for one workspace queue there, and each reads the balance the previous one left,
so two requests can never both spend the same tokens. `CHECK` constraints in the
migration make a negative balance impossible even if the arithmetic is ever
wrong. (`tokens.integration.spec.ts` proves this against PostgreSQL: remove the
lock and four of its tests fail.)

**Wallets are created lazily**, the first time a workspace touches a metered
feature or opens the Tokens screen, holding that month's allowance. There is no
backfill, so existing workspaces and ones made by scripts need nothing done.

**Rollover.** The first read or spend after a month ends lapses what is left of
the allowance (an `EXPIRY` row) and grants the new one (an `ALLOWANCE` row).
Months in which nobody used the product grant nothing: a quiet account does not
bank allowances.

**Idempotency.** Anything that must not apply twice carries a unique key on its
ledger row: the grant for a period, the refund of a spend, a payment. The
database refuses the second one.

**Bookkeeping never takes the product down.** Only a definitive "not enough
tokens" stops work. If the token tables cannot be read or written, the failure
is logged and the work goes ahead uncharged — the same call the AI usage ledger
makes, for the same reason. (It also means a worker that starts before the
migration has run degrades to "unmetered" rather than to "broken".)

## What is metered, and what is not

**Metered by what was used — every AI call through `MultiAiRouterService`.**
About 50 call sites across the product go through the router, so this covers AI
analysis, reports, drafts and the assistant.

```
tokens = ceil(inputTokens × TOKENS_AI_INPUT_WEIGHT + outputTokens × TOKENS_AI_OUTPUT_WEIGHT)
```

- The gate runs *before* the call: a workspace with fewer than
  `TOKENS_MIN_TO_START_AI` tokens is refused with a 402 and **no provider is
  called**, so no money is spent.
- The charge is settled *after* the call from the counts the provider reported.
  It is clamped to what the wallet holds and the rest is recorded as
  `shortfall`: the customer already has the answer and the provider has already
  billed us, so refusing then would punish them for our arithmetic.
- **Only the answer that was returned is charged.** A vendor that errored,
  declined, or returned unparseable JSON before another answered is the
  platform's cost. A refused completion and a failed call are not charged.
- If a provider reports no counts, the charge is estimated from text length (about
  4 characters a token) and the ledger row says `estimated`.
- Calls that carry only a `projectId` are attributed to that project's
  organization. (Before, they had no organization, so no budget or ceiling
  applied to them.)
- Both raw counts are kept on the ledger row, so a charge can always be checked
  against what the provider reported.

**Metered at a fixed price — geo-grid scans**, per grid point
(`TOKENS_COST_GEO_GRID_POINT`, default 5,000: a 3×3 scan is 45,000 and a 9×9
scan 405,000). It is charged after the request has passed every check that could
refuse it and just before the first paid Google Places lookup. A scan stores
nothing unless every lookup succeeds, so a scan that fails is refunded in full.
This was the most expensive single click in the product and had no ceiling at all.

**Not metered** (deliberately, in this first version):

| | Why |
| --- | --- |
| Website audit and competitor crawls | Already bounded by the crawl limits (`CRAWL_*`). The AI analysis they trigger *is* metered. |
| DataForSEO Google checks, keyword gaps | Already bounded per project per day (`SERP_DAILY_CHECKS_PER_PROJECT`, `KEYWORD_GAP_DAILY_FETCHES_PER_PROJECT`). |
| Places business lookups other than geo-grid, Tavily, Search Console | Same. |
| AI calls with no organization and no project (the provider health ping) | Nothing to charge. |

The existing ceilings (`AI_DAILY_CALLS_PER_ORG`, `Organization.aiMonthlyBudgetUsd`)
still apply and are independent: they protect the platform, tokens are what the
customer sees.

Background work that calls the router (scheduled sweeps, for instance) is charged
like anything else and stops when the workspace is out. Callers that catch the
error and fall back will not surface the 402 themselves; the dashboard banner is
the backstop.

## Rolling it out

`TOKENS_ENFORCEMENT` has three modes:

| Mode | Behaviour |
| --- | --- |
| `enforce` (default) | Refuse work the balance cannot pay for. |
| `shadow` | Meter everything and refuse nothing. Balances move, the ledger fills, the screens say "usage is counted, not limited", and a spend the wallet could not cover is recorded as `shortfall`, so the demand is visible. |
| `off` | Inert: no wallets are opened and nothing is checked. |

**The default allowance (5,000,000 a month) is a starting point, not a
measurement.** Nobody has calibrated it against real usage, and too tight a
figure blocks paying customers the day it ships. A sensible rollout:

1. Deploy with `TOKENS_ENFORCEMENT=shadow`.
2. After a week or two, read the burn (per workspace: `scripts/tokens.ts --org
   <slug>`; overall: the `SPEND` rows in `TokenTransaction`, where
   `-(allowanceDelta + bonusDelta) + shortfall` is what each call cost).
3. Set `TOKENS_MONTHLY_ALLOWANCE` from that, then switch to `enforce`.

Changing `TOKENS_MONTHLY_ALLOWANCE` reaches every workspace without its own
figure at its next refill. What the *current* month was granted is unchanged,
which is why the screen reads "4.995M of 5M · then 1M a month" after a mid-month
change.

**Set the same `TOKENS_*` on every process.** The API and the crawl worker both
run AI calls. `docker-compose.yml` forwards them to both; on Render they go in
the service's environment.

## Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `TOKENS_ENFORCEMENT` | `enforce` | `enforce`, `shadow` or `off`. Anything else is treated as `enforce`, so a typo cannot quietly switch limits off. |
| `TOKENS_MONTHLY_ALLOWANCE` | `5000000` | Granted every UTC month to a workspace with no allowance of its own. `0` gives an account nothing until it is granted some. |
| `TOKENS_AI_INPUT_WEIGHT` | `1` | Tokens per piece of text the AI reads. |
| `TOKENS_AI_OUTPUT_WEIGHT` | `4` | Tokens per piece it writes. Vendors charge several times more for writing than reading. Capped at 1,000. |
| `TOKENS_MIN_TO_START_AI` | `1` | Tokens a workspace must hold to start an AI call. |
| `TOKENS_COST_GEO_GRID_POINT` | `5000` | Tokens per grid point. Priced from Google's list price for a Places Text Search request when written; check it against current pricing. |

An unusable value (not a number, negative, out of range) falls back to the
default rather than failing to boot.

## Operator tasks

**See who has what.** The admin screen's *Tenants* tab shows each workspace's
tokens ("Not started" means it has not used a metered feature yet). From the
command line: `npx ts-node scripts/tokens.ts --list`.

**Give tokens.** Admin screen → Tenants → *Add tokens*, or:

```bash
npx ts-node scripts/tokens.ts --org acme --grant 2000000 --note "Goodwill after the outage"
npx ts-node scripts/tokens.ts --org acme --grant -50000       # take bonus tokens back
```

or `POST /api/admin/organizations/:orgId/tokens/adjust` with `{ "amount": 2000000,
"note": "..." }`. These routes are behind `PlatformAdminGuard`
(`PLATFORM_ADMIN_EMAILS`). Grants are bonus tokens: they never lapse and are
spent after the monthly tokens. The note is visible to operators only; the
customer sees "Tokens added by GrowthX" and the amount. A grant is not a payment
and does not charge anyone.

**Give one workspace its own allowance** (from the next month):

```bash
npx ts-node scripts/tokens.ts --org acme --allowance 10000000
npx ts-node scripts/tokens.ts --org acme --allowance default
```

**Check the books.** `npx ts-node scripts/tokens.ts --verify` replays every
wallet's ledger and reports any balance that does not match it (exit code 1).

## Adding something that costs tokens

1. Add it to `TokenAction` in `token-rates.ts`, give it a price in
   `TokenConfig.unitCosts` and an environment variable in `readTokenConfig`, and
   add its label to `ACTION_LABELS` in the dashboard's `src/lib/tokens.ts`.
2. Wrap the paid work in `TokensService.withCharge`:

   ```ts
   return this.tokens.withCharge(
     {
       organizationId,
       projectId,
       action: TokenAction.MY_THING,
       tokens: fixedPriceTokens(TokenAction.MY_THING, quantity, this.tokens.config()),
       detail: { anythingWorthKeeping: true },
     },
     () => doTheExpensiveThing(),
   );
   ```

   It charges first, runs the work, and refunds if the work throws.
3. Put the charge **after** every check that could refuse the request and
   **immediately before** the first paid call, so a request that was never going
   to run costs nothing and there is nothing to refund.
4. Inject `TokensService` as a required dependency and import `TokensModule` (a
   missing import then fails at boot instead of silently not charging).
5. Add the price to the rate card in `TokensController` so the Tokens screen
   lists it.

Do not charge for work that is only sometimes paid (something that may return a
cached result), unless the charge can be made after you know which it was.

## Decisions worth knowing

- **There is no payment.** Billing (Razorpay, plans, subscriptions) was removed
  from the product. Tokens are given (monthly, or by an operator), not sold. When
  purchases return, a payment webhook should call `TokensService.adjust` with the
  payment's id as `idempotencyKey`, so a retried webhook cannot pay out twice.
- **A limit that only reports is not a limit**, so the AI gate runs before the
  call. The price of a call is only known after it, so the overshoot is bounded:
  each call in flight when the balance runs out can take the wallet to zero, and
  the rest becomes `shortfall`. The balance itself never goes negative.
- **Failed work is never billed.** Same rule the removed billing system stated:
  "a failed crawl or a failed LLM call never burns the customer's allowance."
- **Per organization**, not per user, matching everything else that is metered
  here (`AiUsageRecord`, `Organization.aiMonthlyBudgetUsd`).
- **`/billing` is gone.** It called `/api/billing/*` endpoints that no longer
  exist, on every dashboard load (the sidebar asked for entitlements). It now
  redirects to `/tokens`. The public pricing page's plans are marketing copy and
  are not connected to tokens.

## Testing

```bash
cd growthx-ai-crawler
npx jest src/modules/tokens                       # rates, service (in-memory ledger), controllers
TOKENS_TEST_DATABASE_URL=postgresql://... \
  npx jest src/modules/tokens/tokens.integration.spec.ts   # concurrency against real PostgreSQL

cd growthx-ai-seo
npx playwright test e2e/tokens.spec.ts            # the screens, against a fake API
```

The integration spec needs a database that has had the migrations applied. It
creates and deletes its own organizations and is skipped when the variable is
unset, so CI (which has no database) never runs it.
