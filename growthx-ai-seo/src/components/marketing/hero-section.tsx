"use client";

import Link from "next/link";
import { ArrowRight, Play, CheckCircle, TrendingUp, Globe, Sparkles, Wrench } from "lucide-react";

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto lg:mx-0 lg:max-w-none select-none">
      {/* Floating cards — positioned absolutely around the mockup */}
      {/* Top-left: Website Audit */}
      <div className="absolute -left-4 top-4 z-10 bg-white rounded-2xl shadow-lg border border-slate-100 px-3.5 py-2.5 flex items-center gap-2.5 w-48 sm:w-52 animate-float-slow">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <Globe size={15} className="text-blue-600" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-900 leading-tight">Website Audit</p>
          <p className="text-[10px] text-slate-500 leading-tight">Find what's holding you back</p>
        </div>
      </div>

      {/* Top-right: Competitor Intel */}
      <div className="absolute -right-2 top-2 z-10 bg-white rounded-2xl shadow-lg border border-slate-100 px-3.5 py-2.5 flex items-center gap-2.5 w-48 sm:w-52 animate-float">
        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
          <TrendingUp size={15} className="text-amber-600" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-900 leading-tight">Competitor Intelligence</p>
          <p className="text-[10px] text-slate-500 leading-tight">Opportunities competitors cover</p>
        </div>
      </div>

      {/* Main dashboard card */}
      <div className="relative mt-8 mx-2 bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden">
        {/* Dashboard header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">
              Growth<span className="text-violet-600">X</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <div className="w-2 h-2 rounded-full bg-green-400" />
          </div>
        </div>

        {/* Sidebar + content */}
        <div className="flex">
          {/* Mini sidebar */}
          <div className="w-28 sm:w-32 bg-slate-900 min-h-[220px] p-2.5 shrink-0 hidden sm:block">
            <div className="space-y-0.5">
              {[
                { icon: "🏠", label: "Dashboard", active: true },
                { icon: "🔍", label: "Website Audit" },
                { icon: "🎯", label: "Competitor Intel" },
                { icon: "✨", label: "AI Visibility" },
                { icon: "⚡", label: "Fix Engine" },
                { icon: "📊", label: "Reports" },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                    item.active
                      ? "bg-violet-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span className="text-[11px]">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 p-3.5 space-y-2.5 min-w-0">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              Website Overview
            </p>

            {/* KPI row */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "SEO Health", value: "68", trend: "+12%", color: "text-blue-600" },
                { label: "AI Visibility", value: "52", trend: "+28%", color: "text-violet-600" },
                { label: "Organic Traffic", value: "12.4K", trend: "+22%", color: "text-emerald-600" },
                { label: "Ranking Keywords", value: "1,240", trend: "+18%", color: "text-amber-600" },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-slate-50 rounded-lg p-2">
                  <p className="text-[8px] text-slate-500 font-medium truncate">{kpi.label}</p>
                  <p className={`text-sm font-extrabold ${kpi.color} leading-tight`}>{kpi.value}</p>
                  <p className="text-[8px] text-emerald-600 font-semibold">{kpi.trend}</p>
                </div>
              ))}
            </div>

            {/* 30-day plan */}
            <div className="bg-violet-50 rounded-xl p-2.5 border border-violet-100">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-semibold text-violet-900">30-Day Plan</p>
                <span className="text-[8px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full">
                  Active
                </span>
              </div>
              <p className="text-[8px] text-violet-700 mb-1">12 / 38 actions completed</p>
              <div className="w-full bg-violet-200 rounded-full h-1.5">
                <div className="bg-violet-600 h-1.5 rounded-full transition-all" style={{ width: "32%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-left: AI Visibility */}
      <div className="absolute -left-2 bottom-6 z-10 bg-white rounded-2xl shadow-lg border border-slate-100 px-3.5 py-2.5 flex items-center gap-2.5 w-48 sm:w-52 animate-float-slow">
        <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
          <Sparkles size={15} className="text-violet-600" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-900 leading-tight">AI Visibility</p>
          <p className="text-[10px] text-slate-500 leading-tight">How AI platforms see your brand</p>
        </div>
      </div>

      {/* Bottom-right: Fix Engine */}
      <div className="absolute -right-2 bottom-4 z-10 bg-white rounded-2xl shadow-lg border border-slate-100 px-3.5 py-2.5 flex items-center gap-2.5 w-48 sm:w-52 animate-float">
        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <Wrench size={15} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-900 leading-tight">Fix Engine</p>
          <p className="text-[10px] text-slate-500 leading-tight">Auto-implement approved fixes</p>
        </div>
      </div>

      {/* Annotation */}
      <div className="absolute -bottom-6 right-6 z-20">
        <p
          className="font-bold text-violet-500 text-xs sm:text-sm"
          style={{ fontFamily: "cursive", transform: "rotate(-4deg)" }}
        >
          From insights to real growth ↗
        </p>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-violet-50/30 pt-16 pb-8 lg:pt-20 lg:pb-10">
      {/* Soft background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-100/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 w-[450px] h-[450px] rounded-full bg-blue-100/30 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-4 sm:py-6">
        <div className="grid lg:grid-cols-[55%_45%] gap-8 lg:gap-8 items-center">
          {/* LEFT */}
          <div className="space-y-5 lg:space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200/80 text-violet-700 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              AI-Powered SEO &amp; GEO Automation
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                Turn Search and<br />
                AI Visibility into
              </h1>
              <h1 className="text-4xl sm:text-5xl lg:text-[52px] font-extrabold leading-[1.1] tracking-tight bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mt-1">
                Real Business Growth
              </h1>
            </div>

            {/* Sub */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              GrowthX analyzes your website, competitors, and AI platforms, creates a prioritized 30-day plan, and automatically implements the improvements for you.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Link
                href="/analyze"
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-bold text-sm sm:text-[15px] px-6 py-3.5 rounded-xl transition-all shadow-md hover:shadow-violet-300 hover:shadow-lg"
              >
                Analyze Your Website
                <ArrowRight size={16} />
              </Link>
              <button className="flex items-center gap-2.5 text-slate-700 hover:text-slate-900 font-semibold text-sm sm:text-[15px] px-4 py-3.5 rounded-xl hover:bg-slate-100 transition-all cursor-pointer">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white">
                  <Play size={12} fill="white" />
                </div>
                Watch Demo
              </button>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-5 pt-1">
              {[
                "No credit card required",
                "Free analysis",
                "Setup in minutes",
              ].map((item) => (
                <div key={item} className="flex items-center gap-1.5 text-xs sm:text-[13px] text-slate-600 font-medium">
                  <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT — Dashboard mockup */}
          <div className="relative lg:pl-4">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
