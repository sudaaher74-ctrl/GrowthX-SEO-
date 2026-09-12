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

const METRICS = [
  { value: "2.4x", label: "More organic traffic", sublabel: "on average*" },
  { value: "65%", label: "Faster execution", sublabel: "with AI automation*" },
  { value: "500+", label: "Businesses analyzed", sublabel: "and counting*" },
];

function WorkflowViz() {
  return (
    <div className="relative pt-6 pb-8 px-2 sm:px-4">
      {/* Top Floating Badge: SEO Health — positioned above the card header so card is 100% unobstructed */}
      <div className="absolute -top-3 -left-2 sm:-left-4 z-20 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-2.5 w-32 text-center animate-float-slow">
        <p className="text-[10px] font-bold text-slate-500">SEO Health</p>
        <p className="text-2xl font-black text-blue-600 leading-none mt-0.5">78</p>
        <p className="text-[10px] text-emerald-600 font-bold mt-0.5">↑ 22%</p>
      </div>

      {/* Main workflow card — completely unobstructed and fully visible */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden relative z-10">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <span className="text-xs font-bold text-slate-700 ml-1">
              GrowthX Analysis Engine
            </span>
          </div>

          <div className="bg-amber-50 text-amber-700 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded border border-amber-200">
            Illustrative
          </div>
        </div>

        {/* 6 Steps List — completely clear and 100% visible */}
        <div className="p-5 space-y-3 bg-white">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {step.status === "done" && (
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                )}
                {step.status === "active" && (
                  <Loader2 size={16} className="text-violet-600 shrink-0 animate-spin" />
                )}
                {step.status === "pending" && (
                  <Circle size={16} className="text-slate-300 shrink-0" />
                )}
                <span
                  className={`text-xs font-medium truncate ${
                    step.status === "done"
                      ? "text-slate-800"
                      : step.status === "active"
                      ? "text-violet-700 font-bold"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              <span
                className={`text-[10px] font-semibold shrink-0 ${
                  step.status === "done"
                    ? "text-slate-400"
                    : step.status === "active"
                    ? "text-violet-600 font-bold"
                    : "text-slate-300"
                }`}
              >
                {step.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Floating Badge: AI Visibility Score — positioned below the card at the bottom */}
      <div className="absolute -bottom-3 -right-2 sm:-right-4 z-20 bg-white rounded-2xl shadow-xl border border-slate-100 px-4 py-2.5 w-36 animate-float">
        <p className="text-[10px] font-bold text-slate-500">AI Visibility Score</p>
        <div className="flex items-baseline gap-2 mt-0.5">
          <p className="text-2xl font-black text-violet-600 leading-none">52</p>
          <div className="flex items-center gap-0.5">
            <TrendingUp size={11} className="text-emerald-500" />
            <p className="text-[10px] text-emerald-600 font-bold">↑ 28%</p>
          </div>
        </div>
      </div>

      {/* Annotation */}
      <div className="absolute -bottom-9 right-8 z-20">
        <p
          className="font-bold text-violet-500 text-xs sm:text-sm"
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
    <section className="py-20 bg-slate-50/60 border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-violet-600 mb-2">
                From Data to Done
              </p>
              {/* Title without dash */}
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-tight tracking-tight">
                From analysis to action<br />
                all in one platform.
              </h2>
            </div>
            <p className="text-base text-slate-600 leading-relaxed">
              GrowthX analyzes, prioritizes and executes the work so you can focus on what matters most for your business.
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {METRICS.map((m) => (
                <div key={m.value} className="bg-white rounded-2xl border border-slate-200/80 p-4 text-center shadow-xs">
                  <p className="text-2xl sm:text-3xl font-black text-slate-900">{m.value}</p>
                  <p className="text-xs font-bold text-slate-700 mt-1 leading-tight">{m.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{m.sublabel}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              * Figures are illustrative examples — not verified customer data.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-sm hover:shadow-violet-200 hover:shadow-md cursor-pointer"
              >
                <span>Analyze Your Website</span>
                <ArrowRight size={15} />
              </Link>
              <button className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 font-semibold text-sm px-4 py-3 rounded-xl hover:bg-white transition-all cursor-pointer">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white">
                  <Play size={10} fill="white" className="ml-0.5" />
                </div>
                <span>Watch how it works</span>
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <WorkflowViz />
        </div>
      </div>
    </section>
  );
}
