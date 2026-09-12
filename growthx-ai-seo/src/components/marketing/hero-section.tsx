"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Play,
  CheckCircle,
  TrendingUp,
  Globe,
  Sparkles,
  Wrench,
  Search,
} from "lucide-react";

function normalizeUrl(value: string) {
  if (!value.startsWith("http")) return `https://${value}`;
  return value;
}

function CompactDashboardMockup() {
  return (
    <div className="relative w-full max-w-md mx-auto select-none">
      {/* Floating Badge Top Left */}
      <div className="absolute -left-3 -top-2 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-slate-100 px-3 py-1.5 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
          <Globe size={13} className="text-blue-600" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-900 leading-tight">Website Audit</p>
          <p className="text-[9px] text-slate-500 leading-tight">Instant crawl &amp; diagnostics</p>
        </div>
      </div>

      {/* Floating Badge Top Right */}
      <div className="absolute -right-3 -top-2 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-slate-100 px-3 py-1.5 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
          <TrendingUp size={13} className="text-amber-600" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-900 leading-tight">Competitor Intel</p>
          <p className="text-[9px] text-slate-500 leading-tight">3 direct rivals mapped</p>
        </div>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden mt-6">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900">
              Growth<span className="text-violet-600">X</span>
            </span>
            <span className="text-[10px] text-slate-400 font-mono">app.growthx.ai</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "SEO Health", val: "68", change: "+12%", col: "text-blue-600" },
              { label: "AI Visibility", val: "52", change: "+28%", col: "text-violet-600" },
              { label: "Organic Traffic", val: "12.4K", change: "+22%", col: "text-emerald-600" },
              { label: "Rank Keywords", val: "1,240", change: "+18%", col: "text-amber-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-slate-50 rounded-lg p-2 text-center">
                <p className="text-[8px] text-slate-500 font-medium truncate">{kpi.label}</p>
                <p className={`text-sm font-extrabold ${kpi.col} leading-none mt-0.5`}>{kpi.val}</p>
                <p className="text-[8px] text-emerald-600 font-semibold mt-0.5">{kpi.change}</p>
              </div>
            ))}
          </div>

          {/* Action item preview */}
          <div className="bg-violet-50/80 rounded-xl p-3 border border-violet-100">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-violet-950 flex items-center gap-1">
                <Wrench size={11} className="text-violet-600" />
                30-Day Fix Engine
              </span>
              <span className="text-[9px] font-bold text-violet-700 bg-violet-200/60 px-1.5 py-0.5 rounded">
                Active Execution
              </span>
            </div>
            <p className="text-[9px] text-violet-700 mb-1.5">
              12 of 38 automated fixes completed
            </p>
            <div className="w-full bg-violet-200/80 rounded-full h-1.5">
              <div className="bg-violet-600 h-1.5 rounded-full" style={{ width: "38%" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Badge Bottom Left */}
      <div className="absolute -left-3 -bottom-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-slate-100 px-3 py-1.5 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
          <Sparkles size={13} className="text-violet-600" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-900 leading-tight">AI Visibility</p>
          <p className="text-[9px] text-slate-500 leading-tight">ChatGPT &amp; Perplexity share</p>
        </div>
      </div>

      {/* Floating Badge Bottom Right */}
      <div className="absolute -right-3 -bottom-3 z-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-md border border-slate-100 px-3 py-1.5 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
          <Wrench size={13} className="text-emerald-600" />
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-900 leading-tight">Fix Engine</p>
          <p className="text-[9px] text-slate-500 leading-tight">Zero-code implementation</p>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  const router = useRouter();
  const [targetUrl, setTargetUrl] = useState("");

  const handleQuickAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = targetUrl.trim();
    if (!clean) {
      router.push("/analyze");
      return;
    }
    router.push(`/analyze/progress?url=${encodeURIComponent(normalizeUrl(clean))}`);
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50/80 via-white to-violet-50/20 pt-20 pb-8 sm:pb-10 border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-[54%_46%] gap-8 lg:gap-10 items-center">
          {/* Left Column */}
          <div className="space-y-4">
            {/* Pill Tag */}
            <div className="inline-flex items-center gap-2 bg-violet-50 border border-violet-200/70 text-violet-700 text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-600 animate-pulse" />
              AI-Powered SEO &amp; GEO Automation
            </div>

            {/* Headline */}
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-slate-900 leading-[1.12] tracking-tight">
                Turn Search &amp; AI Visibility into{" "}
                <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  Real Business Growth
                </span>
              </h1>
            </div>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-lg">
              GrowthX crawls your website, uncovers competitor search gaps, audits AI visibility (ChatGPT, Perplexity), and automatically implements a prioritized 30-day fix plan.
            </p>

            {/* Direct Quick URL Analyzer Bar */}
            <form
              onSubmit={handleQuickAnalyze}
              className="flex flex-col sm:flex-row items-stretch gap-2 max-w-lg bg-white p-1.5 rounded-2xl border border-slate-200 shadow-md focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all"
            >
              <div className="flex-1 flex items-center gap-2 px-3 py-1.5">
                <Globe size={16} className="text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="Enter your website URL (e.g. acme.com)"
                  className="w-full text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-violet-600 hover:bg-violet-700 active:scale-[0.98] shadow-md shadow-violet-200 transition-all cursor-pointer shrink-0"
              >
                <span>Analyze Website</span>
                <ArrowRight size={14} />
              </button>
            </form>

            {/* Trust Signals */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
              {["Free instant scan", "No credit card needed", "Ready in 60 seconds"].map((sig) => (
                <div key={sig} className="flex items-center gap-1.5">
                  <CheckCircle size={13} className="text-emerald-500 shrink-0" />
                  <span>{sig}</span>
                </div>
              ))}
              <Link
                href="/dashboard"
                className="text-violet-600 hover:text-violet-700 font-semibold underline underline-offset-2 ml-auto sm:ml-0"
              >
                Explore Demo Dashboard →
              </Link>
            </div>
          </div>

          {/* Right Column: Compact Mockup */}
          <div className="relative pt-4 pb-4 lg:py-2">
            <CompactDashboardMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
