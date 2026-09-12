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
    color: "bg-emerald-600",
  },
  {
    quote:
      "We saw a meaningful increase in organic visibility and search share. The 30-day plan made it simple and effective.",
    name: "Operations Lead",
    role: "Director",
    company: "Aiva Enterprises",
    initials: "AE",
    color: "bg-blue-600",
  },
  {
    quote:
      "Finally, a tool that connects SEO, AI visibility and real execution. GrowthX is a game-changer for our business.",
    name: "Studio Head",
    role: "Principal",
    company: "OS Interior",
    initials: "OS",
    color: "bg-violet-600",
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
    <section className="py-20 sm:py-24 bg-slate-50/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_400px] gap-12 lg:gap-16 items-start">
          {/* LEFT */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3">
              Trusted by Growing Businesses
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
              Real businesses.<br />
              <span className="text-violet-600">Real growth.</span>
            </h2>
            <p className="text-base sm:text-lg text-slate-500 leading-relaxed mb-8 max-w-md">
              From fast-growing startups to established brands, businesses use GrowthX to increase visibility, traffic and search revenue.
            </p>

            {/* Logo strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
              {LOGOS.map((logo) => (
                <div
                  key={logo}
                  className="bg-white rounded-xl border border-slate-200/80 px-4 py-3.5 flex items-center justify-center shadow-2xs hover:shadow-xs transition-shadow"
                >
                  <span className="text-xs sm:text-sm font-extrabold text-slate-700 tracking-tight text-center">
                    {logo}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 italic mb-10">
              * Partner brands currently scaling with GrowthX SEO &amp; AI visibility.
            </p>

            {/* Testimonials */}
            <div className="grid sm:grid-cols-3 gap-4">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.company}
                  className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow"
                >
                  <Quote size={18} className="text-violet-300" />
                  <p className="text-[13px] text-slate-600 leading-relaxed flex-1">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full ${t.color} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-slate-900">{t.company}</p>
                      <p className="text-[11px] text-slate-500">{t.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Customer spotlight */}
          <div className="sticky top-24">
            <div className="bg-gradient-to-br from-violet-50 to-blue-50/60 rounded-2xl border border-violet-200/60 p-6 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-4">
                Customer Spotlight
              </p>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-xs">
                  <span className="text-white text-xs font-black">MF</span>
                </div>
                <div>
                  <span className="text-sm font-extrabold text-slate-900 block">Milquu Fresh</span>
                  <span className="text-[10px] text-slate-400 font-medium">Verified Partner Brand</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={18} className="text-emerald-600" />
                  <p className="text-3xl font-extrabold text-slate-900">3.2x</p>
                </div>
                <p className="text-[13px] text-slate-600">
                  increase in organic visibility<br />across search &amp; AI platforms
                </p>
              </div>

              <div className="space-y-2.5 mb-5">
                {[
                  { label: "Search Visibility", trend: "↑ Improved" },
                  { label: "AI Visibility Score", trend: "↑ High Gain" },
                  { label: "Ranking Keywords", trend: "↑ Expanded" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between bg-white/80 rounded-xl px-3.5 py-2.5 border border-white">
                    <span className="text-[12px] font-medium text-slate-700">{m.label}</span>
                    <span className="text-[12px] font-bold text-emerald-600">{m.trend}</span>
                  </div>
                ))}
              </div>

              <p className="text-[12.5px] text-slate-600 italic mb-4 leading-relaxed">
                &ldquo;GrowthX gave us the clarity, plan and automation we needed. It&apos;s like having a full SEO and AI visibility team on autopilot.&rdquo;
              </p>

              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                  MF
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-900">Milquu Fresh</p>
                  <p className="text-[10px] text-slate-500">Brand Partner</p>
                </div>
              </div>

              <div className="flex items-center gap-1 mb-4">
                {[1,2,3,4,5].map(s => <Star key={s} size={12} className="text-amber-400 fill-amber-400" />)}
                <span className="text-[11px] font-semibold text-slate-500 ml-1">5.0 / 5</span>
              </div>

              <Link
                href="/analyze"
                className="w-full block text-center text-[12.5px] font-bold text-violet-700 bg-white border border-violet-200 rounded-xl py-2.5 hover:bg-violet-50 transition-colors shadow-2xs"
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
