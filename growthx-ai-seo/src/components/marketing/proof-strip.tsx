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

const STACK_INTEGRATIONS = [
  "WordPress",
  "Shopify",
  "Webflow",
  "GitHub",
  "Search Console",
  "GA4",
  "Slack & Discord Webhooks",
];

const AI_ENGINES = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Sarvam"];

/** What the product does, stated as fact. No counters: a number belongs here only when it is read from live data. */
const PRINCIPLES = [
  {
    icon: Activity,
    label: "Crawled like Google",
    detail: "Playwright renders JavaScript pages on demand or on Daily, Weekly, Bi-weekly, or Monthly schedules.",
    color: "text-brand-800",
  },
  {
    icon: Target,
    label: "5 AI assistants measured",
    detail: "ChatGPT, Claude, Gemini, Perplexity & Sarvam via official APIs, with live SERP citation previews.",
    color: "text-signal-400",
  },
  {
    icon: ShieldCheck,
    label: "GitHub, WP, Shopify & Webflow",
    detail: "Ship single or batch fixes with BEFORE snapshots, 1-click rollback, and zero unapproved publishes.",
    color: "text-success-500",
  },
  {
    icon: Zap,
    label: "Nothing invented",
    detail: "Zero fabricated stats in audits, Content Studio, or white-label portals. Unmeasured fields say so.",
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

        {/* Visual Integrations & AI Engines Strip */}
        <div
          id="integrations"
          className="pt-5 border-t border-brand-200 grid md:grid-cols-2 gap-4 items-center scroll-mt-20"
        >
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-500 mr-1.5">
              Connects &amp; ships to
            </span>
            {STACK_INTEGRATIONS.map((name) => (
              <span
                key={name}
                className="rounded-full border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-800 shadow-2xs"
              >
                {name}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center md:justify-end gap-1.5 sm:gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-500 mr-1.5">
              Measures AI search
            </span>
            {AI_ENGINES.map((engine) => (
              <span
                key={engine}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-800 shadow-2xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-signal-400" />
                {engine}
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
