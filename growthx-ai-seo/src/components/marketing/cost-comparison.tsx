"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Zap } from "lucide-react";
import { PLANS, planPrice, YEARLY_DISCOUNT, type Currency, type BillingCycle } from "@/lib/pricing";

interface ComparisonRow {
  what: string;
  usualWay: string;
  costInr: string;
  costUsd: string;
  growthx: string;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    what: "Technical SEO audit + fixes",
    usualWay: "SEO agency retainer",
    costInr: "₹40,000–1,00,000",
    costUsd: "$500–1,200",
    growthx: "Included, fixes ready as pull requests",
  },
  {
    what: "Keyword & competitor research",
    usualWay: "Semrush or Ahrefs",
    costInr: "₹11,000+",
    costUsd: "$130+",
    growthx: "Included, gaps priced in ₹",
  },
  {
    what: "AI search visibility",
    usualWay: "Otterly, Peec or Profound",
    costInr: "₹2,500–8,500",
    costUsd: "$30–100",
    growthx: "Included",
  },
  {
    what: "Google Maps rank tracking",
    usualWay: "Local Falcon or BrightLocal",
    costInr: "₹2,000–3,500",
    costUsd: "$25–45",
    growthx: "Included",
  },
  {
    what: "Someone to actually do the work",
    usualWay: "Freelancer or in-house hire (for the routine fixes)",
    costInr: "₹25,000+",
    costUsd: "$300+",
    growthx: "Fix Engine opens the pull request",
  },
];

