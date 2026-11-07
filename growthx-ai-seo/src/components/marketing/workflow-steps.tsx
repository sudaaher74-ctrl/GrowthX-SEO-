"use client";

import Link from "next/link";
import {
  Link2,
  Search,
  ListChecks,
  TrendingUp,
  ArrowRight,
  Check,
  CheckCircle2,
  Calendar,
  Zap,
  Globe,
  Target,
  Wrench,
  FileSpreadsheet,
  Settings,
  LayoutGrid,
  Boxes,
  Bot,
} from "lucide-react";

const PIPELINE_STEPS = [
  {
    num: "01",
    title: "Paste your website",
    description: "Add your URL and up to 5 rivals, or let us suggest them. That's the whole setup.",
    icon: Link2,
    iconBg: "bg-surface-2 border border-brand-200 text-signal-400",
  },
  {
    num: "02",
    title: "We crawl and compare",
    description:
      "Every page is read the way Google reads it. Then we compare you with your rivals and ask AI assistants about you.",
    icon: Search,
    iconBg: "bg-surface-2 border border-brand-200 text-brand-900",
  },
  {
    num: "03",
    title: "Get one ranked list",
    description:
      "Each issue and gap shows the evidence, the effort involved and a priority. You see what to do first.",
    icon: ListChecks,
    iconBg: "bg-surface-2 border border-brand-200 text-success-500",
  },
  {
    num: "04",
    title: "Approve, then we prove it",
    description:
      "Approve a fix and Reigel opens a pull request on your repository. You merge it. Then we re-crawl to check it worked.",
    icon: TrendingUp,
    iconBg: "bg-surface-2 border border-brand-200 text-warning-500",
  },
];

