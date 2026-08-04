# Billing & entitlements

Single source of truth for what a customer's money buys. Direct-to-SMB self-serve, INR, Razorpay.

## Plans

| Plan | Price | Sites | What's included |
|---|---|---|---|
| `FREE` | ₹0 | 1 | 100-page crawl, no AI |
| `STARTER` | **₹2,000/mo** | 1 | Full crawl (5,000 pages/mo), scheduled re-crawls, **Gemini** recommendations (200/mo) |
| `PRO` | **₹5,000/mo** | 3 | Everything above (25,000 pages, 1,000 analyses) **plus Claude + GPT**, auto-fix patches (50/mo) shipped as pull requests, AI-assistant visibility tracking (3,000 checks/mo), competitor tracking, market & social strategy (4/mo) |
| `ENTERPRISE` | negotiated | ∞ | Everything, unlimited, white-label reports, API access |

Edit [`plans.catalog.ts`](./plans.catalog.ts) to change any of this — nothing else hard-codes prices or limits.

## Enforcing a plan on a route

```ts
@Post('issues/:id/autofix')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('issue', 'id')                                   // trace the org from the resource
@Metered(Feature.AUTO_FIX_PATCH, UsageMetric.AUTO_FIXES)  // feature gate + allowance check
async generateAutoFix(@Req() req: any, @Param('id') id: string) {
  const result = await this.autoFixService.generateFixPatch(id);
  await this.entitlements.recordUsage(req.organizationId, UsageMetric.AUTO_FIXES);
  return result;
}
```

Two rules that keep billing honest:

- **The guard only checks; it never charges.** Usage is recorded by the handler *after* the work
  succeeds, so a failed crawl or a failed LLM call costs the customer nothing.
- **A feature absent from a plan is denied.** Adding a `Feature` without granting it anywhere means
  it is locked, which is the safe direction to fail.

Denials return a 403 naming the cheapest plan that unlocks the capability, so the frontend can render
an upgrade prompt straight from the error body:

```json
{
  "error": "FEATURE_NOT_IN_PLAN",
  "feature": "MODEL_CLAUDE",
  "message": "Claude analysis is available on the Pro plan (₹5,000/month).",
  "currentPlan": "STARTER",
  "upgradeTo": { "plan": "PRO", "name": "Pro", "price": "₹5,000" }
}
```

## Organization resolution

`OrgContextService` decides *whose* plan applies, then verifies the caller is a member of that org —
without the membership check, gating would be bypassable by passing someone else's organization id.
It resolves in order: the `@OrgFrom(...)` resource → an explicit `organizationId` (param, body, query,
or `x-organization-id` header) → the caller's org when they belong to exactly one.

## Razorpay

`RazorpayService` is a thin REST client (no SDK) so the transport stays mockable.

- Plans are created lazily on first checkout. Pin existing ones with `RAZORPAY_PLAN_ID_STARTER` /
  `RAZORPAY_PLAN_ID_PRO`.
- **Entitlement follows the webhook, not checkout.** `startCheckout` records a pending subscription;
  the plan is only served once Razorpay confirms `subscription.activated` / `subscription.charged`.
- Webhook signatures are verified against the **raw** body (`rawBody: true` in `main.ts`) — re-serialising
  the parsed JSON changes byte order and the HMAC will not match.
- Deliveries are de-duplicated via the `WebhookEvent` table, so Razorpay's retries cannot roll the
  billing period forward twice.

## Lapsed subscriptions

`resolvePlan` drops an org to `FREE` when a subscription is halted, expired, or pending, but keeps
serving a **cancelled** plan until `currentPeriodEnd` — the customer paid for that period.

## Endpoints

| Method | Path | Auth |
|---|---|---|
| `GET` | `/api/billing/plans` | public (pricing page) |
| `GET` | `/api/billing/organizations/:orgId/entitlements` | JWT |
| `GET` | `/api/billing/organizations/:orgId/subscription` | JWT |
| `POST` | `/api/billing/organizations/:orgId/checkout` | JWT |
| `POST` | `/api/billing/organizations/:orgId/cancel` | JWT |
| `POST` | `/api/billing/webhooks/razorpay` | HMAC signature |
