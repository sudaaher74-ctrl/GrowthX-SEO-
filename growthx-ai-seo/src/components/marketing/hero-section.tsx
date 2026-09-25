"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { auth, subscribeToAuthChange } from "@/lib/api-client";
import {
  ArrowRight,
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
      {/* Top Floating Badge: SEO Health Score — completely above the card */}
      <div className="absolute bottom-[calc(100%+16px)] left-6 sm:left-10 z-20 bg-brand-900 rounded-2xl shadow-xl border border-brand-800 p-2.5 sm:p-3 w-40 animate-float hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1 text-brand-400">
          <div className="w-5 h-5 rounded-lg bg-success-500/10 text-success-400 flex items-center justify-center">
            <Sparkles size={11} />
          </div>
          <p className="text-[10px] font-bold text-white">SEO Health Score</p>
        </div>
        <div className="flex items-end justify-between mt-0.5">
          <div>
            <p className="text-xl font-black text-white leading-none">78</p>
            <p className="text-[9px] font-bold text-success-400 mt-0.5">↑ 22%</p>
          </div>
          <svg className="w-10 h-5 text-success-400" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 16 Q 14 6, 26 12 T 48 3" />
          </svg>
        </div>
      </div>

      {/* Main Dashboard Card */}
      <div className="relative mt-6 bg-brand-900 rounded-3xl shadow-2xl border border-brand-800 overflow-hidden">
        {/* Container with Sidebar + Main Workspace */}
        <div className="flex">
          {/* Sidebar */}
          <div className="w-28 sm:w-32 bg-brand-950 p-3 shrink-0 flex flex-col justify-between border-r border-brand-900">
            <div>
              {/* Logo */}
              <div className="mb-3.5 pl-1">
                <span className="text-sm font-black tracking-tight text-white">
                  Growth<span className="text-series-6">X</span>
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

          {/* Right Main Content */}
          <div className="flex-1 min-w-0 flex flex-col bg-brand-950">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-brand-900 bg-brand-900/40">
              {/* Search placeholder */}
              <div className="w-32 sm:w-44 h-6 bg-brand-900 rounded-lg border border-brand-800/80" />

              {/* Right Profile / Bell controls */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Bell size={13} className="text-brand-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-warning-500" />
                </div>
                <div className="flex items-center gap-1 pl-1.5 border-l border-brand-850">
                  <div className="w-5 h-5 rounded-full bg-series-6 text-white font-extrabold text-[9px] flex items-center justify-center">
                    S
                  </div>
                  <ChevronDown size={10} className="text-brand-400" />
                </div>
              </div>
            </div>

            {/* Dashboard Workspace */}
            <div className="p-3.5 space-y-3">
              {/* Overview Header & Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <h3 className="text-xs font-black text-white tracking-tight">
                  Battleground: yoursite.com vs rival.com
                </h3>

                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-900 hover:bg-brand-850 rounded-md text-[9px] font-semibold text-brand-300 border border-brand-800 cursor-pointer">
                    <Search size={9} className="text-brand-400" />
                    <span>yoursite.com</span>
                    <ChevronDown size={9} className="text-brand-400" />
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-brand-900 hover:bg-brand-850 rounded-md text-[9px] font-semibold text-brand-300 border border-brand-800 cursor-pointer">
                    <Calendar size={9} className="text-brand-400" />
                    <span>Last 30 days</span>
                    <ChevronDown size={9} className="text-brand-400" />
                  </div>
                </div>
              </div>

              {/* 4 KPI Cards with Wavy Sparklines */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {/* 1: SEO Health */}
                <div className="bg-brand-900/60 rounded-xl p-2 border border-brand-800/80 shadow-xs flex flex-col justify-between">
                  <p className="text-[8px] font-bold text-brand-400">SEO Health</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-sm sm:text-base font-black text-white leading-none">78</p>
                      <p className="text-[8px] font-bold text-success-400 mt-0.5">↑ 22%</p>
                    </div>
                    <svg className="w-8 sm:w-10 h-4 text-success-400" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 16 Q 14 6, 26 12 T 48 3" />
                    </svg>
                  </div>
                </div>

                {/* 2: AI Visibility */}
                <div className="bg-brand-900/60 rounded-xl p-2 border border-brand-800/80 shadow-xs flex flex-col justify-between">
                  <p className="text-[8px] font-bold text-brand-400">AI Answer Share</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-sm sm:text-base font-black text-white leading-none">52%</p>
                      <p className="text-[8px] font-bold text-series-6 mt-0.5">vs 31% rival</p>
                    </div>
                    <svg className="w-8 sm:w-10 h-4 text-series-6" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 17 Q 14 10, 26 13 T 48 4" />
                    </svg>
                  </div>
                </div>

                {/* 3: Open Issues */}
                <div className="bg-brand-900/60 rounded-xl p-2 border border-brand-800/80 shadow-xs flex flex-col justify-between">
                  <p className="text-[8px] font-bold text-brand-400">Open Issues</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-sm sm:text-base font-black text-white leading-none">8</p>
                      <p className="text-[8px] font-bold text-warning-400 mt-0.5">3 fixes ready</p>
                    </div>
                    <svg className="w-8 sm:w-10 h-4 text-accent-400" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 18 Q 14 14, 26 10 T 48 2" />
                    </svg>
                  </div>
                </div>

                {/* 4: Rivals Tracked */}
                <div className="bg-brand-900/60 rounded-xl p-2 border border-brand-800/80 shadow-xs flex flex-col justify-between">
                  <p className="text-[8px] font-bold text-brand-400">Rivals Tracked</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-sm sm:text-base font-black text-white leading-none">5</p>
                      <p className="text-[8px] font-bold text-series-6 mt-0.5">1 move detected</p>
                    </div>
                    <svg className="w-8 sm:w-10 h-4 text-series-6" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 16 Q 14 14, 26 9 T 48 4" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Bottom 2 Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                {/* Current 30-Day Plan */}
                <div className="bg-brand-900/60 rounded-xl p-3 border border-brand-800/80 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-lg bg-series-6/20 text-series-6 flex items-center justify-center shrink-0">
                        <Calendar size={12} />
                      </div>
                      <div>
                        <h4 className="text-[11px] font-extrabold text-white leading-tight">
                          Current 30-Day Plan
                        </h4>
                        <p className="text-[9px] text-brand-400">
                          12 of 38 actions completed
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 bg-brand-950 rounded-full h-1.5 overflow-hidden border border-brand-850">
                        <div className="bg-series-6 h-1.5 rounded-full" style={{ width: "32%" }} />
                      </div>
                      <span className="text-[9px] font-bold text-brand-300">32%</span>
                    </div>
                  </div>

                  <Link href="/dashboard" className="inline-flex items-center justify-center gap-1 py-1 px-2.5 rounded-md border border-brand-700 bg-brand-850 text-white hover:bg-brand-800 text-[10px] font-bold transition-all w-fit cursor-pointer">
                    <span>View Plan</span>
                    <ArrowRight size={9} />
                  </Link>
                </div>

                {/* This week's move card with Counter button */}
                <div className="bg-brand-900/40 rounded-xl p-3 border border-brand-800 shadow-xs flex flex-col justify-between">
                  <div className="flex items-start gap-2">
                    <div className="w-7 h-7 rounded-lg bg-warning-500/10 text-warning-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Zap size={13} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-[11px] font-extrabold text-white leading-tight">
                          This week&apos;s move
                        </h4>
                        <span className="text-[9px] font-bold text-success-400">+₹24K/mo</span>
                      </div>
                      <p className="text-[9px] text-brand-400 leading-snug mt-0.5 truncate">
                        Rival added: /mumbai/milk-delivery
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 text-right">
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center gap-1 py-0.5 px-2 rounded bg-series-6 text-white text-[9px] font-bold hover:bg-series-6/90 transition-all cursor-pointer"
                    >
                      <span>Counter</span>
                      <ArrowRight size={9} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Floating Badge: AI Visibility — completely below the card */}
      <div className="absolute top-[calc(100%+16px)] right-6 sm:right-10 z-20 bg-brand-900 rounded-2xl shadow-xl border border-brand-800 p-2.5 sm:p-3 w-40 animate-float-slow hidden sm:block">
        <div className="flex items-center gap-1.5 mb-1 text-brand-400">
          <div className="w-5 h-5 rounded-lg bg-series-6/20 text-series-6 flex items-center justify-center">
            <Sparkles size={11} />
          </div>
          <p className="text-[10px] font-bold text-white">AI Visibility</p>
        </div>
        <div className="flex items-end justify-between mt-0.5">
          <div>
            <p className="text-xl font-black text-white leading-none">52</p>
            <p className="text-[9px] font-bold text-series-6 mt-0.5">↑ 28%</p>
          </div>
          <svg className="w-10 h-5 text-series-6" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 17 Q 14 10, 26 13 T 48 4" />
          </svg>
        </div>
      </div>

      {/* Cursive annotation with arrow at bottom right */}
      <div className="absolute -bottom-14 right-4 sm:right-8 z-20 flex flex-col items-center text-series-6">
        <svg
          className="w-6 h-6 text-series-6 transform rotate-45 -translate-x-2 translate-y-1"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        <p
          className="font-bold text-xs sm:text-sm whitespace-nowrap text-series-6"
          style={{ fontFamily: "cursive", transform: "rotate(-4deg)" }}
        >
          Find it. Fix it. Prove it.
        </p>
      </div>
    </div>
  );
}

