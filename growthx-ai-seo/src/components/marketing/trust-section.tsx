"use client";

import { Quote, Star } from "lucide-react";

const CLIENT_LOGOS = [
  "Stripe",
  "Shopify",
  "Notion",
  "Slack",
  "Webflow",
  "Vercel",
];

const TESTIMONIALS = [
  {
    quote:
      "GrowthX completely changed how we approach SEO. The AI insights and automated execution save us weeks of engineering time.",
    name: "Alex M.",
    role: "Head of Growth, FinScale",
    rating: 5,
  },
  {
    quote:
      "We saw an immediate boost in AI search citations. ChatGPT and Perplexity now recommend us first for key category prompts.",
    name: "Elena R.",
    role: "Marketing Director, SaaSio",
    rating: 5,
  },
  {
    quote:
      "Having a tool that doesn't just produce audit spreadsheets but actually implements the code and content fixes is a game changer.",
    name: "Marcus T.",
    role: "Founder, CloudPeak",
    rating: 5,
  },
];

export function TrustSection() {
  return (
    <section className="py-6 sm:py-8 bg-slate-50/50 border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Logo Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-5 mb-5 border-b border-slate-200/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
            Works across modern tech stacks:
          </span>
          <div className="flex flex-wrap items-center gap-6 text-xs font-bold text-slate-400">
            {CLIENT_LOGOS.map((brand) => (
              <span key={brand} className="hover:text-slate-600 transition-colors">
                {brand}
              </span>
            ))}
          </div>
        </div>

        {/* Testimonials Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
              Validated by Search &amp; Marketing Leaders
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              Real Results. Autonomous Execution.
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 italic hidden sm:block">
            *Illustrative examples &amp; feedback
          </span>
        </div>

        {/* 3 Compact Testimonial Cards */}
        <div className="grid sm:grid-cols-3 gap-3.5">
          {TESTIMONIALS.map((item, idx) => (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-0.5 text-amber-400 mb-2">
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} size={13} fill="currentColor" />
                  ))}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-3 italic">
                  &ldquo;{item.quote}&rdquo;
                </p>
              </div>
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-900 leading-tight">{item.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
