"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  Sparkles,
  Search,
  Users,
  Wrench,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Lock,
  ChevronRight,
  Zap,
} from "lucide-react";

interface AuditIssue {
  severity: "critical" | "warning" | "optimized";
  category: string;
  title: string;
  impact: string;
}

interface IdentifiedRival {
  domain: string;
  overlapScore: number;
  estRankedKeywords: number;
  aiVisibilityIndex: number;
}

const AUDIT_FINDINGS: AuditIssue[] = [
  {
    severity: "critical",
    category: "Technical SEO",
    title: "Missing Structured Data (JSON-LD) for Core Entities",
    impact: "Search engines and LLMs cannot parse entity relationships",
  },
  {
    severity: "critical",
    category: "AI Visibility",
    title: "Zero Direct Citations in Perplexity & ChatGPT Probes",
    impact: "Competitors are recommended 85% of the time for category queries",
  },
  {
    severity: "warning",
    category: "On-Page SEO",
    title: "Thin Content & Keyword Cannibalization on 6 Key Landing Pages",
    impact: "Dilutes page authority across search rankings",
  },
  {
    severity: "warning",
    category: "Performance",
    title: "LCP (Largest Contentful Paint) exceeds 3.2s on mobile viewport",
    impact: "Penalizes Core Web Vitals score",
  },
  {
    severity: "optimized",
    category: "Security",
    title: "SSL / HTTPS and Canonical redirects configured properly",
    impact: "Baseline indexation integrity maintained",
  },
];

const DISCOVERED_RIVALS: IdentifiedRival[] = [
  {
    domain: "marketleader-pro.com",
    overlapScore: 78,
    estRankedKeywords: 1420,
    aiVisibilityIndex: 72,
  },
  {
    domain: "nexusgrowth.io",
    overlapScore: 64,
    estRankedKeywords: 980,
    aiVisibilityIndex: 61,
  },
  {
    domain: "apexstrategy.co",
    overlapScore: 52,
    estRankedKeywords: 830,
    aiVisibilityIndex: 48,
  },
];

