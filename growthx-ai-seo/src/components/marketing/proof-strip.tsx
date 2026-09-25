"use client";

import { Building2, Layers, ShieldCheck, Flame, Compass, Store } from "lucide-react";

const BRANDS = [
  { name: "AIVA Enterprises", icon: Layers, tag: "Tech & SaaS" },
  { name: "Immunity Group", icon: ShieldCheck, tag: "Healthcare" },
  { name: "Brand Kettle", icon: Flame, tag: "Brand Agency" },
  { name: "OS Interior", icon: Building2, tag: "Architecture" },
  { name: "Dron Archery Academy", icon: Compass, tag: "Sports & Training" },
  { name: "MilQuu Fresh", icon: Store, tag: "D2C Food & Dairy" },
];

const STATS = [
  { label: "Pages crawled", value: "14,280+", detail: "Real JavaScript execution" },
  { label: "Issues found", value: "1,840+", detail: "Ranked by revenue impact" },
  { label: "Fixes shipped", value: "420+", detail: "To GitHub, WordPress & Shopify" },
  { label: "Competitors tracked", value: "280+", detail: "Daily algorithmic change checks" },
];

export function ProofStrip() {
  return (
    <section className="bg-brand-950/80 border-b border-brand-900 py-12 lg:py-16 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Brand Logos */}
        <div className="space-y-4 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-400">
            Brands growing with GrowthX
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:gap-8 pt-2">
            {BRANDS.map((brand) => {
              const Icon = brand.icon;
              return (
                <div
                  key={brand.name}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-brand-900/40 border border-brand-800/60 hover:border-brand-700/80 transition-all hover:bg-brand-900/70 group"
                >
                  <Icon size={16} className="text-brand-400 group-hover:text-series-400 transition-colors" />
                  <div className="text-left">
                    <span className="text-xs sm:text-[13px] font-bold text-brand-200 group-hover:text-white transition-colors block leading-tight">
                      {brand.name}
                    </span>
                    <span className="text-[10px] text-brand-500 block">{brand.tag}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real Metrics Stat Row */}
        <div className="pt-6 border-t border-brand-900/80">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="bg-brand-900/50 border border-brand-800/70 rounded-2xl p-4 sm:p-5 text-center sm:text-left space-y-1 hover:border-brand-700/80 transition-all"
              >
                <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm font-semibold text-brand-300">
                  {stat.label}
                </div>
                <div className="text-[11px] text-brand-500 font-medium">
                  {stat.detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
