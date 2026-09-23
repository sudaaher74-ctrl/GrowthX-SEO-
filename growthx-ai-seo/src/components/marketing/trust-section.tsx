"use client";

import Link from "next/link";
import { TrendingUp } from "lucide-react";

const LOGOS = [
  "Milquu Fresh",
  "Aiva Enterprises",
  "OS Interior",
  "Dron Archery Academy",
  "Brand Kettle",
  "Immunity Group",
];

export function TrustSection() {
  return (
    <section className="py-20 sm:py-24 bg-brand-950 border-t border-brand-900 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_400px] gap-12 lg:gap-16 items-start">
          {/* LEFT */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-series-6 mb-3">
              Trusted by Growing Businesses
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4">
              Real businesses.<br />
              <span className="text-series-6">Real growth.</span>
            </h2>
            <p className="text-base sm:text-lg text-brand-400 leading-relaxed mb-8 max-w-md">
              From fast-growing startups to established brands, businesses use GrowthX to increase visibility, traffic and search revenue.
            </p>

            {/* Logo strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
              {LOGOS.map((logo) => (
                <div
                  key={logo}
                  className="bg-brand-900/60 rounded-xl border border-brand-800 px-4 py-3.5 flex items-center justify-center shadow-2xs hover:border-brand-700 hover:bg-brand-900/80 transition-colors"
                >
                  <span className="text-xs sm:text-sm font-extrabold text-brand-200 tracking-tight text-center">
                    {logo}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-brand-500 italic">
              * Partner brands currently scaling with GrowthX SEO &amp; AI visibility.
            </p>
          </div>

          {/* RIGHT: call to action. Results and quotes appear here only when a
              customer has given them, with their name on them. */}
          <div className="sticky top-24">
            <div className="bg-gradient-to-br from-brand-900 via-brand-900/90 to-brand-950 rounded-2xl border border-brand-800 p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-series-6/10 blur-2xl pointer-events-none" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-series-6 mb-4">
                See it on your own site
              </p>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={18} className="text-success-400" />
                <p className="text-lg font-extrabold text-white">A free audit of your website</p>
              </div>
              <p className="text-[13px] text-brand-300 mb-5 leading-relaxed">
                We crawl your pages, check technical SEO and on-page content, and show you what to fix first — using
                your site&apos;s real data.
              </p>
              <Link
                href="/analyze"
                className="w-full block text-center text-[12.5px] font-bold text-white bg-series-6 hover:bg-series-6/90 rounded-xl py-2.5 transition-colors shadow-sm"
              >
                Analyze your website →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