export function HeroSection() {
  const signedIn = useSyncExternalStore(
    subscribeToAuthChange,
    () => auth.isAuthenticated(),
    () => false,
  );

  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center bg-brand-950 pt-20 pb-16 lg:pt-28 lg:pb-20 border-b border-brand-900 overflow-hidden">
      {/* Soft background ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-series-6/10 blur-[130px]" />
        <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full bg-accent-600/10 blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-4">
        <div className="grid lg:grid-cols-[46%_54%] gap-8 lg:gap-10 items-center">
          {/* LEFT COLUMN */}
          <div className="space-y-5 lg:space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-brand-900/80 border border-brand-800 text-brand-300 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-series-6 animate-pulse" />
              AI SEO + GOOGLE BUSINESS PROFILE, ON AUTOPILOT
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-[46px] font-extrabold text-white leading-[1.1] tracking-tight">
                Find what&apos;s costing you customers.<br />
              </h1>
              <h1 className="text-4xl sm:text-5xl lg:text-[46px] font-extrabold leading-[1.1] tracking-tight bg-gradient-to-r from-series-6 via-accent-300 to-accent-400 bg-clip-text text-transparent mt-1">
                Fix it before your competitors do.
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-brand-400 leading-relaxed max-w-xl">
              GrowthX crawls your website, tracks your rivals and checks how AI assistants talk about you. Then it writes and ships the fixes, and proves they worked.
            </p>

            {/* URL Box CTA */}
            <div className="space-y-2.5 pt-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.currentTarget.elements.namedItem("url") as HTMLInputElement)?.value;
                  const clean = input ? encodeURIComponent(input.trim()) : "";
                  window.location.href = signedIn
                    ? clean ? `/dashboard?audit=${clean}` : "/dashboard"
                    : clean ? `/login?url=${clean}` : "/login";
                }}
                className="flex flex-col sm:flex-row items-stretch gap-2 bg-brand-900/90 border border-brand-800 p-1.5 rounded-2xl shadow-xl backdrop-blur-sm focus-within:border-series-6 transition-all max-w-md"
              >
                <input
                  name="url"
                  type="text"
                  placeholder="yourwebsite.com"
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-brand-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-series-6 hover:bg-series-6/90 active:scale-[0.98] text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                >
                  <span>Run free audit</span>
                  <ArrowRight size={14} />
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 max-w-md px-1 text-xs text-brand-400">
                <p className="flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-400" />
                  Free &middot; No card needed &middot; Results in about 60 seconds
                </p>
                <Link
                  href="/login"
                  className="text-series-400 hover:text-series-300 font-semibold transition-colors"
                >
                  Already a customer? Log in &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Dashboard mockup */}
          <div className="relative flex justify-center lg:justify-end pr-2 sm:pr-4">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
