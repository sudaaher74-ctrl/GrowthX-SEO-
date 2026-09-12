"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Globe,
  Search,
  FileText,
  TrendingUp,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Wrench,
  Zap,
} from "lucide-react";

const PIPELINE_STEPS = [
  {
    num: "01",
    title: "Enter your website",
    desc: "Single-click domain submission. GrowthX initiates deep headless DOM and sitemap crawls.",
    icon: Globe,
  },
  {
    num: "02",
    title: "AI & SERP Diagnostics",
    desc: "Simultaneous audits of technical SEO, competitor ranking overlaps, and LLM citations.",
    icon: Search,
  },
  {
    num: "03",
    title: "Prioritized 30-Day Plan",
    desc: "Generates high-ROI code fixes, schema integrations, and content velocity blueprints.",
    icon: FileText,
  },
  {
    num: "04",
    title: "Autonomous Fix Execution",
    desc: "Review and approve with 1 click. GrowthX Fix Engine deploys code & content updates directly.",
    icon: Wrench,
  },
];

export function WorkflowSteps() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="py-6 sm:py-8 bg-white border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header & Metrics Strip */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
              Autonomous Growth Pipeline
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              From Analysis to Execution in Minutes
            </h2>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 bg-violet-50 text-violet-800 px-3 py-1.5 rounded-lg font-semibold border border-violet-100">
              <Zap size={13} className="text-violet-600" />
              <span>2.4x Traffic Velocity*</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg font-semibold border border-emerald-100">
              <CheckCircle2 size={13} className="text-emerald-600" />
              <span>Zero Dev Work Required</span>
            </div>
          </div>
        </div>

        {/* 2-Column Compact Layout */}
        <div className="grid lg:grid-cols-2 gap-6 items-center">
          {/* Left: Sequential Steps */}
          <div className="space-y-2.5">
            {PIPELINE_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isSelected = activeStep === idx;
              return (
                <div
                  key={step.num}
                  onClick={() => setActiveStep(idx)}
                  className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-violet-50/70 border-violet-200 shadow-sm"
                      : "bg-white border-slate-200/70 hover:border-slate-300"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                      isSelected
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {step.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4
                        className={`text-xs sm:text-sm font-bold ${
                          isSelected ? "text-violet-950" : "text-slate-800"
                        }`}
                      >
                        {step.title}
                      </h4>
                      <Icon
                        size={14}
                        className={isSelected ? "text-violet-600" : "text-slate-400"}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Live Interactive Workflow Preview */}
          <div className="bg-slate-950 rounded-2xl p-5 text-white shadow-lg border border-slate-800">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-200">GrowthX Live Execution Engine</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Step {activeStep + 1} of 4</span>
            </div>

            {/* Dynamic Card Body based on selected step */}
            <div className="space-y-3 min-h-[160px] flex flex-col justify-center">
              {activeStep === 0 && (
                <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">Domain Target:</span>
                    <span className="text-emerald-400 font-mono font-bold">yourwebsite.com</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">Status:</span>
                    <span className="text-violet-300 font-mono">Crawl Completed (42 URLs)</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                    <div className="bg-emerald-500 h-1.5 rounded-full w-full" />
                  </div>
                </div>
              )}

              {activeStep === 1 && (
                <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Technical Audit:</span>
                    <span className="text-amber-400 font-semibold">4 Critical Schema Gaps</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">SERP Overlap:</span>
                    <span className="text-indigo-400 font-semibold">3 Rivals Outranking</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">AI Citation Share:</span>
                    <span className="text-rose-400 font-semibold">18% (ChatGPT &amp; Perplexity)</span>
                  </div>
                </div>
              )}

              {activeStep === 2 && (
                <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-violet-300">30-Day Fix Blueprint Assembled</span>
                    <span className="bg-violet-600/30 text-violet-200 px-2 py-0.5 rounded text-[10px]">
                      14 Key Fixes
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Phase 1 (Days 1–7): Schema Injection &amp; Canonical Fixes<br />
                    Phase 2 (Days 8–18): AI Knowledge Anchors &amp; Entity Tuning<br />
                    Phase 3 (Days 19–30): Content Velocity Engine
                  </p>
                </div>
              )}

              {activeStep === 3 && (
                <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-400">Automated Fixes Implemented</span>
                    <span className="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[10px]">
                      100% Verified
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    All approved technical tags, meta descriptors, and schema payloads deployed directly. No engineering team bandwidth used.
                  </p>
                </div>
              )}
            </div>

            {/* Bottom CTA */}
            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-[10px] text-slate-400 italic">
                *Illustrative demo workflow and benchmark estimates.
              </span>
              <Link
                href="/analyze"
                className="inline-flex items-center gap-1 font-bold text-violet-400 hover:text-violet-300 transition-colors"
              >
                <span>Run for your site</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
