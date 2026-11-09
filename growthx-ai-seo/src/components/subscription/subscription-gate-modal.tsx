"use client";

import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Crown,
  Globe,
  Loader2,
  ShieldCheck,
  Sparkles,
  Sprout,
  Zap,
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

const TIER_ICONS: Record<SubscriptionTierId, typeof Sprout> = {
  founder_free: Sparkles,
  starter: Sprout,
  growth: Crown,
  agency: BarChart3,
};

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
    // Simulate brief instant activation beacon
    await new Promise((r) => setTimeout(r, 650));
    subscriptionEngine.claimSubscription(orgId, selectedTier, {
      cycle,
      currency,
    });
    setIsSuccess(true);
    setIsSubmitting(false);

    setTimeout(() => {
      onClaimed?.();
    }, 850);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-brand-950/80 backdrop-blur-md p-4 sm:p-6 md:p-8">
      <div className="relative w-full max-w-5xl rounded-3xl border border-brand-200/80 bg-surface-1 p-6 sm:p-8 md:p-10 shadow-2xl my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-signal-400/40 bg-signal-400/15 px-3 py-1 text-xs font-mono font-bold text-brand-950">
            <Sparkles size={14} className="text-signal-500 animate-pulse" />
            <span>Founder Early Access Promotion · 100% Free Access</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-brand-950">
            Select &amp; Claim Your Subscription
          </h2>
          <p className="text-xs sm:text-sm text-brand-600 leading-relaxed">
            Platform access is granted based on your chosen subscription capacity. Claim your plan below to unlock your workspace, website auditing tools, and Fix Engine agents.
          </p>

          {/* Currency & Billing Cycle Toggles */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {/* Currency */}
            <div className="inline-flex items-center rounded-xl border border-brand-200 bg-surface-2 p-1 text-xs font-bold text-brand-700">
              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={cn(
                  "rounded-lg px-3 py-1 transition cursor-pointer",
                  currency === "INR"
                    ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200"
                    : "text-brand-500 hover:text-brand-950"
                )}
              >
                ₹ INR
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={cn(
                  "rounded-lg px-3 py-1 transition cursor-pointer",
                  currency === "USD"
                    ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200"
                    : "text-brand-500 hover:text-brand-950"
                )}
              >
                $ USD
              </button>
            </div>

            {/* Cycle */}
            <div className="inline-flex items-center rounded-xl border border-brand-200 bg-surface-2 p-1 text-xs font-bold text-brand-700">
              <button
                type="button"
                onClick={() => setCycle("monthly")}
                className={cn(
                  "rounded-lg px-3 py-1 transition cursor-pointer",
                  cycle === "monthly"
                    ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200"
                    : "text-brand-500 hover:text-brand-950"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCycle("yearly")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 transition cursor-pointer",
                  cycle === "yearly"
                    ? "bg-surface-1 text-brand-950 shadow-xs border border-brand-200"
                    : "text-brand-500 hover:text-brand-950"
                )}
              >
                <span>Yearly</span>
                <span className="rounded-full bg-signal-400 px-1.5 py-0.2 text-[9.5px] font-mono text-signal-ink font-extrabold">
                  -20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 4 Plan Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6 sm:my-8 items-stretch">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const Icon = TIER_ICONS[plan.id];
            const isSelected = selectedTier === plan.id;
            const price = plan.monthlyPrice[currency];
            const isYearly = cycle === "yearly";
            const effectivePrice =
              isYearly && price > 0 ? Math.round(price * 0.8) : price;

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedTier(plan.id)}
                className={cn(
                  "flex flex-col justify-between rounded-2xl border p-5 transition-all cursor-pointer relative shadow-2xs",
                  isSelected
                    ? "border-signal-400 bg-surface-1 ring-2 ring-signal-400/30 shadow-card scale-[1.02]"
                    : "border-brand-200 bg-surface-2 hover:bg-surface-1 hover:border-brand-300"
                )}
              >
                {/* Popular or Free Badge */}
                {plan.isPromotionalFree ? (
                  <span className="absolute -top-3 right-4 rounded-full bg-signal-400 px-2.5 py-0.5 text-[10px] font-mono font-extrabold text-signal-ink shadow-xs">
                    Recommended · ₹0 Today
                  </span>
                ) : plan.popular ? (
                  <span className="absolute -top-3 right-4 rounded-full bg-brand-950 px-2.5 py-0.5 text-[10px] font-mono font-extrabold text-surface-1 shadow-xs">
                    Most Popular
                  </span>
                ) : null}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl border",
                        isSelected
                          ? "border-signal-400 bg-signal-400 text-signal-ink"
                          : "border-brand-200 bg-surface-1 text-brand-700"
                      )}
                    >
                      <Icon size={16} />
                    </div>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold font-mono text-brand-700">
                      {plan.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-brand-950">{plan.name}</h3>
                  <p className="mt-1 text-[11px] text-brand-500 leading-snug min-h-[32px]">
                    {plan.blurb}
                  </p>

                  {/* Price */}
                  <div className="my-3 pb-3 border-b border-brand-200/60">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono text-brand-950">
                        {currency === "INR" ? `₹${effectivePrice.toLocaleString("en-IN")}` : `$${effectivePrice}`}
                      </span>
                      <span className="text-[11px] text-brand-500 font-medium">/ month</span>
                    </div>
                    <span className="text-[10px] text-success-700 font-semibold block mt-0.5">
                      {plan.isPromotionalFree
                        ? "100% Free through Dec 31, 2026"
                        : "Promo claim eligibility applied"}
                    </span>
                  </div>

                  {/* Key Quota Badges */}
                  <div className="space-y-1.5 my-3 text-[11px] font-semibold text-brand-800">
                    <div className="flex items-center justify-between rounded-lg bg-surface-1 p-1.5 border border-brand-200/60">
                      <span>Websites:</span>
                      <span className="font-mono text-brand-950 font-bold">{plan.websiteLimit} Site</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-surface-1 p-1.5 border border-brand-200/60">
                      <span>Crawl Pages:</span>
                      <span className="font-mono text-brand-950 font-bold">{plan.crawlPageLimit.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-surface-1 p-1.5 border border-brand-200/60">
                      <span>AI Visibility:</span>
                      <span className="font-mono text-brand-950 font-bold">{plan.aiCyclesMonthly} Cycles/mo</span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-1.5 pt-2">
                    {plan.features.slice(0, 4).map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-brand-600">
                        <Check size={12} className="text-success-600 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Selection Indicator */}
                <div className="mt-4 pt-3 border-t border-brand-200/60 text-center">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-bold font-mono",
                      isSelected ? "text-brand-950 font-extrabold" : "text-brand-400"
                    )}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle2 size={13} className="text-signal-500" />
                        <span>Selected Plan</span>
                      </>
                    ) : (
                      <span>Select Tier</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Claim Action Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-brand-200 bg-surface-2 p-4 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-2xs">
              <Zap size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-950 font-mono">
                  Active Choice: {selectedPlan.name}
                </span>
                <span className="rounded-full bg-success-50 text-success-700 border border-success-200 px-2 py-0.2 text-[10px] font-bold font-mono">
                  ₹0 Billed Today
                </span>
              </div>
              <p className="text-[11px] text-brand-500">
                Includes {selectedPlan.websiteLimit} website, {selectedPlan.crawlPageLimit.toLocaleString()} crawl capacity, and {selectedPlan.aiCyclesMonthly} monthly AI Visibility cycles.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              disabled={isSubmitting || isSuccess}
              onClick={handleClaim}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-signal-400 hover:bg-signal-500 active:scale-[0.98] px-6 py-3 text-xs sm:text-sm font-extrabold text-brand-950 shadow-xs transition cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-brand-950" />
                  <span>Activating Plan…</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 size={16} className="text-brand-950" />
                  <span>Subscription Active! Unlocking…</span>
                </>
              ) : (
                <>
                  <span>Claim &amp; Activate Subscription</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Assurance footer */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[11px] text-brand-400 text-center">
          <span className="flex items-center gap-1">
            <ShieldCheck size={13} className="text-success-600" />
            <span>No payment card required</span>
          </span>
          <span>&middot;</span>
          <span>Zero automatic renewal debits</span>
          <span>&middot;</span>
          <span>Can switch or upgrade anytime in Settings &gt; Subscription</span>
        </div>
      </div>
    </div>
  );
}

