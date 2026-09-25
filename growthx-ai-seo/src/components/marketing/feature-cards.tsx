"use client";

import Link from "next/link";
import { Globe, Trophy, Sparkles, Wrench, MapPin } from "lucide-react";

export function FeatureCards() {
  return (
    <section className="py-24 bg-brand-950 border-t border-brand-900 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-series-6/5 blur-[140px] rounded-full" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-series-6 mb-3">
            One platform. Five jobs done.
          </p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Find what&apos;s costing you traffic.<br />
            <span className="text-series-6">Let GrowthX ship the fix.</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-brand-400 leading-relaxed">
            From technical site audits and rival intelligence to AI citations and map rankings — all in one platform that writes and ships the work.
          </p>
        </div>

        {/* Top Row: 2 Flagship Foundation Engines (Audit & Fix Engine) */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* 1. Website Audit */}
          <div className="group bg-brand-900/40 border border-brand-850 hover:border-brand-700 hover:bg-brand-900/60 rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-brand-900 border border-brand-800 flex items-center justify-center shadow-inner">
                  <Globe size={20} className="text-accent-400" />
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-brand-400 bg-brand-950 px-2 py-0.5 rounded border border-brand-800">
                  WEBSITE AUDIT
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white leading-snug">
                  See your site the way Google does.
                </h3>
                <p className="text-xs sm:text-sm text-brand-400 leading-relaxed mt-1.5">
                  Our headless crawler loads every page like Googlebot. It checks speed, indexing, schema and content, then ranks the issues by how much they cost you.
                </p>
              </div>

              {/* Visual Widget: Crawl Health & Diagnostics */}
              <div className="bg-brand-950/80 rounded-xl border border-brand-800/80 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-brand-300">
                    <span className="w-2 h-2 rounded-full bg-success-400 animate-pulse" />
                    <span className="font-mono text-[10px]">Googlebot Mobile / 200 OK</span>
                  </div>
                  <span className="font-extrabold text-success-400 bg-success-500/10 border border-success-500/20 px-2 py-0.5 rounded text-[10px]">
                    Health 96/100
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-brand-900 text-center font-mono text-[10px]">
                  <div className="bg-brand-900/60 rounded-lg p-2 border border-brand-850">
                    <span className="text-brand-400 block text-[9px] mb-0.5">TTFB</span>
                    <span className="font-bold text-white text-xs">142ms</span>
                  </div>
                  <div className="bg-brand-900/60 rounded-lg p-2 border border-brand-850">
                    <span className="text-brand-400 block text-[9px] mb-0.5">Core Web Vitals</span>
                    <span className="font-bold text-success-400 text-xs">Pass</span>
                  </div>
                  <div className="bg-brand-900/60 rounded-lg p-2 border border-brand-850">
                    <span className="text-brand-400 block text-[9px] mb-0.5">Indexability</span>
                    <span className="font-bold text-white text-xs">100%</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-800/60">
                Server speed &amp; canonicals · Schema checks · Thin content flags
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/website"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-series-6 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>Audit my site</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* 2. Fix Engine */}
          <div className="group bg-brand-900/40 border border-brand-850 hover:border-brand-700 hover:bg-brand-900/60 rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-brand-900 border border-brand-800 flex items-center justify-center shadow-inner">
                  <Wrench size={20} className="text-success-400" />
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-brand-400 bg-brand-950 px-2 py-0.5 rounded border border-brand-800">
                  FIX ENGINE
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white leading-snug">
                  Don&apos;t just find problems. Ship the fix.
                </h3>
                <p className="text-xs sm:text-sm text-brand-400 leading-relaxed mt-1.5">
                  GrowthX writes the actual code or content change. You approve it with one click and it goes live on Next.js, Shopify, WordPress or plain HTML.
                </p>
              </div>

              {/* Visual Widget: Code Diff Preview */}
              <div className="bg-brand-950/80 rounded-xl border border-brand-800/80 p-3.5 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[10px] text-brand-400 pb-1.5 border-b border-brand-900">
                  <span className="text-brand-300">app/layout.tsx</span>
                  <span className="text-success-400 font-bold bg-success-500/10 px-2 py-0.5 rounded border border-success-500/20">
                    PR #42 Ready
                  </span>
                </div>
                <div className="text-[10px] space-y-1">
                  <div className="text-error-400 bg-error-500/10 px-2 py-0.5 rounded truncate">
                    - &lt;meta name=&quot;robots&quot; content=&quot;noindex&quot; /&gt;
                  </div>
                  <div className="text-success-400 bg-success-500/10 px-2 py-0.5 rounded truncate">
                    + &lt;meta name=&quot;robots&quot; content=&quot;index, follow&quot; /&gt;
                  </div>
                </div>
                <div className="flex items-center justify-between text-[9px] text-brand-400 pt-1">
                  <span>1-Click Shopify / GitHub</span>
                  <span className="text-brand-300 font-semibold">100% Verified</span>
                </div>
              </div>

              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-800/60">
                AI-written code &amp; content · Ships as GitHub PR or CMS · Timestamped proof
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/fix-engine"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-success-400 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>See how fixes work</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Row: 3 Market Intelligence Engines (Competitor, AI Search, GBP) */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* 3. Competitor Intelligence */}
          <div className="group bg-brand-900/40 border border-brand-850 hover:border-brand-700 hover:bg-brand-900/60 rounded-2xl p-6 flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-brand-900 border border-brand-800 flex items-center justify-center shadow-inner">
                  <Trophy size={20} className="text-warning-400" />
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-brand-400 bg-brand-950 px-2 py-0.5 rounded border border-brand-800">
                  COMPETITOR INTEL
                </span>
              </div>

              <div>
                <h3 className="text-[15px] font-bold text-white leading-snug">
                  Know every move rivals make. Answer in one click.
                </h3>
                <p className="text-[13px] text-brand-400 leading-relaxed mt-1.5">
                  Track competitor pages, pricing changes, and keyword gains daily with ready counter-moves priced in ₹.
                </p>
              </div>

              {/* Visual Widget: Rival Radar Feed */}
              <div className="bg-brand-950/80 rounded-xl border border-brand-800/80 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold uppercase tracking-wider text-warning-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning-400" />
                    Rival Radar
                  </span>
                  <span className="text-brand-400 font-mono text-[9px]">2h ago</span>
                </div>
                <div className="bg-brand-900/60 rounded-lg p-2 border border-brand-850 space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-white font-mono">rival.com</span>
                    <span className="text-[10px] font-bold text-warning-400">+4 Pages</span>
                  </div>
                  <p className="text-[10px] text-brand-400">Added new pricing &amp; feature comparison guides</p>
                </div>
                <div className="flex items-center justify-between text-[10px] pt-0.5">
                  <span className="text-series-400 font-semibold font-mono">Valued: ₹45,000/mo</span>
                  <span className="text-[9px] bg-series-6/20 text-series-300 border border-series-6/30 px-1.5 py-0.5 rounded font-bold">
                    ⚡ Counter
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-800/60">
                Gaps ranked by ₹ value · Rival Radar feed · Counter button
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/competitor-intelligence"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-warning-400 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>Track my competitors</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* 4. AI Search Visibility */}
          <div className="group bg-brand-900/40 border border-brand-850 hover:border-brand-700 hover:bg-brand-900/60 rounded-2xl p-6 flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-brand-900 border border-brand-800 flex items-center justify-center shadow-inner">
                  <Sparkles size={20} className="text-series-6" />
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-brand-400 bg-brand-950 px-2 py-0.5 rounded border border-brand-800">
                  AI VISIBILITY
                </span>
              </div>

              <div>
                <h3 className="text-[15px] font-bold text-white leading-snug">
                  When customers ask AI, does it recommend you?
                </h3>
                <p className="text-[13px] text-brand-400 leading-relaxed mt-1.5">
                  We query buyer prompts across AI assistants in English and Indian languages to see who gets cited and why.
                </p>
              </div>

              {/* Visual Widget: AI Citation Box */}
              <div className="bg-brand-950/80 rounded-xl border border-brand-800/80 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-brand-300 font-mono truncate">&quot;best platform for...&quot;</span>
                  <span className="bg-series-6/20 text-series-300 border border-series-6/30 text-[9px] font-bold px-1.5 py-0.5 rounded">
                    Cited #1
                  </span>
                </div>
                <div className="bg-brand-900/60 rounded-lg p-2 border border-brand-850 text-[10px] text-brand-300 leading-snug">
                  &quot;<span className="text-white font-bold">yoursite.com</span> was recommended by Perplexity &amp; ChatGPT for fastest response...&quot;
                </div>
                <div className="flex items-center justify-between text-[10px] text-brand-400 font-mono">
                  <span>Share of Voice: <strong className="text-series-300 font-bold">48%</strong></span>
                  <span className="text-brand-400 text-[9px]">vs 18% rival</span>
                </div>
              </div>

              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-800/60">
                Share of AI answers vs rivals · Exact pages cited · Direct fixes
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/ai-visibility"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-series-6 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>Check my AI visibility</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* 5. Google Business Profile */}
          <div className="group bg-brand-900/40 border border-brand-850 hover:border-brand-700 hover:bg-brand-900/60 rounded-2xl p-6 flex flex-col justify-between hover:shadow-2xl transition-all duration-300">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-brand-900 border border-brand-800 flex items-center justify-center shadow-inner">
                  <MapPin size={20} className="text-accent-400" />
                </div>
                <span className="text-[10px] font-bold tracking-wider uppercase text-brand-400 bg-brand-950 px-2 py-0.5 rounded border border-brand-800">
                  MAPS &amp; GBP
                </span>
              </div>

              <div>
                <h3 className="text-[15px] font-bold text-white leading-snug">
                  Win the map in every area you serve.
                </h3>
                <p className="text-[13px] text-brand-400 leading-relaxed mt-1.5">
                  See where you rank on Google Maps across your metro area, block by block, next to competitors.
                </p>
              </div>

              {/* Visual Widget: 3x3 Geo-Grid */}
              <div className="bg-brand-950/80 rounded-xl border border-brand-800/80 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-accent-400 font-bold flex items-center gap-1">
                    <span>📍</span> 3×3 Metro Geo-Grid
                  </span>
                  <span className="text-success-400 font-bold font-mono text-[10px]">Avg #1.2</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-brand-900/60 rounded-lg border border-brand-850 text-center font-mono font-bold text-[10px]">
                  <div className="bg-brand-950/80 border border-success-500/30 text-success-400 py-1 rounded">#1</div>
                  <div className="bg-brand-950/80 border border-success-500/30 text-success-400 py-1 rounded">#1</div>
                  <div className="bg-brand-950/80 border border-series-6/30 text-series-300 py-1 rounded">#2</div>
                  <div className="bg-brand-950/80 border border-success-500/30 text-success-400 py-1 rounded">#1</div>
                  <div className="bg-success-500/20 border border-success-400 text-success-400 py-1 rounded shadow-xs">★ #1</div>
                  <div className="bg-brand-950/80 border border-success-500/30 text-success-400 py-1 rounded">#1</div>
                  <div className="bg-brand-950/80 border border-series-6/30 text-series-300 py-1 rounded">#2</div>
                  <div className="bg-brand-950/80 border border-success-500/30 text-success-400 py-1 rounded">#1</div>
                  <div className="bg-brand-950/80 border border-warning-500/30 text-warning-400 py-1 rounded">#3</div>
                </div>
                <div className="flex items-center justify-between text-[9px] text-brand-400">
                  <span>Local 3-Pack Presence</span>
                  <span className="text-brand-300 font-semibold">5km Radius Dominated</span>
                </div>
              </div>

              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-800/60">
                Grid map of rankings · Profile &amp; reviews audit · Multi-location
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/google-business-profile"
                className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent-400 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>Audit my Google profile</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
