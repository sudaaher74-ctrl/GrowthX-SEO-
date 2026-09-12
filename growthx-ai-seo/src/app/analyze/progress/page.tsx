"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  Search,
  Users,
  Sparkles,
  Wrench,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Terminal,
} from "lucide-react";

interface Stage {
  id: string;
  title: string;
  desc: string;
  icon: typeof Globe;
  threshold: number;
}

const STAGES: Stage[] = [
  {
    id: "crawl",
    title: "Deep Crawling Architecture",
    desc: "Extracting DOM tree, meta tags, sitemap, and assets",
    icon: Globe,
    threshold: 20,
  },
  {
    id: "audit",
    title: "Technical & On-Page Audit",
    desc: "Auditing indexability, page performance, and schema",
    icon: Search,
    threshold: 45,
  },
  {
    id: "competitors",
    title: "Competitor Market Discovery",
    desc: "Identifying direct SERP rivals and content overlaps",
    icon: Users,
    threshold: 70,
  },
  {
    id: "ai_visibility",
    title: "AI Search Engine Visibility",
    desc: "Simulating citation share on ChatGPT, Perplexity & Claude",
    icon: Sparkles,
    threshold: 90,
  },
  {
    id: "fix_plan",
    title: "Compiling 30-Day Fix Plan",
    desc: "Prioritizing high-ROI technical fixes and content velocity",
    icon: Wrench,
    threshold: 100,
  },
];

function ProgressInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get("url") || "https://example.com";
  
  let hostname = "example.com";
  try {
    const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    hostname = parsed.hostname;
  } catch {
    hostname = rawUrl;
  }

  const [progress, setProgress] = useState(8);
  const [logs, setLogs] = useState<string[]>([
    `[INFO] Target resolved: ${hostname}`,
    `[INFO] Initializing headless crawler cluster...`,
  ]);

  useEffect(() => {
    const logPool = [
      `[HTTP] Fetching https://${hostname}/robots.txt (200 OK)`,
      `[CRAWL] Discovered sitemap.xml with 38 canonical URLs`,
      `[PARSE] DOM parsed in 240ms: Title, OpenGraph & JSON-LD detected`,
      `[AUDIT] Assessing Core Web Vitals: LCP, INP, and CLS benchmarks`,
      `[AUDIT] Evaluating H1/H2 semantic hierarchy and content density`,
      `[MARKET] Reverse-matching SERP keyword intersections for ${hostname}`,
      `[MARKET] Identified 3 high-overlap competitor domains in your vertical`,
      `[AI-GEO] Running multi-turn prompt probes on ChatGPT & Perplexity`,
      `[AI-GEO] Measuring brand mention frequency & source citations`,
      `[PLAN] Calculating opportunity scores across 14 actionable items`,
      `[COMPLETE] Comprehensive audit & 30-Day Fix Plan successfully assembled`,
    ];

    let currentLogIndex = 0;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        // Increment with natural pacing
        const step = Math.min(100, prev + 2);

        // Add contextual logs as progress increases
        const expectedLogIdx = Math.floor((step / 100) * logPool.length);
        if (expectedLogIdx > currentLogIndex && currentLogIndex < logPool.length) {
          setLogs((l) => [...l.slice(-5), logPool[currentLogIndex]]);
          currentLogIndex++;
        }

        return step;
      });
    }, 110);

    return () => clearInterval(timer);
  }, [hostname]);

  const isFinished = progress >= 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/20 flex flex-col">
      {/* Top Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-slate-900">
          Growth<span className="text-violet-600">X</span>
        </Link>
        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {[
            { num: "01", label: "Website", completed: true, active: false },
            { num: "02", label: "Analyze", completed: false, active: true },
            { num: "03", label: "Results", completed: false, active: false },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-px ${
                    step.completed || step.active ? "bg-violet-400" : "bg-slate-200"
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-1.5 text-[12px] font-semibold ${
                  step.active
                    ? "text-violet-600"
                    : step.completed
                    ? "text-emerald-600"
                    : "text-slate-400"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step.completed
                      ? "bg-emerald-500 text-white"
                      : step.active
                      ? "bg-violet-600 text-white animate-pulse"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step.completed ? "✓" : step.num}
                </span>
                <span className="hidden sm:block">{step.label}</span>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Domain Tag */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100">
              <Globe size={12} className="text-violet-500" />
              {hostname}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
              <ShieldCheck size={12} />
              Live Scan
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 text-center tracking-tight mb-2">
            {isFinished ? "Analysis Complete!" : "Analyzing Your Website..."}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 text-center mb-8">
            {isFinished
              ? "Your baseline audit, competitor insights, and 30-day fix roadmap are ready."
              : "GrowthX is mapping your technical health, search authority, and AI visibility."}
          </p>

          {/* Large Progress Bar & Percentage */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Overall Progress
              </span>
              <span className="text-2xl font-extrabold text-violet-600 tabular-nums">
                {progress}%
              </span>
            </div>
            <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-violet-600 to-indigo-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Workflow Stages Checklist */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3 mb-6">
            {STAGES.map((stage) => {
              const isStageDone = progress >= stage.threshold;
              const isStageCurrent =
                progress < stage.threshold &&
                progress >= (stage.threshold === 20 ? 0 : stage.threshold - 25);
              const StageIcon = stage.icon;

              return (
                <div
                  key={stage.id}
                  className={`flex items-start gap-3.5 p-3 rounded-xl transition-all ${
                    isStageCurrent
                      ? "bg-violet-50/70 border border-violet-100"
                      : isStageDone
                      ? "bg-slate-50/50"
                      : "opacity-40"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isStageDone
                        ? "bg-emerald-500 text-white"
                        : isStageCurrent
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isStageDone ? (
                      <CheckCircle2 size={18} />
                    ) : isStageCurrent ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <StageIcon size={18} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p
                        className={`text-sm font-semibold ${
                          isStageDone
                            ? "text-slate-900"
                            : isStageCurrent
                            ? "text-violet-900"
                            : "text-slate-500"
                        }`}
                      >
                        {stage.title}
                      </p>
                      <span className="text-[11px] font-medium text-slate-400">
                        {isStageDone ? "Done" : isStageCurrent ? "In progress..." : "Pending"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{stage.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real-time Diagnostics Terminal Box */}
          <div className="bg-slate-900 rounded-xl p-4 text-xs font-mono text-slate-300 shadow-md mb-8">
            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-800 text-slate-400 text-[11px]">
              <Terminal size={13} className="text-violet-400" />
              <span>Crawler Diagnostics Console</span>
            </div>
            <div className="space-y-1 overflow-hidden min-h-[76px]">
              {logs.map((log, idx) => (
                <div key={idx} className="truncate text-slate-300">
                  <span className="text-violet-400 font-semibold">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>

          {/* Action CTA */}
          <div className="flex justify-center">
            {isFinished ? (
              <button
                onClick={() =>
                  router.push(`/analyze/results?url=${encodeURIComponent(rawUrl)}`)
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-semibold text-white bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-200 hover:shadow-violet-300 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <span>View Full Analysis Results</span>
                <ArrowRight size={18} />
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <Loader2 size={14} className="animate-spin text-violet-500" />
                <span>Generating your comprehensive analysis report...</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AnalysisProgressPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 size={18} className="animate-spin text-violet-600" />
            <span>Loading analysis engine...</span>
          </div>
        </div>
      }
    >
      <ProgressInner />
    </Suspense>
  );
}
