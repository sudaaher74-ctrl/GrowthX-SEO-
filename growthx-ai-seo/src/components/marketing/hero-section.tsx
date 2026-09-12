"use client";

import Link from "next/link";
import {
  ArrowRight,
  Play,
  CheckCircle,
  FileText,
  BarChart3,
  Sparkles,
  Settings,
  Bell,
  ChevronDown,
  Calendar,
  Search,
  Zap,
  RotateCcw,
  Target,
  Wrench,
  FileSpreadsheet,
  Home,
} from "lucide-react";

function DashboardMockup() {
  return (
    <div className="relative w-full max-w-2xl mx-auto select-none">
      {/* Floating cards — positioned around the mockup matching Screenshot 1 */}

      {/* Top-Left Floating Card: Website Audit */}
      <div className="absolute -left-6 -top-5 z-20 bg-white rounded-2xl shadow-xl border border-slate-100/90 px-4 py-3 flex items-center gap-3.5 w-64 animate-float-slow">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
          <FileText size={20} className="text-blue-600" />
        </div>
        <div>
          <p className="text-xs font-extrabold text-slate-900 leading-tight">
            Find what&apos;s holding you back
          </p>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
            Website Audit
          </p>
        </div>
      </div>

      {/* Top-Right Floating Card: Competitor Intelligence */}
      <div className="absolute -right-6 -top-5 z-20 bg-white rounded-2xl shadow-xl border border-slate-100/90 px-4 py-3 flex items-center gap-3.5 w-72 animate-float">
        <div className="w-10 h-10 rounded-2xl bg-teal-50 flex items-center justify-center shrink-0">
          <BarChart3 size={20} className="text-teal-600" />
        </div>
        <div>
          <p className="text-xs font-extrabold text-slate-900 leading-tight">
            Discover opportunities your competitors cover
          </p>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
            Competitor Intelligence
          </p>
        </div>
      </div>

      {/* Main Dashboard Card */}
      <div className="relative mt-8 bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden">
        {/* Container with Sidebar + Main Workspace */}
        <div className="flex">
          {/* Dark Sidebar */}
          <div className="w-36 sm:w-44 bg-[#0a101d] p-4 shrink-0 flex flex-col justify-between">
            <div>
              {/* Logo */}
              <div className="mb-5 pl-1">
                <span className="text-base font-black tracking-tight text-white">
                  Growth<span className="text-violet-400">X</span>
                </span>
              </div>

              {/* Sidebar Menu */}
              <div className="space-y-1">
                {[
                  { icon: Home, label: "Dashboard", active: true },
                  { icon: RotateCcw, label: "Website Audit" },
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
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                        item.active
                          ? "bg-violet-600/30 text-white border border-violet-500/40 shadow-sm"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <ItemIcon size={14} className={item.active ? "text-violet-400" : "text-slate-400"} />
                      <span className="truncate">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Main Content */}
          <div className="flex-1 min-w-0 flex flex-col bg-white">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/50">
              {/* Search placeholder */}
              <div className="w-48 sm:w-64 h-8 bg-slate-100/90 rounded-xl" />

              {/* Right Profile / Bell controls */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Bell size={16} className="text-slate-500" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
                </div>
                <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                  <div className="w-7 h-7 rounded-full bg-sky-500 text-white font-extrabold text-xs flex items-center justify-center shadow-sm">
                    S
                  </div>
                  <ChevronDown size={13} className="text-slate-400" />
                </div>
              </div>
            </div>

            {/* Dashboard Workspace */}
            <div className="p-5 space-y-4">
              {/* Overview Header & Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-900 tracking-tight">
                  Website Overview
                </h3>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-[11px] font-semibold text-slate-700 border border-slate-200 cursor-pointer">
                    <Search size={11} className="text-slate-400" />
                    <span>yourwebsite.com</span>
                    <ChevronDown size={11} className="text-slate-400" />
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-[11px] font-semibold text-slate-700 border border-slate-200 cursor-pointer">
                    <Calendar size={11} className="text-slate-400" />
                    <span>Last 30 days</span>
                    <ChevronDown size={11} className="text-slate-400" />
                  </div>
                </div>
              </div>

              {/* 4 KPI Cards with Wavy Sparklines */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1: SEO Health */}
                <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-slate-500">SEO Health</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-xl font-black text-slate-900 leading-none">68</p>
                      <p className="text-[10px] font-bold text-emerald-600 mt-1">↑ 12%</p>
                    </div>
                    <svg className="w-12 h-6 text-emerald-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 16 Q 14 6, 26 12 T 48 3" />
                    </svg>
                  </div>
                </div>

                {/* 2: AI Visibility */}
                <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-slate-500">AI Visibility</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-xl font-black text-slate-900 leading-none">52</p>
                      <p className="text-[10px] font-bold text-violet-600 mt-1">↑ 28%</p>
                    </div>
                    <svg className="w-12 h-6 text-violet-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 17 Q 14 10, 26 13 T 48 4" />
                    </svg>
                  </div>
                </div>

                {/* 3: Organic Traffic */}
                <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-slate-500">Organic Traffic</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-xl font-black text-slate-900 leading-none">12.4K</p>
                      <p className="text-[10px] font-bold text-sky-600 mt-1">↑ 22%</p>
                    </div>
                    <svg className="w-12 h-6 text-sky-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 18 Q 14 14, 26 10 T 48 2" />
                    </svg>
                  </div>
                </div>

                {/* 4: Ranking Keywords */}
                <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex flex-col justify-between">
                  <p className="text-[10px] font-bold text-slate-500">Ranking Keywords</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-xl font-black text-slate-900 leading-none">1,240</p>
                      <p className="text-[10px] font-bold text-indigo-600 mt-1">↑ 18%</p>
                    </div>
                    <svg className="w-12 h-6 text-indigo-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 16 Q 14 14, 26 9 T 48 4" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Bottom 2 Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Current 30-Day Plan */}
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className="w-7 h-7 rounded-lg bg-violet-100/70 text-violet-700 flex items-center justify-center">
                        <Calendar size={14} />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900">
                          Current 30-Day Plan
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          12 of 38 actions completed
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 my-3">
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="bg-violet-600 h-2 rounded-full" style={{ width: "32%" }} />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700">32%</span>
                    </div>
                  </div>

                  <button className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 text-[11px] font-bold transition-all w-fit cursor-pointer">
                    <span>View Plan</span>
                    <ArrowRight size={11} />
                  </button>
                </div>

                {/* Let GrowthX do the work */}
                <div className="bg-gradient-to-br from-violet-50/70 via-indigo-50/40 to-slate-50 rounded-2xl p-4 border border-violet-100/80 shadow-sm flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-violet-100/90 text-violet-600 flex items-center justify-center shrink-0">
                    <Zap size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Let GrowthX do the work
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      From insights to execution, all in one place.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-Left Floating Card: AI Visibility */}
      <div className="absolute -left-6 -bottom-5 z-20 bg-white rounded-2xl shadow-xl border border-slate-100/90 px-4 py-3 flex items-center gap-3.5 w-64 animate-float-slow">
        <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-violet-600" />
        </div>
        <div>
          <p className="text-xs font-extrabold text-slate-900 leading-tight">
            See how AI platforms perceive your brand
          </p>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
            AI Visibility
          </p>
        </div>
      </div>

      {/* Bottom-Right Floating Card: Fix Engine */}
      <div className="absolute -right-6 -bottom-5 z-20 bg-white rounded-2xl shadow-xl border border-slate-100/90 px-4 py-3 flex items-center gap-3.5 w-72 animate-float">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
          <Settings size={20} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-xs font-extrabold text-slate-900 leading-tight">
            Automatically implement approved improvements
          </p>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5">
            Fix Engine
          </p>
        </div>
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
        <div className="grid lg:grid-cols-[50%_50%] gap-8 lg:gap-10 items-center">
          {/* LEFT */}
          <div className="space-y-5 lg:space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200/80 text-violet-700 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              AI-Powered SEO &amp; GEO Automation
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-[50px] font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                Turn Search and<br />
                AI Visibility into
              </h1>
              <h1 className="text-4xl sm:text-5xl lg:text-[50px] font-extrabold leading-[1.1] tracking-tight bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mt-1">
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
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-bold text-sm sm:text-[15px] px-6 py-3.5 rounded-xl transition-all shadow-md hover:shadow-violet-300 hover:shadow-lg cursor-pointer"
              >
                <span>Analyze Your Website</span>
                <ArrowRight size={16} />
              </Link>
              <button className="flex items-center gap-2.5 text-slate-700 hover:text-slate-900 font-semibold text-sm sm:text-[15px] px-4 py-3.5 rounded-xl hover:bg-slate-100 transition-all cursor-pointer">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white">
                  <Play size={12} fill="white" />
                </div>
                <span>Watch Demo</span>
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
          <div className="relative lg:pl-2">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
