"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle,
  FileCode,
  Globe,
  GitPullRequest,
  CheckCheck,
  TrendingUp,
  Radar,
  Bot,
  MapPin,
  Star,
  Sparkles,
  Zap,
} from "lucide-react";

export function ProductShowcaseSection() {
  const scrollToAudit = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="bg-brand-950 py-24 lg:py-32 border-b border-brand-900 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 lg:space-y-32">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-series-6">
            Complete SEO &amp; Local Visibility Stack
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-white leading-tight tracking-tight">
            One platform. Five jobs done.
          </h2>
          <p className="text-sm sm:text-base text-brand-400">
            Find what&apos;s costing you traffic, see what rivals are doing, and let GrowthX ship the fix.
          </p>
        </div>

        {/* 5. WEBSITE AUDIT (Image Right) */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-5">
            <span className="text-xs font-bold uppercase tracking-widest text-series-400">
              WEBSITE AUDIT
            </span>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
              See your site the way Google does.
            </h3>
            <p className="text-brand-300 text-sm sm:text-base leading-relaxed">
              Our headless crawler loads every page like Googlebot. It checks speed, indexing, schema and content, then ranks the issues by how much they cost you.
            </p>
            <ul className="space-y-3 pt-2 text-xs sm:text-sm text-brand-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Server speed, broken links, redirects and canonical problems</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>JSON-LD schema checks for Product, Organization, FAQ and LocalBusiness</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Titles, headings, thin content and duplicate pages</span>
              </li>
            </ul>
            <div className="pt-3">
              <button
                type="button"
                onClick={scrollToAudit}
                className="inline-flex items-center gap-2 font-bold text-sm text-series-400 hover:text-series-300 transition-colors cursor-pointer"
              >
                <span>Audit my site</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Mockup */}
          <div className="bg-brand-900/80 border border-brand-800 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-800 pb-3">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-brand-400" />
                <span className="text-xs font-bold text-white">Crawler Health Breakdown</span>
              </div>
              <span className="text-[10px] font-bold uppercase bg-success-500/10 text-success-400 border border-success-500/30 px-2 py-0.5 rounded-full">
                Score: 78 / 100
              </span>
            </div>
            <div className="space-y-2.5">
              <div className="bg-brand-950/70 border border-brand-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="text-brand-300 font-medium">Product Schema (JSON-LD)</span>
                <span className="text-success-400 font-bold">Valid &bull; 82 pages</span>
              </div>
              <div className="bg-brand-950/70 border border-brand-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="text-brand-300 font-medium">Core Web Vitals LCP &bull; mobile</span>
                <span className="text-warning-400 font-bold">1.8s &bull; Good</span>
              </div>
              <div className="bg-brand-950/70 border border-brand-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
                <span className="text-brand-300 font-medium">Canonical URLs &amp; Indexability</span>
                <span className="text-error-400 font-bold">3 missing tags</span>
              </div>
            </div>
          </div>
        </div>

        {/* 6. FIX ENGINE (Image Left) */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Mockup First */}
          <div className="order-2 lg:order-1 bg-brand-900/80 border border-brand-800 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-800 pb-3">
              <div className="flex items-center gap-2">
                <GitPullRequest size={16} className="text-series-400" />
                <span className="text-xs font-bold text-white">Generated GitHub Pull Request #48</span>
              </div>
              <span className="text-[10px] font-bold text-series-300 bg-series-6/15 border border-series-6/30 px-2 py-0.5 rounded-full">
                Ready to Ship
              </span>
            </div>
            <div className="bg-brand-950 border border-brand-800 rounded-xl p-3 text-[11px] font-mono space-y-1">
              <div className="text-success-400">+ &quot;@context&quot;: &quot;https://schema.org&quot;,</div>
              <div className="text-success-400">+ &quot;@type&quot;: &quot;Product&quot;,</div>
              <div className="text-success-400">+ &quot;name&quot;: &quot;A2 Desi Cow Ghee&quot;,</div>
              <div className="text-brand-400">{'  "offers": { "price": "899", "priceCurrency": "INR" }'}</div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-success-400 font-semibold flex items-center gap-1.5">
                <CheckCheck size={14} />
                Re-crawl verified automatically
              </span>
              <button
                type="button"
                onClick={scrollToAudit}
                className="px-3 py-1.5 rounded-lg bg-series-6 text-white text-xs font-bold hover:bg-series-6/90 transition-all cursor-pointer"
              >
                Approve &amp; Ship
              </button>
            </div>
          </div>

          <div className="order-1 lg:order-2 space-y-5">
            <span className="text-xs font-bold uppercase tracking-widest text-series-400">
              FIX ENGINE
            </span>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
              Don&apos;t just find problems. Ship the fix.
            </h3>
            <p className="text-brand-300 text-sm sm:text-base leading-relaxed">
              GrowthX writes the actual code or content change. You approve it with one click and it goes live on Next.js, Shopify, WordPress or plain HTML.
            </p>
            <ul className="space-y-3 pt-2 text-xs sm:text-sm text-brand-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>AI-written fixes for schema, meta tags, internal links and page content</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Ships as a GitHub pull request, a CMS update or a copy-paste snippet</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Re-crawls afterwards and gives you a timestamped before/after proof for every fix</span>
              </li>
            </ul>
            <div className="pt-3">
              <button
                type="button"
                onClick={scrollToAudit}
                className="inline-flex items-center gap-2 font-bold text-sm text-series-400 hover:text-series-300 transition-colors cursor-pointer"
              >
                <span>See how fixes work</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 7. COMPETITOR INTELLIGENCE (Image Right) */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-5">
            <span className="text-xs font-bold uppercase tracking-widest text-series-400">
              COMPETITOR INTELLIGENCE
            </span>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
              Know every move your rivals make. Answer it in one click.
            </h3>
            <p className="text-brand-300 text-sm sm:text-base leading-relaxed">
              GrowthX tracks your competitors&apos; websites every day. When they add a page, change prices or start ranking for something new, you see it, what it&apos;s worth in ₹, and a ready counter-move.
            </p>
            <ul className="space-y-3 pt-2 text-xs sm:text-sm text-brand-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Keyword and content gaps, ranked by ₹ value (not just &ldquo;Medium&rdquo;)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Rival Radar: a daily feed of new pages, schema and price changes</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>A Counter button on every gap that drafts the page or fix for you</span>
              </li>
            </ul>
            <div className="pt-3">
              <button
                type="button"
                onClick={scrollToAudit}
                className="inline-flex items-center gap-2 font-bold text-sm text-series-400 hover:text-series-300 transition-colors cursor-pointer"
              >
                <span>Track my competitors</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Mockup */}
          <div className="bg-brand-900/80 border border-brand-800 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-800 pb-3">
              <div className="flex items-center gap-2">
                <Radar size={16} className="text-series-400" />
                <span className="text-xs font-bold text-white">Rival Radar Feed</span>
              </div>
              <span className="text-[10px] font-bold text-warning-400 bg-warning-500/10 border border-warning-500/20 px-2 py-0.5 rounded-full">
                Active Sweep
              </span>
            </div>
            <div className="space-y-2.5">
              <div className="bg-brand-950/70 border border-brand-800/80 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">countrydelight.in</p>
                  <p className="text-[11px] text-brand-400">Added city landing page: /mumbai/milk-delivery</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-success-400">+₹24,000/mo</span>
                  <button
                    type="button"
                    onClick={scrollToAudit}
                    className="block text-[10px] text-series-400 hover:underline mt-0.5 font-bold"
                  >
                    Counter →
                  </button>
                </div>
              </div>
              <div className="bg-brand-950/70 border border-brand-800/80 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">amul.com</p>
                  <p className="text-[11px] text-brand-400">Updated FAQ schema on organic butter page</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-success-400">+₹9,500/mo</span>
                  <button
                    type="button"
                    onClick={scrollToAudit}
                    className="block text-[10px] text-series-400 hover:underline mt-0.5 font-bold"
                  >
                    Counter →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 8. AI VISIBILITY (Image Left) */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Mockup */}
          <div className="order-2 lg:order-1 bg-brand-900/80 border border-brand-800 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-series-400" />
                <span className="text-xs font-bold text-white">AI Search Citation Share</span>
              </div>
              <span className="text-[10px] font-bold text-series-300 bg-series-6/15 border border-series-6/30 px-2 py-0.5 rounded-full">
                4 Engines Monitored
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="bg-brand-950/80 border border-brand-800/80 rounded-xl p-3 text-center space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-brand-400">ChatGPT</span>
                <p className="text-lg font-black text-success-400">46%</p>
                <p className="text-[10px] text-brand-500">Cited in 12/26 queries</p>
              </div>
              <div className="bg-brand-950/80 border border-brand-800/80 rounded-xl p-3 text-center space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-brand-400">Google Gemini</span>
                <p className="text-lg font-black text-series-400">38%</p>
                <p className="text-[10px] text-brand-500">Cited in 10/26 queries</p>
              </div>
              <div className="bg-brand-950/80 border border-brand-800/80 rounded-xl p-3 text-center space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-brand-400">Perplexity</span>
                <p className="text-lg font-black text-success-400">52%</p>
                <p className="text-[10px] text-brand-500">Cited in 14/26 queries</p>
              </div>
              <div className="bg-brand-950/80 border border-brand-800/80 rounded-xl p-3 text-center space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-brand-400">Claude</span>
                <p className="text-lg font-black text-series-400">35%</p>
                <p className="text-[10px] text-brand-500">Cited in 9/26 queries</p>
              </div>
            </div>
            <div className="text-[11px] text-brand-400 pt-1 text-center font-medium">
              Tracking ChatGPT, Google Gemini, Perplexity, and Claude. More coming soon.
            </div>
          </div>

          <div className="order-1 lg:order-2 space-y-5">
            <span className="text-xs font-bold uppercase tracking-widest text-series-400">
              AI SEARCH VISIBILITY
            </span>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
              When customers ask AI, does it recommend you?
            </h3>
            <p className="text-brand-300 text-sm sm:text-base leading-relaxed">
              We ask the questions your buyers ask across AI assistants, in English and Indian languages. You see who gets named, which pages get cited, and why it isn&apos;t you yet.
            </p>
            <ul className="space-y-3 pt-2 text-xs sm:text-sm text-brand-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Share of AI answers vs each competitor</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>The exact rival pages AI cites, and what they have that yours don&apos;t</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Fixes such as FAQ schema and direct answers to earn citations</span>
              </li>
            </ul>
            <p className="text-xs text-brand-400 italic pt-1">
              Tracking ChatGPT, Google Gemini, Perplexity, and Claude. More coming soon.
            </p>
            <div className="pt-3">
              <button
                type="button"
                onClick={scrollToAudit}
                className="inline-flex items-center gap-2 font-bold text-sm text-series-400 hover:text-series-300 transition-colors cursor-pointer"
              >
                <span>Check my AI visibility</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 9. GOOGLE BUSINESS PROFILE (Image Right) */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-5">
            <span className="text-xs font-bold uppercase tracking-widest text-series-400">
              GOOGLE BUSINESS PROFILE
            </span>
            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight">
              Win the map in every area you serve.
            </h3>
            <p className="text-brand-300 text-sm sm:text-base leading-relaxed">
              See where you rank on Google Maps across your city, block by block, next to your competitors. Then fix your profile, posts and reviews from one place.
            </p>
            <ul className="space-y-3 pt-2 text-xs sm:text-sm text-brand-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Grid map of your Maps rankings vs rivals</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Profile audit covering categories, photos, posts, Q&amp;A and review replies</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle size={16} className="text-series-6 shrink-0 mt-0.5" />
                <span>Built for multi-location businesses and franchises</span>
              </li>
            </ul>
            <div className="pt-3">
              <button
                type="button"
                onClick={scrollToAudit}
                className="inline-flex items-center gap-2 font-bold text-sm text-series-400 hover:text-series-300 transition-colors cursor-pointer"
              >
                <span>Audit my Google profile</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Mockup */}
          <div className="bg-brand-900/80 border border-brand-800 rounded-3xl p-6 shadow-2xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-brand-800 pb-3">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-series-400" />
                <span className="text-xs font-bold text-white">Local Maps Geo-Grid (City Metro)</span>
              </div>
              <span className="text-[10px] font-bold text-success-400 bg-success-500/10 border border-success-500/20 px-2 py-0.5 rounded-full">
                Avg Rank: #1.4
              </span>
            </div>
            {/* 3x3 Geo-grid pins */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { rank: "#1", pos: "North Zone" },
                { rank: "#1", pos: "Downtown" },
                { rank: "#2", pos: "Central" },
                { rank: "#1", pos: "East Gate" },
                { rank: "#1", pos: "Sector 11" },
                { rank: "#2", pos: "West Hub" },
                { rank: "#2", pos: "South Point" },
                { rank: "#1", pos: "Market Yard" },
                { rank: "#3", pos: "Tech Park" },
              ].map((pin, i) => (
                <div
                  key={i}
                  className="bg-brand-950/80 border border-brand-800/80 rounded-xl p-2.5 text-center space-y-0.5"
                >
                  <span
                    className={`inline-block text-xs font-black px-2 py-0.5 rounded-md ${
                      pin.rank === "#1"
                        ? "bg-success-500/15 text-success-400 border border-success-500/30"
                        : "bg-series-6/15 text-series-300 border border-series-6/30"
                    }`}
                  >
                    {pin.rank}
                  </span>
                  <p className="text-[10px] text-brand-400 font-medium truncate">{pin.pos}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
