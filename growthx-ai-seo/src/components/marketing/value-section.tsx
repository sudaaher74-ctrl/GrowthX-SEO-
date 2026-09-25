"use client";

import Link from "next/link";
import { ArrowRight, Play, CheckCircle2, Circle, Loader2, TrendingUp } from "lucide-react";

const WORKFLOW_STEPS = [
  { label: "Website crawled", status: "done", time: "2 min ago" },
  { label: "Analyzing technical SEO", status: "done", time: "In progress" },
  { label: "Checking competitor data", status: "active", time: "In progress" },
  { label: "Analyzing AI visibility (ChatGPT, Claude, Gemini)", status: "pending", time: "Pending" },
  { label: "Generating opportunities", status: "pending", time: "Pending" },
  { label: "Creating 30-day plan", status: "pending", time: "Pending" },
];

function WorkflowViz() {
  return (
    <div className="relative pt-6 pb-8 px-2 sm:px-4">
      {/* Top Floating Badge: SEO Health */}
      <div className="absolute -top-3 -left-2 sm:-left-4 z-20 bg-brand-900 rounded-2xl shadow-2xl border border-brand-800 px-4 py-2.5 w-32 text-center animate-float-slow">
        <p className="text-[10px] font-bold text-brand-400">SEO Health</p>
        <p className="text-2xl font-black text-accent-400 leading-none mt-0.5">78</p>
        <p className="text-[10px] text-success-400 font-bold mt-0.5">↑ 22%</p>
      </div>

      {/* Main workflow card */}
      <div className="bg-brand-900 rounded-2xl shadow-2xl border border-brand-800 overflow-hidden relative z-10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-800 bg-brand-950">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-error-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-warning-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-success-500" />
            </div>
            <span className="text-xs font-bold text-white ml-1">
              GrowthX Analysis Engine
            </span>
          </div>

          <div className="bg-brand-850 text-brand-300 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border border-brand-700">
            Live Agent
          </div>
        </div>

        {/* 6 Steps List */}
        <div className="p-5 space-y-3 bg-brand-900">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {step.status === "done" && (
                  <CheckCircle2 size={16} className="text-success-400 shrink-0" />
                )}
                {step.status === "active" && (
                  <Loader2 size={16} className="text-series-6 shrink-0 animate-spin" />
                )}
                {step.status === "pending" && (
                  <Circle size={16} className="text-brand-700 shrink-0" />
                )}
                <span
                  className={`text-xs font-medium truncate ${
                    step.status === "done"
                      ? "text-brand-200"
                      : step.status === "active"
                      ? "text-series-6 font-bold"
                      : "text-brand-500"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold shrink-0 ${
                  step.status === "done"
                    ? "text-brand-400"
                    : step.status === "active"
                    ? "text-series-6 font-bold"
                    : "text-brand-600"
                }`}
              >
                {step.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Floating Badge: AI Visibility Score */}
      <div className="absolute -bottom-3 -right-2 sm:-right-4 z-20 bg-brand-900 rounded-2xl shadow-2xl border border-brand-800 px-4 py-2.5 w-36 animate-float">
        <p className="text-[10px] font-bold text-brand-400">AI Visibility Score</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <p className="text-2xl font-black text-series-6 leading-none">52</p>
          <div className="flex items-center gap-0.5">
            <TrendingUp size={11} className="text-success-400" />
            <p className="text-[10px] text-success-400 font-bold">↑ 28%</p>
          </div>
        </div>
      </div>

      {/* Annotation */}
      <div className="absolute -bottom-9 right-8 z-20">
        <p
          className="font-bold text-series-6 text-xs sm:text-sm"
          style={{ fontFamily: "cursive", transform: "rotate(-3deg)" }}
        >
          From analysis to action automatically ↗
        </p>
      </div>
    </div>
  );
}

export function ValueSection() {
  return (
    <section className="py-20 bg-brand-950 border-t border-brand-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-series-6 mb-2">
                FOR THE TECHNICAL BUYER
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
                Real crawls. Real data.<br />
                <span className="text-series-6">No guesswork.</span>
              </h2>
            </div>
            <p className="text-base text-brand-400 leading-relaxed">
              Our headless crawler loads every page like Googlebot, parses JSON-LD schemas, and saves timestamped before/after proof for every single fix.
            </p>

            {/* 5 Technical Cards */}
            <div className="space-y-3">
              {[
                {
                  title: "Headless crawler",
                  desc: "Renders JavaScript pages like Googlebot, so Next.js and React sites are audited correctly.",
                },
                {
                  title: "Schema inspection",
                  desc: "Parses your JSON-LD and flags exactly which field is missing or broken.",
                },
                {
                  title: "Before/after proof",
                  desc: "Every fix is re-crawled and saved with a timestamp, so you can show clients what changed.",
                },
                {
                  title: "Multi-AI engine",
                  desc: "Routes each task to the best AI model for speed, cost and quality.",
                },
                {
                  title: "Your data stays yours",
                  desc: "Enterprise-grade encryption, isolated tenant workspaces, and zero data sharing with third parties.",
                },
              ].map((card) => (
                <div key={card.title} className="bg-brand-900/40 border border-brand-800 rounded-xl p-3.5 space-y-0.5">
                  <h4 className="text-xs sm:text-sm font-bold text-white">{card.title}</h4>
                  <p className="text-xs text-brand-400 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>

            {/* Built for three kinds of teams */}
            <div className="pt-4 border-t border-brand-850 space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-brand-300">
                Built for three kinds of teams
              </h3>
              <div className="grid sm:grid-cols-3 gap-2.5">
                {[
                  {
                    who: "E-commerce & D2C",
                    headline: "Rank for products, not just brand name.",
                    line: "Product schema, category pages and competitor price watch.",
                  },
                  {
                    who: "Agencies",
                    headline: "Run 20 clients like 2.",
                    line: "White-label reports, bulk fixes and weekly briefs.",
                  },
                  {
                    who: "Multi-location",
                    headline: "Own the map in every city.",
                    line: "Map-grid tracking, city pages and GBP management.",
                  },
                ].map((item) => (
                  <div key={item.who} className="bg-brand-900/60 border border-brand-800/80 rounded-xl p-3 space-y-1">
                    <span className="text-[10px] font-black text-series-6 uppercase tracking-wider block">
                      {item.who}
                    </span>
                    <h5 className="text-[11px] font-bold text-white leading-tight">{item.headline}</h5>
                    <p className="text-[10px] text-brand-400 leading-snug">{item.line}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 bg-series-6 hover:bg-series-6/90 active:scale-[0.98] text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-md cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <WorkflowViz />
        </div>
      </div>
    </section>
  );
}
