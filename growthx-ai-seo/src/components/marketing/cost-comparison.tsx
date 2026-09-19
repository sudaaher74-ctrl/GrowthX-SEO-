"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";

interface ComparisonRow {
  task: string;
  costInr: string;
  costUsd: string;
  isNotPossible?: boolean;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    task: "Full time marketing hire",
    costInr: "₹60,000/mo",
    costUsd: "$5,000/mo",
  },
  {
    task: "SEO agency",
    costInr: "₹50,000/mo",
    costUsd: "$4,000/mo",
  },
  {
    task: "Content writer",
    costInr: "₹20,000/mo",
    costUsd: "$1,500/mo",
  },
  {
    task: "Social media manager",
    costInr: "₹15,000/mo",
    costUsd: "$1,500/mo",
  },
  {
    task: "Reddit and community growth",
    costInr: "₹10,000/mo",
    costUsd: "$1,000/mo",
  },
  {
    task: "AI search visibility (GEO)",
    costInr: "not possible",
    costUsd: "not possible",
    isNotPossible: true,
  },
  {
    task: "24/7 availability",
    costInr: "not possible",
    costUsd: "not possible",
    isNotPossible: true,
  },
];

export function CostComparison() {
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");

  const badgeText =
    currency === "INR"
      ? "The ₹1,55,000/mo job from ₹2,999/mo"
      : "The $14,000/mo job from $39/mo";

  const totalWithout = currency === "INR" ? "₹1,55,000+" : "$14,000+";
  const totalWith = currency === "INR" ? "From ₹2,999/mo" : "From $39/mo";

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
            What GrowthX replaces vs. what it costs
          </h2>

          <p className="text-sm sm:text-base text-brand-400 leading-relaxed max-w-2xl mx-auto mb-7">
            Replace costly retainers, scattered tools, and slow turnarounds with an autonomous AI engine that audits, optimizes, and scales your search visibility.
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
            <div className="col-span-6 text-left">
              What needs doing
            </div>
            <div className="col-span-3 text-right sm:text-center">
              Without GrowthX
            </div>
            <div className="col-span-3 text-right text-success-400">
              With GrowthX
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-brand-900">
            {COMPARISON_ROWS.map((row) => {
              const cost = currency === "INR" ? row.costInr : row.costUsd;

              return (
                <div
                  key={row.task}
                  className="grid grid-cols-12 items-center py-4 sm:py-4.5 px-5 sm:px-8 hover:bg-brand-900/25 transition-colors"
                >
                  <div className="col-span-6 text-left text-xs sm:text-sm text-brand-200 font-normal pr-2">
                    {row.task}
                  </div>
                  <div
                    className={`col-span-3 text-right sm:text-center text-xs sm:text-sm ${
                      row.isNotPossible
                        ? "text-brand-500 font-normal"
                        : "text-brand-300 font-normal"
                    }`}
                  >
                    {cost}
                  </div>
                  <div className="col-span-3 flex justify-end items-center">
                    <CheckCircle2
                      size={18}
                      className="text-success-400 shrink-0"
                      strokeWidth={2.2}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Footer Row */}
          <div className="grid grid-cols-12 items-center py-5 px-5 sm:px-8 bg-brand-900/60 border-t border-brand-800">
            <div className="col-span-6 text-left text-sm sm:text-base font-bold text-white">
              Total per month
            </div>
            <div className="col-span-3 text-right sm:text-center text-sm sm:text-base font-bold text-error-400">
              {totalWithout}
            </div>
            <div className="col-span-3 text-right text-sm sm:text-base font-bold text-success-400">
              {totalWith}
            </div>
          </div>
        </div>

        {/* CTA Bar below table */}
        <div className="mt-8 max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-brand-900/40 border border-brand-800/80">
          <div>
            <p className="text-xs sm:text-sm font-bold text-white">
              Ready to replace manual SEO with AI automation?
            </p>
            <p className="text-[11px] sm:text-xs text-brand-400 mt-0.5">
              Plans start at ₹2,999/mo ($39/mo). No credit card required to audit your site.
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Link
              href="/pricing"
              className="text-xs font-semibold text-brand-300 hover:text-white px-3 py-2 transition-colors"
            >
              View All Plans
            </Link>
            <Link
              href="/analyze"
              className="inline-flex items-center gap-1.5 bg-series-6 hover:bg-series-6/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer shrink-0"
            >
              <span>Start Free Analysis</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
