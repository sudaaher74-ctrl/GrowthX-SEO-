"use client";

import { Globe, Trophy, Sparkles, Wrench, ArrowRight } from "lucide-react";

const FEATURES = [
  {
    icon: Globe,
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    borderColor: "hover:border-blue-200",
    accentColor: "text-blue-600",
    title: "Website Audit",
    description:
      "Detect technical, on-page and performance issues automatically. Know exactly what's holding your site back.",
    cta: "Find what's holding you back →",
  },
  {
    icon: Trophy,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    borderColor: "hover:border-amber-200",
    accentColor: "text-amber-600",
    title: "Competitor Intelligence",
    description:
      "See what your competitors are doing, find gaps and uncover new opportunities before they do.",
    cta: "Stay ahead of your competition →",
  },
  {
    icon: Sparkles,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    borderColor: "hover:border-violet-200",
    accentColor: "text-violet-600",
    title: "AI Visibility",
    description:
      "Track how ChatGPT, Claude and Gemini perceive your brand and where you can improve your presence.",
    cta: "Be visible in AI searches →",
  },
  {
    icon: Wrench,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    borderColor: "hover:border-emerald-200",
    accentColor: "text-emerald-600",
    title: "Fix Engine",
    description:
      "Get a prioritized 30-day plan and automatically implement the approved improvements for you.",
    cta: "Turn insights into real growth →",
  },
];

export function FeatureCards() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600 mb-3">
            How GrowthX Works
          </p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">
            Everything you need to grow<br />
            in the age of AI search
          </h2>
          <p className="mt-4 text-lg text-slate-500 leading-relaxed">
            GrowthX brings together SEO, competitor intelligence and AI visibility — and turns insights into execution.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className={`group bg-white border border-slate-200 ${feat.borderColor} rounded-2xl p-6 flex flex-col gap-4 hover:shadow-lg transition-all duration-300 cursor-default`}
              >
                <div className={`w-11 h-11 rounded-xl ${feat.iconBg} flex items-center justify-center`}>
                  <Icon size={20} className={feat.iconColor} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-bold text-slate-900 mb-2">{feat.title}</h3>
                  <p className="text-[13.5px] text-slate-500 leading-relaxed">{feat.description}</p>
                </div>
                <button
                  className={`flex items-center gap-1 text-[12.5px] font-semibold ${feat.accentColor} group-hover:gap-2 transition-all`}
                >
                  {feat.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
