"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { auth, subscribeToAuthChange } from "@/lib/api-client";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Check,
  Globe,
  LayoutGrid,
  RefreshCw,
  Target,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

function DashboardMockup() {
  const [activeTab, setActiveTab] = useState<"overview" | "visitors" | "todos">("overview");

  return (
    <div className="relative select-none w-full max-w-[600px] mx-auto lg:mr-0">
      {/* Main Dashboard Window — Matches the real Reigel Dashboard in Night & Day mode */}
      <div className="relative rounded-3xl border border-brand-200 bg-surface-1 shadow-card overflow-hidden">
        <div className="flex">
          {/* Left Sidebar — Matches Reigel Dashboard Sidebar */}
          <div className="w-14 sm:w-44 bg-surface-1 p-2.5 sm:p-3.5 shrink-0 flex flex-col justify-between border-r border-brand-200">
            <div>
              {/* Brand Row */}
              <div className="flex items-center gap-2 mb-3.5 px-1">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-signal-400 font-mono text-[11px] font-extrabold text-signal-ink">
                  R
                </span>
                <span className="hidden sm:inline text-sm font-extrabold tracking-tight text-brand-950">
                  Reigel
                </span>
                <span className="hidden sm:inline rounded border border-brand-200 bg-surface-2 px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-wider text-brand-500">
                  AI SEO
                </span>
              </div>

              {/* Workspace Switcher Pill */}
              <div className="hidden sm:block mb-3">
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-brand-400">
                    Workspace
                  </span>
                  <span className="rounded-full bg-success-50 px-1.5 py-0.5 font-mono text-[8px] font-bold text-success-600">
                    4/4 Ready
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-2 px-2.5 py-1.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-[8px] font-bold text-brand-700">
                    YW
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[10px] font-bold text-brand-950 leading-tight">
                      yourwebsite.com
                    </p>
                    <p className="truncate text-[8px] text-brand-500 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                      Sample site
                    </p>
                  </div>
                </div>
              </div>

              {/* Sidebar Navigation */}
              <div className="space-y-1">
                <p className="hidden sm:block px-2 pt-1 font-mono text-[8px] font-bold uppercase tracking-wider text-brand-400">
                  Overview &amp; Search
                </p>
                {[
                  {
                    icon: LayoutGrid,
                    label: "Dashboard",
                    tab: "overview" as const,
                    ready: false,
                  },
                  {
                    icon: Globe,
                    label: "Website Audit",
                    tab: "todos" as const,
                    ready: true,
                  },
                  {
                    icon: TrendingUp,
                    label: "Traffic",
                    tab: "visitors" as const,
                    ready: true,
                  },
                  {
                    icon: Target,
                    label: "Competitor Intel",
                    ready: true,
                  },
                  {
                    icon: Bot,
                    label: "AI Visibility",
                    ready: true,
                  },
                  {
                    icon: Wrench,
                    label: "Fix Engine",
                    tab: "todos" as const,
                    ready: false,
                  },
                ].map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = item.tab ? activeTab === item.tab && item.label === "Dashboard" : false;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => item.tab && setActiveTab(item.tab)}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-full text-[10px] font-semibold transition-colors cursor-pointer text-left",
                        isActive
                          ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                          : "text-brand-600 hover:bg-surface-2 hover:text-brand-950",
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <ItemIcon
                          size={12}
                          className={isActive ? "text-signal-ink shrink-0" : "text-brand-500 shrink-0"}
                        />
                        <span className="hidden sm:inline truncate">{item.label}</span>
                      </span>
                      {item.ready && !isActive && (
                        <span className="hidden sm:flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-success-500/40 bg-success-50 text-success-600">
                          <Check size={8} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom AI Compute Meter */}
            <div className="hidden sm:block mt-4 rounded-xl border border-brand-200 bg-surface-2 p-2.5">
              <div className="flex items-center justify-between text-[9px] font-bold text-brand-900">
                <span>AI Compute</span>
                <span className="font-mono text-brand-700">Sample</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                <div className="h-full w-3/4 rounded-full bg-signal-400" />
              </div>
              <div className="mt-1 flex items-center justify-between text-[8px] text-brand-500">
                <span>Monthly balance</span>
                <span className="font-mono">77%</span>
              </div>
            </div>
          </div>

          {/* Right Main Workspace */}
          <div
            className="flex-1 min-w-0 flex flex-col"
            style={{ background: "var(--color-canvas)" }}
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-brand-200 bg-surface-1">
              {/* Sub-nav Pill Group (Overview / Visitors / To-do list) */}
              <div className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-surface-2 p-0.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={cn(
                    "px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer",
                    activeTab === "overview"
                      ? "bg-signal-400 text-signal-ink font-bold"
                      : "text-brand-600 hover:text-brand-950",
                  )}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("visitors")}
                  className={cn(
                    "px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer",
                    activeTab === "visitors"
                      ? "bg-signal-400 text-signal-ink font-bold"
                      : "text-brand-600 hover:text-brand-950",
                  )}
                >
                  Visitors
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("todos")}
                  className={cn(
                    "px-2.5 py-1 rounded-full font-semibold transition-all cursor-pointer",
                    activeTab === "todos"
                      ? "bg-signal-400 text-signal-ink font-bold"
                      : "text-brand-600 hover:text-brand-950",
                  )}
                >
                  To-do list
                </button>
              </div>

              <span className="rounded-full border border-brand-200 bg-surface-2 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-500">
                Example data
              </span>
            </div>

            {/* Dashboard Inner Content */}
            <div className="p-3.5 sm:p-4 space-y-3">
              {/* Title & Action Row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold tracking-tight text-brand-950 leading-none">
                    Dashboard
                  </h3>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-brand-500">
                    <Globe size={10} className="text-brand-400" />
                    <span>yourwebsite.com &middot; Sample preview</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="hidden sm:inline-flex items-center rounded-full border border-brand-200 bg-surface-1 px-2.5 py-1 text-[9.5px] font-semibold text-brand-800">
                    See improvement plan
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-signal-400 px-2.5 py-1 text-[9.5px] font-bold text-signal-ink shadow-2xs">
                    <RefreshCw size={9} />
                    <span>Check website again</span>
                  </span>
                </div>
              </div>

              {/* TAB 1: OVERVIEW (Matches the user's Dashboard screenshot) */}
              {activeTab === "overview" && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    {/* Left Card: How healthy is your website? */}
                    <div className="sm:col-span-7 rounded-2xl border border-brand-200 bg-surface-1 p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-brand-950">
                            How healthy is your website?
                          </h4>
                          <span className="rounded-full bg-success-50 px-2 py-0.5 text-[9px] font-bold text-success-600">
                            Excellent
                          </span>
                        </div>
                        <p className="mt-1 text-[9.5px] text-brand-500 leading-relaxed">
                          A score out of 100 for how easily Google can find, read and show your pages.
                        </p>
                      </div>

                      <div className="my-3 grid grid-cols-3 gap-2">
                        <div>
                          <p className="font-mono text-[8px] font-bold uppercase tracking-wider text-brand-400">
                            Health Score
                          </p>
                          <p className="mt-0.5 text-xl font-black text-brand-950 leading-none">
                            94
                            <span className="text-[10px] font-normal text-brand-400">/100</span>
                          </p>
                          <p className="text-[8px] font-semibold text-brand-400 mt-0.5">
                            Example
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[8px] font-bold uppercase tracking-wider text-brand-400">
                            Problems to Fix
                          </p>
                          <p className="mt-0.5 text-xl font-black text-brand-950 leading-none">
                            13
                          </p>
                          <p className="text-[8px] font-semibold text-brand-400 mt-0.5">
                            Sample
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[8px] font-bold uppercase tracking-wider text-brand-400">
                            Pages Checked
                          </p>
                          <p className="mt-0.5 text-xl font-black text-brand-950 leading-none">
                            42
                          </p>
                          <p className="text-[8px] font-semibold text-brand-400 mt-0.5">
                            Sample
                          </p>
                        </div>
                      </div>

                      <div>
                        {/* Severity Bar */}
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                          <div className="h-full w-[18%] bg-warning-500" />
                          <div className="h-full w-[38%] bg-accent-500" />
                          <div className="h-full w-[44%] bg-brand-300" />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[8.5px] text-brand-500">
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-error-500" />
                            Urgent <strong className="text-brand-900">0</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-warning-500" />
                            Important <strong className="text-brand-900">11</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                            Moderate <strong className="text-brand-900">45</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
                            Minor <strong className="text-brand-900">72</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Card: Visitors from Google */}
                    <div className="sm:col-span-5 rounded-2xl border border-brand-200 bg-surface-1 p-3.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-brand-950">
                            Visitors from Google
                          </h4>
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-brand-200 bg-surface-2 text-brand-500">
                            <ArrowUpRight size={10} />
                          </span>
                        </div>
                        <p className="mt-0.5 text-[9px] text-brand-500">
                          Last 28 days &middot; Sample search traffic
                        </p>

                        <div className="mt-2.5">
                          <p className="font-mono text-[8px] font-bold uppercase tracking-wider text-brand-400">
                            Clicks from Google
                          </p>
                          <div className="mt-0.5 flex items-baseline gap-1.5">
                            <span className="text-xl font-black text-brand-950 leading-none">
                              48
                            </span>
                            <span className="text-[9px] font-bold text-success-500">
                              Example
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bar Chart (Matches the Dashboard's Daily Activity chart) */}
                      <div className="my-2.5">
                        <div className="flex items-center justify-between text-[8px] font-mono uppercase text-brand-400 mb-1">
                          <span>Daily Activity</span>
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-brand-600">
                            Sample chart
                          </span>
                        </div>
                        <div className="flex h-12 items-end gap-1 border-b border-brand-200 pb-1">
                          {[15, 22, 18, 42, 30, 25, 55, 48, 72, 95, 78, 68].map((h, i) => (
                            <div
                              key={i}
                              className={cn(
                                "flex-1 rounded-t-xs transition-all",
                                h > 40 ? "bg-signal-400" : "bg-brand-200",
                              )}
                              style={{ height: `${h}%` }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Metric Switcher Pills */}
                      <div className="grid grid-cols-4 gap-1 rounded-full border border-brand-200 bg-surface-2 p-0.5 text-center text-[8.5px] font-semibold">
                        <span className="rounded-full bg-signal-400 py-0.5 font-bold text-signal-ink">
                          Clicks
                        </span>
                        <span className="py-0.5 text-brand-500">Seen</span>
                        <span className="py-0.5 text-brand-500">Visits</span>
                        <span className="py-0.5 text-brand-500">Goals</span>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Card: Your to-do list */}
                  <div className="rounded-2xl border border-brand-200 bg-surface-1 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-brand-950">
                          Your to-do list
                        </h4>
                        <span className="rounded-full border border-brand-200 bg-surface-2 px-2 py-0.5 text-[8.5px] font-semibold text-brand-600">
                          5 prioritized
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[8.5px] font-semibold">
                        <span className="rounded-full bg-signal-400 px-2 py-0.5 font-bold text-signal-ink">
                          All 5
                        </span>
                        <span className="rounded-full border border-brand-200 bg-surface-2 px-2 py-0.5 text-brand-500">
                          Important 2
                        </span>
                        <span className="rounded-full border border-brand-200 bg-surface-2 px-2 py-0.5 text-brand-500">
                          Moderate 2
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-brand-200 bg-surface-2/60 p-2">
                        <p className="font-mono text-[7.5px] font-bold uppercase tracking-wider text-brand-400">
                          Action Queue
                        </p>
                        <p className="mt-0.5 text-[10px] font-bold text-brand-950 truncate">
                          5 defects prioritized
                        </p>
                      </div>
                      <div className="rounded-xl border border-brand-200 bg-surface-2/60 p-2">
                        <p className="font-mono text-[7.5px] font-bold uppercase tracking-wider text-brand-400">
                          Audit Scope
                        </p>
                        <p className="mt-0.5 text-[10px] font-bold text-brand-950 truncate">
                          42 pages checked
                        </p>
                      </div>
                      <div className="rounded-xl border border-brand-200 bg-surface-2/60 p-2">
                        <p className="font-mono text-[7.5px] font-bold uppercase tracking-wider text-brand-400">
                          Fix Engine
                        </p>
                        <p className="mt-0.5 text-[10px] font-bold text-success-500 truncate">
                          4 PRs ready
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* TAB 2: VISITORS & AI VISIBILITY */}
              {activeTab === "visitors" && (
                <div className="rounded-2xl border border-brand-200 bg-surface-1 p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-brand-950">
                        Search &amp; AI Visibility Breakdown
                      </h4>
                      <p className="text-[9.5px] text-brand-500">
                        Measured across Google Search, ChatGPT, Perplexity, Gemini &amp; Claude
                      </p>
                    </div>
                    <span className="rounded-full bg-surface-2 border border-brand-200 px-2 py-0.5 text-[9px] font-bold text-brand-600">
                      Sample
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    {[
                      { name: "ChatGPT", val: "46%", sub: "12/26 queries" },
                      { name: "Perplexity", val: "52%", sub: "14/26 queries" },
                      { name: "Gemini", val: "38%", sub: "10/26 queries" },
                      { name: "Claude", val: "35%", sub: "9/26 queries" },
                    ].map((engine) => (
                      <div
                        key={engine.name}
                        className="rounded-xl border border-brand-200 bg-surface-2 p-2.5"
                      >
                        <span className="font-mono text-[8.5px] font-bold uppercase text-brand-500">
                          {engine.name}
                        </span>
                        <p className="mt-1 text-base font-black text-brand-950">
                          {engine.val}
                        </p>
                        <p className="text-[8.5px] text-brand-400">{engine.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: TO-DO LIST & FIX ENGINE */}
              {activeTab === "todos" && (
                <div className="rounded-2xl border border-brand-200 bg-surface-1 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-brand-950">
                      3 fixes prepared for your approval
                    </h4>
                    <span className="text-[9px] font-mono font-semibold text-brand-500">
                      Opens GitHub PR
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { title: "Product JSON-LD schema markup", risk: "Low risk", tag: "Pull request" },
                      { title: "Canonical tag cleanup across pages", risk: "Low risk", tag: "Pull request" },
                      { title: "H1–H2 heading hierarchy on 4 pages", risk: "You review", tag: "Pull request" },
                    ].map((fix) => (
                      <div
                        key={fix.title}
                        className="rounded-xl border border-brand-200 bg-surface-2 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-[11px] font-bold text-brand-950">{fix.title}</p>
                          <span className="font-mono text-[9px] text-brand-500">{fix.tag}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[9.5px] font-bold text-success-500">
                            {fix.risk}
                          </span>
                          <Link
                            href="/login"
                            className="rounded-full bg-signal-400 px-2.5 py-1 text-[9px] font-bold text-signal-ink hover:bg-signal-500"
                          >
                            Review
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
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
    <section className="relative lg:min-h-[calc(100vh-4rem)] flex items-start lg:items-center pt-24 pb-16 lg:pt-28 lg:pb-20 border-b border-brand-200 overflow-hidden">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-4">
        <div className="grid lg:grid-cols-[45%_55%] gap-8 lg:gap-10 items-center">
          {/* LEFT COLUMN */}
          <div className="space-y-5 lg:space-y-6">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-surface-1 border border-brand-200 text-brand-700 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full shadow-2xs">
              <div className="w-2 h-2 rounded-full bg-signal-400" />
              SEO, AI SEARCH AND GOOGLE MAPS, IN ONE QUEUE
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-[46px] font-extrabold text-brand-950 leading-[1.1] tracking-tight">
                Find what&apos;s costing you customers.
                <span className="block text-signal-400 mt-1.5">
                  Fix it before your competitors do.
                </span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-brand-500 leading-relaxed max-w-xl">
              Reigel crawls your site, watches your rivals and asks ChatGPT, Claude, Gemini, Perplexity and Sarvam about you. It ranks what to fix, opens the pull request, and checks the fix worked. Built for agencies and business owners.
            </p>

            {/* URL Box CTA */}
            <div className="space-y-3 pt-1">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = (e.currentTarget.elements.namedItem("url") as HTMLInputElement)?.value?.trim() ?? "";
                  if (input) {
                    try {
                      localStorage.setItem("growthx_pending_domain", input);
                    } catch {}
                  }
                  const clean = input ? encodeURIComponent(input) : "";
                  window.location.href = signedIn
                    ? clean ? `/analyze?url=${clean}` : "/analyze"
                    : clean ? `/login?url=${clean}` : "/login";
                }}
                className="flex flex-col sm:flex-row items-stretch gap-2 bg-surface-1 border border-brand-200 focus-within:border-brand-400 p-1.5 rounded-2xl shadow-card transition-all max-w-md"
              >
                <input
                  name="url"
                  type="text"
                  placeholder="yourwebsite.com"
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm font-medium text-brand-950 placeholder-brand-400 outline-none focus:outline-none focus:ring-0"
                  style={{ outline: "none", boxShadow: "none" }}
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-signal-400 hover:bg-signal-500 active:scale-[0.98] text-signal-ink font-extrabold text-sm px-6 py-2.5 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <span>Run free audit</span>
                  <ArrowRight size={14} />
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-between gap-2 max-w-md px-1 text-xs text-brand-500">
                <p className="flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-success-500" />
                  Free account &middot; No card needed &middot; Audit ready in minutes
                </p>
                <Link
                  href="/login"
                  className="text-brand-900 hover:text-brand-950 font-bold underline decoration-signal-400 underline-offset-4 transition-colors"
                >
                  Already a customer? Log in &rarr;
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Real Reigel Dashboard Preview */}
          <div className="relative flex justify-center lg:justify-end">
            <DashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
