"use client";

import Link from "next/link";
import { ArrowRight, Globe, Layers, Calendar, CheckCheck } from "lucide-react";

const STEPS = [
  {
    step: "01",
    title: "Enter your website",
    line: "Add your URL and up to 5 competitors. That's the whole setup.",
    icon: Globe,
  },
  {
    step: "02",
    title: "We crawl and compare",
    line: "Our crawler reads every page the way Google does. Then it compares you with your rivals and checks AI answers.",
    icon: Layers,
  },
  {
    step: "03",
    title: "Get a 30-day plan",
    line: "Every issue and gap gets a ₹ value, the effort involved and a priority. You see what to do first.",
    icon: Calendar,
  },
  {
    step: "04",
    title: "Approve, ship, verify",
    line: "Approve a fix and GrowthX ships it (PR, Shopify or WordPress). Then it re-crawls to prove it worked.",
    icon: CheckCheck,
  },
];

export function HowItWorksSection() {
  const scrollToAudit = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="bg-brand-950 py-20 lg:py-28 border-b border-brand-900 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Header */}
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-series-6">
            Simple 4-Step Process
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-white leading-tight tracking-tight">
            From URL to results in four steps.
          </h2>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="bg-brand-900/50 border border-brand-800 rounded-3xl p-6 space-y-4 hover:border-brand-700/80 transition-all hover:bg-brand-900/80 relative group"
              >
                {/* Step badge */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-series-6/10 border border-series-6/20 text-series-400">
                    {s.step}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-brand-950/80 border border-brand-800 text-brand-300 flex items-center justify-center group-hover:text-white transition-colors">
                    <Icon size={17} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-white group-hover:text-series-300 transition-colors">
                    {s.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-400 leading-relaxed">
                    {s.line}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Button */}
        <div className="pt-2 flex items-center">
          <button
            type="button"
            onClick={scrollToAudit}
            className="inline-flex items-center gap-2 bg-series-6 hover:bg-series-6/90 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
          >
            <span>Run free audit</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