export function CostComparison() {
  const [currency, setCurrency] = useState<Currency>("INR");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const yearlyPct = Math.round(YEARLY_DISCOUNT * 100);

  const starterPrice = planPrice("starter", currency, billingCycle);
  const badgeText = `Audit, rivals, AI answers and Maps, from ${planPrice("starter", currency, "monthly")}/mo`;
  const totalWithout = currency === "INR" ? "₹80,500+" : "$985+";
  const saving = currency === "INR" ? "₹77,500" : "$946";
  const totalWith = `From ${starterPrice}`;

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden border-y border-brand-200">
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Header container */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 bg-surface-1 border border-brand-200 text-brand-700 text-[11px] sm:text-sm font-medium px-3 sm:px-4 py-1 sm:py-1.5 rounded-full mb-4 sm:mb-5 shadow-2xs max-w-full">
            <span className="h-2 w-2 rounded-full bg-signal-400 shrink-0" />
            <span className="truncate">{badgeText}</span>
          </div>

          {/* Headline */}
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-brand-950 tracking-tight leading-[1.15] mb-3 sm:mb-4">
            Five tools and a freelancer, from {starterPrice}/month.
          </h2>

          <p className="text-sm sm:text-base text-brand-500 leading-relaxed max-w-2xl mx-auto mb-6 sm:mb-8">
            Most teams stitch together an agency and a pile of subscriptions. Reigel covers the same ground in one place, prepares the fixes, and checks they worked.
          </p>

          {/* Dual Controls: Billing Cycle + Currency Switcher */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
            {/* Monthly / Yearly Toggle */}
            <div className="inline-flex items-center bg-surface-2 p-1 rounded-full border border-brand-200">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  billingCycle === "monthly"
                    ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                    : "text-brand-600 hover:text-brand-950"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  billingCycle === "yearly"
                    ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                    : "text-brand-600 hover:text-brand-950"
                }`}
              >
                <span>Yearly</span>
                <span className="bg-surface-1 text-success-500 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full border border-brand-200">
                  Save {yearlyPct}%
                </span>
              </button>
            </div>

            {/* Currency Switcher */}
            <div className="inline-flex items-center bg-surface-2 p-1 rounded-full border border-brand-200">
              <button
                type="button"
                onClick={() => setCurrency("INR")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  currency === "INR"
                    ? "bg-surface-1 text-brand-950 shadow-2xs border border-brand-200"
                    : "text-brand-600 hover:text-brand-950"
                }`}
              >
                INR (₹)
              </button>
              <button
                type="button"
                onClick={() => setCurrency("USD")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  currency === "USD"
                    ? "bg-surface-1 text-brand-950 shadow-2xs border border-brand-200"
                    : "text-brand-600 hover:text-brand-950"
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>
        </div>

        {/* ROI Savings Callout Banner */}
        <div className="mb-8 sm:mb-10 max-w-4xl mx-auto bg-surface-1 border border-brand-200 rounded-2xl p-4 sm:p-6 shadow-card relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-3.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center shrink-0">
                <Zap size={18} className="text-signal-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-lg font-bold text-brand-950 leading-tight">
                  If you replaced all five, you would save about {saving} a month
                </h3>
                <p className="text-xs sm:text-sm text-brand-500 mt-0.5 sm:mt-1 leading-snug">
                  Adds up the low end of each line in the table below. You may only need some of them.
                </p>
              </div>
            </div>
            <div className="shrink-0 bg-surface-2 border border-brand-200 text-brand-600 font-mono font-bold text-[10px] sm:text-xs px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full">
              Illustrative
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto bg-surface-1 border border-brand-200 rounded-2xl sm:rounded-3xl shadow-card overflow-hidden">
          {/* Table Header */}
          <div className="hidden sm:grid grid-cols-12 items-center py-4 px-5 sm:px-8 border-b border-brand-200 bg-surface-2 text-xs sm:text-sm font-semibold text-brand-500">
            <div className="col-span-5 text-left">
              What you need
            </div>
            <div className="col-span-4 text-left">
              The usual way
            </div>
            <div className="col-span-3 text-right text-brand-950 font-bold">
              Reigel
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-brand-200">
            {COMPARISON_ROWS.map((row) => {
              const cost = currency === "INR" ? row.costInr : row.costUsd;

              return (
                <div
                  key={row.what}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-0 py-3.5 sm:py-4.5 px-3.5 sm:px-8 hover:bg-surface-2/60 transition-colors"
                >
                  <div className="sm:col-span-5 text-left text-sm text-brand-950 font-semibold pr-2">
                    {row.what}
                  </div>
                  <div className="sm:col-span-4 text-left text-xs sm:text-sm text-brand-500 font-normal">
                    <span className="block sm:hidden text-[10px] font-bold uppercase tracking-wide text-brand-400 mb-0.5">Usual way</span>
                    <span>{row.usualWay}</span>
                    <span className="block text-[11px] text-brand-400 font-mono mt-0.5">{cost}/mo</span>
                  </div>
                  <div className="sm:col-span-3 text-left sm:text-right text-xs sm:text-sm font-bold text-success-500">
                    <span className="block sm:hidden text-[10px] font-bold uppercase tracking-wide text-success-500 mb-0.5">Reigel</span>
                    <span>{row.growthx}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Footer Row */}
          <div className="grid grid-cols-2 sm:grid-cols-12 items-center gap-y-2 sm:gap-y-3 py-4 sm:py-5 px-3.5 sm:px-8 bg-surface-2 border-t border-brand-200">
            <div className="col-span-2 sm:col-span-5 text-left text-sm sm:text-base font-bold text-brand-950">
              Total monthly cost
            </div>
            <div className="sm:col-span-4 text-left text-xs sm:text-base font-bold text-error-500">
              <span className="block sm:hidden text-[10px] font-bold uppercase tracking-wide text-brand-400">Usual cost</span>
              {totalWithout}/mo
            </div>
            <div className="sm:col-span-3 text-left sm:text-right text-xs sm:text-base font-bold text-success-500">
              <span className="block sm:hidden text-[10px] font-bold uppercase tracking-wide text-brand-400">Reigel</span>
              {totalWith}/mo
            </div>
          </div>
        </div>

        {/* Pricing Teaser Cards */}
        <div className="mt-12 max-w-4xl mx-auto grid sm:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={
                plan.popular
                  ? "bg-surface-1 border-2 border-signal-400 shadow-card rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between relative"
                  : "bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-5 sm:p-6 space-y-4 flex flex-col justify-between transition-all shadow-2xs"
              }
            >
              {plan.popular && (
                <span className="absolute -top-3 right-4 bg-signal-400 text-signal-ink text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-xs">
                  Popular
                </span>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-700">{plan.name}</span>
                  <span className="text-[11px] text-brand-500 font-medium">{plan.audience}</span>
                </div>
                <p className="text-3xl font-black text-brand-950 mt-2">
                  {planPrice(plan.id, currency, billingCycle)}
                  <span className="text-xs font-normal text-brand-500">/mo</span>
                </p>
                {billingCycle === "yearly" && (
                  <p className="text-[10px] text-success-500 font-semibold mt-0.5">
                    Billed annually (save {yearlyPct}%)
                  </p>
                )}
                <p className="text-xs text-brand-500 mt-3 leading-relaxed">{plan.blurb}</p>
              </div>
              <Link
                href="/pricing"
                className={
                  plan.popular
                    ? "block text-center py-2.5 px-3 rounded-full bg-signal-400 hover:bg-signal-500 text-signal-ink text-xs font-bold transition-all shadow-xs cursor-pointer"
                    : "block text-center py-2.5 px-3 rounded-full bg-surface-2 hover:bg-brand-100 text-brand-950 text-xs font-bold transition-all border border-brand-200 cursor-pointer"
                }
              >
                See {plan.name}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-6 max-w-4xl mx-auto text-[11px] text-brand-400 text-center">
          Other vendors&apos; figures are approximate list prices and change often.
        </p>

        {/* CTA Bar below teaser */}
        <div className="mt-8 max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-brand-500 px-2">
          <p className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-success-500" />
            <span>Free account, free audit. No card needed. Cancel anytime.</span>
          </p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-brand-950 font-bold underline decoration-signal-400 underline-offset-4 transition-colors cursor-pointer"
          >
            <span>See all plans and features</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
