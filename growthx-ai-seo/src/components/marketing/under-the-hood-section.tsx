"use client";

import {
  Cpu,
  FileCode,
  History,
  Sparkles,
  Lock,
  ShoppingBag,
  Briefcase,
  Store,
} from "lucide-react";

const TECH_CARDS = [
  {
    icon: Cpu,
    title: "Headless crawler",
    line: "Renders JavaScript pages like Googlebot, so Next.js and React sites are audited correctly.",
  },
  {
    icon: FileCode,
    title: "Schema inspection",
    line: "Parses your JSON-LD and flags exactly which field is missing or broken.",
  },
  {
    icon: History,
    title: "Before/after proof",
    line: "Every fix is re-crawled and saved with a timestamp, so you can show clients what changed.",
  },
  {
    icon: Sparkles,
    title: "Multi-AI engine",
    line: "Routes each task to the best AI model for speed, cost and quality.",
  },
  {
    icon: Lock,
    title: "Your data stays yours",
    line: "Hosted securely with isolated project tenants, encrypted OAuth credentials, and zero third-party training on your proprietary data.",
  },
];

const AUDIENCES = [
  {
    icon: ShoppingBag,
    who: "E-commerce and D2C brands",
    headline: "Rank for products, not just your brand name.",
    line: "Product schema, category pages and competitor price watch.",
  },
  {
    icon: Briefcase,
    who: "Agencies",
    headline: "Run 20 clients like 2.",
    line: "White-label reports, bulk fixes and a client-ready weekly brief.",
  },
  {
    icon: Store,
    who: "Multi-location businesses",
    headline: "Own the map in every city.",
    line: "Map-grid tracking, city landing pages and GBP management per location.",
  },
];

export function UnderTheHoodSection() {
  return (
    <section className="bg-brand-950 py-24 lg:py-32 border-b border-brand-900 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        {/* Part 1: Under The Hood */}
        <div className="space-y-10">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-series-6">
              FOR THE TECHNICAL BUYER
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
              Real crawls. Real data. No guesswork.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {TECH_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="bg-brand-900/50 border border-brand-800 rounded-3xl p-6 space-y-3 hover:border-brand-700/80 transition-all hover:bg-brand-900/80"
                >
                  <div className="w-10 h-10 rounded-xl bg-series-6/10 border border-series-6/20 text-series-400 flex items-center justify-center">
                    <Icon size={18} />
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-300 leading-relaxed">
                    {card.line}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Part 2: Who It's For */}
        <div className="pt-10 border-t border-brand-900 space-y-10">
          <div className="space-y-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Built for three kinds of teams
            </h3>
            <p className="text-xs sm:text-sm text-brand-400">
              Engineered to drive direct revenue outcomes for businesses of every scale.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {AUDIENCES.map((audience) => {
              const Icon = audience.icon;
              return (
                <div
                  key={audience.who}
                  className="bg-brand-900/60 border border-brand-800 rounded-3xl p-6 sm:p-7 space-y-4 hover:border-brand-700/80 transition-all hover:bg-brand-900/80 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-950 border border-brand-800 text-series-400 flex items-center justify-center">
                      <Icon size={18} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
                      {audience.who}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-series-300 transition-colors">
                      {audience.headline}
                    </h4>
                    <p className="text-xs sm:text-sm text-brand-300 leading-relaxed">
                      {audience.line}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
