"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SUBSCRIPTION_PLANS,
  subscriptionEngine,
  type SubscriptionTierId,
} from "@/lib/subscription-engine";
import type { Currency, BillingCycle } from "@/lib/pricing";

interface SubscriptionGateModalProps {
  orgId: string | null;
  onClaimed?: () => void;
}

export function SubscriptionGateModal({ orgId, onClaimed }: SubscriptionGateModalProps) {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTierId>("founder_free");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const selectedPlan =
    SUBSCRIPTION_PLANS.find((p) => p.id === selectedTier) ?? SUBSCRIPTION_PLANS[0];

  const handleClaim = async () => {
    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 450));
    subscriptionEngine.claimSubscription(orgId, selectedTier, {
      cycle,
      currency,
    });
    setIsSuccess(true);
    setIsSubmitting(false);

    setTimeout(() => {
      onClaimed?.();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-brand-950/80 backdrop-blur-md p-4 sm:p-6">
      <div className="relative w-full max-w-4xl rounded-3xl border border-brand-200/80 bg-surface-1 p-6 sm:p-8 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-signal-400/40 bg-signal-400/15 px-3 py-0.5 text-xs font-mono font-bold text-brand-950">
            <Sparkles size={13} className="text-signal-500" />
            <span>100% Free Founder Access</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-brand-950">
            Choose your plan
          </h2>
          <p className="text-xs sm:text-sm text-brand-500">
            Select a plan to start using Reigel. You can upgrade or switch plans anytime.
          </p>

          {/* Currency & Billing Cycle Toggles */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <div className="inline-flex items-center rounded-lg border border-brand-200 bg-surface-2 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={cn(
                  "rounded-md px-2.5 py-1 transition cursor-pointer",
                  currency === "INR" ? "bg-surface-1 text-brand-950 shadow-xs" : "text-brand-500"
                )}
              >
                ₹ INR
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={cn(
                  "rounded-md px-2.5 py-1 transition cursor-pointer",
                  currency === "USD" ? "bg-surface-1 text-brand-950 shadow-xs" : "text-brand-500"
                )}
              >
                $ USD
              </button>
            </div>

            <div className="inline-flex items-center rounded-lg border border-brand-200 bg-surface-2 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setCycle("monthly")}
                className={cn(
                  "rounded-md px-2.5 py-1 transition cursor-pointer",
                  cycle === "monthly" ? "bg-surface-1 text-brand-950 shadow-xs" : "text-brand-500"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCycle("yearly")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1 transition cursor-pointer",
                  cycle === "yearly" ? "bg-surface-1 text-brand-950 shadow-xs" : "text-brand-500"
                )}
              >
                <span>Yearly</span>
                <span className="rounded-full bg-signal-400 px-1 py-0.2 text-[9px] font-mono text-signal-ink font-extrabold">
                  -20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Plan Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 my-6 items-stretch">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isSelected = selectedTier === plan.id;
            const price = plan.monthlyPrice[currency];
            const isYearly = cycle === "yearly";
            const effectivePrice = isYearly && price > 0 ? Math.round(price * 0.8) : price;

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedTier(plan.id)}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border p-4 transition-all cursor-pointer relative",
                  isSelected
                    ? "border-signal-400 bg-surface-1 ring-2 ring-signal-400/30 shadow-card"
                    : "border-brand-200 bg-surface-1 hover:border-brand-300"
                )}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                      {plan.badge}
                    </span>
                    {isSelected && (
                      <CheckCircle2 size={15} className="text-signal-500" />
                    )}
                  </div>

                  <div>
                    <h3 className="font-extrabold text-sm text-brand-950">{plan.name}</h3>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl font-black text-brand-950">
                        {currency === "INR" ? `₹${effectivePrice.toLocaleString("en-IN")}` : `$${effectivePrice}`}
                      </span>
                      <span className="text-[11px] text-brand-500 font-medium">
                        {plan.id === "founder_free" ? "" : "/mo"}
                      </span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 pt-2 border-t border-brand-200/70 text-xs text-brand-700">
                    <li className="flex items-center gap-1.5">
                      <Check size={12} className="text-success-600 shrink-0" />
                      <span>{plan.websiteLimit} {plan.websiteLimit === 1 ? "website" : "websites"}</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={12} className="text-success-600 shrink-0" />
                      <span>{plan.crawlPageLimit.toLocaleString()} crawl pages</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={12} className="text-success-600 shrink-0" />
                      <span>{plan.aiCyclesMonthly} AI Visibility cycles</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Check size={12} className="text-success-600 shrink-0" />
                      <span>{plan.competitorsLimit} rivals tracked</span>
                    </li>
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-brand-200/70 text-center">
                  <span
                    className={cn(
                      "text-xs font-bold",
                      isSelected ? "text-brand-950" : "text-brand-400"
                    )}
                  >
                    {isSelected ? "Selected" : "Click to select"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Claim Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-brand-200/80">
          <p className="text-xs text-brand-500">
            Selected: <strong className="text-brand-950">{selectedPlan.name}</strong> · No credit card required for early access
          </p>

          <button
            type="button"
            disabled={isSubmitting || isSuccess}
            onClick={handleClaim}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-signal-400 hover:bg-signal-500 active:scale-[0.98] px-6 py-2.5 text-xs font-extrabold text-signal-ink shadow-xs transition cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin text-signal-ink" />
                <span>Activating…</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 size={14} className="text-signal-ink" />
                <span>Plan Active!</span>
              </>
            ) : (
              <>
                <span>Continue with {selectedPlan.name}</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

