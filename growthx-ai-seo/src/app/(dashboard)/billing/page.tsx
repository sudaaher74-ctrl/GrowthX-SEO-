"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { cn } from "@/lib/utils";
import { useCheckout, useEntitlements, usePlans, useWorkspace } from "@/hooks/use-growthx";
import type { Plan } from "@/lib/api-client";

/** Human labels for the feature flags the API returns. */
const FEATURE_LABELS: Record<string, string> = {
  CRAWL: "Full website crawl",
  SCHEDULED_CRAWLS: "Scheduled re-crawls",
  AI_RECOMMENDATIONS: "AI fix recommendations",
  MODEL_GEMINI: "Gemini analysis",
  MODEL_GPT: "GPT analysis",
  MODEL_CLAUDE: "Claude analysis",
  AUTO_FIX_PATCH: "Automated fix generation",
  AUTO_FIX_DEPLOY: "Fixes shipped as pull requests",
  AI_VISIBILITY: "AI assistant visibility tracking",
  COMPETITOR_TRACKING: "Competitor tracking",
  MARKET_STRATEGY: "Market & social media strategy",
  WHITE_LABEL_REPORTS: "White-label reporting",
  API_ACCESS: "API access",
};

const QUOTA_LABELS: Record<string, string> = {
  CRAWL_PAGES: "Pages crawled",
  AI_ANALYSES: "AI analyses",
  AUTO_FIXES: "Automated fixes",
  AI_VISIBILITY_CHECKS: "AI visibility checks",
  STRATEGY_REPORTS: "Strategy reports",
};

export default function BillingPage() {
  const { orgId } = useWorkspace();
  const plans = usePlans();
  const entitlements = useEntitlements(orgId);
  const checkout = useCheckout(orgId);
  const [email, setEmail] = useState("");

  const currentPlan = entitlements.data?.plan;

  async function subscribe(plan: Plan) {
    if (!email.trim()) {
      window.alert("Enter the billing email first.");
      return;
    }
    const session = await checkout.mutateAsync({ plan: plan.plan, email: email.trim() });
    // Razorpay returns a hosted checkout link; the plan is only granted once
    // their webhook confirms payment, so we never mark it active here.
    if (session.shortUrl) window.location.assign(session.shortUrl);
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-h1 text-[var(--text-primary)]">Billing & Plans</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {entitlements.data
            ? `You are on ${entitlements.data.planName}. Usage resets ${new Date(
                entitlements.data.periodEnd,
              ).toLocaleDateString()}.`
            : "Choose a plan to get started."}
        </p>
      </motion.div>

      {/* ── Plans ─────────────────────────────────────────────── */}
      <QueryState isLoading={plans.isLoading} error={plans.error}>
        {!plans.data?.configured && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-500">
            Razorpay is not configured on the server, so checkout is disabled. Set
            <code className="mx-1 font-mono text-xs">RAZORPAY_KEY_ID</code> and
            <code className="mx-1 font-mono text-xs">RAZORPAY_KEY_SECRET</code> to enable it.
          </div>
        )}

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.data?.plans.map((plan) => {
            const isCurrent = currentPlan === plan.plan;
            const isPopular = plan.plan === "GROWTH";
            return (
              <motion.div
                key={plan.plan}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "relative rounded-2xl border bg-[var(--surface-1)] p-6",
                  isPopular ? "border-blue-500" : "border-[var(--border-color)]",
                )}
              >
                {isPopular && (
                  <span className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-blue-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                    <Star size={10} /> Most popular
                  </span>
                )}

                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">{plan.name}</h2>
                    <p className="mt-1 max-w-xs text-xs text-[var(--text-muted)]">{plan.tagline}</p>
                  </div>
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </div>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-[var(--text-primary)]">{plan.price}</span>
                  <span className="text-sm text-[var(--text-muted)]">/month</span>
                </div>

                <ul className="mt-5 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                      <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                      {FEATURE_LABELS[feature] ?? feature}
                    </li>
                  ))}
                  <li className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                    {plan.maxSites === null ? "Unlimited websites" : `${plan.maxSites} website${plan.maxSites === 1 ? "" : "s"}`}
                  </li>
                </ul>

                <div className="mt-6">
                  <Button
                    variant={isPopular ? "primary" : "secondary"}
                    size="sm"
                    disabled={isCurrent || checkout.isPending || !plans.data?.configured}
                    onClick={() => subscribe(plan)}
                  >
                    {checkout.isPending ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={13} className="animate-spin" /> Starting checkout…
                      </span>
                    ) : isCurrent ? (
                      "Your current plan"
                    ) : (
                      `Subscribe — ${plan.price}/mo`
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 max-w-sm">
          <label className="text-xs font-medium text-[var(--text-muted)]">Billing email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@yourbusiness.in"
            className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </div>

        {checkout.error && (
          <p className="mt-2 text-sm text-red-400">{(checkout.error as Error).message}</p>
        )}
      </QueryState>

      {/* ── Usage ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-h3 text-[var(--text-primary)]">Usage this period</h2>
        <QueryState
          isLoading={entitlements.isLoading}
          error={entitlements.error}
          isEmpty={!entitlements.data}
          emptyTitle="No subscription yet"
          emptyBody="Pick a plan above to start tracking usage."
        >
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {entitlements.data?.quotas.map((quota) => {
              const unlimited = quota.limit === null;
              const pct = unlimited ? 0 : Math.min(100, (quota.used / Math.max(1, quota.limit!)) * 100);
              return (
                <div
                  key={quota.metric}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] p-4"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">
                      {QUOTA_LABELS[quota.metric] ?? quota.metric}
                    </span>
                    <span className="font-mono text-xs text-[var(--text-muted)]">
                      {unlimited
                        ? "Unlimited"
                        : `${quota.used.toLocaleString()} / ${quota.limit!.toLocaleString()}`}
                    </span>
                  </div>
                  {!unlimited && (
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div
                        className={cn("h-full rounded-full", pct > 80 ? "bg-amber-500" : "bg-blue-500")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </QueryState>
      </section>
    </div>
  );
}
