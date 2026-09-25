"use client";

import Link from "next/link";
import {
  Link2,
  Search,
  ListChecks,
  TrendingUp,
  ArrowRight,
  Check,
  CheckCircle2,
  Bell,
  ChevronDown,
  Calendar,
  Zap,
  RotateCcw,
  Target,
  Wrench,
  FileSpreadsheet,
  Settings,
  Home,
  Star,
  Users2,
  Boxes,
  Sparkles,
} from "lucide-react";

const PIPELINE_STEPS = [
  {
    num: "01",
    title: "Enter your website",
    description: "Add your URL and up to 5 competitors. That's the whole setup.",
    icon: Link2,
    iconBg: "bg-brand-900 border border-brand-800 text-series-6",
  },
  {
    num: "02",
    title: "We crawl and compare",
    description:
      "Our crawler reads every page the way Google does. Then it compares you with your rivals and checks AI answers.",
    icon: Search,
    iconBg: "bg-brand-900 border border-brand-800 text-accent-400",
  },
  {
    num: "03",
    title: "Get a 30-day plan",
    description:
      "Every issue and gap gets a ₹ value, the effort involved and a priority. You see what to do first.",
    icon: ListChecks,
    iconBg: "bg-brand-900 border border-brand-800 text-success-400",
  },
  {
    num: "04",
    title: "Approve, ship, verify",
    description:
      "Approve a fix and GrowthX ships it (PR, Shopify or WordPress). Then it re-crawls to prove it worked.",
    icon: TrendingUp,
    iconBg: "bg-brand-900 border border-brand-800 text-warning-400",
  },
];

