"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

export function CostComparison() {
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");

  const isINR = currency === "INR";

  const rows = [
    {
      need: "Technical SEO audit + fixes",
      usual: "SEO agency retainer",
      cost: isINR ? "₹40,000–1,00,000" : "$500–1,200",
      growthx: "Included, fixes shipped automatically",
    },
    {
      need: "Keyword and competitor research",
      usual: "Semrush or Ahrefs",
      cost: isINR ? "₹11,000+" : "$130+",
      growthx: isINR ? "Included, gaps priced in ₹" : "Included, gaps priced in $",
    },
    {
      need: "AI search visibility",
      usual: "Otterly, Peec or Profound",
      cost: isINR ? "₹2,500–8,500" : "$30–100",
      growthx: "Included",
    },
    {
      need: "Google Maps rank tracking",
      usual: "Local Falcon or BrightLocal",
      cost: isINR ? "₹2,000–3,500" : "$25–45",
      growthx: "Included",
    },
    {
      need: "Someone to actually do the work",
      usual: "Freelancer or in-house hire",
      cost: isINR ? "₹25,000+" : "$300+",
      growthx: "Fix Engine",
    },
  ];

  const plans = [
    {
      name: "Starter",
      price: isINR ? "₹2,999" : "$39",
      target: "1 website",
      line: "Audit, Fix Engine, 3 competitors, AI visibility basics",
      badge: null,
    },
    {
      name: "Growth",
      price: isINR ? "₹7,999" : "$99",
      target: "Growing brands",
      line: "5 competitors, Rival Radar, GBP for 1 location, weekly brief",
      badge: "Popular",
    },
    {
      name: "Agency",
      price: isINR ? "₹19,999" : "$249",
      target: "Agencies",
      line: "Multiple clients, white-label reports, bulk fixes, multi-location GBP",
      badge: null,
    },
  ];

  return (
    <section className="bg-brand-950 py-24 lg:py-32 border-b border-brand-900 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Header & Currency Switcher */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-series-6">
              Cost &amp; Value Breakdown
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
              An SEO team and four tools, from {isINR ? "₹2,999" : "$39"}/month.
            </h2>
            <p className="text-sm sm:text-base text-brand-300 leading-relaxed">
              Most businesses stitch together an agency and a pile of subscriptions.
              GrowthX does the same job in one place, and actually ships the work.
            </p>
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center gap-1 bg-brand-900 border border-brand-800 p-1 rounded-xl shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setCurrency("INR")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isINR
                  ? "bg-series-6 text-white shadow-sm"
                  : "text-brand-400 hover:text-white"
              }`}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => setCurrency("USD")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                !isINR
                  ? "bg-series-6 text-white shadow-sm"
                  : "text-brand-400 hover:text-white"
              }`}
            >
              $ USD
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="overflow-x-auto rounded-3xl border border-brand-800 bg-brand-900/40 shadow-xl">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-brand-800 bg-brand-900/80 text-brand-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="p-4 sm:p-5">What you need</th>
                <th className="p-4 sm:p-5">The usual way</th>
                <th className="p-4 sm:p-5">Typical cost/month</th>
                <th className="p-4 sm:p-5 text-white bg-series-6/10 border-l border-series-6/20">GrowthX</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-800/60">
              {rows.map((row) => (
                <tr key={row.need} className="hover:bg-brand-900/30 transition-colors">
                  <td className="p-4 sm:p-5 font-semibold text-white">{row.need}</td>
                  <td className="p-4 sm:p-5 text-brand-400">{row.usual}</td>
                  <td className="p-4 sm:p-5 text-brand-300 font-mono font-medium">{row.cost}</td>
                  <td className="p-4 sm:p-5 text-series-300 font-semibold bg-series-6/5 border-l border-series-6/20">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-series-400 shrink-0" />
                      {row.growthx}
                    </span>
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-brand-950/80 font-bold border-t-2 border-brand-800">
                <td className="p-4 sm:p-5 text-white text-base">Total</td>
                <td className="p-4 sm:p-5 text-brand-400">Fragmented tools + agency</td>
                <td className="p-4 sm:p-5 text-error-400 font-mono text-base">
                  {isINR ? "₹80,000+" : "$1,000+"}/mo
                </td>
                <td className="p-4 sm:p-5 text-success-400 text-base font-black bg-series-6/10 border-l border-series-6/20">
                  From {isINR ? "₹2,999" : "$39"}/mo
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Pricing Teaser Cards */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="bg-brand-900/60 border border-brand-800 rounded-3xl p-6 sm:p-7 space-y-4 hover:border-brand-700/80 transition-all hover:bg-brand-900/80 relative"
              >
                {plan.badge && (
                  <span className="absolute top-5 right-5 text-[10px] font-bold uppercase tracking-wider text-series-300 bg-series-6/20 border border-series-6/30 px-2.5 py-0.5 rounded-full">
                    {plan.badge}
                  </span>
                )}

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-brand-400 font-medium">{plan.target}</p>
                </div>

                <div>
                  <span className="text-3xl sm:text-4xl font-black text-white">{plan.price}</span>
                  <span className="text-xs text-brand-400 font-medium"> /month</span>
                </div>

                <p className="text-xs sm:text-sm text-brand-300 leading-relaxed pt-2 border-t border-brand-800">
                  {plan.line}
                </p>
              </div>
            ))}
          </div>

          {/* CTA & Microcopy */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 bg-series-6 hover:bg-series-6/90 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all shadow-md active:scale-95"
            >
              <span>See all plans</span>
              <ArrowRight size={15} />
            </Link>
            <p className="text-xs text-brand-400 font-medium">
              Free audit. No card needed. Cancel anytime.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
