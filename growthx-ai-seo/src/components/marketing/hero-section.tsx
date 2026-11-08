"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { auth, subscribeToAuthChange } from "@/lib/api-client";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Coins,
  Globe,
  LayoutGrid,
  Search,
  Sun,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

function DashboardMockup() {
  const [activeTab, setActiveTab] = useState<"overview" | "ai" | "fixes">("overview");

  return (
    <div className="relative select-none w-full max-w-[620px] mx-auto lg:mr-0">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute -inset-2 rounded-3xl opacity-40 blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(212, 255, 0, 0.15) 0%, rgba(212, 255, 0, 0.03) 50%, transparent 80%)",
        }}
      />

      {/* Main Window */}
      <div className="relative rounded-2xl sm:rounded-3xl border border-brand-200 bg-surface-1 shadow-2xl overflow-hidden">
        {/* macOS Window Chrome Top Bar */}
        <div className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 border-b border-brand-200 bg-surface-1">
          {/* Window control dots */}
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-error-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning-500/80 inline-block" />
            <span className="h-2.5 w-2.5 rounded-full bg-success-500/80 inline-block" />
          </div>

          {/* Breadcrumb / Workspace Pill */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-brand-500">
            <span className="font-bold text-brand-950">reigel.in</span>
            <span>/</span>
            <span className="text-brand-700">yourwebsite.com</span>
          </div>

          {/* Credits + Single Theme Toggle */}
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-surface-2 px-2 py-0.5 text-[10px] font-mono font-bold text-brand-950">
              <Coins size={10} className="text-signal-400 shrink-0" />
              <span>4.985M Credits</span>
            </span>
            <span className="flex h-5 w-5 items-center justify-center rounded-md border border-brand-200 bg-surface-2 text-brand-500">
              <Sun size={10} />
            </span>
          </div>
        </div>

        {/* Dashboard Body: Sidebar + Workspace */}
        <div className="flex">
          {/* Streamlined Sidebar */}
          <div className="w-12 sm:w-44 bg-surface-1 p-2 sm:p-3 shrink-0 flex flex-col justify-between border-r border-brand-200">
            <div className="space-y-3">
              {/* Workspace Badge */}
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-2 p-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface-3 font-mono text-[9px] font-bold text-brand-800">
                  YW
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-brand-950 leading-tight">
                    yourwebsite.com
                  </p>
                  <p className="truncate text-[9px] text-brand-500 flex items-center gap-1 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success-500 inline-block" />
                    4/4 Ready
                  </p>
                </div>
              </div>

              {/* Navigation Items */}
              <div className="space-y-0.5">
                {[
                  { id: "overview" as const, label: "Dashboard", icon: LayoutGrid },
                  { id: "overview" as const, label: "Website Audit", icon: Globe },
                  { id: "overview" as const, label: "Organic Search", icon: Search },
                  { id: "ai" as const, label: "AI Visibility", icon: Bot },
                  { id: "fixes" as const, label: "Fix Engine", icon: Wrench },
                ].map((item) => {
                  const ItemIcon = item.icon;
                  const isCurrent = activeTab === item.id;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer text-left",
                        isCurrent
                          ? "bg-surface-2 text-brand-950 font-bold border border-brand-200/80 shadow-2xs"
                          : "text-brand-600 hover:bg-surface-2 hover:text-brand-950",
                      )}
                    >
                      <span className="relative flex items-center justify-center shrink-0">
                        <ItemIcon
                          size={13}
                          className={isCurrent ? "text-brand-950" : "text-brand-400"}
                        />
                        {isCurrent && (
                          <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 h-2.5 w-0.5 rounded-full bg-signal-400 hidden sm:block" />
                        )}
                      </span>
                      <span className="hidden sm:inline truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom mini indicator */}
            <div className="hidden sm:block pt-2 border-t border-brand-200/60">
              <div className="flex items-center justify-between text-[9px] font-mono text-brand-500 px-1">
                <span>Crawl status</span>
                <span className="font-bold text-success-500">Synced</span>
              </div>
            </div>
          </div>

          {/* Right Main Panel */}
          <div
            className="flex-1 min-w-0 flex flex-col p-3 sm:p-4 space-y-3"
            style={{ background: "var(--color-canvas)" }}
          >
            {/* Tab Controls & Time Filter */}
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-surface-2 p-0.5 text-[10.5px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={cn(
                    "px-3 py-1 rounded-full font-semibold transition-all cursor-pointer",
                    activeTab === "overview"
                      ? "bg-surface-1 text-brand-950 font-bold shadow-2xs"
                      : "text-brand-600 hover:text-brand-950",
                  )}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ai")}
                  className={cn(
                    "px-3 py-1 rounded-full font-semibold transition-all cursor-pointer",
                    activeTab === "ai"
                      ? "bg-surface-1 text-brand-950 font-bold shadow-2xs"
                      : "text-brand-600 hover:text-brand-950",
                  )}
                >
                  AI Visibility
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("fixes")}
                  className={cn(
                    "px-3 py-1 rounded-full font-semibold transition-all cursor-pointer",
                    activeTab === "fixes"
                      ? "bg-surface-1 text-brand-950 font-bold shadow-2xs"
                      : "text-brand-600 hover:text-brand-950",
                  )}
                >
                  Fix Engine
                </button>
              </div>

              <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-brand-200 bg-surface-1 px-2.5 py-0.5 font-mono text-[9.5px] font-semibold text-brand-600">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-400" />
                Live 28d
              </span>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="space-y-2.5">
                {/* Metric Row: Health & Defects */}
                <div className="rounded-2xl border border-brand-200 bg-surface-1 p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-400">
                        Website Health Score
                      </p>
                      <div className="mt-0.5 flex items-baseline gap-2">
                        <span className="text-2xl sm:text-3xl font-black text-brand-950 tracking-tight leading-none">
                          94
                        </span>
                        <span className="text-[11px] font-semibold text-brand-500">
                          / 100
                        </span>
                        <span className="rounded-full bg-success-50 px-2 py-0.5 text-[9.5px] font-bold text-success-600">
                          Excellent
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-400">
                        Audit Scope
                      </p>
                      <p className="mt-0.5 text-xs font-bold text-brand-950">
                        42 pages crawled
                      </p>
                      <p className="text-[9.5px] text-brand-500">0 critical errors</p>
                    </div>
                  </div>

                  {/* Clean Visual Health Breakdown Bar */}
                  <div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full w-[82%] bg-signal-400" />
                      <div className="h-full w-[12%] bg-warning-500" />
                      <div className="h-full w-[6%] bg-brand-300" />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[9px] text-brand-500">
                      <span className="flex items-center gap-1 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-signal-400 inline-block" />
                        Healthy Pages (82%)
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning-500 inline-block" />
                        Minor Fixes (12%)
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-400 inline-block" />
                        Notices (6%)
                      </span>
                    </div>
                  </div>
                </div>

                {/* AI Engine Visibility Quick Breakdown */}
                <div className="rounded-2xl border border-brand-200 bg-surface-1 p-3.5 space-y-2 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-brand-950">
                        AI Recommendation Share
                      </h4>
                      <p className="text-[9.5px] text-brand-500">
                        Brand citations in LLM purchase recommendations
                      </p>
                    </div>
                    <span className="rounded-full bg-surface-2 border border-brand-200 px-2 py-0.5 text-[9.5px] font-bold text-brand-950 font-mono">
                      52% avg
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {[
                      { name: "ChatGPT", pct: "46%", width: "46%" },
                      { name: "Perplexity", pct: "52%", width: "52%" },
                      { name: "Gemini", pct: "38%", width: "38%" },
                      { name: "Claude", pct: "35%", width: "35%" },
                    ].map((model) => (
                      <div
                        key={model.name}
                        className="rounded-xl border border-brand-200 bg-surface-2 p-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[8.5px] font-bold text-brand-500">
                            {model.name}
                          </span>
                          <span className="text-[11px] font-black text-brand-950">
                            {model.pct}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full rounded-full bg-surface-3 overflow-hidden">
                          <div
                            className="h-full bg-signal-400 rounded-full"
                            style={{ width: model.width }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fix Engine 1-Click PR Card */}
                <div className="rounded-2xl border border-brand-200 bg-surface-1 p-3 sm:p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-success-50 border border-success-500/20 px-1.5 py-0.5 text-[9px] font-mono font-bold text-success-600">
                        <CheckCircle2 size={9} />
                        PR Ready
                      </span>
                      <p className="text-[11px] font-bold text-brand-950 truncate">
                        Product JSON-LD schema markup
                      </p>
                    </div>
                    <p className="text-[9.5px] text-brand-500 truncate">
                      Auto-generated &amp; validated for Google Rich Results
                    </p>
                  </div>

                  <Link
                    href="/login"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-signal-400 hover:bg-signal-500 px-3 py-1.5 text-[10px] font-extrabold text-signal-ink shadow-xs transition-all active:scale-95"
                  >
                    <span>Merge PR</span>
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            )}

            {/* TAB 2: AI VISIBILITY DETAIL */}
            {activeTab === "ai" && (
              <div className="rounded-2xl border border-brand-200 bg-surface-1 p-3.5 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-brand-950">
                      Sampled AI Answer References
                    </h4>
                    <p className="text-[9.5px] text-brand-500">
                      Real-time queries tested across 4 major AI engines
                    </p>
                  </div>
                  <span className="rounded-full bg-success-50 px-2 py-0.5 text-[9px] font-bold text-success-600">
                    Active Scan
                  </span>
                </div>

                <div className="space-y-1.5">
                  {[
                    {
                      query: "Which suppliers deliver fastest in our region?",
                      status: "Recommended #1",
                      engines: "ChatGPT · Perplexity",
                    },
                    {
                      query: "Best wholesale enterprise supplier options",
                      status: "Brand Cited",
                      engines: "Gemini · Claude",
                    },
                    {
                      query: "Verified manufacturer customer reviews & pricing",
                      status: "Full Profile",
                      engines: "All 4 Engines",
                    },
                  ].map((item) => (
                    <div
                      key={item.query}
                      className="rounded-xl border border-brand-200 bg-surface-2 p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-bold text-brand-950 truncate">
                          &ldquo;{item.query}&rdquo;
                        </p>
                        <p className="text-[9px] font-mono text-brand-500">
                          {item.engines}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-brand-200 bg-surface-1 px-2 py-0.5 text-[9px] font-bold text-success-600">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: FIX ENGINE DETAIL */}
            {activeTab === "fixes" && (
              <div className="rounded-2xl border border-brand-200 bg-surface-1 p-3.5 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-brand-950">
                      Autonomous Fix Engine
                    </h4>
                    <p className="text-[9.5px] text-brand-500">
                      3 code pull requests generated and verified
                    </p>
                  </div>
                  <span className="font-mono text-[9px] font-bold text-signal-400">
                    GitHub Connected
                  </span>
                </div>

                <div className="space-y-1.5">
                  {[
                    {
                      title: "Add Product & Merchant Schema markup",
                      branch: "reigel/fix-schema",
                      impact: "+18 Health",
                    },
                    {
                      title: "Resolve duplicate canonical tags on 4 pages",
                      branch: "reigel/canonical-clean",
                      impact: "+9 Health",
                    },
                    {
                      title: "Generate missing OpenGraph & Twitter tags",
                      branch: "reigel/social-meta",
                      impact: "+6 Health",
                    },
                  ].map((fix) => (
                    <div
                      key={fix.title}
                      className="rounded-xl border border-brand-200 bg-surface-2 p-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[10.5px] font-bold text-brand-950 truncate">
                          {fix.title}
                        </p>
                        <p className="text-[9px] font-mono text-brand-500">
                          {fix.branch} &middot;{" "}
                          <span className="text-success-500 font-bold">
                            {fix.impact}
                          </span>
                        </p>
                      </div>
                      <Link
                        href="/login"
                        className="shrink-0 rounded-lg bg-surface-1 hover:bg-surface-3 border border-brand-200 px-2.5 py-1 text-[9.5px] font-bold text-brand-950 transition-colors"
                      >
                        Review
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