function WorkflowAppPreview() {
  return (
    <div className="relative select-none w-full max-w-xl mx-auto lg:mx-0">
      {/* Top right cursive annotation with curved arrow */}
      <div className="absolute -top-10 right-8 z-20 flex flex-col items-end text-series-6">
        <p
          className="font-bold text-xs sm:text-sm leading-tight text-right text-series-6"
          style={{ fontFamily: "cursive", transform: "rotate(-4deg)" }}
        >
          From insights<br />to execution
        </p>
        <svg
          className="w-6 h-6 text-series-6 transform -rotate-12 translate-x-2 -translate-y-1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Main card */}
      <div className="bg-brand-900 rounded-3xl shadow-2xl border border-brand-800 overflow-hidden">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-32 sm:w-36 bg-brand-950 p-3 sm:p-3.5 shrink-0 flex flex-col justify-between border-r border-brand-900">
            <div>
              <div className="mb-4 pl-1">
                <span className="text-sm font-black tracking-tight text-white">
                  Growth<span className="text-series-6">X</span>
                </span>
              </div>

              <div className="space-y-1">
                {[
                  { icon: Home, label: "Dashboard" },
                  { icon: RotateCcw, label: "Website Audit", active: true },
                  { icon: Target, label: "Competitor Intel" },
                  { icon: Sparkles, label: "AI Visibility" },
                  { icon: Wrench, label: "Fix Engine" },
                  { icon: FileSpreadsheet, label: "Reports" },
                  { icon: Settings, label: "Settings" },
                ].map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                        item.active
                          ? "bg-series-6/30 text-white border border-series-6/40 shadow-xs"
                          : "text-brand-400 hover:text-white"
                      }`}
                    >
                      <ItemIcon size={12} className={item.active ? "text-series-6" : "text-brand-400"} />
                      <span className="truncate">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 flex flex-col bg-brand-950">
            {/* Top Bar with Input & Profile */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-brand-900 bg-brand-900/40">
              <div className="flex items-center gap-1.5 flex-1 max-w-xs bg-brand-900 rounded-lg border border-brand-800 px-2.5 py-1">
                <Search size={11} className="text-brand-400 shrink-0" />
                <span className="text-[10px] text-brand-300 font-mono truncate">
                  yourwebsite.com
                </span>
              </div>
              <button className="bg-series-6 hover:bg-series-6/90 text-white text-[10px] font-bold px-3 py-1 rounded-lg shrink-0">
                Analyze
              </button>

              <div className="flex items-center gap-2 pl-2 border-l border-brand-850">
                <div className="relative">
                  <Bell size={13} className="text-brand-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-warning-500" />
                </div>
                <div className="w-5 h-5 rounded-full bg-series-6 text-white font-extrabold text-[9px] flex items-center justify-center">
                  S
                </div>
                <ChevronDown size={10} className="text-brand-400" />
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 space-y-3">
              {/* Status Banner */}
              <div className="flex items-center justify-between gap-2 bg-success-500/10 border border-success-500/20 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 size={14} className="text-success-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-white leading-tight">
                      Website Analysis Complete
                    </p>
                    <p className="text-[9px] text-brand-400 leading-tight truncate">
                      We found 38 high-impact opportunities for your website.
                    </p>
                  </div>
                </div>
                <button className="text-[10px] font-bold text-brand-200 hover:text-white shrink-0">
                  View Full Report
                </button>
              </div>

              {/* 4 KPIs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1: SEO Health */}
                <div className="bg-brand-900/60 rounded-xl p-2.5 border border-brand-800/80 shadow-xs flex flex-col justify-between">
                  <p className="text-[8px] font-semibold text-brand-400">SEO Health</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-base font-black text-white leading-none">68</p>
                      <p className="text-[8px] font-bold text-success-400 mt-0.5">↑ 22%</p>
                    </div>
                    <svg className="w-9 h-4 text-success-400" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 16 Q 14 6, 26 12 T 48 3" />
                    </svg>
                  </div>
                </div>

                {/* 2: AI Visibility */}
                <div className="bg-brand-900/60 rounded-xl p-2.5 border border-brand-800/80 shadow-xs flex flex-col justify-between">
                  <p className="text-[8px] font-semibold text-brand-400">AI Visibility</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-base font-black text-white leading-none">52</p>
                      <p className="text-[8px] font-bold text-series-6 mt-0.5">↑ 28%</p>
                    </div>
                    <svg className="w-9 h-4 text-series-6" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 17 Q 14 10, 26 13 T 48 4" />
                    </svg>
                  </div>
                </div>

                {/* 3: Competitors Found */}
                <div className="bg-brand-900/60 rounded-xl p-2.5 border border-brand-800/80 shadow-xs">
                  <p className="text-[8px] font-semibold text-brand-400">Competitors Found</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-5 h-5 rounded-md bg-accent-500/20 text-accent-400 flex items-center justify-center shrink-0">
                      <Boxes size={11} />
                    </div>
                    <div>
                      <p className="text-base font-black text-white leading-none">5</p>
                      <p className="text-[8px] text-brand-400 leading-tight">In your industry</p>
                    </div>
                  </div>
                </div>

                {/* 4: Opportunities */}
                <div className="bg-brand-900/60 rounded-xl p-2.5 border border-brand-800/80 shadow-xs">
                  <p className="text-[8px] font-semibold text-brand-400">Opportunities</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-5 h-5 rounded-md bg-warning-500/20 text-warning-400 flex items-center justify-center shrink-0">
                      <Zap size={11} />
                    </div>
                    <div>
                      <p className="text-base font-black text-white leading-none">38</p>
                      <p className="text-[8px] text-brand-400 leading-tight">High-value actions</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom 2 Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Current Plan */}
                <div className="bg-brand-900/60 rounded-xl p-3 border border-brand-800/80 shadow-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-series-6/20 text-series-6 flex items-center justify-center shrink-0">
                      <Calendar size={12} />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold text-white leading-tight">
                        Your 30-Day Plan
                      </p>
                      <p className="text-[8px] text-brand-400">12 of 38 actions completed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-brand-950 rounded-full h-1.5 overflow-hidden border border-brand-850">
                      <div className="bg-series-6 h-1.5 rounded-full" style={{ width: "32%" }} />
                    </div>
                    <span className="text-[9px] font-bold text-brand-300">32%</span>
                  </div>
                </div>

                {/* Let GrowthX Do the Work */}
                <div className="bg-brand-900/40 rounded-xl p-3 border border-brand-800 shadow-xs flex flex-col justify-between">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-series-6/20 text-series-6 flex items-center justify-center shrink-0">
                      <Zap size={12} />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold text-white leading-tight">
                        Let GrowthX do the work
                      </p>
                      <p className="text-[8px] text-brand-400 leading-tight mt-0.5">
                        Approve your plan and we&apos;ll automatically implement the fixes.
                      </p>
                    </div>
                  </div>
                  <button className="bg-series-6 hover:bg-series-6/90 text-white text-[9px] font-bold py-1 px-2.5 rounded-md flex items-center justify-center gap-1 w-fit shadow-xs">
                    <span>View Plan</span>
                    <ArrowRight size={9} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Floating Badge: SEO Health Score */}
      <div className="absolute bottom-[calc(100%+10px)] left-6 z-20 bg-brand-900 rounded-2xl shadow-2xl border border-brand-800 p-2.5 sm:p-3 w-40 animate-float hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1 text-brand-400">
          <div className="w-5 h-5 rounded-lg bg-success-500/20 text-success-400 flex items-center justify-center">
            <Sparkles size={11} />
          </div>
          <p className="text-[10px] font-bold text-white">SEO Health Score</p>
        </div>
        <div className="flex items-end justify-between mt-0.5">
          <div>
            <p className="text-xl font-black text-white leading-none">68</p>
            <p className="text-[9px] font-bold text-success-400 mt-0.5">↑ 22%</p>
          </div>
          <svg className="w-10 h-5 text-success-400" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 16 Q 14 6, 26 12 T 48 3" />
          </svg>
        </div>
      </div>

      {/* Bottom Floating Badge: AI Visibility Score */}
      <div className="absolute top-[calc(100%+10px)] left-6 z-20 bg-brand-900 rounded-2xl shadow-2xl border border-brand-800 p-2.5 sm:p-3 w-44 animate-float hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1 text-brand-400">
          <div className="w-5 h-5 rounded-lg bg-series-6/20 text-series-6 flex items-center justify-center">
            <Sparkles size={11} />
          </div>
          <p className="text-[10px] font-bold text-white">AI Visibility Score</p>
        </div>
        <div className="flex items-end justify-between mt-0.5">
          <div>
            <p className="text-xl font-black text-white leading-none">52</p>
            <p className="text-[9px] font-bold text-success-400 mt-0.5">↑ 28%</p>
          </div>
          <svg className="w-12 h-5 text-series-6" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 17 Q 14 10, 26 13 T 48 4" />
          </svg>
        </div>
      </div>

      {/* Bottom cursive annotation with curved arrow */}
      <div className="absolute -bottom-10 right-8 z-20 flex flex-col items-center text-series-6">
        <svg
          className="w-6 h-6 text-series-6 transform rotate-45 -translate-x-3 translate-y-1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        <p
          className="font-bold text-xs sm:text-sm whitespace-nowrap text-series-6"
          style={{ fontFamily: "cursive", transform: "rotate(-3deg)" }}
        >
          A clear plan. Measurable growth.
        </p>
      </div>
    </div>
  );
}

export function WorkflowSteps() {
  return (
    <section className="py-16 sm:py-20 bg-brand-950 border-t border-brand-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 2-Column Main Section */}
        <div className="grid lg:grid-cols-[48%_52%] gap-8 lg:gap-12 items-center mb-10">
          {/* Left Column: Header + 4 Step Cards + Actions */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 bg-brand-900/80 border border-brand-800 text-brand-300 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full mb-2.5">
                How It Works
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-white leading-[1.12] tracking-tight">
                From URL to results<br />
                in four steps.
              </h2>
              <p className="mt-2 text-sm sm:text-base text-brand-400 leading-relaxed">
                Add your URL and up to 5 competitors. GrowthX handles the crawling, comparisons, 30-day prioritization, and automated fix delivery.
              </p>
            </div>

            {/* 4 Step Cards with Vertical Dotted Line */}
            <div className="relative pl-7 space-y-2.5">
              {/* Dotted Vertical Connector Line */}
              <div className="absolute left-2.5 top-6 bottom-6 w-0 border-l-2 border-dashed border-brand-800 pointer-events-none" />

              {PIPELINE_STEPS.map((step) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.num} className="relative flex items-center">
                    {/* Number Badge on the Line */}
                    <div className="absolute -left-7 font-black text-xs text-series-6 w-5 text-center">
                      {step.num}
                    </div>

                    {/* Step Card */}
                    <div className="w-full bg-brand-900/40 rounded-2xl p-3 sm:p-3.5 border border-brand-800 hover:border-brand-750 hover:bg-brand-900/70 transition-all flex items-center gap-3 shadow-sm">
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${step.iconBg}`}>
                        <StepIcon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-sm font-extrabold text-white leading-tight">
                          {step.title}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-brand-400 leading-snug mt-0.5">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons & Trust row */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 bg-series-6 hover:bg-series-6/90 active:scale-[0.98] text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition-all shadow-md cursor-pointer"
                >
                  <span>Run free audit →</span>
                </Link>
              </div>

              {/* Trust Checkmarks */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-brand-400 pt-1">
                {["Free", "No card needed", "Results in about 60 seconds"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <Check size={14} className="text-series-6 shrink-0 font-extrabold" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Vertically Centered Complete Dashboard Preview */}
          <div className="relative flex items-center justify-center py-6">
            <WorkflowAppPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
