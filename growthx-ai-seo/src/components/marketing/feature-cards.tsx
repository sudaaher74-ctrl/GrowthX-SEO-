"use client";

import { Globe, Trophy, Sparkles, Wrench } from "lucide-react";

const FEATURES = [
  {
    icon: Globe,
    iconBg: "bg-brand-900 border border-brand-800",
    iconColor: "text-accent-400",
    accentColor: "text-series-6",
    title: "Technical Website Audit",
    description:
      "Detect technical, on-page, and performance issues automatically. We use live headless crawlers (simulating Googlebot) to validate everything from Server Response Time (TTFB) to JSON-LD schema syntax, canonical loops, and title hierarchies. Know exactly what's holding your site back.",
    cta: "Find what's holding you back →",
  },
  {
    icon: Sparkles,
    iconBg: "bg-brand-900 border border-brand-800",
    iconColor: "text-series-6",
    accentColor: "text-series-6",
    title: "AI Visibility Tracking",
    description:
      "Search is changing. Track exactly how Large Language Models (like ChatGPT, Claude, and Gemini) perceive your brand. We monitor your brand's citations, measure geographical brand presence, and alert you when AI assistants recommend competitors over you.",
    cta: "Be visible in AI searches →",
  },
  {
    icon: Trophy,
    iconBg: "bg-brand-900 border border-brand-800",
    iconColor: "text-warning-400",
    accentColor: "text-warning-400",
    title: "Competitor Intelligence",
    description:
      "See what your competitors are doing, find content gaps, and uncover new ranking opportunities before they do.",
    cta: "Stay ahead of your competition →",
  },
  {
    icon: Wrench,
    iconBg: "bg-brand-900 border border-brand-800",
    iconColor: "text-success-400",
    accentColor: "text-success-400",
    title: "The Fix Engine",
    description:
      "Don't just find problems—fix them. Get a prioritized 30-day plan. Once you approve, our engine automatically verifies the improvements and generates a cryptographic Verification Certificate to guarantee the defect was resolved.",
    cta: "Turn insights into real growth →",
  },
];

export function FeatureCards() {
  return (
    <section className="py-24 bg-brand-950 border-t border-brand-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-series-6 mb-3">
            Core Capabilities
          </p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
            A clear plan.<br />
            Measurable growth.
          </h2>
          <p className="mt-4 text-lg text-brand-400 leading-relaxed">
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
                className="group bg-brand-900/40 border border-brand-850 hover:border-brand-700 hover:bg-brand-900/70 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-2xl transition-all duration-300 cursor-default"
              >
                <div className={`w-11 h-11 rounded-xl ${feat.iconBg} flex items-center justify-center shadow-inner`}>
                  <Icon size={20} className={feat.iconColor} />
                </div>
                <div className="flex-1">
                  <h3 className="text-[15px] font-bold text-white mb-2">{feat.title}</h3>
                  <p className="text-[13.5px] text-brand-400 leading-relaxed">{feat.description}</p>
                </div>
                <button
                  className={`flex items-center gap-1 text-[12.5px] font-semibold ${feat.accentColor} group-hover:gap-2 transition-all cursor-pointer`}
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
