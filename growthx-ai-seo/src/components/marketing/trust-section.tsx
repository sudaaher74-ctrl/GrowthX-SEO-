"use client";

import Link from "next/link";
import { Quote, Star, TrendingUp } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "GrowthX completely changed how we approach SEO. The AI insights and automated execution save us weeks of work every month.",
    name: "Growth Team",
    role: "Leadership",
    company: "Milquu Fresh",
    initials: "MF",
    color: "bg-success-600",
  },
  {
    quote:
      "We saw a meaningful increase in organic visibility and search share. The 30-day plan made it simple and effective.",
    name: "Operations Lead",
    role: "Director",
    company: "Aiva Enterprises",
    initials: "AE",
    color: "bg-accent-600",
  },
  {
    quote:
      "Finally, a tool that connects SEO, AI visibility and real execution. GrowthX is a game-changer for our business.",
    name: "Studio Head",
    role: "Principal",
    company: "OS Interior",
    initials: "OS",
    color: "bg-series-6",
  },
];

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
            <p className="text-[11px] text-brand-500 italic mb-10">
              * Partner brands currently scaling with GrowthX SEO &amp; AI visibility.
            </p>

            {/* Testimonials */}
            <div className="grid sm:grid-cols-3 gap-4">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.company}
                  className="bg-brand-900/40 rounded-2xl border border-brand-800 p-5 flex flex-col gap-4 hover:border-brand-700 transition-colors"
                >
                  <Quote size={18} className="text-series-6/60" />
                  <p className="text-[13px] text-brand-300 leading-relaxed flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full ${t.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-white">{t.company}</p>
                      <p className="text-[11px] text-brand-400">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Customer spotlight */}
          <div className="sticky top-24">
            <div className="bg-gradient-to-br from-brand-900 via-brand-900/90 to-brand-950 rounded-2xl border border-brand-800 p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-series-6/10 blur-2xl pointer-events-none" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-series-6 mb-4">
                Customer Spotlight
              </p>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-xl bg-success-600 flex items-center justify-center shadow-xs">
                  <span className="text-white text-xs font-black">MF</span>
                </div>
                <div>
                  <span className="text-sm font-extrabold text-white block">Milquu Fresh</span>
                  <span className="text-[10px] text-brand-400 font-medium">Verified Partner Brand</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={18} className="text-success-400" />
                  <p className="text-3xl font-extrabold text-white">3.2x</p>
                </div>
                <p className="text-[13px] text-brand-300">
                  increase in organic visibility<br />across search &amp; AI platforms
                </p>
              </div>

              <div className="space-y-2.5 mb-5">
                {[
                  { label: "Search Visibility", trend: "↑ Improved" },
                  { label: "AI Visibility Score", trend: "↑ High Gain" },
                  { label: "Ranking Keywords", trend: "↑ Expanded" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between bg-brand-950/60 rounded-xl px-3.5 py-2.5 border border-brand-800/80">
                    <span className="text-[12px] font-medium text-brand-200">{m.label}</span>
                    <span className="text-[12px] font-bold text-success-400">{m.trend}</span>
                  </div>
                ))}
              </div>

              <p className="text-[12.5px] text-brand-300 italic mb-4 leading-relaxed">
                &ldquo;GrowthX gave us the clarity, plan and automation we needed. It&apos;s like having a full SEO and AI visibility team on autopilot.&rdquo;
              </p>

              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-full bg-success-600 text-white text-xs font-bold flex items-center justify-center">
                  MF
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white">Milquu Fresh</p>
                  <p className="text-[10px] text-brand-400">Brand Partner</p>
                </div>
              </div>

              <div className="flex items-center gap-1 mb-4">
                {[1,2,3,4,5].map(s => <Star key={s} size={12} className="text-warning-400 fill-warning-400" />)}
                <span className="text-[11px] font-semibold text-brand-400 ml-1">5.0 / 5</span>
              </div>

              <Link
                href="/analyze"
                className="w-full block text-center text-[12.5px] font-bold text-white bg-series-6 hover:bg-series-6/90 rounded-xl py-2.5 transition-colors shadow-sm"
              >
                Analyze your website like Milquu Fresh →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
