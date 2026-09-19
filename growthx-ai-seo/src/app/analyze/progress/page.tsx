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
        const increment = 6;
        const next = Math.min(prev + increment, 100);

        if (currentLogIndex < logPool.length) {
          setLogs((l) => [...l.slice(-4), logPool[currentLogIndex]]);
          currentLogIndex++;
        }

        return next;
      });
    }, 450);

    return () => clearInterval(timer);
  }, [hostname]);

  const isFinished = progress >= 100;

  return (
    <div className="min-h-screen bg-brand-950 text-brand-50 flex flex-col relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-series-6/10 blur-[140px] rounded-full pointer-events-none" />

      {/* Header with Step Tracker */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-brand-800 bg-brand-950/80 backdrop-blur-md relative z-10">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-white">
          Growth<span className="text-series-6">X</span>
        </Link>
        <div className="flex items-center gap-2">
          {[
            { num: "01", label: "Website", completed: true },
            { num: "02", label: "Analyze", active: !isFinished, completed: isFinished },
            { num: "03", label: "Results", active: isFinished },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-brand-800" />}
              <div
                className={`flex items-center gap-1.5 text-[12px] font-semibold ${
                  step.active
                    ? "text-series-6"
                    : step.completed
                    ? "text-success-400"
                    : "text-brand-500"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step.completed
                      ? "bg-success-600 text-white"
                      : step.active
                      ? "bg-series-6 text-white animate-pulse"
                      : "bg-brand-900 border border-brand-800 text-brand-500"
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
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-2xl">
          {/* Domain Tag */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-brand-900 text-brand-300 border border-brand-800">
              <Globe size={12} className="text-series-6" />
              {hostname}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success-950/60 text-success-400 border border-success-800/60">
              <ShieldCheck size={12} />
              Live Scan
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white text-center tracking-tight mb-2">
            {isFinished ? "Analysis Complete!" : "Analyzing Your Website..."}
          </h1>
          <p className="text-sm sm:text-base text-brand-400 text-center mb-8">
            {isFinished
              ? "Your baseline audit, competitor insights, and 30-day fix roadmap are ready."
              : "GrowthX is mapping your technical health, search authority, and AI visibility."}
          </p>

          {/* Large Progress Bar & Percentage */}
          <div className="bg-brand-900/50 rounded-2xl border border-brand-800 p-6 shadow-xl mb-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                Overall Progress
              </span>
              <span className="text-2xl font-extrabold text-series-6 tabular-nums">
                {progress}%
              </span>
            </div>
            <div className="w-full h-3.5 bg-brand-950 rounded-full overflow-hidden p-0.5 border border-brand-800">
              <div
                className="h-full bg-gradient-to-r from-series-6 to-accent-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Workflow Stages Checklist */}
          <div className="bg-brand-900/40 rounded-2xl border border-brand-800 p-5 shadow-xl space-y-3 mb-6">
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
                      ? "bg-series-6/10 border border-series-6/30"
                      : isStageDone
                      ? "bg-brand-950/50"
                      : "opacity-40"
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      isStageDone
                        ? "bg-success-600 text-white"
                        : isStageCurrent
                        ? "bg-series-6 text-white"
                        : "bg-brand-800 text-brand-400"
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
                            ? "text-white"
                            : isStageCurrent
                            ? "text-white font-bold"
                            : "text-brand-400"
                        }`}
                      >
                        {stage.title}
                      </p>
                      <span className="text-[11px] font-medium text-brand-400">
                        {isStageDone ? "Done" : isStageCurrent ? "In progress..." : "Pending"}
                      </span>
                    </div>
                    <p className="text-xs text-brand-400 mt-0.5 line-clamp-1">{stage.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real-time Diagnostics Terminal Box */}
          <div className="bg-brand-900 rounded-xl p-4 text-xs font-mono text-brand-300 shadow-md mb-8 border border-brand-800">
            <div className="flex items-center gap-2 pb-2 mb-2 border-b border-brand-800 text-brand-400 text-[11px]">
              <Terminal size={13} className="text-series-6" />
              <span>Crawler Diagnostics Console</span>
            </div>
            <div className="space-y-1 overflow-hidden min-h-[76px]">
              {logs.map((log, idx) => (
                <div key={idx} className="truncate text-brand-300">
                  <span className="text-series-6 font-semibold">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>

          {/* Action CTA */}
          <div className="flex justify-center">
            {isFinished ? (
              <button
                onClick={() =>
                  router.push(`/register?domain=${encodeURIComponent(hostname)}`)
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-semibold text-white bg-series-6 hover:bg-series-6/90 shadow-lg shadow-series-6/20 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <span>View Full Analysis Results</span>
                <ArrowRight size={18} />
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-brand-400">
                <Loader2 size={14} className="animate-spin text-series-6" />
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
        <div className="min-h-screen flex items-center justify-center bg-brand-950">
          <div className="flex items-center gap-2 text-brand-400 text-sm">
            <Loader2 size={18} className="animate-spin text-series-6" />
            <span>Loading analysis engine...</span>
          </div>
        </div>
      }
    >
      <ProgressInner />
    </Suspense>
  );
}
