"use client";

import Link from "next/link";
import {
  ArrowRight,
  Play,
  Check,
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
    <div className="relative select-none w-full max-w-[510px] mx-auto lg:mr-4">
      {/* Top-Left Floating Card: Website Audit */}
      <div className="absolute -left-2 sm:-left-5 -top-4 z-20 bg-white rounded-2xl shadow-xl border border-slate-100/90 px-3.5 py-2.5 flex items-center gap-3 w-52 sm:w-56 animate-float-slow">
        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <FileText size={18} className="text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold text-slate-900 leading-tight truncate">
            Find what&apos;s holding you back
          </p>
          <p className="text-[10px] font-medium text-slate-400 mt-0.5">
            Website Audit
          </p>
        </div>
      </div>

      {/* Top-Right Floating Card: Competitor Intelligence */}
      <div className="absolute -right-2 sm:-right-5 -top-4 z-20 bg-white rounded-2xl shadow-xl border border-slate-100/90 px-3.5 py-2.5 flex items-center gap-3 w-56 sm:w-60 animate-float">
        <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
          <BarChart3 size={18} className="text-teal-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold text-slate-900 leading-tight">
            Discover opportunities your competitors cover
          </p>
          <p className="text-[10px] font-medium text-slate-400 mt-0.5">
            Competitor Intelligence
          </p>
        </div>
      </div>

      {/* Main Dashboard Card */}
      <div className="relative mt-6 bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden">
        {/* Container with Sidebar + Main Workspace */}
        <div className="flex">
          {/* Dark Sidebar */}
          <div className="w-28 sm:w-32 bg-[#0a101d] p-3 shrink-0 flex flex-col justify-between">
            <div>
              {/* Logo */}
              <div className="mb-3.5 pl-1">
                <span className="text-sm font-black tracking-tight text-white">
                  Growth<span className="text-violet-400">X</span>
                </span>
              </div>

              {/* Sidebar Menu */}
              <div className="space-y-0.5">
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
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-colors ${
                        item.active
                          ? "bg-violet-600/30 text-white border border-violet-500/40 shadow-xs"
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

          {/* Right Main Content */}
          <div className="flex-1 min-w-0 flex flex-col bg-white">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-100 bg-slate-50/50">
              {/* Search placeholder */}
              <div className="w-32 sm:w-44 h-6 bg-slate-100/90 rounded-lg" />

              {/* Right Profile / Bell controls */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Bell size={13} className="text-slate-500" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                </div>
                <div className="flex items-center gap-1 pl-1.5 border-l border-slate-200">
                  <div className="w-5 h-5 rounded-full bg-sky-500 text-white font-extrabold text-[9px] flex items-center justify-center">
                    S
                  </div>
                  <ChevronDown size={10} className="text-slate-400" />
                </div>
              </div>
            </div>

            {/* Dashboard Workspace */}
            <div className="p-3.5 space-y-3">
              {/* Overview Header & Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <h3 className="text-xs font-black text-slate-900 tracking-tight">
                  Website Overview
                </h3>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200/80 rounded-md text-[9px] font-semibold text-slate-700 border border-slate-200 cursor-pointer">
                    <Search size={9} className="text-slate-400" />
                    <span>yourwebsite.com</span>
                    <ChevronDown size={9} className="text-slate-400" />
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200/80 rounded-md text-[9px] font-semibold text-slate-700 border border-slate-200 cursor-pointer">
                    <Calendar size={9} className="text-slate-400" />
                    <span>Last 30 days</span>
                    <ChevronDown size={9} className="text-slate-400" />
                  </div>
                </div>
              </div>

              {/* 4 KPI Cards with Wavy Sparklines */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {/* 1: SEO Health */}
                <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-xs flex flex-col justify-between">
                  <p className="text-[8px] font-bold text-slate-500">SEO Health</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-sm sm:text-base font-black text-slate-900 leading-none">68</p>
                      <p className="text-[8px] font-bold text-emerald-600 mt-0.5">↑ 12%</p>
                    </div>
                    <svg className="w-8 sm:w-10 h-4 text-emerald-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 16 Q 14 6, 26 12 T 48 3" />
                    </svg>
                  </div>
                </div>

                {/* 2: AI Visibility */}
                <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-xs flex flex-col justify-between">
                  <p className="text-[8px] font-bold text-slate-500">AI Visibility</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-sm sm:text-base font-black text-slate-900 leading-none">52</p>
                      <p className="text-[8px] font-bold text-violet-600 mt-0.5">↑ 28%</p>
                    </div>
                    <svg className="w-8 sm:w-10 h-4 text-violet-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 17 Q 14 10, 26 13 T 48 4" />
                    </svg>
                  </div>
                </div>

                {/* 3: Organic Traffic */}
                <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-xs flex flex-col justify-between">
                  <p className="text-[8px] font-bold text-slate-500">Organic Traffic</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-sm sm:text-base font-black text-slate-900 leading-none">12.4K</p>
                      <p className="text-[8px] font-bold text-sky-600 mt-0.5">↑ 22%</p>
                    </div>
                    <svg className="w-8 sm:w-10 h-4 text-sky-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 18 Q 14 14, 26 10 T 48 2" />
                    </svg>
                  </div>
                </div>

                {/* 4: Ranking Keywords */}
                <div className="bg-white rounded-xl p-2 border border-slate-100 shadow-xs flex flex-col justify-between">
                  <p className="text-[8px] font-bold text-slate-500">Ranking Keywords</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-sm sm:text-base font-black text-slate-900 leading-none">1,240</p>
                      <p className="text-[8px] font-bold text-indigo-600 mt-0.5">↑ 18%</p>
                    </div>
                    <svg className="w-8 sm:w-10 h-4 text-indigo-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 16 Q 14 14, 26 9 T 48 4" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Bottom 2 Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                {/* Current 30-Day Plan */}
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-lg bg-violet-100/70 text-violet-700 flex items-center justify-center shrink-0">
                        <Calendar size={12} />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-extrabold text-slate-900 leading-tight">
                          Current 30-Day Plan
                        </h4>
                        <p className="text-[9px] text-slate-400">
                          12 of 38 actions completed
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-violet-600 h-1.5 rounded-full" style={{ width: "32%" }} />
                      </div>
                      <span className="text-[9px] font-bold text-slate-700">32%</span>
                    </div>
                  </div>

                  <button className="inline-flex items-center justify-center gap-1 py-1 px-2.5 rounded-md border border-violet-200 text-violet-700 hover:bg-violet-50 text-[10px] font-bold transition-all w-fit cursor-pointer">
                    <span>View Plan</span>
                    <ArrowRight size={9} />
                  </button>
                </div>

                {/* Let GrowthX do the work */}
                <div className="bg-gradient-to-br from-violet-50/70 via-indigo-50/40 to-slate-50 rounded-xl p-3 border border-violet-100/80 shadow-xs flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-violet-100/90 text-violet-600 flex items-center justify-center shrink-0">
                    <Zap size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 leading-tight">
                      Let GrowthX do the work
                    </h4>
                    <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
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
      <div className="absolute -left-2 sm:-left-5 -bottom-4 z-20 bg-white rounded-2xl shadow-xl border border-slate-100/90 px-3.5 py-2.5 flex items-center gap-3 w-52 sm:w-56 animate-float-slow">
        <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
          <Sparkles size={18} className="text-violet-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold text-slate-900 leading-tight">
            See how AI platforms perceive your brand
          </p>
          <p className="text-[10px] font-medium text-slate-400 mt-0.5">
            AI Visibility
          </p>
        </div>
      </div>

      {/* Bottom-Right Floating Card: Fix Engine */}
      <div className="absolute -right-2 sm:-right-5 -bottom-4 z-20 bg-white rounded-2xl shadow-xl border border-slate-100/90 px-3.5 py-2.5 flex items-center gap-3 w-56 sm:w-60 animate-float">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
          <Settings size={18} className="text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold text-slate-900 leading-tight">
            Automatically implement approved improvements
          </p>
          <p className="text-[10px] font-medium text-slate-400 mt-0.5">
            Fix Engine
          </p>
        </div>
      </div>

      {/* Cursive annotation with arrow at bottom right */}
      <div className="absolute -bottom-14 right-4 sm:right-8 z-20 flex flex-col items-center text-violet-600">
        <svg
          className="w-6 h-6 text-violet-500 transform rotate-45 -translate-x-2 translate-y-1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        <p
          className="font-bold text-xs sm:text-sm whitespace-nowrap text-violet-600"
          style={{ fontFamily: "cursive", transform: "rotate(-4deg)" }}
        >
          From insights<br className="sm:hidden" /> to real growth
        </p>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center bg-gradient-to-br from-slate-50 via-white to-violet-50/30 pt-16 pb-12 lg:pt-20 lg:pb-14">
      {/* Soft background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-100/40 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 w-[450px] h-[450px] rounded-full bg-blue-100/30 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-4">
        <div className="grid lg:grid-cols-[46%_54%] gap-8 lg:gap-10 items-center">
          {/* LEFT COLUMN */}
          <div className="space-y-5 lg:space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200/80 text-violet-700 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              AI-Powered SEO &amp; GEO Automation
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-[48px] font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                Turn Search and<br />
                AI Visibility into
              </h1>
              <h1 className="text-4xl sm:text-5xl lg:text-[48px] font-extrabold leading-[1.1] tracking-tight bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mt-1">
                Real Business Growth
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
              GrowthX analyzes your website, competitors, and AI platforms, creates a prioritized 30-day plan, and automatically implements the improvements for you.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1">
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white font-bold text-sm sm:text-[15px] px-6 py-3.5 rounded-2xl transition-all shadow-md shadow-violet-200 cursor-pointer"
              >
                <span>Analyze Your Website</span>
                <ArrowRight size={16} />
              </Link>
              <button className="inline-flex items-center gap-2.5 bg-white border border-slate-200 text-slate-800 hover:text-slate-900 font-bold text-sm sm:text-[15px] px-5 py-3 rounded-2xl hover:bg-slate-50 transition-all shadow-xs cursor-pointer">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-600 text-white shadow-xs">
                  <Play size={10} fill="white" className="ml-0.5" />
                </div>
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Trust signals */}
            <div className="flex flex-wrap items-center gap-5 pt-1 text-xs sm:text-[13px] text-slate-600 font-semibold">
              {["No credit card required", "Free analysis", "Setup in minutes"].map((item) => (
                <div key={item} className="flex items-center gap-1.5">
                  <Check size={14} className="text-violet-600 shrink-0 font-extrabold" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN: Dashboard mockup matching Screenshot 2 */}
          <div className="relative flex justify-center lg:justify-end pr-2 sm:pr-4">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
