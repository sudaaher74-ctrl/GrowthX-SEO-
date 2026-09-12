"use client";

import { Quote, Star, TrendingUp } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "GrowthX completely changed how we approach SEO. The AI insights and automated execution save us weeks of work every month.",
    name: "Sarah K.",
    role: "Founder",
    company: "FreshCart",
    initials: "SK",
    color: "bg-violet-600",
  },
  {
    quote:
      "We saw a meaningful increase in organic traffic in just 2 months. The 30-day plan made it simple and effective.",
    name: "David C.",
    role: "Marketing Lead",
    company: "Notely",
    initials: "DC",
    color: "bg-blue-600",
  },
  {
    quote:
      "Finally, a tool that connects SEO, AI visibility and real execution. GrowthX is a game-changer for our team.",
    name: "James M.",
    role: "CEO",
    company: "BuildPro",
    initials: "JM",
    color: "bg-emerald-600",
  },
];

const LOGOS = ["Stripe", "Shopify", "Notion", "Slack", "Webflow", "Vercel", "Zapier", "Loom"];

export function TrustSection() {
  return (
    <section className="py-24 bg-slate-50/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_400px] gap-16 items-start">
          {/* LEFT */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3">
              Trusted by Growing Businesses
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight mb-4">
              Real businesses.<br />
              <span className="text-violet-600">Real growth.</span>
            </h2>
            <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-md">
              From startups to growing brands, teams use GrowthX to increase visibility, traffic and revenue.
            </p>

            {/* Logo strip */}
            <div className="grid grid-cols-4 gap-4 mb-10">
              {LOGOS.map((logo) => (
                <div
                  key={logo}
                  className="bg-white rounded-xl border border-slate-200 px-3 py-3 flex items-center justify-center"
                >
                  <span className="text-[12px] font-black text-slate-400 tracking-tight">{logo}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 italic mb-10">
              * Illustrative logos — not verified GrowthX customers.
            </p>

            {/* Testimonials */}
            <div className="grid sm:grid-cols-3 gap-4">
              {TESTIMONIALS.map((t) => (
                <div
                  key={t.name}
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
                      <p className="text-[12px] font-bold text-slate-900">{t.name}</p>
                      <p className="text-[11px] text-slate-500">{t.role}, {t.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 italic mt-3">
              * Testimonials are illustrative examples — not verified customer statements.
            </p>
          </div>

          {/* RIGHT: Customer spotlight */}
          <div className="sticky top-24">
            <div className="bg-gradient-to-br from-violet-50 to-blue-50/60 rounded-2xl border border-violet-200/60 p-6 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-4">
                Customer Spotlight
              </p>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <span className="text-white text-xs font-black">FC</span>
                </div>
                <span className="text-sm font-bold text-slate-900">FreshCart</span>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={18} className="text-emerald-600" />
                  <p className="text-3xl font-extrabold text-slate-900">3.2x</p>
                </div>
                <p className="text-[13px] text-slate-600">
                  increase in organic traffic<br />in 90 days
                </p>
              </div>

              <div className="space-y-2.5 mb-5">
                {[
                  { label: "Organic Visibility", trend: "↑ Improved" },
                  { label: "AI Visibility Score", trend: "↑ +28 pts" },
                  { label: "Ranking Keywords", trend: "↑ Expanded" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between bg-white/80 rounded-xl px-3.5 py-2.5 border border-white">
                    <span className="text-[12px] font-medium text-slate-700">{m.label}</span>
                    <span className="text-[12px] font-bold text-emerald-600">{m.trend}</span>
                  </div>
                ))}
              </div>

              <p className="text-[12.5px] text-slate-600 italic mb-4 leading-relaxed">
                &ldquo;GrowthX gave us the clarity, plan and automation we needed. It&apos;s like having a full SEO team on autopilot.&rdquo;
              </p>

              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center">
                  SK
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-900">Sarah K.</p>
                  <p className="text-[10px] text-slate-500">Founder, FreshCart</p>
                </div>
              </div>

              <div className="flex items-center gap-1 mb-4">
                {[1,2,3,4,5].map(s => <Star key={s} size={12} className="text-amber-400 fill-amber-400" />)}
                <span className="text-[11px] font-semibold text-slate-500 ml-1">4.9/5</span>
              </div>

              <button className="w-full text-center text-[12.5px] font-semibold text-violet-600 hover:text-violet-800 border border-violet-200 rounded-xl py-2.5 hover:bg-violet-50 transition-colors">
                Read full case study →
              </button>

              <p className="text-[10px] text-slate-400 text-center mt-2 italic">
                Illustrative example — not verified data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
