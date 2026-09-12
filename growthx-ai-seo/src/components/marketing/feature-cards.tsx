"use client";

import { Globe, Trophy, Sparkles, Wrench, ArrowRight } from "lucide-react";
import Link from "next/link";

const CORE_PILLARS = [
  {
    icon: Globe,
    title: "1. Website Audit",
    tag: "Technical & On-Page",
    iconBg: "bg-blue-50 text-blue-600",
    borderHover: "hover:border-blue-200",
    description: "Deep crawl of DOM, sitemap, Core Web Vitals, schema markup, and meta tags.",
    impact: "Uncovers 30+ hidden technical blockers",
    link: "/website",
  },
  {
    icon: Trophy,
    title: "2. Competitor Intel",
    tag: "Market Gaps",
    iconBg: "bg-amber-50 text-amber-600",
    borderHover: "hover:border-amber-200",
    description: "Reverse-engineers rival rankings, content velocity, and target keyword opportunities.",
    impact: "Identifies top 3 vertical rivals",
    link: "/competitors",
  },
  {
    icon: Sparkles,
    title: "3. AI Visibility",
    tag: "GEO & Citations",
    iconBg: "bg-violet-50 text-violet-600",
    borderHover: "hover:border-violet-200",
    description: "Measures brand presence & answer inclusion across ChatGPT, Claude & Perplexity.",
    impact: "Audits citation share & entity graph",
    link: "/ai-visibility",
  },
  {
    icon: Wrench,
    title: "4. Fix Engine",
    tag: "Autonomous Execution",
    iconBg: "bg-emerald-50 text-emerald-600",
    borderHover: "hover:border-emerald-200",
    description: "Synthesizes a prioritized 30-day plan and auto-implements code & content improvements.",
    impact: "Executes without developer backlog",
    link: "/fix-engine",
  },
];

export function FeatureCards() {
  return (
    <section className="py-6 sm:py-8 bg-slate-50/50 border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-5 gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
              The Complete SEO + GEO Lifecycle
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Four Autonomous Pillars for Search Dominance
            </h2>
          </div>
          <p className="text-xs text-slate-500 max-w-sm">
            From initial crawl to real-time execution, GrowthX replaces disconnected toolkits with a single unified engine.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {CORE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className={`bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:shadow-md transition-all ${pillar.borderHover} flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${pillar.iconBg}`}>
                      <Icon size={16} />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {pillar.tag}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{pillar.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-3">
                    {pillar.description}
                  </p>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700">{pillar.impact}</span>
                  <Link
                    href={pillar.link}
                    className="text-violet-600 hover:text-violet-700 font-bold inline-flex items-center gap-0.5"
                  >
                    <span>View</span>
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