function WorkflowAppPreview() {
  return (
    <div className="relative select-none w-full max-w-xl mx-auto lg:mx-0">
      {/* Main card */}
      <div className="bg-surface-1 rounded-3xl shadow-card border border-brand-200 overflow-hidden">
        <div className="flex">
          {/* Sidebar */}
          <div className="w-12 sm:w-40 bg-surface-1 p-2.5 sm:p-3.5 shrink-0 flex flex-col justify-between border-r border-brand-200">
            <div>
              <div className="mb-4 flex items-center gap-2 pl-1">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-signal-400 font-mono text-[11px] font-extrabold text-signal-ink">
                  R
                </span>
                <span className="hidden sm:inline text-sm font-extrabold tracking-tight text-brand-950">
                  Reigel
                </span>
              </div>

              <div className="space-y-1">
                {[
                  { icon: LayoutGrid, label: "Dashboard" },
                  { icon: Globe, label: "Website Audit", active: true },
                  { icon: Target, label: "Competitor Intel" },
                  { icon: Bot, label: "AI Visibility" },
                  { icon: Wrench, label: "Fix Engine" },
                  { icon: FileSpreadsheet, label: "Reports" },
                  { icon: Settings, label: "Settings" },
                ].map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-full text-[10px] font-semibold transition-colors ${
                        item.active
                          ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                          : "text-brand-600 hover:text-brand-950"
                      }`}
                    >
                      <ItemIcon size={12} className={item.active ? "text-signal-ink" : "text-brand-500"} />
                      <span className="hidden sm:inline truncate">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 flex flex-col" style={{ background: "var(--color-canvas)" }}>
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-brand-200 bg-surface-1">
              <div className="flex items-center gap-1.5 flex-1 max-w-xs bg-surface-2 rounded-full border border-brand-200 px-3 py-1">
                <Search size={11} className="text-brand-500 shrink-0" />
                <span className="text-[10px] text-brand-800 font-mono truncate">
                  yourwebsite.com
                </span>
              </div>
              <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-surface-2 border border-brand-200 font-mono text-[9px] font-bold uppercase tracking-wide text-brand-500">
                Example data
              </span>
            </div>

            {/* Content Body */}
            <div className="p-4 space-y-3">
              {/* Status Banner */}
              <div className="flex items-center justify-between gap-2 bg-surface-1 border border-brand-200 rounded-xl px-3.5 py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 size={15} className="text-success-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold text-brand-950 leading-tight">
                      Website Analysis Complete
                    </p>
                    <p className="text-[9.5px] text-brand-500 leading-tight truncate">
                      Sample result: 38 opportunities ranked by impact.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-brand-800 shrink-0">
                  Full Report →
                </span>
              </div>

              {/* 4 KPIs Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1: SEO Health */}
                <div className="bg-surface-1 rounded-xl p-2.5 border border-brand-200 flex flex-col justify-between">
                  <p className="text-[8.5px] font-semibold text-brand-500">SEO Health</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-base font-black text-brand-950 leading-none">94</p>
                      <p className="text-[8px] font-bold text-brand-400 mt-0.5">Example</p>
                    </div>
                    <svg className="w-9 h-4 text-success-500" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 16 Q 14 6, 26 12 T 48 3" />
                    </svg>
                  </div>
                </div>

                {/* 2: AI Visibility */}
                <div className="bg-surface-1 rounded-xl p-2.5 border border-brand-200 flex flex-col justify-between">
                  <p className="text-[8.5px] font-semibold text-brand-500">AI Visibility</p>
                  <div className="flex items-end justify-between mt-1">
                    <div>
                      <p className="text-base font-black text-brand-950 leading-none">52</p>
                      <p className="text-[8px] font-bold text-brand-400 mt-0.5">Example</p>
                    </div>
                    <svg className="w-9 h-4 text-signal-400" viewBox="0 0 50 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 17 Q 14 10, 26 13 T 48 4" />
                    </svg>
                  </div>
                </div>

                {/* 3: Competitors Found */}
                <div className="bg-surface-1 rounded-xl p-2.5 border border-brand-200">
                  <p className="text-[8.5px] font-semibold text-brand-500">Competitors</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-5 h-5 rounded-md bg-surface-2 border border-brand-200 text-brand-700 flex items-center justify-center shrink-0">
                      <Boxes size={11} />
                    </div>
                    <div>
                      <p className="text-base font-black text-brand-950 leading-none">5</p>
                      <p className="text-[8px] text-brand-500 leading-tight">In your market</p>
                    </div>
                  </div>
                </div>

                {/* 4: Opportunities */}
                <div className="bg-surface-1 rounded-xl p-2.5 border border-brand-200">
                  <p className="text-[8.5px] font-semibold text-brand-500">Opportunities</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-5 h-5 rounded-md bg-surface-2 border border-brand-200 text-warning-500 flex items-center justify-center shrink-0">
                      <Zap size={11} />
                    </div>
                    <div>
                      <p className="text-base font-black text-brand-950 leading-none">38</p>
                      <p className="text-[8px] text-brand-500 leading-tight">Ranked actions</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom 2 Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Current Plan */}
                <div className="bg-surface-1 rounded-xl p-3 border border-brand-200">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-surface-2 border border-brand-200 text-brand-800 flex items-center justify-center shrink-0">
                      <Calendar size={12} />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold text-brand-950 leading-tight">
                        Your 30-Day Plan
                      </p>
                      <p className="text-[8.5px] text-brand-500">12 of 38 actions completed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-surface-3 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-signal-400 h-1.5 rounded-full" style={{ width: "32%" }} />
                    </div>
                    <span className="text-[9px] font-bold text-brand-700">32%</span>
                  </div>
                </div>

                {/* Let Reigel Do the Work */}
                <div className="bg-surface-1 rounded-xl p-3 border border-brand-200 flex flex-col justify-between">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-surface-2 border border-brand-200 text-brand-800 flex items-center justify-center shrink-0">
                      <Wrench size={12} />
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold text-brand-950 leading-tight">
                        We prepare the fix
                      </p>
                      <p className="text-[8.5px] text-brand-500 leading-tight mt-0.5">
                        Approve a fix and we open the pull request.
                      </p>
                    </div>
                  </div>
                  <span className="bg-signal-400 text-signal-ink text-[9px] font-bold py-1 px-2.5 rounded-full flex items-center justify-center gap-1 w-fit">
                    <span>View Plan</span>
                    <ArrowRight size={9} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkflowSteps() {
  return (
    <section id="how-it-works" className="py-16 sm:py-20 border-t border-brand-200 scroll-mt-16 overflow-x-clip">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 2-Column Main Section */}
        <div className="grid lg:grid-cols-[48%_52%] gap-8 lg:gap-12 items-center mb-10">
          {/* Left Column: Header + 4 Step Cards + Actions */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 bg-surface-1 border border-brand-200 text-brand-600 text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full mb-2.5">
                How It Works
              </div>
              <h2 className="text-3xl sm:text-4xl lg:text-[40px] font-extrabold text-brand-950 leading-[1.12] tracking-tight">
                From URL to proof<br />
                in four steps.
              </h2>
              <p className="mt-2 text-sm sm:text-base text-brand-500 leading-relaxed">
                Add your URL and up to 5 rivals. Reigel does the crawling and comparing, ranks the work, prepares the fixes, and checks the results.
              </p>
            </div>

            {/* 4 Step Cards with Vertical Dotted Line */}
            <div className="relative pl-7 space-y-2.5">
              {/* Dotted Vertical Connector Line */}
              <div className="absolute left-2.5 top-6 bottom-6 w-0 border-l-2 border-dashed border-brand-200 pointer-events-none" />

              {PIPELINE_STEPS.map((step) => {
                const StepIcon = step.icon;
                return (
                  <div key={step.num} className="relative flex items-center">
                    {/* Number Badge on the Line */}
                    <div className="absolute -left-7 font-mono font-black text-xs text-brand-500 w-5 text-center">
                      {step.num}
                    </div>

                    {/* Step Card */}
                    <div className="w-full bg-surface-1 rounded-2xl p-3 sm:p-3.5 border border-brand-200 hover:border-brand-300 transition-all flex items-center gap-3 shadow-2xs">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${step.iconBg}`}>
                        <StepIcon size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs sm:text-sm font-extrabold text-brand-950 leading-tight">
                          {step.title}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-brand-500 leading-snug mt-0.5">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons & Trust row */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 bg-signal-400 hover:bg-signal-500 active:scale-[0.98] text-signal-ink font-extrabold text-xs sm:text-sm px-6 py-3 rounded-full transition-all shadow-xs cursor-pointer"
                >
                  <span>Start free audit →</span>
                </Link>
              </div>

              {/* Trust Checkmarks */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-brand-500 pt-1">
                {["Free account", "No card needed", "Audit ready in minutes"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <Check size={14} className="text-success-500 shrink-0 font-extrabold" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="relative flex items-center justify-center py-6">
            <WorkflowAppPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