function ResultsInner() {
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get("url") || "https://example.com";

  let hostname = "example.com";
  try {
    const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    hostname = parsed.hostname;
  } catch {
    hostname = rawUrl;
  }

  const [activeTab, setActiveTab] = useState<"overview" | "audit" | "competitors" | "fixes">("overview");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/20 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-slate-900">
          Growth<span className="text-violet-600">X</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
          >
            Open Dashboard Demo
          </Link>
          <Link
            href={`/register?domain=${encodeURIComponent(hostname)}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3.5 py-1.5 rounded-lg shadow-sm transition-all"
          >
            <span>Activate Fixes</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Banner with Target Website */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-sm mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100">
                  <Globe size={12} className="text-violet-500" />
                  {hostname}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <ShieldCheck size={12} />
                  Audit Verified
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Initial SEO & AI Visibility Diagnostic
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Detailed diagnostic audit for <span className="font-semibold text-slate-700">{hostname}</span>. GrowthX has mapped your current technical standing and identified 14 automated growth levers.
              </p>
            </div>

            {/* Score Badges */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-center p-3 sm:p-4 rounded-xl bg-violet-50/70 border border-violet-100 min-w-[120px]">
                <div className="text-xs font-bold uppercase tracking-wider text-violet-600 mb-1">
                  SEO Health
                </div>
                <div className="text-2xl sm:text-3xl font-black text-violet-900">
                  64<span className="text-sm font-normal text-violet-500">/100</span>
                </div>
                <div className="text-[11px] font-medium text-amber-600 mt-0.5">Needs Attention</div>
              </div>

              <div className="text-center p-3 sm:p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 min-w-[120px]">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
                  AI Visibility
                </div>
                <div className="text-2xl sm:text-3xl font-black text-indigo-900">
                  38<span className="text-sm font-normal text-indigo-500">/100</span>
                </div>
                <div className="text-[11px] font-medium text-rose-600 mt-0.5">Low LLM Share</div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-t border-slate-100 mt-6 pt-4 overflow-x-auto">
            {[
              { id: "overview", label: "Executive Summary", icon: Sparkles },
              { id: "audit", label: "Audit Findings (5)", icon: Search },
              { id: "competitors", label: "Discovered Rivals (3)", icon: Users },
              { id: "fixes", label: "30-Day Fix Plan", icon: Wrench },
            ].map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <TabIcon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Critical Blockers</span>
                  <AlertTriangle size={16} className="text-amber-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900">4 Issues</div>
                <p className="text-xs text-slate-500 mt-1">Directly impacting crawl budget & SERP positions</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Competitor Overlap</span>
                  <Users size={16} className="text-indigo-500" />
                </div>
                <div className="text-2xl font-extrabold text-slate-900">3 Competitors</div>
                <p className="text-xs text-slate-500 mt-1">Capturing 74% of high-intent search terms</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Automated Fixes</span>
                  <Zap size={16} className="text-violet-500" />
                </div>
                <div className="text-2xl font-extrabold text-violet-600">14 Ready to Deploy</div>
                <p className="text-xs text-slate-500 mt-1">GrowthX Fix Engine can implement without dev work</p>
              </div>
            </div>

            {/* GrowthX Automation Highlight Box */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-900 via-indigo-900 to-slate-950 p-6 sm:p-8 text-white shadow-xl">
              <div className="max-w-xl relative z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-200 border border-violet-400/30 mb-4">
                  <Wrench size={12} />
                  Autonomous Execution Engine
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
                  Don&apos;t just read reports. Let GrowthX fix these issues automatically.
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                  Unlike traditional SEO tools that hand you a 40-page PDF checklist, GrowthX autonomously creates the meta schema, generates citation-optimized entity pages, and deploys high-velocity content updates directly to your site.
                </p>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Link
                    href={`/register?domain=${encodeURIComponent(hostname)}`}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-violet-950 bg-white hover:bg-violet-50 shadow-lg transition-all"
                  >
                    <span>Claim Your 30-Day Fix Plan Free</span>
                    <ArrowRight size={16} />
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-violet-200 hover:text-white border border-violet-700/60 hover:bg-violet-800/40 transition-all"
                  >
                    <span>View Software Preview</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Audit Findings */}
        {activeTab === "audit" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Identified Vulnerabilities & Issues</h2>
                <p className="text-xs text-slate-500">Audited across structural DOM, Core Web Vitals, and semantic tags</p>
              </div>
              <span className="text-xs font-semibold text-slate-500">5 Findings Detected</span>
            </div>

            <div className="space-y-3">
              {AUDIT_FINDINGS.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3.5 p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-200 transition-all"
                >
                  <div className="mt-0.5 shrink-0">
                    {item.severity === "critical" ? (
                      <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                        <AlertTriangle size={16} />
                      </div>
                    ) : item.severity === "warning" ? (
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                        <AlertTriangle size={16} />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <CheckCircle size={16} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {item.category}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.severity === "critical"
                            ? "bg-red-50 text-red-700 border border-red-100"
                            : item.severity === "warning"
                            ? "bg-amber-50 text-amber-700 border border-amber-100"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        }`}
                      >
                        {item.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{item.impact}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Competitor Intelligence */}
        {activeTab === "competitors" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Direct Competitors in Your Category</h2>
              <p className="text-xs text-slate-500">
                Discovered via semantic overlap in SERP rankings and conversational AI citations
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DISCOVERED_RIVALS.map((rival, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-xl border border-slate-200/80 bg-white hover:border-violet-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700">
                      #{idx + 1}
                    </div>
                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {rival.overlapScore}% overlap
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-3 truncate">{rival.domain}</h3>
                  <div className="space-y-2 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Ranked Keywords:</span>
                      <span className="font-semibold text-slate-800">{rival.estRankedKeywords}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>AI Visibility Index:</span>
                      <span className="font-semibold text-slate-800">{rival.aiVisibilityIndex}/100</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: 30-Day Fix Plan */}
        {activeTab === "fixes" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-6">
            <div className="pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Prioritized 30-Day Fix Roadmap</h2>
                <p className="text-xs text-slate-500">
                  Ready for automated implementation via GrowthX Fix Engine
                </p>
              </div>
              <span className="text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-100">
                14 Total Actions
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  day: "Day 1–7",
                  phase: "Phase 1: Technical Schema & Crawl Optimization",
                  tasks: "Inject schema markup, resolve canonical flags, configure robots directives",
                  status: "Ready to deploy",
                },
                {
                  day: "Day 8–18",
                  phase: "Phase 2: AI Citation & Entity Positioning",
                  tasks: "Generate entity knowledge anchors and multi-channel LLM reference pages",
                  status: "Queued",
                },
                {
                  day: "Day 19–30",
                  phase: "Phase 3: Content Velocity & Keyword Gap Closure",
                  tasks: "Deploy 8 high-ranking comparison and solution pages to outrank discovered rivals",
                  status: "Queued",
                },
              ].map((phase, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-extrabold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                        {phase.day}
                      </span>
                      <span className="text-sm font-bold text-slate-900">{phase.phase}</span>
                    </div>
                    <p className="text-xs text-slate-500">{phase.tasks}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-lg shrink-0 self-start sm:self-auto">
                    {phase.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Lock / CTA overlay banner */}
            <div className="p-6 rounded-xl bg-violet-50 border border-violet-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-violet-200">
                  <Lock size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Connect your domain to execute all 14 fixes automatically
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    No developers needed. GrowthX integrates with WordPress, Webflow, Shopify, or custom Next.js apps.
                  </p>
                </div>
              </div>
              <Link
                href={`/register?domain=${encodeURIComponent(hostname)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-md transition-all shrink-0"
              >
                <span>Get Started</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AnalysisResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Sparkles size={18} className="animate-spin text-violet-600" />
            <span>Loading analysis report...</span>
          </div>
        </div>
      }
    >
      <ResultsInner />
    </Suspense>
  );
}
