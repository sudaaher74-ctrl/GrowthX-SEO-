"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  Code2,
  Cpu,
  FileSearch,
  Gauge,
  Globe,
  Link2,
  Loader2,
  Lock,
  Radar,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { api, auth, subscribeToAuthChange, type AutopilotRun } from "@/lib/api-client";
import { setActiveProject, useWorkspace } from "@/hooks/use-growthx";
import { cn } from "@/lib/utils";

function cleanDomainInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
}

function pathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + (parsed.search || "");
  } catch {
    return url;
  }
}

const INSPECTION_MODULES = [
  {
    icon: Globe,
    title: "Indexability & Canonicals",
    detail: "robots.txt, XML sitemaps, HTTP status codes & canonical tags",
    tone: "text-series-6 bg-series-6/15 border-series-6/30",
  },
  {
    icon: Gauge,
    title: "Core Web Vitals & Speed",
    detail: "LCP, INP, CLS, server response time (TTFB) & render blockers",
    tone: "text-success-400 bg-success-500/15 border-success-500/30",
  },
  {
    icon: FileSearch,
    title: "On-Page SEO & Metadata",
    detail: "Titles, meta descriptions, word count & H1–H6 heading hierarchy",
    tone: "text-accent-400 bg-accent-500/15 border-accent-500/30",
  },
  {
    icon: Code2,
    title: "Schema & Structured Data",
    detail: "JSON-LD entity validation for Google rich results & AI engines",
    tone: "text-warning-400 bg-warning-500/15 border-warning-500/30",
  },
  {
    icon: Link2,
    title: "Internal Link Architecture",
    detail: "Crawl depth, orphan pages, broken links & redirect chains",
    tone: "text-series-4 bg-series-4/15 border-series-4/30",
  },
  {
    icon: Bot,
    title: "AI Search Readiness",
    detail: "Citation structure for ChatGPT, Perplexity, Gemini & Claude",
    tone: "text-series-6 bg-series-6/15 border-series-6/30",
  },
];

function AnalyzeOnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { orgId, setOrgId, projects } = useWorkspace();

  const signedIn = useSyncExternalStore(
    subscribeToAuthChange,
    () => auth.isAuthenticated(),
    () => null,
  );

  const urlParam = (searchParams.get("url") || "").trim();

  const [domainInput, setDomainInput] = useState<string>(() => {
    if (urlParam) return cleanDomainInput(urlParam);
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("growthx_pending_domain");
        if (saved) return cleanDomainInput(saved);
      } catch {}
    }
    return "";
  });

  const [phase, setPhase] = useState<"input" | "crawling">("input");
  const [activeDomain, setActiveDomain] = useState<string>("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [initialRun, setInitialRun] = useState<AutopilotRun | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (urlParam) {
      setDomainInput(cleanDomainInput(urlParam));
    }
  }, [urlParam]);

  useEffect(() => {
    if (signedIn === false) {
      const target = domainInput ? `/login?url=${encodeURIComponent(domainInput)}` : "/login";
      router.replace(target);
    }
  }, [signedIn, domainInput, router]);

  // Poll live crawl status once crawling starts
  const crawlQuery = useQuery({
    queryKey: ["onboarding-crawl", activeDomain],
    queryFn: () => api.getLatestCrawl(activeDomain),
    enabled: phase === "crawling" && Boolean(activeDomain),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
        return false;
      }
      return 2000;
    },
  });

  const crawlData = crawlQuery.data;
  const crawlId = crawlData?.id ?? null;
  const crawlStatus = crawlData?.status ?? "PENDING";
  const isCompleted = crawlStatus === "COMPLETED";
  const isFailed = crawlStatus === "FAILED" || crawlStatus === "CANCELLED";

  // Poll live discovered pages from the active crawl job
  const pagesQuery = useQuery({
    queryKey: ["onboarding-crawl-pages", crawlId],
    queryFn: () => api.getCrawlPages(crawlId!, { page: 1, limit: 12 }),
    enabled: phase === "crawling" && Boolean(crawlId),
    refetchInterval: isCompleted || isFailed ? false : 2500,
  });

  // Poll live detected issues from the active crawl job
  const issuesQuery = useQuery({
    queryKey: ["onboarding-crawl-issues", crawlId],
    queryFn: () => api.getCrawlIssues(crawlId!, { page: 1, limit: 6 }),
    enabled: phase === "crawling" && Boolean(crawlId),
    refetchInterval: isCompleted || isFailed ? false : 3000,
  });

  // Poll autopilot run log for additional live status lines
  const autopilotQuery = useQuery({
    queryKey: ["onboarding-autopilot", activeProjectId],
    queryFn: () => api.autopilot.latest(activeProjectId!),
    enabled: phase === "crawling" && Boolean(activeProjectId),
    initialData: initialRun,
    refetchInterval: isCompleted || isFailed ? false : 3000,
  });

  const crawledPages = pagesQuery.data?.data ?? [];
  const totalPagesRecorded = Math.max(
    crawlData?.pagesCrawled ?? 0,
    pagesQuery.data?.meta?.total ?? 0,
    crawledPages.length,
  );
  const crawledIssues = issuesQuery.data?.data ?? [];
  const totalIssuesRecorded = Math.max(
    crawlData?.issuesFound ?? 0,
    issuesQuery.data?.meta?.totalFindings ?? 0,
    issuesQuery.data?.meta?.total ?? 0,
    crawledIssues.length,
  );
  const healthScore = crawlData?.healthScore ?? issuesQuery.data?.meta?.healthScore ?? null;
  const autopilotLogs = autopilotQuery.data?.log ?? initialRun?.log ?? [];

  // Elapsed timer while crawling
  useEffect(() => {
    if (phase !== "crawling" || isCompleted || isFailed) return;
    const interval = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, isCompleted, isFailed]);

  // Automatically redirect to Website Audit (/website) when the crawl finishes
  useEffect(() => {
    if (phase !== "crawling" || !isCompleted) return;
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["latest-crawl"] });
      queryClient.invalidateQueries({ queryKey: ["issue-counts"] });
      queryClient.invalidateQueries({ queryKey: ["issue-groups"] });
      router.replace("/website");
    }, 1200);
    return () => clearTimeout(timer);
  }, [phase, isCompleted, queryClient, router]);

  async function handleStartAudit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = cleanDomainInput(domainInput);
    if (!cleaned || !cleaned.includes(".")) {
      setError("Please enter a valid website domain, e.g. yourwebsite.com");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      let resolvedOrgId = orgId || auth.getOrgId();
      if (!resolvedOrgId) {
        const orgs = await api.listOrganizations();
        if (orgs?.[0]?.id) {
          resolvedOrgId = orgs[0].id;
          setOrgId(resolvedOrgId);
        }
      }

      const run = await api.autopilot.start(cleaned, null);

      try {
        localStorage.removeItem("growthx_pending_domain");
      } catch {}

      if (resolvedOrgId) {
        queryClient.setQueryData<{ id: string; name: string }[]>(
          ["projects", resolvedOrgId],
          (current = []) =>
            current.some((project) => project.id === run.projectId)
              ? current
              : [...current, { id: run.projectId, name: run.domain }],
        );
      }

      setActiveProject(run.projectId);
      setActiveProjectId(run.projectId);
      setInitialRun(run);
      queryClient.setQueryData(["autopilot", run.projectId], run);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });

      setElapsedSec(0);
      setActiveDomain(run.domain || cleaned);
      setPhase("crawling");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the website audit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (signedIn !== true) return null;

  const previewDomain = cleanDomainInput(domainInput) || "yourwebsite.com";

  const crawlSteps = [
    {
      label: "Origin Handshake & robots.txt",
      detail: `Connected to https://${activeDomain} · SSL & crawl directives verified`,
      done: true,
      active: false,
    },
    {
      label: "Sitemap & Internal Link Spider",
      detail:
        totalPagesRecorded > 0
          ? `${totalPagesRecorded} ${totalPagesRecorded === 1 ? "page" : "pages"} fetched and parsed`
          : "Following XML sitemaps and internal <a href> graph…",
      done: isCompleted,
      active: !isCompleted && !isFailed,
    },
    {
      label: "DOM, Metadata & Core Web Vitals Audit",
      detail:
        totalIssuesRecorded > 0
          ? `${totalIssuesRecorded} technical & SEO findings recorded across scanned pages`
          : "Inspecting titles, canonicals, headings, schema & response speed",
      done: isCompleted,
      active: !isCompleted && !isFailed && totalPagesRecorded > 0,
    },
    {
      label: "Website Audit Report Compilation",
      detail: isCompleted
        ? "Complete! Opening your Website Audit command center…"
        : "Scoring technical health and prioritizing fixes",
      done: isCompleted,
      active: isCompleted,
    },
  ];

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-brand-950 text-brand-50 overflow-hidden selection:bg-series-6 selection:text-white">
      {/* ── ARCHITECTURAL BACKGROUND GRID & AMBIENT STUDIO GLOWS ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Ambient radial studio lights */}
        <div className="absolute -top-48 left-1/4 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-series-6/15 blur-[140px]" />
        <div className="absolute top-1/3 -right-32 h-[500px] w-[500px] rounded-full bg-accent-600/12 blur-[140px]" />
        <div className="absolute -bottom-48 left-1/2 h-[480px] w-[640px] -translate-x-1/2 rounded-full bg-success-500/10 blur-[140px]" />

        {/* Subtle technical grid pattern */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.07]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="reigel-crawler-grid"
              width="44"
              height="44"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 44 0 L 0 0 0 44"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
              />
              <circle cx="44" cy="44" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#reigel-crawler-grid)" />
        </svg>
      </div>

      {/* ── EXECUTIVE COMMAND HEADER ── */}
      <header className="relative z-20 border-b border-brand-800/80 bg-brand-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal-400 font-mono text-sm font-black text-signal-ink shadow-sm">
              R
            </span>
            <span className="text-base font-black tracking-tight text-white">
              Reigel
            </span>
            <span className="hidden sm:inline-block rounded-md border border-brand-800 bg-brand-900 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-widest text-brand-300">
              Crawler Studio
            </span>
          </Link>

          {/* 3-Step Mission Stepper */}
          <div className="hidden md:flex items-center gap-2 rounded-full border border-brand-800/90 bg-brand-900/80 px-3 py-1.5 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold transition",
                phase === "input"
                  ? "bg-series-6 text-white shadow-xs"
                  : "text-success-400",
              )}
            >
              {phase === "crawling" ? <Check size={12} strokeWidth={3} /> : <span className="font-mono text-[10px]">01</span>}
              <span>Connect Domain</span>
            </span>
            <span className="text-brand-600">→</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold transition",
                phase === "crawling" && !isCompleted
                  ? "bg-series-6 text-white shadow-xs"
                  : isCompleted
                    ? "text-success-400"
                    : "text-brand-400",
              )}
            >
              {isCompleted ? (
                <Check size={12} strokeWidth={3} />
              ) : phase === "crawling" ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <span className="font-mono text-[10px]">02</span>
              )}
              <span>Deep Technical Crawl</span>
            </span>
            <span className="text-brand-600">→</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold transition",
                isCompleted ? "bg-success-500 text-white" : "text-brand-500",
              )}
            >
              <span className="font-mono text-[10px]">03</span>
              <span>Website Audit</span>
            </span>
          </div>

          {/* Right Status / Skip */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-brand-800 bg-brand-900/90 px-3 py-1 text-[11px] font-medium text-brand-300">
              <span className="h-1.5 w-1.5 rounded-full bg-success-400 animate-pulse" />
              Crawler Engine Online
            </span>
            {projects.length > 0 && phase === "input" && (
              <Link
                href="/website"
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-700 bg-brand-900 hover:bg-brand-800 px-3.5 py-1.5 text-xs font-bold text-white transition"
              >
                <span>Open Website Audit</span>
                <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN WORKSPACE ── */}
      <main className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center px-4 py-8 sm:px-6 lg:px-8">
        {phase === "input" ? (
          /* =================================================================
             PHASE 1: SPLIT-SCREEN WEBSITE AUDIT LAUNCHPAD
             ================================================================= */
          <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
            {/* LEFT COLUMN: Launch Form & 6-Module Matrix */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-series-6/40 bg-series-6/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-200">
                <Sparkles size={12} className="text-series-6" />
                <span>Autonomous Technical SEO & AI Crawler</span>
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.1]">
                  Launch your deep <br />
                  <span className="bg-gradient-to-r from-series-6 via-accent-300 to-success-400 bg-clip-text text-transparent">
                    website audit.
                  </span>
                </h1>
                <p className="mt-3 max-w-xl text-sm sm:text-base text-brand-300 leading-relaxed">
                  Enter your website domain below. Reigel&apos;s crawler will map your internal pages, inspect technical health, Core Web Vitals, schema markup, and open your full{" "}
                  <strong className="font-semibold text-white">Website Audit</strong> command center automatically.
                </p>
              </div>

              {/* Command Input Bar */}
              <form onSubmit={handleStartAudit} className="space-y-3" noValidate>
                <div className="rounded-2xl border border-brand-700/90 bg-brand-900/90 p-2 shadow-2xl backdrop-blur-xl transition-all focus-within:border-series-6 focus-within:ring-4 focus-within:ring-series-6/15">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-2.5 px-3 py-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-800 border border-brand-700 text-series-6">
                        <Globe size={18} />
                      </div>
                      <span className="select-none font-mono text-xs sm:text-sm font-semibold text-brand-400">
                        https://
                      </span>
                      <input
                        id="onboarding-domain"
                        type="text"
                        required
                        autoFocus
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        placeholder="yourwebsite.com"
                        className="w-full min-w-0 bg-transparent font-mono text-sm sm:text-base font-bold text-white placeholder:text-brand-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-series-6 hover:bg-series-6/90 active:scale-[0.99] px-6 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-series-6/25 transition-all cursor-pointer disabled:opacity-60"
                    >
                      {submitting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Launching Crawler…</span>
                        </>
                      ) : (
                        <>
                          <span>Start Website Audit</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-error-500/40 bg-error-950/50 px-4 py-2.5 text-xs font-semibold text-error-300"
                  >
                    <AlertTriangle size={14} className="shrink-0 text-error-400" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1 text-xs text-brand-400">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-success-400" />
                    Safe, read-only bot crawl
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Zap size={13} className="text-series-6" />
                    Real-time page & issue telemetry
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Lock size={13} className="text-accent-400" />
                    Opens Website Audit automatically
                  </span>
                </div>
              </form>

              {/* 6-Module Inspection Matrix */}
              <div className="pt-2">
                <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-widest text-brand-400">
                  What our crawler inspects on every page
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {INSPECTION_MODULES.map((mod) => {
                    const Icon = mod.icon;
                    return (
                      <div
                        key={mod.title}
                        className="rounded-2xl border border-brand-800/80 bg-brand-900/50 p-3.5 backdrop-blur-sm transition hover:border-brand-700 hover:bg-brand-900/80"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                              mod.tone,
                            )}
                          >
                            <Icon size={14} />
                          </span>
                          <h3 className="text-xs font-bold text-white leading-tight">
                            {mod.title}
                          </h3>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-brand-400">
                          {mod.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Interactive Technical Crawler Scanner Preview */}
            <div className="lg:col-span-5">
              <div className="relative rounded-3xl border border-brand-800 bg-brand-900/75 p-6 shadow-2xl backdrop-blur-xl overflow-hidden">
                {/* Top Terminal Chrome */}
                <div className="flex items-center justify-between border-b border-brand-800 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-error-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-warning-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-success-500/80" />
                    <span className="ml-2 font-mono text-[11px] font-semibold text-brand-300">
                      crawler-engine://target-scanner
                    </span>
                  </div>
                  <span className="rounded-md border border-brand-700 bg-brand-800 px-2 py-0.5 font-mono text-[10px] font-bold text-series-6">
                    READY
                  </span>
                </div>

                {/* Orbital Radar Graphic */}
                <div className="relative my-6 flex flex-col items-center justify-center py-6">
                  <div className="relative flex h-44 w-44 items-center justify-center">
                    {/* Outer pulsing rings */}
                    <div className="absolute inset-0 rounded-full border border-brand-700/60" />
                    <div className="absolute inset-4 rounded-full border border-dashed border-series-6/40 animate-[spin_24s_linear_infinite]" />
                    <div className="absolute inset-9 rounded-full border border-brand-700/80" />
                    <div className="absolute inset-14 rounded-full border border-accent-500/30 bg-series-6/10 animate-pulse" />

                    {/* Crosshairs */}
                    <div className="absolute inset-x-0 top-1/2 h-px bg-brand-800/80" />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-brand-800/80" />

                    {/* Center Core */}
                    <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-series-6/50 bg-brand-950 shadow-lg shadow-series-6/20">
                      <Radar size={24} className="text-series-6" />
                    </div>
                  </div>

                  {/* Target Domain Lock Pill */}
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-brand-700 bg-brand-950/90 px-4 py-1.5 font-mono text-xs font-bold text-white shadow-md">
                    <span className="h-2 w-2 rounded-full bg-success-400 animate-pulse" />
                    <span>https://{previewDomain}</span>
                  </div>
                </div>

                {/* Crawler Pipeline Stages Preview */}
                <div className="space-y-2 border-t border-brand-800 pt-4 font-mono text-[11px]">
                  {[
                    { step: "01", name: "DNS, TLS & robots.txt handshake", tag: "20 threads" },
                    { step: "02", name: "XML Sitemap & internal link spider", tag: "Depth 20" },
                    { step: "03", name: "DOM, Schema & Core Web Vitals parser", tag: "128 rules" },
                    { step: "04", name: "AI Fix Engine & Website Audit sync", tag: "Auto-route" },
                  ].map((row) => (
                    <div
                      key={row.step}
                      className="flex items-center justify-between rounded-xl border border-brand-800/80 bg-brand-950/60 px-3 py-2 text-brand-300"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="text-series-6 font-bold">{row.step}</span>
                        <span className="truncate">{row.name}</span>
                      </div>
                      <span className="shrink-0 rounded bg-brand-900 px-1.5 py-0.5 text-[9.5px] text-brand-400 border border-brand-800">
                        {row.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =================================================================
             PHASE 2: LIVE TECHNICAL CRAWLING MISSION CONTROL
             ================================================================= */
          <div className="w-full space-y-6">
            {/* Top Live Telemetry Banner */}
            <div className="rounded-3xl border border-brand-800 bg-brand-900/80 p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wider",
                        isCompleted
                          ? "border border-success-500/40 bg-success-500/15 text-success-400"
                          : "border border-series-6/40 bg-series-6/15 text-series-6",
                      )}
                    >
                      {isCompleted ? (
                        <>
                          <Check size={12} strokeWidth={3} />
                          Audit Complete
                        </>
                      ) : (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Live Technical Crawl Running
                        </>
                      )}
                    </span>

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-700 bg-brand-950 px-3 py-1 font-mono text-xs font-bold text-white">
                      <Globe size={12} className="text-series-6" />
                      https://{activeDomain}
                    </span>

                    <span className="rounded-full border border-brand-800 bg-brand-950/80 px-2.5 py-1 font-mono text-xs text-brand-300">
                      Elapsed: <strong className="text-white">{formatElapsed(elapsedSec)}</strong>
                    </span>
                  </div>

                  <h1 className="pt-1 text-2xl sm:text-3xl font-black tracking-tight text-white">
                    {isCompleted
                      ? `Finished auditing ${activeDomain} — opening Website Audit…`
                      : `Crawling and analyzing ${activeDomain} in real time…`}
                  </h1>
                </div>

                {/* Live 3-Metric Telemetry Strip */}
                <div className="grid grid-cols-3 gap-3 shrink-0">
                  <div className="rounded-2xl border border-brand-800 bg-brand-950/90 px-4 py-2.5 text-center">
                    <p className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-brand-400">
                      Pages Scanned
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-black text-white">
                      {totalPagesRecorded}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-800 bg-brand-950/90 px-4 py-2.5 text-center">
                    <p className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-brand-400">
                      Findings Flagged
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-black text-warning-400">
                      {totalIssuesRecorded}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-800 bg-brand-950/90 px-4 py-2.5 text-center">
                    <p className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-brand-400">
                      Health Score
                    </p>
                    <p className="mt-0.5 font-mono text-2xl font-black text-success-400">
                      {healthScore != null ? `${healthScore}` : "…"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2-Column Mission Control Body */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* LEFT COLUMN: Active Radar + 4-Stage Pipeline */}
              <div className="lg:col-span-5 space-y-6">
                <div className="rounded-3xl border border-brand-800 bg-brand-900/80 p-6 shadow-2xl backdrop-blur-xl">
                  <div className="flex items-center justify-between border-b border-brand-800 pb-3.5">
                    <div className="flex items-center gap-2">
                      <Cpu size={16} className="text-series-6" />
                      <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                        Crawler Execution Pipeline
                      </h2>
                    </div>
                    <span className="font-mono text-[10px] text-brand-400">
                      {isCompleted ? "4/4 Stages Complete" : "Active Spider"}
                    </span>
                  </div>

                  {/* Compact Live Radar Header */}
                  <div className="my-4 flex items-center gap-4 rounded-2xl border border-brand-800 bg-brand-950/80 p-4">
                    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                      <div
                        className={cn(
                          "absolute inset-0 rounded-full border border-dashed",
                          isCompleted
                            ? "border-success-500/60"
                            : "border-series-6/60 animate-[spin_8s_linear_infinite]",
                        )}
                      />
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-series-6/15 text-series-6">
                        {isCompleted ? (
                          <Check size={20} className="text-success-400" strokeWidth={3} />
                        ) : (
                          <Radar size={20} className="animate-pulse" />
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs font-bold text-white">
                        {activeDomain}
                      </p>
                      <p className="mt-0.5 text-[11px] text-brand-400">
                        {isCompleted
                          ? "All discovered pages indexed & scored"
                          : totalPagesRecorded > 0
                            ? `Parsing DOM & links (${totalPagesRecorded} pages)…`
                            : "Connecting to origin & reading sitemaps…"}
                      </p>
                    </div>
                  </div>

                  {/* 4 Pipeline Steps */}
                  <div className="space-y-2.5">
                    {crawlSteps.map((s, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border p-3.5 transition-all",
                          s.done
                            ? "border-success-500/30 bg-success-500/10"
                            : s.active
                              ? "border-series-6/50 bg-brand-950/90 shadow-md"
                              : "border-brand-800/60 bg-brand-950/40 opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
                            s.done
                              ? "bg-success-500 text-white"
                              : s.active
                                ? "bg-series-6 text-white"
                                : "border border-brand-700 text-brand-400",
                          )}
                        >
                          {s.done ? (
                            <Check size={13} strokeWidth={3} />
                          ) : s.active ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white">{s.label}</p>
                          <p className="mt-0.5 text-[11px] text-brand-300">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Live Technical Crawler Stream & Discovered Pages */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="flex flex-1 flex-col justify-between rounded-3xl border border-brand-800 bg-brand-900/80 p-6 shadow-2xl backdrop-blur-xl">
                  <div>
                    {/* Terminal Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-800 pb-3.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-error-500/80" />
                        <span className="h-2.5 w-2.5 rounded-full bg-warning-500/80" />
                        <span className="h-2.5 w-2.5 rounded-full bg-success-500/80" />
                        <Terminal size={14} className="ml-1.5 text-series-6" />
                        <span className="font-mono text-xs font-bold text-white">
                          LIVE CRAWLER TELEMETRY · {activeDomain}
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 font-mono text-[10.5px] text-brand-400">
                        <Activity size={12} className="text-success-400" />
                        Real-time feed
                      </span>
                    </div>

                    {/* Autopilot / Engine Status Log Strip */}
                    {autopilotLogs.length > 0 && (
                      <div className="mt-4 rounded-2xl border border-brand-800 bg-brand-950/90 p-3 font-mono text-[11px] space-y-1">
                        {autopilotLogs.slice(-3).map((entry, i) => (
                          <div key={i} className="flex items-center gap-2 text-brand-300">
                            <span className="text-success-400">▸</span>
                            <span className="truncate">{entry.message}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Discovered Pages Live Stream */}
                    <div className="mt-4">
                      <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-brand-400">
                        <span>Discovered Pages Stream</span>
                        <span className="font-mono text-brand-300">
                          {crawledPages.length > 0
                            ? `Showing latest ${crawledPages.length} of ${totalPagesRecorded} pages`
                            : "Awaiting first page response…"}
                        </span>
                      </div>

                      <div className="max-h-[260px] overflow-y-auto rounded-2xl border border-brand-800 bg-brand-950/90 divide-y divide-brand-800/70 font-mono text-xs">
                        {crawledPages.length > 0 ? (
                          crawledPages.map((p) => {
                            const ok = p.statusCode >= 200 && p.statusCode < 300;
                            const redirect = p.statusCode >= 300 && p.statusCode < 400;
                            return (
                              <div
                                key={p.id}
                                className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-brand-900/60 transition"
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <span
                                    className={cn(
                                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                                      ok
                                        ? "bg-success-500/15 text-success-400 border border-success-500/30"
                                        : redirect
                                          ? "bg-warning-500/15 text-warning-400 border border-warning-500/30"
                                          : "bg-error-500/15 text-error-400 border border-error-500/30",
                                    )}
                                  >
                                    {p.statusCode || "—"}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate font-semibold text-white">
                                      {pathFromUrl(p.url)}
                                    </p>
                                    {p.title && (
                                      <p className="truncate font-sans text-[10.5px] text-brand-400">
                                        {p.title}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-2 text-[10.5px] text-brand-400">
                                  {p.responseTimeMs > 0 && <span>{p.responseTimeMs}ms</span>}
                                  {p.wordCount > 0 && (
                                    <span className="hidden sm:inline rounded bg-brand-900 px-1.5 py-0.5 text-[10px] text-brand-300">
                                      {p.wordCount}w
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                            <Loader2 size={22} className="animate-spin text-series-6 mb-2.5" />
                            <p className="font-sans text-xs font-semibold text-white">
                              Connecting to https://{activeDomain} and discovering URLs…
                            </p>
                            <p className="mt-1 font-sans text-[11px] text-brand-400">
                              Crawled pages, HTTP status codes, and response times will stream here live as they arrive.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Live Findings Stream (once issues start arriving) */}
                    {crawledIssues.length > 0 && (
                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-brand-400">
                          <span>Live Technical Findings</span>
                          <span className="font-mono text-warning-400">
                            {totalIssuesRecorded} detected
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {crawledIssues.slice(0, 4).map((iss) => (
                            <div
                              key={iss.id}
                              className="rounded-xl border border-brand-800 bg-brand-950/80 px-3 py-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold",
                                    iss.severity === "CRITICAL" || iss.severity === "HIGH"
                                      ? "bg-error-500/15 text-error-400"
                                      : "bg-warning-500/15 text-warning-400",
                                  )}
                                >
                                  {iss.severity}
                                </span>
                                <span className="truncate font-mono text-[10px] text-brand-400">
                                  {pathFromUrl(iss.affectedUrl)}
                                </span>
                              </div>
                              <p className="mt-1 truncate font-medium text-brand-200">
                                {iss.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="mt-6 flex flex-col gap-3 border-t border-brand-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-brand-400">
                      {isCompleted
                        ? "Crawl finished! Opening your Website Audit report automatically…"
                        : "You will be redirected to Website Audit automatically when the scan completes."}
                    </p>
                    <button
                      type="button"
                      onClick={() => router.replace("/website")}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-series-6 hover:bg-series-6/90 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-series-6/25 transition cursor-pointer"
                    >
                      <span>Open Website Audit Now</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="relative z-10 border-t border-brand-900/80 py-4 text-center text-xs text-brand-500">
        Reigel AI SEO · Autonomous Technical Crawler & Fix Engine
      </footer>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-brand-950 text-brand-50">
          <Loader2 size={24} className="animate-spin text-series-6" />
        </div>
      }
    >
      <AnalyzeOnboardingInner />
    </Suspense>
  );
}
