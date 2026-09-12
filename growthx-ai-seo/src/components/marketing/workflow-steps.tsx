"use client";

import Link from "next/link";
import { ArrowRight, Play, CheckCircle, Globe, Search, FileText, TrendingUp } from "lucide-react";

const STEPS = [
  {
    num: "01",
    icon: Globe,
    title: "Enter your website",
    description: "Simply enter your website URL and let GrowthX analyze it in minutes.",
  },
  {
    num: "02",
    icon: Search,
    title: "Get AI-powered insights",
    description:
      "We analyze your website, competitors and AI visibility to find the biggest opportunities.",
  },
  {
    num: "03",
    icon: FileText,
    title: "Receive your 30-day plan",
    description:
      "Get a prioritized plan with clear actions, expected impact and automatic execution options.",
  },
  {
    num: "04",
    icon: TrendingUp,
    title: "Watch your growth",
    description:
      "Track improvements, see measured results and stay ahead in search and AI platforms.",
  },
];

function AppPreview() {
  return (
    <div className="relative select-none max-w-lg mx-auto lg:mx-0 w-full">
      {/* Top cursive annotation */}
      <div className="absolute -top-4 right-4 z-20">
        <p
          className="font-bold text-violet-400 text-xs sm:text-sm"
          style={{ fontFamily: "cursive", transform: "rotate(3deg)" }}
        >
          From insights to execution ↙
        </p>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/80">
          <span className="text-xs font-bold text-slate-900">
            Growth<span className="text-violet-600">X</span>
          </span>
          <div className="flex-1 bg-slate-100 rounded-lg px-2.5 py-1 text-[11px] text-slate-400 border border-slate-200 truncate">
            yourwebsite.com
          </div>
          <div className="bg-amber-50 text-amber-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded border border-amber-200">
            Illustrative
          </div>
          <div className="bg-violet-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0">
            Analyze
          </div>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-4 space-y-2.5">
          {/* Status banner */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/90 rounded-xl px-3 py-2">
            <CheckCircle size={13} className="text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-emerald-900 leading-tight">
                Website Analysis Complete
              </p>
              <p className="text-[10px] text-emerald-700 leading-tight truncate">
                We found 38 high-impact opportunities for your website.
              </p>
            </div>
            <button className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 shrink-0">
              View Full Report
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "SEO Health", value: "68", trend: "+22%", color: "text-blue-600" },
              { label: "AI Visibility", value: "52", trend: "+28%", color: "text-violet-600" },
              { label: "Competitors Found", value: "5", trend: "In your industry", color: "text-amber-600" },
              { label: "Opportunities", value: "38", trend: "High-value actions", color: "text-emerald-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-100">
                <p className="text-[8px] text-slate-500 font-medium">{kpi.label}</p>
                <p className={`text-base sm:text-lg font-extrabold ${kpi.color} leading-none mt-0.5`}>
                  {kpi.value}
                </p>
                <p className="text-[8px] text-slate-500 mt-0.5">{kpi.trend}</p>
              </div>
            ))}
          </div>

          {/* 30-day plan */}
          <div className="border border-slate-200 rounded-xl p-2.5 bg-white">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-bold text-slate-800">Your 30-Day Plan</p>
              <div className="bg-violet-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                <span>View Plan</span>
                <ArrowRight size={8} />
              </div>
            </div>
            <p className="text-[9px] text-slate-500 mb-1.5">12 of 38 actions completed</p>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div className="bg-violet-600 h-1.5 rounded-full" style={{ width: "32%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Floating: AI Visibility Score */}
      <div className="absolute -left-3 bottom-6 z-10 bg-white rounded-xl shadow-lg border border-slate-100 px-3 py-2 w-32 animate-float-slow">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="text-[9px]">✨</span>
          <p className="text-[9px] font-semibold text-slate-500">AI Visibility Score</p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <p className="text-xl font-extrabold text-violet-600 leading-none">52</p>
          <p className="text-[9px] text-emerald-600 font-bold">↑ 28%</p>
        </div>
      </div>

      {/* Bottom annotation */}
      <div className="absolute -bottom-5 right-6 z-20">
        <p
          className="font-bold text-slate-400 text-xs sm:text-sm"
          style={{ fontFamily: "cursive", transform: "rotate(-2deg)" }}
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
        {/* Header */}
        <div className="max-w-2xl mb-6 sm:mb-8">
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600 mb-1.5">
            Simple Steps. Big Results.
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight tracking-tight">
            Go from analysis to growth<br />
            in just a few clicks.
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed">
            GrowthX handles the complexity. You get a clear plan and real results.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Steps Column */}
          <div className="space-y-4 sm:space-y-5">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="flex gap-3.5 items-start">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-violet-600" />
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="w-px h-6 bg-gradient-to-b from-violet-200 to-transparent" />
                    )}
                  </div>
                  <div className="pt-0.5">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[9px] font-black text-violet-500 uppercase tracking-wider">
                        {step.num}
                      </span>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/analyze"
                className="inline-flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm"
              >
                <span>Analyze Your Website</span>
                <ArrowRight size={13} />
              </Link>
              <button className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 font-semibold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl hover:bg-slate-50 transition-all cursor-pointer">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white">
                  <Play size={9} fill="white" />
                </div>
                <span>Watch a 2-min demo</span>
              </button>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-4 text-slate-500 text-[11px]">
              {["No credit card required", "Setup in minutes", "Free analysis"].map((item) => (
                <div key={item} className="flex items-center gap-1">
                  <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* App preview Column */}
          <div className="pt-2 lg:pt-0">
            <AppPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
