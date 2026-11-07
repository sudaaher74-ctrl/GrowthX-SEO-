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

/** What the product does, stated as fact. No counters: a number belongs here only when it is read from live data. */
const PRINCIPLES = [
  {
    icon: Activity,
    label: "Crawled like Google",
    detail: "JavaScript pages are rendered before they are audited.",
    color: "text-brand-800",
  },
  {
    icon: Target,
    label: "5 AI assistants measured",
    detail: "ChatGPT, Claude, Gemini, Perplexity and Sarvam, each through its own API.",
    color: "text-signal-400",
  },
  {
    icon: ShieldCheck,
    label: "You approve every change",
    detail: "Fixes arrive as a pull request. We never merge for you.",
    color: "text-success-500",
  },
  {
    icon: Zap,
    label: "Nothing invented",
    detail: "If we could not measure it, the screen says so.",
    color: "text-warning-500",
  },
];

export function ProofStrip() {
  return (
    <section className="border-b border-brand-200 py-8 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Partner Logos */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500 shrink-0">
            Brands growing with Reigel
          </span>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            {PARTNER_LOGOS.map((brand) => (
              <span
                key={brand}
                className="text-xs sm:text-sm font-extrabold text-brand-700 hover:text-brand-950 tracking-tight transition-colors cursor-default"
              >
                {brand}
              </span>
            ))}
          </div>
        </div>

        {/* What the product does */}
        <div className="pt-6 border-t border-brand-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {PRINCIPLES.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="bg-surface-1 border border-brand-200 rounded-2xl p-4 flex items-start gap-3.5 hover:border-brand-300 transition-colors shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center shrink-0">
                  <Icon size={18} className={stat.color} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-brand-950 leading-tight tracking-tight">
                    {stat.label}
                  </p>
                  <p className="text-[11px] text-brand-500 font-medium mt-1 leading-snug">
                    {stat.detail}
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
