"use client";

import { FileSpreadsheet, EyeOff, Bot, ArrowRight } from "lucide-react";

const PAIN_CARDS = [
  {
    icon: FileSpreadsheet,
    title: "Reports, not results",
    line: "You get a 200-row audit. Nobody has time to fix it.",
    pill: "Data paralysis",
  },
  {
    icon: EyeOff,
    title: "Competitors move silently",
    line: "A rival adds 20 pages and a new city page, and you find out months later.",
    pill: "Missed opportunities",
  },
  {
    icon: Bot,
    title: "AI search skips you",
    line: "People ask AI assistants for suppliers. Your name doesn't come up.",
    pill: "Zero AI citations",
  },
];

export function ProblemSection() {
  return (
    <section className="bg-brand-950 py-20 lg:py-28 border-b border-brand-900 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-bold uppercase tracking-widest text-series-6">
            The Reality of Modern Search
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-white leading-tight tracking-tight">
            SEO got harder. Your tools didn&apos;t get smarter.
          </h2>
          <p className="text-base sm:text-lg text-brand-300 leading-relaxed">
            Most businesses pay for three or four tools and still don&apos;t know what to do on Monday morning.
            Reports pile up. Competitors quietly add pages. ChatGPT and Google&apos;s AI answers recommend someone else.
            Nobody fixes anything.
          </p>
        </div>

        {/* 3 Pain Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PAIN_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className="bg-brand-900/60 border border-brand-800 rounded-3xl p-6 sm:p-7 space-y-4 hover:border-brand-700/80 transition-all hover:bg-brand-900/80 group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-error-500/10 border border-error-500/20 text-error-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon size={22} />
                  </div>
                  <span className="text-[11px] font-bold text-error-400/90 bg-error-500/10 px-2.5 py-1 rounded-full border border-error-500/20">
                    {card.pill}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-series-300 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-brand-300 leading-relaxed">
                    {card.line}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bridge Line */}
        <div className="pt-4 flex items-center gap-3 text-sm sm:text-base font-semibold text-brand-200">
          <div className="w-2 h-2 rounded-full bg-series-6" />
          <span>GrowthX is built to close the gap between knowing and doing.</span>
        </div>
      </div>
    </section>
  );
}
