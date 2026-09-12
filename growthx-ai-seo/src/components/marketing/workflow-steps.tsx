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
    <div className="relative">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/70">
          <span className="text-sm font-bold text-slate-900">
            Growth<span className="text-violet-600">X</span>
          </span>
          <div className="flex-1 bg-slate-100 rounded-lg px-3 py-1.5 text-[11px] text-slate-400 border border-slate-200">
            yourwebsite.com
          </div>
          <div className="bg-violet-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg">
            Analyze
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Status banner */}
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <CheckCircle size={14} className="text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold text-emerald-800">Website Analysis Complete</p>
              <p className="text-[11px] text-emerald-600">We found 38 high-impact opportunities for your website.</p>
            </div>
            <button className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 shrink-0">
              View Full Report
            </button>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "SEO Health", value: "68", trend: "+22%", color: "text-blue-600" },
              { label: "AI Visibility", value: "52", trend: "+28%", color: "text-violet-600" },
              { label: "Competitors Found", value: "5", trend: "In your industry", color: "text-amber-600" },
              { label: "Opportunities", value: "38", trend: "High-value actions", color: "text-emerald-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[9px] text-slate-500 font-medium">{kpi.label}</p>
                <p className={`text-xl font-extrabold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[9px] text-slate-500">{kpi.trend}</p>
              </div>
            ))}
          </div>

          {/* 30-day plan */}
          <div className="border border-slate-200 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold text-slate-800">Your 30-Day Plan</p>
              <div className="bg-violet-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                View Plan <ArrowRight size={9} />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mb-2">12 of 38 actions completed</p>
            <div className="w-full bg-slate-100 rounded-full h-1.5">
              <div className="bg-violet-600 h-1.5 rounded-full" style={{ width: "32%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Floating: AI Visibility Score */}
      <div className="absolute -left-5 bottom-10 bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-3 w-36 animate-float-slow">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px]">✨</span>
          <p className="text-[10px] font-semibold text-slate-500">AI Visibility Score</p>
        </div>
        <p className="text-2xl font-extrabold text-violet-600">52</p>
        <p className="text-[10px] text-emerald-600 font-semibold">↑ 28%</p>
      </div>

      {/* Annotation */}
      <div className="absolute -top-4 right-4">
        <p className="font-bold text-violet-400 text-sm" style={{ fontFamily: "cursive", transform: "rotate(3deg)" }}>
          From insights to execution ↙
        </p>
      </div>

      {/* Bottom annotation */}
      <div className="absolute -bottom-5 right-8">
        <p className="font-bold text-slate-400 text-sm" style={{ fontFamily: "cursive", transform: "rotate(-2deg)" }}>
          A clear plan. Measurable growth.
        </p>
      </div>

      {/* Demo label */}
      <div className="absolute top-3 right-20 bg-amber-50 text-amber-700 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border border-amber-200">
        Illustrative
      </div>
    </div>
  );
}

export function WorkflowSteps() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-xl mb-16">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3">
            Simple Steps. Big Results.
          </p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">
            Go from analysis to growth<br />
            in just a few clicks.
          </h2>
          <p className="mt-4 text-lg text-slate-500 leading-relaxed">
            GrowthX handles the complexity. You get a clear plan and real results.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Steps */}
          <div className="space-y-8">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.num} className="flex gap-5">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-violet-600" />
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="w-px flex-1 bg-gradient-to-b from-violet-200 to-transparent min-h-[2rem]" />
                    )}
                  </div>
                  <div className="pb-6">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest">{step.num}</span>
                      <h3 className="text-[16px] font-bold text-slate-900">{step.title}</h3>
                    </div>
                    <p className="text-[14px] text-slate-500 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              );
            })}

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/analyze"
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-sm"
              >
                Analyze Your Website <ArrowRight size={14} />
              </Link>
              <button className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold text-sm px-4 py-3 rounded-xl hover:bg-slate-50 transition-all">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white">
                  <Play size={10} fill="white" />
                </div>
                Watch a 2-min demo
              </button>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-5">
              {["No credit card required", "Setup in minutes", "Free analysis"].map((item) => (
                <div key={item} className="flex items-center gap-1.5 text-[12px] text-slate-500">
                  <CheckCircle size={13} className="text-emerald-500" />
                  {item}
                </div>
              ))}
            </div>

            {/* Logo strip */}
            <div className="pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                Trusted by growing businesses
              </p>
              <div className="flex flex-wrap items-center gap-5 opacity-40">
                {["Stripe", "Shopify", "Notion", "Slack", "Webflow", "Vercel"].map((b) => (
                  <span key={b} className="text-sm font-black text-slate-700 tracking-tight">
                    {b}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2 italic">
                * Illustrative logos — not actual GrowthX customers.
              </p>
            </div>
          </div>

          {/* App preview */}
          <AppPreview />
        </div>
      </div>
    </section>
  );
}
