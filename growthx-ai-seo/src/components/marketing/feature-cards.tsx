"use client";

import Link from "next/link";
import { Globe, Trophy, Sparkles, Wrench, MapPin } from "lucide-react";

const FEATURES = [
  {
    icon: Globe,
    iconBg: "bg-brand-900 border border-brand-800",
    iconColor: "text-accent-400",
    accentColor: "text-series-6",
    eyebrow: "WEBSITE AUDIT",
    title: "See your site the way Google does.",
    description:
      "Our headless crawler loads every page like Googlebot. It checks speed, indexing, schema and content, then ranks the issues by how much they cost you.",
    bullets: "Server speed & canonicals · Schema checks · Thin content flags",
    cta: "Audit my site →",
    href: "/website",
  },
  {
    icon: Wrench,
    iconBg: "bg-brand-900 border border-brand-800",
    iconColor: "text-success-400",
    accentColor: "text-success-400",
    eyebrow: "FIX ENGINE",
    title: "Don't just find problems. Ship the fix.",
    description:
      "GrowthX writes the actual code or content change. You approve it with one click and it goes live on Next.js, Shopify, WordPress or plain HTML.",
    bullets: "AI-written code & content · Ships as GitHub PR or CMS · Timestamped proof",
    cta: "See how fixes work →",
    href: "/fix-engine",
  },
  {
    icon: Trophy,
    iconBg: "bg-brand-900 border border-brand-800",
    iconColor: "text-warning-400",
    accentColor: "text-warning-400",
    eyebrow: "COMPETITOR INTELLIGENCE",
    title: "Know every move your rivals make. Answer it in one click.",
    description:
      "GrowthX tracks your competitors' websites every day. When they add a page, change prices or start ranking for something new, you see it, what it's worth in ₹, and a ready counter-move.",
    bullets: "Gaps ranked by ₹ value · Rival Radar daily feed · Counter button on every gap",
    cta: "Track my competitors →",
    href: "/competitor-intelligence",
  },
  {
    icon: Sparkles,
    iconBg: "bg-brand-900 border border-brand-800",
    iconColor: "text-series-6",
    accentColor: "text-series-6",
    eyebrow: "AI SEARCH VISIBILITY",
    title: "When customers ask AI, does it recommend you?",
    description:
      "We ask the questions your buyers ask across AI assistants, in English and Indian languages. You see who gets named, which pages get cited, and why it isn't you yet.",
    bullets: "Share of AI answers vs rivals · Exact pages AI cites · Direct answer fixes",
    cta: "Check my AI visibility →",
    href: "/ai-visibility",
  },
  {
    icon: MapPin,
    iconBg: "bg-brand-900 border border-brand-800",
    iconColor: "text-accent-400",
    accentColor: "text-accent-400",
    eyebrow: "GOOGLE BUSINESS PROFILE",
    title: "Win the map in every area you serve.",
    description:
      "See where you rank on Google Maps across your city, block by block, next to your competitors. Then fix your profile, posts and reviews from one place.",
    bullets: "Grid map of Maps rankings · Profile & reviews audit · Multi-location support",
    cta: "Audit my Google profile →",
    href: "/google-business-profile",
  },
];

export function FeatureCards() {
  return (
    <section className="py-24 bg-brand-950 border-t border-brand-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-series-6 mb-3">
            One platform. Five jobs done.
          </p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Find what&apos;s costing you traffic.<br />
            <span className="text-series-6">Let GrowthX ship the fix.</span>
          </h2>
          <p className="mt-4 text-lg text-brand-400 leading-relaxed">
            From technical site audits and rival intelligence to AI citations and map rankings — all in one platform that writes and ships the work.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="group bg-brand-900/40 border border-brand-850 hover:border-brand-700 hover:bg-brand-900/70 rounded-2xl p-6 flex flex-col gap-4 hover:shadow-2xl transition-all duration-300 cursor-default"
              >
                <div className="flex items-center justify-between">
                  <div className={`w-11 h-11 rounded-xl ${feat.iconBg} flex items-center justify-center shadow-inner`}>
                    <Icon size={20} className={feat.iconColor} />
                  </div>
                  <span className="text-[10px] font-bold tracking-wider uppercase text-brand-400 bg-brand-950 px-2 py-0.5 rounded border border-brand-800">
                    {feat.eyebrow}
                  </span>
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-[15px] font-bold text-white leading-snug">{feat.title}</h3>
                  <p className="text-[13px] text-brand-400 leading-relaxed">{feat.description}</p>
                  <p className="text-[11px] text-brand-500 font-medium pt-1 border-t border-brand-800/60">
                    {feat.bullets}
                  </p>
                </div>
                <Link
                  href={feat.href}
                  className={`flex items-center gap-1 text-[12.5px] font-semibold ${feat.accentColor} group-hover:gap-2 transition-all cursor-pointer pt-1`}
                >
                  {feat.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
