"use client";

import Link from "next/link";
import {
  Link2,
  Search,
  ListChecks,
  TrendingUp,
  ArrowRight,
  Play,
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
    description: "Simply enter your website URL and let GrowthX analyze it in minutes.",
    icon: Link2,
    iconBg: "bg-violet-100/70 text-violet-600",
  },
  {
    num: "02",
    title: "Get AI-powered insights",
    description:
      "We analyze your website, competitors and AI visibility to find the biggest opportunities.",
    icon: Search,
    iconBg: "bg-sky-100/70 text-sky-600",
  },
  {
    num: "03",
    title: "Receive your 30-day plan",
    description:
      "Get a prioritized plan with clear actions, expected impact and automatic execution options.",
    icon: ListChecks,
    iconBg: "bg-emerald-100/70 text-emerald-600",
  },
  {
    num: "04",
    title: "Watch your growth",
    description:
      "Track improvements, see real results and stay ahead in search and AI platforms.",
    icon: TrendingUp,
    iconBg: "bg-indigo-100/70 text-indigo-600",
  },
];

function WorkflowAppPreview() {
  return (
    <div className="relative select-none w-full max-w-xl mx-auto lg:mx-0">
      {/* Top right cursive annotation with curved arrow */}
      <div className="absolute -top-10 right-8 z-20 flex flex-col items-end text-violet-600">
        <p
          className="font-bold text-xs sm:text-sm leading-tight text-right text-violet-600"
          style={{ fontFamily: "cursive", transform: "rotate(-4deg)" }}
        >
          From insights<br />to execution
        </p>
        <svg
          className="w-6 h-6 text-violet-500 transform -rotate-12 translate-x-2 -translate-y-1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden">
        <div className="flex">
          {/* Dark Sidebar */}
          <div className="w-32 sm:w-36 bg-[#0a101d] p-3 sm:p-3.5 shrink-0 flex flex-col justify-between">
            <div>
              <div className="mb-4 pl-1">
                <span className="text-sm font-black tracking-tight text-white">
                  Growth<span className="text-violet-400">X</span>
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
                          ? "bg-violet-600/30 text-white border border-violet-500/50 shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <ItemIcon size={12} className={item.active ? "text-violet-400" : "text-slate-400"} />
                      <span className="truncate">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 flex flex-col bg-white">
            {/* Top Bar with Input & Profile */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-1.5 flex-1 max-w-xs bg-white rounded-lg border border-slate-200 px-2.5 py-1">
                <Search size={11} className="text-slate-400 shrink-0" />
                <span className="text-[10px] text-slate-500 font-mono truncate">
                  yourwebsite.com
                </span>
              </div>
              <button className="bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold px-3 py-1 rounded-lg shrink-0">
                Analyze
              </button>

              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="relative">
                  <Bell size={13} className="text-slate-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                </div>
                <div className="w-5 h-5 rounded-full bg-sky-500 text-white font-extrabold text-[9px] flex items-center justify-center">
                  S
                </div>
                <ChevronDown size={10} className="text-slate-400" />
              </div>
            </div>

            {/* Content Body */}
            <div className="p-4 space-y-3">
              {/* Status Banner */}
              <div className="flex items-center justify-between gap-2 bg-emerald-50/90 border border-emerald-200/90 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-slate-900 leading-tight">
                      Website Analysis Complete
                    </p>
                    <p className="text-[9px] text-slate-500 leading-tight truncate">
                      We found 38 high-impact opportunities for your website.
                    </p>
                  </div>
                </div>
                <button className="text-[10px] font-bold text-slate-700 hover:text-slate-900 shrink-0">
                  View Full Report
                </button>
              </div>

              {/* 4 KPIs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1: SEO Health */}
                <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[8px] font-semibold text-slate-400">SEO Health</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-base font-black text-slate-900 leading-none">68</p>
                      <p className="text-[8px] font-bold text-emerald-600 mt-0.5">↑ 22%</p>
                    </div>
                    <svg className="w-9 h-4 text-emerald-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 16 Q 14 6, 26 12 T 48 3" />
                    </svg>
                  </div>
                </div>

                {/* 2: AI Visibility */}
                <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[8px] font-semibold text-slate-400">AI Visibility</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-base font-black text-slate-900 leading-none">52</p>
                      <p className="text-[8px] font-bold text-violet-600 mt-0.5">↑ 28%</p>
                    </div>
                    <svg className="w-9 h-4 text-violet-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 17 Q 14 10, 26 13 T 48 4" />
                    </svg>
                  </div>
                </div>

                {/* 3: Competitors Found */}
                <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm">
                  <p className="text-[8px] font-semibold text-slate-400">Competitors Found</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-5 h-5 rounded-md bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                      <Boxes size={11} />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900 leading-none">5</p>
                      <p className="text-[8px] text-slate-400 leading-tight">In your industry</p>
                    </div>
                  </div>
                </div>

                {/* 4: Opportunities */}
                <div className="bg-white rounded-xl p-2.5 border border-slate-100 shadow-sm">
                  <p className="text-[8px] font-semibold text-slate-400">Opportunities</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-5 h-5 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                      <Zap size={11} />
                    </div>
                    <div>
                      <p className="text-base font-black text-slate-900 leading-none">38</p>
                      <p className="text-[8px] text-slate-400 leading-tight">High-value actions</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom 2 Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Current Plan */}
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                      <Calendar size={12} />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-900 leading-tight">
                        Your 30-Day Plan
                      </p>
                      <p className="text-[8px] text-slate-400">12 of 38 actions completed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-violet-600 h-1.5 rounded-full" style={{ width: "32%" }} />
                    </div>
                    <span className="text-[9px] font-bold text-slate-600">32%</span>
                  </div>
                </div>

                {/* Let GrowthX Do the Work */}
                <div className="bg-gradient-to-br from-violet-50/80 via-indigo-50/40 to-slate-50 rounded-xl p-3 border border-violet-100 shadow-sm flex flex-col justify-between">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                      <Zap size={12} />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold text-slate-900 leading-tight">
                        Let GrowthX do the work
                      </p>
                      <p className="text-[8px] text-slate-500 leading-tight mt-0.5">
                        Approve your plan and we&apos;ll automatically implement the fixes.
                      </p>
                    </div>
                  </div>
                  <button className="bg-violet-600 hover:bg-violet-700 text-white text-[9px] font-bold py-1 px-2.5 rounded-md flex items-center justify-center gap-1 w-fit shadow-xs">
                    <span>View Plan</span>
                    <ArrowRight size={9} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Floating Badge: SEO Health Score — completely above the card */}
      <div className="absolute bottom-[calc(100%+10px)] left-6 z-20 bg-white rounded-2xl shadow-xl border border-slate-100 p-2.5 sm:p-3 w-40 animate-float hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1 text-slate-500">
          <div className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
            <Sparkles size={11} />
          </div>
          <p className="text-[10px] font-bold text-slate-800">SEO Health Score</p>
        </div>
        <div className="flex items-end justify-between mt-0.5">
          <div>
            <p className="text-xl font-black text-slate-900 leading-none">68</p>
            <p className="text-[9px] font-bold text-emerald-600 mt-0.5">↑ 22%</p>
          </div>
          <svg className="w-10 h-5 text-emerald-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 16 Q 14 6, 26 12 T 48 3" />
          </svg>
        </div>
      </div>

      {/* Bottom Floating Badge: AI Visibility Score — completely below the card */}
      <div className="absolute top-[calc(100%+10px)] left-6 z-20 bg-white rounded-2xl shadow-xl border border-slate-100 p-2.5 sm:p-3 w-44 animate-float hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1 text-slate-500">
          <div className="w-5 h-5 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center">
            <Sparkles size={11} />
          </div>
          <p className="text-[10px] font-bold text-slate-800">AI Visibility Score</p>
        </div>
        <div className="flex items-end justify-between mt-0.5">
          <div>
            <p className="text-xl font-black text-slate-900 leading-none">52</p>
            <p className="text-[9px] font-bold text-emerald-600 mt-0.5">↑ 28%</p>
          </div>
          <svg className="w-12 h-5 text-violet-600" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 17 Q 14 10, 26 13 T 48 4" />
          </svg>
        </div>
      </div>

      {/* Bottom cursive annotation with curved arrow */}
      <div className="absolute -bottom-10 right-8 z-20 flex flex-col items-center text-violet-600">
        <svg
          className="w-6 h-6 text-violet-500 transform rotate-45 -translate-x-3 translate-y-1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        <p
          className="font-bold text-xs sm:text-sm whitespace-nowrap text-violet-600"
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
    <section className="py-8 sm:py-12 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 2-Column Main Section */}
        <div className="grid lg:grid-cols-[48%_52%] gap-8 lg:gap-12 items-center mb-10">
          {/* Left Column: Header + 4 Step Cards + Actions */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 bg-violet-50 border border-violet-200/80 text-violet-700 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full mb-2.5">
                Simple Steps. Big Results.
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-slate-900 leading-[1.12] tracking-tight">
                Go from analysis to growth<br />
                in just a few clicks.
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-500 leading-relaxed">
                GrowthX handles the complexity. You get a clear plan and real results.
              </p>
            </div>

            {/* 4 Step Cards with Vertical Dotted Line */}
            <div className="relative pl-7 space-y-2.5">
              {/* Dotted Vertical Connector Line */}
              <div className="absolute left-2.5 top-6 bottom-6 w-0 border-l-2 border-dashed border-slate-200 pointer-events-none" />

              {PIPELINE_STEPS.map((step) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.num} className="relative flex items-center">
                    {/* Number Badge on the Line */}
                    <div className="absolute -left-7 font-black text-xs text-violet-600 w-5 text-center">
                      {step.num}
                    </div>

                    {/* Step Card */}
                    <div className="w-full bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-100/90 shadow-sm hover:shadow-md transition-all flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${step.iconBg}`}>
                        <StepIcon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">
                          {step.title}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 leading-snug mt-0.5">
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
                  href="/analyze"
                  className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm px-5 py-3 rounded-xl transition-all shadow-md shadow-violet-200 cursor-pointer"
                >
                  <span>Analyze Your Website</span>
                  <ArrowRight size={14} />
                </Link>
                <button className="inline-flex items-center gap-2 text-slate-900 hover:text-violet-700 font-bold text-xs sm:text-sm px-3.5 py-3 rounded-xl transition-colors cursor-pointer">
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-600 text-white shadow-xs">
                    <Play size={10} fill="white" className="ml-0.5" />
                  </div>
                  <span>Watch a 2 min demo</span>
                </button>
              </div>

              {/* Trust Checkmarks */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 pt-1">
                {["No credit card required", "Setup in minutes", "Free analysis"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <Check size={14} className="text-violet-600 shrink-0 font-extrabold" />
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

        {/* Bottom Social Proof Bar matching Screenshot 2 */}
        <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Client Logos */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shrink-0">
              Trusted by growing businesses
            </span>
            <div className="flex flex-wrap items-center gap-6 sm:gap-8 opacity-70">
              {["stripe", "shopify", "Notion", "slack", "Webflow", "Vercel"].map((brand) => (
                <span key={brand} className="text-xs sm:text-sm font-extrabold text-slate-700 tracking-tight">
                  {brand}
                </span>
              ))}
            </div>
          </div>

          {/* Rating Block */}
          <div className="flex items-center gap-3 shrink-0 border-l border-slate-200/80 pl-6 hidden md:flex">
            <div className="flex items-center gap-0.5 text-amber-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={15} fill="currentColor" />
              ))}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 leading-tight">4.9/5</p>
              <p className="text-[10px] text-slate-400 leading-tight">from 500+ happy customers</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
