"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles, Check } from "lucide-react";

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
    growthx: "Included, fixes shipped automatically",
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
    usualWay: "Freelancer or in-house hire",
    costInr: "₹25,000+",
    costUsd: "$300+",
    growthx: "Fix Engine",
  },
];

export function CostComparison() {
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");

  const badgeText =
    currency === "INR"
      ? "An SEO team and four tools, from ₹2,999/mo"
      : "An SEO team and four tools, from $39/mo";

  const totalWithout = currency === "INR" ? "₹80,000+" : "$955+";
  const totalWith = currency === "INR" ? "From ₹2,999" : "From $39";

  return (
    <section className="bg-brand-950 text-brand-50 py-20 sm:py-28 relative overflow-hidden border-y border-brand-900">
      {/* Ambient glowing backdrop */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[650px] h-[320px] bg-series-6/10 blur-[130px] rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[450px] h-[280px] bg-accent-600/10 blur-[110px] rounded-full" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        {/* Header container */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 bg-brand-900/80 border border-brand-800 text-brand-300 text-xs sm:text-sm font-medium px-4 py-1.5 rounded-full mb-5 backdrop-blur-sm shadow-inner">
            <Sparkles size={13} className="text-series-6" />
            <span>{badgeText}</span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15] mb-4">
            An SEO team and four tools, from {currency === "INR" ? "₹2,999" : "$39"}/month.
          </h2>

          <p className="text-sm sm:text-base text-brand-400 leading-relaxed max-w-2xl mx-auto mb-7">
            Most businesses stitch together an agency and a pile of subscriptions. GrowthX does the same job in one place, and actually ships the work.
          </p>

          {/* Currency Switcher */}
          <div className="inline-flex items-center bg-brand-900/90 p-1 rounded-full border border-brand-800 shadow-inner">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                currency === "INR"
                  ? "bg-series-6 text-white shadow-xs"
                  : "text-brand-400 hover:text-brand-200"
              }`}
            >
              INR (₹)
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                currency === "USD"
                  ? "bg-series-6 text-white shadow-xs"
                  : "text-brand-400 hover:text-brand-200"
              }`}
            >
              USD ($)
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="max-w-4xl mx-auto bg-brand-950/80 border border-brand-800 rounded-2xl sm:rounded-3xl shadow-2xl backdrop-blur-md overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 items-center py-4 px-5 sm:px-8 border-b border-brand-800/80 bg-brand-900/40 text-xs sm:text-sm font-semibold text-brand-400">
            <div className="col-span-5 text-left">
              What you need
            </div>
            <div className="col-span-4 text-left">
              The usual way
            </div>
            <div className="col-span-3 text-right text-success-400 font-bold">
              GrowthX
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-brand-900">
            {COMPARISON_ROWS.map((row) => {
              const cost = currency === "INR" ? row.costInr : row.costUsd;

              return (
                <div
                  key={row.what}
                  className="grid grid-cols-12 items-center py-4 sm:py-4.5 px-5 sm:px-8 hover:bg-brand-900/25 transition-colors"
                >
                  <div className="col-span-5 text-left text-xs sm:text-sm text-brand-200 font-normal pr-2">
                    {row.what}
                  </div>
                  <div className="col-span-4 text-left text-xs sm:text-sm text-brand-400 font-normal">
                    <span>{row.usualWay}</span>
                    <span className="block text-[11px] text-brand-500 font-mono mt-0.5">{cost}/mo</span>
                  </div>
                  <div className="col-span-3 text-right text-xs sm:text-sm font-bold text-success-400">
                    {row.growthx}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Footer Row */}
          <div className="grid grid-cols-12 items-center py-5 px-5 sm:px-8 bg-brand-900/60 border-t border-brand-800">
            <div className="col-span-5 text-left text-sm sm:text-base font-bold text-white">
              Total monthly cost
            </div>
            <div className="col-span-4 text-left text-sm sm:text-base font-bold text-error-400">
              {totalWithout}/mo
            </div>
            <div className="col-span-3 text-right text-sm sm:text-base font-bold text-success-400">
              {totalWith}/mo
            </div>
          </div>
        </div>

        {/* Pricing Teaser Cards */}
        <div className="mt-12 max-w-4xl mx-auto grid sm:grid-cols-3 gap-4">
          <div className="bg-brand-900/40 border border-brand-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-series-400">Starter</span>
                <span className="text-[11px] text-brand-400">1 website</span>
              </div>
              <p className="text-2xl font-black text-white mt-1">
                {currency === "INR" ? "₹2,999" : "$39"}
                <span className="text-xs font-normal text-brand-400">/mo</span>
              </p>
              <p className="text-xs text-brand-300 mt-2">
                Audit, Fix Engine, 3 competitors, AI visibility basics.
              </p>
            </div>
            <Link
              href="/pricing"
              className="block text-center py-2 px-3 rounded-xl bg-brand-850 hover:bg-brand-800 text-white text-xs font-bold transition-all border border-brand-700"
            >
              Choose Starter
            </Link>
          </div>

          <div className="bg-brand-900/70 border border-series-6/50 rounded-2xl p-5 space-y-3 flex flex-col justify-between relative shadow-xl">
            <span className="absolute -top-2.5 right-4 bg-series-6 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full">
              Popular
            </span>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-series-300">Growth</span>
                <span className="text-[11px] text-brand-400">Growing brands</span>
              </div>
              <p className="text-2xl font-black text-white mt-1">
                {currency === "INR" ? "₹7,999" : "$99"}
                <span className="text-xs font-normal text-brand-400">/mo</span>
              </p>
              <p className="text-xs text-brand-300 mt-2">
                5 competitors, Rival Radar, GBP for 1 location, weekly brief.
              </p>
            </div>
            <Link
              href="/pricing"
              className="block text-center py-2 px-3 rounded-xl bg-series-6 hover:bg-series-6/90 text-white text-xs font-bold transition-all shadow-md"
            >
              Choose Growth
            </Link>
          </div>

          <div className="bg-brand-900/40 border border-brand-800 rounded-2xl p-5 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-series-400">Agency</span>
                <span className="text-[11px] text-brand-400">Agencies</span>
              </div>
              <p className="text-2xl font-black text-white mt-1">
                {currency === "INR" ? "₹19,999" : "$249"}
                <span className="text-xs font-normal text-brand-400">/mo</span>
              </p>
              <p className="text-xs text-brand-300 mt-2">
                Multiple clients, white-label reports, bulk fixes, multi-location GBP.
              </p>
            </div>
            <Link
              href="/pricing"
              className="block text-center py-2 px-3 rounded-xl bg-brand-850 hover:bg-brand-800 text-white text-xs font-bold transition-all border border-brand-700"
            >
              Choose Agency
            </Link>
          </div>
        </div>

        {/* CTA Bar below teaser */}
        <div className="mt-6 max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-brand-400 px-2">
          <p>Free audit. No card needed. Cancel anytime.</p>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-series-400 hover:text-series-300 font-bold transition-colors"
          >
            <span>See all plans and features</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </section>
  );
}
