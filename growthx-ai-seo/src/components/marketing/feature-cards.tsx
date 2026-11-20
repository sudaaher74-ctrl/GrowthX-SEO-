"use client";

import Link from "next/link";
import { Globe, Trophy, Bot, Wrench, FileText, Building2 } from "lucide-react";

export function FeatureCards() {
  return (
    <section id="features" className="py-24 border-t border-brand-200 relative overflow-hidden scroll-mt-16">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2 sm:mb-3">
            One platform. Six engines working together.
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-brand-950 leading-tight tracking-tight">
            Find what&apos;s costing you traffic.<br />
            <span className="text-signal-400">Ship the fix. Prove the win.</span>
          </h2>
          <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-brand-500 leading-relaxed">
            From headless crawls and AI citation tracking to grounded content, lost-link recovery, direct CMS &amp; GitHub fixes with 1-click rollback, and zero-login white-label client portals.
          </p>
        </div>

        {/* Row 1: 2 Flagship Foundation Engines (Audit & Scheduler + Fix Engine & Rollback) */}
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6 mb-6">
          {/* 1. Website Audit & 5-Stage Pipeline */}
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-5 sm:p-7 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <Globe size={20} className="text-brand-900" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  AUDIT &amp; PIPELINE
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-brand-950 leading-snug">
                  See your site like Googlebot — on demand or on schedule.
                </h3>
                <p className="text-xs sm:text-sm text-brand-500 leading-relaxed mt-1.5">
                  Our headless Playwright crawler renders JavaScript pages, inspects Core Web Vitals and JSON-LD schema, and runs the full 5-stage pipeline automatically on Daily, Weekly, Bi-weekly, or Monthly schedules.
                </p>
              </div>

              {/* Visual Widget: Crawl Health & Scheduler */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3 sm:p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-brand-700 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-success-500 shrink-0" />
                    <span className="font-mono text-[9.5px] sm:text-[10px] truncate">5-Stage Pipeline &middot; Weekly Auto</span>
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
                Playwright JS rendering &middot; JSON-LD &amp; canonicals &middot; 1-click full pipeline &amp; cron scheduler
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

          {/* 2. Fix Engine, Direct CMS & Safe Rollback */}
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-6 sm:p-7 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <Wrench size={20} className="text-success-500" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  FIX ENGINE &amp; ROLLBACK
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-brand-950 leading-snug">
                  Ship single or batch fixes directly — with 1-click rollback.
                </h3>
                <p className="text-xs sm:text-sm text-brand-500 leading-relaxed mt-1.5">
                  Publish individual fixes or safe batches (up to 15 at once) straight to GitHub PRs, WordPress, Shopify, or Webflow (Draft or Live). Every CMS push saves a BEFORE snapshot and Regression Guard watches for returns.
                </p>
              </div>

              {/* Visual Widget: Multi-Platform Fix & Rollback Preview */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3.5 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between gap-2 text-[10px] text-brand-500 pb-1.5 border-b border-brand-200">
                  <span className="text-brand-800 font-semibold truncate">Batch Safe Fixes (6 of 15)</span>
                  <span className="text-success-600 font-bold bg-success-50 px-2 py-0.5 rounded border border-success-500/20 shrink-0">
                    1-Click Rollback
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
                  <span>GitHub &middot; WordPress &middot; Shopify &middot; Webflow</span>
                  <span className="text-brand-800 font-semibold">Regression Guard</span>
                </div>
              </div>

              <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-brand-400">Example data</p>
              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-200">
                Up to 15 fixes per batch &middot; BEFORE snapshots &middot; Self-learning ROI ranking &middot; Auto re-crawl
              </p>
            </div>

            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-950 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>See how fixes ship</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Row 2: 2 Growth & AI Visibility Engines */}
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6 mb-6">
          {/* 3. Grounded SEO Content Studio */}
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-6 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <FileText size={20} className="text-signal-400" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  CONTENT STUDIO
                </span>
              </div>

              <div>
                <h3 className="text-[16px] font-bold text-brand-950 leading-snug">
                  Turn keyword &amp; AI gaps into grounded, publish-ready pages.
                </h3>
                <p className="text-[13px] text-brand-500 leading-relaxed mt-1.5">
                  Jump straight from any Organic Search gap, declining query, or AI visibility miss into Grounded Content Studio. Draft articles, briefs, FAQs, and JSON-LD using only verified facts from your site — zero invented stats.
                </p>
              </div>

              {/* Visual Widget: Content Studio Draft Card */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono font-bold text-brand-800 truncate">Grounded Article + FAQ JSON-LD</span>
                  <span className="bg-signal-400 text-signal-ink text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">
                    Zero Fluff
                  </span>
                </div>
                <div className="bg-surface-1 rounded-lg p-2.5 border border-brand-200 space-y-1 text-[10px]">
                  <p className="font-bold text-brand-950">Source: Declining query &amp; AI citation gap</p>
                  <p className="text-brand-500">Grounded in 12 crawled product &amp; spec pages &middot; Ready for Draft or Live</p>
                </div>
                <div className="flex items-center justify-between text-[9.5px] font-mono text-brand-500">
                  <span>Publish: WP &middot; Shopify &middot; Webflow &middot; GitHub</span>
                  <span className="text-brand-800 font-semibold">MD / HTML Export</span>
                </div>
              </div>

              <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-brand-400">Example data</p>
              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-200">
                1-click Draft from Organic Search &middot; Fact-grounded copy &middot; Direct CMS &amp; PR publishing
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-950 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>Open Content Studio</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* 4. AI Search Visibility & SERP Visualizer */}
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-6 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <Bot size={20} className="text-brand-900" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  AI VISIBILITY &amp; SERP
                </span>
              </div>

              <div>
                <h3 className="text-[16px] font-bold text-brand-950 leading-snug">
                  When buyers ask AI, inspect every citation and defend your brand.
                </h3>
                <p className="text-[13px] text-brand-500 leading-relaxed mt-1.5">
                  We query ChatGPT, Claude, Gemini, Perplexity, and Sarvam through their official APIs, preview real clickable citation sources in the Live SERP Visualizer, and flag AI gaps right alongside your Google rankings.
                </p>
              </div>

              {/* Visual Widget: AI Citation Box */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-brand-700 font-mono truncate">&quot;best platform for...&quot;</span>
                  <span className="bg-signal-400 text-signal-ink text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0">
                    AI Cited #1
                  </span>
                </div>
                <div className="bg-surface-1 rounded-lg p-2.5 border border-brand-200 text-[10px] text-brand-600 leading-snug">
                  &quot;<span className="text-brand-950 font-bold">yourwebsite.com</span> cited directly by Perplexity, ChatGPT &amp; Sarvam with clickable source links.&quot;
                </div>
                <div className="flex items-center justify-between text-[10px] text-brand-500 font-mono">
                  <span>Share of Voice: <strong className="text-brand-950 font-bold">48%</strong></span>
                  <span className="text-brand-700 text-[9px] font-semibold">1-Click Stage Defense</span>
                </div>
              </div>

              <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-brand-400">Example data</p>
              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-200">
                5 official AI APIs &middot; Live SERP Visualizer &middot; AI Cited / AI Gap badges on every keyword
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
        </div>

        {/* Row 3: 2 Authority & Agency Engines */}
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
          {/* 5. Competitor Intelligence & Backlink Recovery */}
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-6 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <Trophy size={20} className="text-warning-500" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  RIVALS &amp; BACKLINK RECOVERY
                </span>
              </div>

              <div>
                <h3 className="text-[16px] font-bold text-brand-950 leading-snug">
                  Track every rival move and win back lost backlinks.
                </h3>
                <p className="text-[13px] text-brand-500 leading-relaxed mt-1.5">
                  Spot new competitor pages with ready counter-move drafts, and run Backlink Recovery Outreach to detect lost referring domains, draft personalized recovery emails, and log recovered links straight into the Fix Impact Ledger.
                </p>
              </div>

              {/* Visual Widget: Rival Radar & Lost-Link Recovery */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold uppercase tracking-wider text-warning-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-warning-500" />
                    Rival &amp; Link Radar
                  </span>
                  <span className="text-brand-500 font-mono text-[9px]">Daily Scan</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="bg-surface-1 rounded-lg p-2 border border-brand-200 space-y-0.5">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="font-bold text-brand-950 font-mono">rival.com</span>
                      <span className="text-[9.5px] font-bold text-warning-500">+4 Pages</span>
                    </div>
                    <p className="text-[9.5px] text-brand-500">Counter-move draft staged</p>
                  </div>
                  <div className="bg-surface-1 rounded-lg p-2 border border-brand-200 space-y-0.5">
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="font-bold text-brand-950">Lost Backlinks</span>
                      <span className="text-[9.5px] font-bold text-success-500">3 Outreach</span>
                    </div>
                    <p className="text-[9.5px] text-brand-500">Recovery logged to ledger</p>
                  </div>
                </div>
              </div>

              <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-brand-400">Example data</p>
              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-200">
                Daily rival change feed &middot; Lost-link outreach tracker &middot; Recovered links proven in reports
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-950 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>Track rivals &amp; backlinks</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* 6. Agency Client Hub & White-Label Portals */}
          <div className="group bg-surface-1 border border-brand-200 hover:border-brand-300 rounded-2xl p-6 flex flex-col justify-between shadow-2xs transition-all duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center">
                  <Building2 size={20} className="text-success-500" />
                </div>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-brand-500 bg-surface-2 px-2.5 py-0.5 rounded-full border border-brand-200">
                  AGENCY HUB &amp; PORTALS
                </span>
              </div>

              <div>
                <h3 className="text-[16px] font-bold text-brand-950 leading-snug">
                  Deliver month-end client proof in one click — zero client logins.
                </h3>
                <p className="text-[13px] text-brand-500 leading-relaxed mt-1.5">
                  Manage up to 20 client sites from one Agency Hub. Trigger 1-click pipelines, bulk Lock &amp; Share frozen monthly snapshots to white-labeled client portals, export server A4 PDFs &amp; CSVs, and push HMAC-signed Slack or Discord alerts.
                </p>
              </div>

              {/* Visual Widget: Agency Delivery Console */}
              <div className="bg-surface-2 rounded-xl border border-brand-200 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-brand-800 font-bold">Month-End Client Delivery</span>
                  <span className="text-success-500 font-bold font-mono text-[9.5px]">White-Label Active</span>
                </div>
                <div className="bg-surface-1 rounded-lg p-2.5 border border-brand-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold text-brand-950 truncate">/share/report/client-portal</p>
                    <p className="text-[9.5px] text-brand-500 truncate">Frozen Snapshot &middot; A4 PDF &middot; 1-Click CSV</p>
                  </div>
                  <span className="shrink-0 text-[9px] font-bold bg-signal-400 text-signal-ink px-2 py-0.5 rounded-full">
                    Lock &amp; Share
                  </span>
                </div>
                <div className="flex items-center justify-between text-[9.5px] font-mono text-brand-500">
                  <span>Signed Webhooks: Slack &middot; Discord &middot; REST</span>
                  <span className="text-brand-800 font-semibold">Up to 20 sites</span>
                </div>
              </div>

              <p className="text-[10px] font-mono font-bold uppercase tracking-wide text-brand-400">Example data</p>
              <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-200">
                Zero-login client portals &middot; Frozen snapshots &middot; Bulk delivery &middot; HMAC webhooks
              </p>
            </div>

            <div className="pt-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-[12.5px] font-bold text-brand-950 group-hover:gap-2 transition-all cursor-pointer"
              >
                <span>Explore Agency Hub</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
