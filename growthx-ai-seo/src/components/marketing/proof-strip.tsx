"use client";

import { Activity, ShieldCheck, Zap, Target } from "lucide-react";

const PARTNER_LOGOS = [
  "AIVA Enterprises",
  "Immunity Group",
  "Brand Kettle",
  "OS Interior",
  "Dron Archery Academy",
  "MilQuu Fresh",
];

const STATS = [
  {
    icon: Activity,
    label: "Pages crawled",
    value: "12,480+",
    color: "text-brand-300",
  },
  {
    icon: ShieldCheck,
    label: "Issues found",
    value: "3,420+",
    color: "text-warning-400",
  },
  {
    icon: Zap,
    label: "Fixes shipped",
    value: "1,890+",
    color: "text-success-400",
  },
  {
    icon: Target,
    label: "Competitors tracked",
    value: "840+",
    color: "text-series-400",
  },
];

export function ProofStrip() {
  return (
    <section className="bg-brand-950 border-b border-brand-900/80 py-8 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Partner Logos */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-400 shrink-0">
            Brands growing with GrowthX
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            {PARTNER_LOGOS.map((brand) => (
              <span
                key={brand}
                className="text-xs sm:text-sm font-extrabold text-brand-300 hover:text-white tracking-tight transition-colors cursor-default"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>

        {/* Database Metric Counters */}
        <div className="pt-6 border-t border-brand-900 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {STATS.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-brand-900/40 border border-brand-850 rounded-2xl p-4 flex items-center gap-3.5 hover:border-brand-750 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-950 border border-brand-800 flex items-center justify-center shrink-0">
                  <Icon size={18} className={stat.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-black text-white leading-none tracking-tight">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-brand-400 font-medium mt-1 truncate">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
