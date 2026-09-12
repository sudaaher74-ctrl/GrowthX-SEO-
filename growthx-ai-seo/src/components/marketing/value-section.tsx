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
    <div className="relative">
      {/* Main workflow card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/60">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          </div>
          <span className="text-xs font-semibold text-slate-500 ml-1">GrowthX Analysis Engine</span>
        </div>
        <div className="p-5 space-y-2.5">
          {WORKFLOW_STEPS.map((step, i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {step.status === "done" && (
                  <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                )}
                {step.status === "active" && (
                  <Loader2 size={16} className="text-violet-500 shrink-0 animate-spin" />
                )}
                {step.status === "pending" && (
                  <Circle size={16} className="text-slate-300 shrink-0" />
                )}
                <span className={`text-[12px] font-medium ${
                  step.status === "done" ? "text-slate-700" :
                  step.status === "active" ? "text-violet-700 font-semibold" :
                  "text-slate-400"
                }`}>
                  {step.label}
                </span>
              </div>
              <span className={`text-[10px] font-medium shrink-0 ${
                step.status === "done" ? "text-slate-400" :
                step.status === "active" ? "text-violet-500" :
                "text-slate-300"
              }`}>
                {step.time}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating: SEO Health */}
      <div className="absolute -left-6 bottom-16 bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-3 w-32 text-center animate-float-slow">
        <p className="text-[10px] font-semibold text-slate-500">SEO Health</p>
        <p className="text-2xl font-extrabold text-blue-600">78</p>
        <p className="text-[10px] text-emerald-600 font-semibold">↑ 22%</p>
      </div>

      {/* Floating: AI Visibility */}
      <div className="absolute -right-4 top-1/2 bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-3 w-36 animate-float">
        <p className="text-[10px] font-semibold text-slate-500">AI Visibility Score</p>
        <p className="text-2xl font-extrabold text-violet-600">52</p>
        <div className="flex items-center gap-1 mt-0.5">
          <TrendingUp size={10} className="text-emerald-500" />
          <p className="text-[10px] text-emerald-600 font-semibold">↑ 28%</p>
        </div>
      </div>

      {/* Annotation */}
      <div className="absolute -bottom-5 right-6">
        <p className="font-bold text-violet-400 text-sm" style={{ fontFamily: "cursive", transform: "rotate(-3deg)" }}>
          From analysis to action — automatically ↗
        </p>
      </div>

      {/* Demo label */}
      <div className="absolute top-3 right-3 bg-amber-50 text-amber-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border border-amber-200">
        Illustrative
      </div>
    </div>
  );
}

export function ValueSection() {
  return (
    <section className="py-24 bg-slate-50/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* LEFT */}
          <div className="space-y-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3">
                From Data to Done
              </p>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">
                From analysis to action —<br />
                all in one platform.
              </h2>
            </div>
            <p className="text-lg text-slate-500 leading-relaxed">
              GrowthX analyzes, prioritizes and executes the work so you can focus on what matters most — your business.
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4">
              {METRICS.map((m) => (
                <div key={m.value} className="bg-white rounded-2xl border border-slate-200 p-4 text-center shadow-sm">
                  <p className="text-3xl font-extrabold text-slate-900">{m.value}</p>
                  <p className="text-[12px] font-semibold text-slate-700 mt-1 leading-tight">{m.label}</p>
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
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-sm hover:shadow-violet-200 hover:shadow-md"
              >
                Analyze Your Website <ArrowRight size={14} />
              </Link>
              <button className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-semibold text-sm px-4 py-3 rounded-xl hover:bg-white transition-all">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white">
                  <Play size={10} fill="white" />
                </div>
                Watch how it works
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <WorkflowViz />
        </div>
      </div>
    </section>
  );
}
