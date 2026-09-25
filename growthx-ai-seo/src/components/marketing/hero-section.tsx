"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Zap,
  Globe,
  Swords,
} from "lucide-react";
import { auth } from "@/lib/api-client";

function BattlegroundMockup() {
  const [countered, setCountered] = useState(false);

  return (
    <div className="relative select-none w-full max-w-[530px] mx-auto lg:mr-2">
      {/* Background ambient glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-series-6/30 via-series-6/20 to-accent-500/30 rounded-3xl blur-xl opacity-70 pointer-events-none" />

      {/* Main Container */}
      <div className="relative bg-brand-900/90 border border-brand-800 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl text-white space-y-4">
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3.5 border-b border-brand-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-series-6/20 border border-series-6/40 flex items-center justify-center text-series-400">
              <Swords size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-300">Live Battleground</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-500/10 text-success-400 border border-success-500/30">
                  Updated today
                </span>
              </div>
              <p className="text-[11px] text-brand-400 font-mono mt-0.5">yoursite.com vs competitor.com</p>
            </div>
          </div>
          <span className="text-[11px] text-brand-400 font-semibold hidden sm:inline">Active match</span>
        </div>

        {/* Head-to-Head Comparison Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* SEO Health */}
          <div className="bg-brand-950/70 border border-brand-800/80 rounded-2xl p-3 text-center space-y-1">
            <p className="text-[10px] uppercase font-bold text-brand-400">SEO Health</p>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-lg font-black text-success-400">78%</span>
              <span className="text-xs text-brand-500">vs</span>
              <span className="text-sm font-semibold text-brand-400">64%</span>
            </div>
            <p className="text-[10px] font-medium text-success-400/90">+14% edge</p>
          </div>

          {/* AI Answer Share */}
          <div className="bg-brand-950/70 border border-brand-800/80 rounded-2xl p-3 text-center space-y-1">
            <p className="text-[10px] uppercase font-bold text-brand-400">AI Answer Share</p>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-lg font-black text-series-400">42%</span>
              <span className="text-xs text-brand-500">vs</span>
              <span className="text-sm font-semibold text-brand-400">28%</span>
            </div>
            <p className="text-[10px] font-medium text-series-400/90">+14% citations</p>
          </div>

          {/* Open Issues */}
          <div className="bg-brand-950/70 border border-brand-800/80 rounded-2xl p-3 text-center space-y-1">
            <p className="text-[10px] uppercase font-bold text-brand-400">Open Issues</p>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-lg font-black text-white">14</span>
              <span className="text-xs text-brand-500">vs</span>
              <span className="text-sm font-semibold text-error-400">31</span>
            </div>
            <p className="text-[10px] font-medium text-success-400/90">55% cleaner</p>
          </div>
        </div>

        {/* This Week's Move Card */}
        <div className="bg-gradient-to-br from-brand-950 via-brand-950/90 to-brand-900 border border-series-6/30 rounded-2xl p-4 space-y-3 relative overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-warning-400 bg-warning-500/10 px-2 py-0.5 rounded-full border border-warning-500/20">
                  <Zap size={11} className="fill-warning-400 text-warning-400" />
                  This week&apos;s move
                </span>
                <span className="text-[10px] text-brand-400 font-medium">3 days ago</span>
              </div>
              <p className="text-xs sm:text-[13px] font-semibold text-white leading-snug">
                Rival added 3 product schema pages for &ldquo;A2 Desi Cow Ghee&rdquo;
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-bold text-success-400 bg-success-500/10 px-2.5 py-1 rounded-lg border border-success-500/20 block">
                +₹18,500/mo
              </span>
              <span className="text-[10px] text-brand-400 block mt-0.5">Est. value</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1 border-t border-brand-800/60">
            <span className="text-[11px] text-brand-300">
              {countered
                ? "✓ Counter-strategy drafted and ready in Fix Engine"
                : "Counter-play ready to deploy: Product Schema + FAQ"}
            </span>
            <button
              type="button"
              onClick={() => setCountered(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                countered
                  ? "bg-success-600 text-white cursor-default"
                  : "bg-series-6 hover:bg-series-6/90 text-white cursor-pointer active:scale-95"
              }`}
            >
              {countered ? "Countered" : "Counter"}
              {!countered && <ArrowRight size={12} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    setLoading(true);
    const destination = auth.isAuthenticated() ? "/dashboard" : "/register";
    if (trimmed) {
      const clean = trimmed.replace(/^https?:\/\//i, "");
      router.push(`${destination}?url=${encodeURIComponent(clean)}`);
    } else {
      router.push(destination);
    }
  };

  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center bg-brand-950 pt-24 pb-16 lg:pt-32 lg:pb-24 border-b border-brand-900 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-series-6/15 blur-[140px]" />
        <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full bg-accent-600/10 blur-[130px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-[50%_50%] gap-10 lg:gap-12 items-center">
          {/* LEFT COLUMN: Copy & Primary CTA */}
          <div className="space-y-6">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 bg-brand-900/90 border border-brand-800 text-brand-300 text-[11px] font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-series-6 animate-pulse" />
              AI SEO + GOOGLE BUSINESS PROFILE, ON AUTOPILOT
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-[46px] font-extrabold text-white leading-[1.12] tracking-tight">
              Find what&apos;s costing you customers.{" "}
              <span className="bg-gradient-to-r from-series-6 to-accent-400 bg-clip-text text-transparent">
                Fix it before your competitors do.
              </span>
            </h1>

            {/* Subhead */}
            <p className="text-base sm:text-lg text-brand-400 leading-relaxed max-w-xl">
              GrowthX crawls your website, tracks your rivals and checks how AI assistants talk about you.
              Then it writes and ships the fixes, and proves they worked.
            </p>

            {/* Primary CTA: URL Audit Box */}
            <div className="space-y-2.5 max-w-xl">
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch gap-2 bg-brand-900/90 border border-brand-800 rounded-2xl p-2 shadow-2xl focus-within:border-series-6 transition-colors">
                <div className="flex items-center gap-2.5 px-3 py-2 flex-1">
                  <Globe size={18} className="text-brand-400 shrink-0" />
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="yourwebsite.com"
                    className="bg-transparent text-white placeholder-brand-500 text-sm font-medium w-full focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center gap-2 bg-series-6 hover:bg-series-6/90 active:scale-[0.98] text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all shadow-lg shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <span>Opening…</span>
                  ) : (
                    <>
                      <span>Run free audit</span>
                      <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              {/* Microcopy & Secondary link */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-brand-400">
                <span className="font-medium">Free · No card needed · Results in about 60 seconds</span>
                <Link
                  href="/login"
                  className="font-semibold text-series-400 hover:text-series-300 transition-colors inline-flex items-center gap-1"
                >
                  Already a customer? Log in →
                </Link>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Hero Battleground Visual */}
          <div className="relative flex justify-center lg:justify-end">
            <BattlegroundMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
