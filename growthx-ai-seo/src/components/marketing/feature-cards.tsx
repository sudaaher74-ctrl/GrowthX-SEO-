"use client";

import Link from "next/link";
import { Globe, Trophy, Bot, Wrench, MapPin } from "lucide-react";

export function FeatureCards() {
  return (
    <section id="features" className="py-24 border-t border-brand-200 relative overflow-hidden scroll-mt-16">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2 sm:mb-3">
            One platform. Five jobs done.
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-brand-950 leading-tight tracking-tight">
            Find what&apos;s costing you traffic.<br />
            <span className="text-signal-400">Approve it. We prepare the fix.</span>
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-brand-500 leading-relaxed">
            From technical audits and rival tracking to AI citations and map rankings, in one ranked queue. Every fix is prepared for you and waits for your approval.
          </p>
        </div>

        {/* Top Row: 2 Flagship Foundation Engines (Audit & Fix Engine) */}
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6 mb-6">
          {/* 1. Website Audit */}
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-5 sm:p-7 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <Globe size={20} className="text-brand-900" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  WEBSITE AUDIT
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-brand-950 leading-snug">
                  See your site the way Google does.
                </h3>
                <p className="text-xs sm:text-sm text-brand-500 leading-relaxed mt-1.5">
                  Our headless crawler loads every page like Googlebot. It checks speed, indexing, schema and content, then ranks the issues by how much they cost you.
                </p>
              </div>

              {/* Visual Widget: Crawl Health & Diagnostics */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3 sm:p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-brand-700">
                    <span className="w-2 h-2 rounded-full bg-success-500 shrink-0" />
                    <span className="font-mono text-[9.5px] sm:text-[10px] truncate">Googlebot Mobile / 200 OK</span>
                  </div>
                  <span className="font-mono font-bold text-brand-600 bg-surface-1 border border-brand-200 px-2 py-0.5 rounded text-[9.5px] sm:text-[10px] shrink-0">
                    Example
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-2 border-t border-brand-200 text-center font-mono text-[10px]">
                  <div className="bg-surface-1 rounded-lg p-1.5 sm:p-2 border border-brand-200">
                    <span className="text-brand-500 block text-[9px] mb-0.5">TTFB</span>
                    <span className="font-bold text-brand-950 text-xs">142ms</span>
                  </div>
                  <div className="bg-surface-1 rounded-lg p-1.5 sm:p-2 border border-brand-200">
                    <span className="text-brand-500 block text-[9px] mb-0.5">
                      <span className="sm:hidden">CWV</span>
                      <span className="hidden sm:inline">Core Web Vitals</span>
                    </span>
                    <span className="font-bold text-success-500 text-xs">Pass</span>
                  </div>
                  <div className="bg-surface-1 rounded-lg p-1.5 sm:p-2 border border-brand-200">
                    <span className="text-brand-500 block text-[9px] mb-0.5">Indexability</span>
                    <span className="font-bold text-brand-950 text-xs">100%</span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-brand-400">Example data</p>
              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-200">
                Server speed &amp; canonicals &middot; Schema checks &middot; Thin content flags
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-950 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>Audit my site</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* 2. Fix Engine */}
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <Wrench size={20} className="text-success-500" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  FIX ENGINE
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-brand-950 leading-snug">
                  Don&apos;t just find problems. Get the fix.
                </h3>
                <p className="text-xs sm:text-sm text-brand-500 leading-relaxed mt-1.5">
                  Reigel prepares the actual code change and opens a pull request on your GitHub repository. You review the diff and merge it. We never merge for you.
                </p>
              </div>

              {/* Visual Widget: Code Diff Preview */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3.5 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-[10px] text-brand-500 pb-1.5 border-b border-brand-200">
                  <span className="text-brand-800 font-semibold">app/layout.tsx</span>
                  <span className="text-success-600 font-bold bg-success-50 px-2 py-0.5 rounded border border-success-500/20">
                    Pull request ready
                  </span>
                </div>
                <div className="text-[10px] space-y-1">
                  <div className="text-error-600 bg-error-50 px-2 py-0.5 rounded truncate">
                    - &lt;meta name=&quot;robots&quot; content=&quot;noindex&quot; /&gt;
                  </div>
                  <div className="text-success-600 bg-success-50 px-2 py-0.5 rounded truncate">
                    + &lt;meta name=&quot;robots&quot; content=&quot;index, follow&quot; /&gt;
                  </div>
                </div>
                <div className="flex items-center justify-between text-[9px] text-brand-500 pt-1">
                  <span>Opens on GitHub</span>
                  <span className="text-brand-800 font-semibold">Re-crawled after merge</span>
                </div>
              </div>

              <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-brand-400">Example data</p>
              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-200">
                Low-risk fixes prepared &middot; Opens a GitHub PR &middot; Never merged for you &middot; Re-crawled after
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-950 group-hover:gap-2 transition-all cursor-pointer"
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
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-6 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <Trophy size={20} className="text-warning-500" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  COMPETITOR INTEL
                </span>
              </div>

              <div>
                <h3 className="text-[15px] font-bold text-brand-950 leading-snug">
                  Know every move rivals make. Answer with a ready draft.
                </h3>
                <p className="text-[13px] text-brand-500 leading-relaxed mt-1.5">
                  Rival pages are checked every day. New pages and changes show up in a feed, each with a counter-move draft.
                </p>
              </div>

              {/* Visual Widget: Rival Radar Feed */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold uppercase tracking-wider text-warning-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning-500" />
                    Rival Radar
                  </span>
                  <span className="text-brand-500 font-mono text-[9px]">2h ago</span>
                </div>
                <div className="bg-surface-1 rounded-lg p-2 border border-brand-200 space-y-0.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-brand-950 font-mono">rival.com</span>
                    <span className="text-[10px] font-bold text-warning-500">+4 Pages</span>
                  </div>
                  <p className="text-[10px] text-brand-500">Added new pricing &amp; feature comparison guides</p>
                </div>
                <div className="flex items-center justify-between text-[10px] pt-0.5">
                  <span className="text-brand-700 font-semibold font-mono">Counter-move draft ready</span>
                  <span className="text-[9px] bg-signal-400 text-signal-ink px-2 py-0.5 rounded-full font-bold">
                    Counter
                  </span>
                </div>
              </div>

              <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-brand-400">Example data</p>
              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-200">
                Gaps ranked by priority &middot; Rival feed &middot; Counter-move drafts
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-950 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>Track my competitors</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* 4. AI Search Visibility */}
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-6 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <Bot size={20} className="text-brand-900" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  AI VISIBILITY
                </span>
              </div>

              <div>
                <h3 className="text-[15px] font-bold text-brand-950 leading-snug">
                  When customers ask AI, does it recommend you?
                </h3>
                <p className="text-[13px] text-brand-500 leading-relaxed mt-1.5">
                  We ask ChatGPT, Claude, Gemini, Perplexity and Sarvam the questions your buyers ask, to see who gets cited and why. AI Overviews and Copilot have no public API, so we say so instead of showing a zero.
                </p>
              </div>

              {/* Visual Widget: AI Citation Box */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-brand-700 font-mono truncate">&quot;best platform for...&quot;</span>
                  <span className="bg-signal-400 text-signal-ink text-[9px] font-bold px-2 py-0.5 rounded-full">
                    Cited #1
                  </span>
                </div>
                <div className="bg-surface-1 rounded-lg p-2 border border-brand-200 text-[10px] text-brand-600 leading-snug">
                  &quot;<span className="text-brand-950 font-bold">yoursite.com</span> was recommended by Perplexity &amp; ChatGPT for fastest response...&quot;
                </div>
                <div className="flex items-center justify-between text-[10px] text-brand-500 font-mono">
                  <span>Share of Voice: <strong className="text-brand-950 font-bold">48%</strong></span>
                  <span className="text-brand-500 text-[9px]">vs 18% rival</span>
                </div>
              </div>

              <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-brand-400">Example data</p>
              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-200">
                Share of AI answers vs rivals &middot; Answers stored as evidence &middot; Fixes for pages that miss out
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-950 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>Check my AI visibility</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* 5. Google Business Profile */}
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-6 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <MapPin size={20} className="text-success-500" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  MAPS &amp; GBP
                </span>
              </div>

              <div>
                <h3 className="text-[15px] font-bold text-brand-950 leading-snug">
                  Win the map in every area you serve.
                </h3>
                <p className="text-[13px] text-brand-500 leading-relaxed mt-1.5">
                  See where you rank on Google Maps across your metro area, block by block, next to competitors.
                </p>
              </div>

              {/* Visual Widget: 3x3 Geo-Grid */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-brand-800 font-bold flex items-center gap-1">
                    3×3 Metro Geo-Grid
                  </span>
                  <span className="text-success-500 font-bold font-mono text-[10px]">Avg #1.2</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-1 rounded-lg border border-brand-200 text-center font-mono font-bold text-[10px]">
                  <div className="bg-surface-2 border border-brand-200 text-success-500 py-1 rounded">#1</div>
                  <div className="bg-surface-2 border border-brand-200 text-success-500 py-1 rounded">#1</div>
                  <div className="bg-surface-2 border border-brand-200 text-brand-700 py-1 rounded">#2</div>
                  <div className="bg-surface-2 border border-brand-200 text-success-500 py-1 rounded">#1</div>
                  <div className="bg-signal-400 text-signal-ink py-1 rounded">#1</div>
                  <div className="bg-surface-2 border border-brand-200 text-success-500 py-1 rounded">#1</div>
                  <div className="bg-surface-2 border border-brand-200 text-brand-700 py-1 rounded">#2</div>
                  <div className="bg-surface-2 border border-brand-200 text-success-500 py-1 rounded">#1</div>
                  <div className="bg-surface-2 border border-brand-200 text-warning-500 py-1 rounded">#3</div>
                </div>
                <div className="flex items-center justify-between text-[9px] text-brand-500">
                  <span>Example grid</span>
                  <span className="text-brand-700 font-semibold">Sample layout</span>
                </div>
              </div>

              <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-brand-400">Example data</p>
              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-200">
                Grid map of rankings &middot; Profile &amp; reviews audit &middot; Multi-location
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-950 group-hover:gap-2 transition-all cursor-pointer"
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
