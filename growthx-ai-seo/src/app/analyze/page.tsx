"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  Code2,
  Cpu,
  FileCode2,
  Globe,
  Layers,
  Link2,
  Loader2,
  Radar,
  Terminal,
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
    return (parsed.pathname || "/") + (parsed.search || "");
  } catch {
    return url || "/";
  }
}

const BLUEPRINT_NODES = [
  { path: "/", label: "Root Document", type: "HTML · Entry" },
  { path: "/sitemap.xml", label: "XML Sitemap", type: "Index Graph" },
  { path: "/robots.txt", label: "Robots Directives", type: "Crawl Rules" },
  { path: "/products", label: "Primary Category", type: "Internal Link" },
  { path: "/about", label: "Brand Entity", type: "Schema Node" },
  { path: "/contact", label: "Local / NAP Node", type: "Conversion" },
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
  const [activeNodeIdx, setActiveNodeIdx] = useState(0);

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
    queryFn: () => api.getCrawlPages(crawlId!, { page: 1, limit: 16 }),
    enabled: phase === "crawling" && Boolean(crawlId),
    refetchInterval: isCompleted || isFailed ? false : 2000,
  });

  // Poll live detected issues from the active crawl job
  const issuesQuery = useQuery({
    queryKey: ["onboarding-crawl-issues", crawlId],
    queryFn: () => api.getCrawlIssues(crawlId!, { page: 1, limit: 8 }),
    enabled: phase === "crawling" && Boolean(crawlId),
    refetchInterval: isCompleted || isFailed ? false : 2500,
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

  // Cycle the highlighted node in the raw website structure view while crawling
  useEffect(() => {
    if (phase !== "crawling" || isCompleted || isFailed) return;
    const interval = setInterval(() => {
      setElapsedSec((s) => s + 1);
      setActiveNodeIdx((idx) => idx + 1);
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
    }, 1100);
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

  const displayDomain = activeDomain || cleanDomainInput(domainInput) || "yourwebsite.com";
  const inspectedPage =
    crawledPages.length > 0
      ? crawledPages[activeNodeIdx % crawledPages.length]
      : null;

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  return (
    <div
      className="dash-dark dark relative min-h-screen w-full overflow-hidden flex flex-col justify-between select-none"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* ── KEYFRAME ANIMATIONS FOR LASER SCANLINE ── */}
      <style>{`
        @keyframes reigel-scanline {
          0% { top: 0%; opacity: 0.2; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 100%; opacity: 0.2; }
        }
        .reigel-laser-sweep {
          animation: reigel-scanline 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      {/* ── PURE MATTE-BLACK TECHNICAL CAD BLUEPRINT GRID ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full opacity-[0.12]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="tech-subgrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" fill="none" stroke="var(--color-brand-300)" strokeWidth="0.5" />
            </pattern>
            <pattern id="tech-grid" width="120" height="120" patternUnits="userSpaceOnUse">
              <rect width="120" height="120" fill="url(#tech-subgrid)" />
              <path d="M 120 0 L 0 0 0 120" fill="none" stroke="var(--color-brand-400)" strokeWidth="1" />
              <circle cx="0" cy="0" r="1.5" fill="var(--color-signal-400)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tech-grid)" />
        </svg>

        {/* Subtle technical corner crosshairs */}
        <div className="absolute left-6 top-16 h-6 w-6 border-l border-t border-brand-300/40" />
        <div className="absolute right-6 top-16 h-6 w-6 border-r border-t border-brand-300/40" />
        <div className="absolute bottom-6 left-6 h-6 w-6 border-b border-l border-brand-300/40" />
        <div className="absolute bottom-6 right-6 h-6 w-6 border-b border-r border-brand-300/40" />
      </div>

      {/* ── TOP MINIMAL TECHNICAL HUD HEADER ── */}
      <header
        className="relative z-20 flex h-[52px] shrink-0 items-center justify-between border-b bg-surface-1/90 px-4 sm:px-6 backdrop-blur-md"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal-400 font-mono text-xs font-black text-signal-ink">
              R
            </span>
            <span className="text-sm font-extrabold tracking-tight text-brand-950">
              Reigel
            </span>
          </Link>
          <span className="text-brand-300">/</span>
          <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-600">
            <Radar size={11} className={phase === "crawling" ? "text-signal-400 animate-spin" : "text-signal-400"} />
            {phase === "crawling" ? "LIVE DOM & SITEMAP CRAWLER" : "RAW WEBSITE STRUCTURE SCANNER"}
          </span>
        </div>

        {/* Center Live Telemetry Pills */}
        <div className="hidden lg:flex items-center gap-4 font-mono text-[11px] text-brand-500">
          <span>
            TARGET: <strong className="text-brand-950">https://{displayDomain}</strong>
          </span>
          <span className="text-brand-300">·</span>
          <span>
            STATE:{" "}
            <strong className={phase === "crawling" ? "text-signal-400" : "text-brand-600"}>
              {phase === "crawling" ? (isCompleted ? "COMPLETED" : "CRAWLING_LIVE") : "STANDBY"}
            </strong>
          </span>
          {phase === "crawling" && (
            <>
              <span className="text-brand-300">·</span>
              <span>
                ELAPSED: <strong className="text-brand-950">{formatElapsed(elapsedSec)}</strong>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {phase === "crawling" && (
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-brand-950">
                <strong className="text-signal-400">{totalPagesRecorded}</strong> pages
              </span>
              <span className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-brand-950">
                <strong className="text-warning-700">{totalIssuesRecorded}</strong> findings
              </span>
            </div>
          )}

          {(projects.length > 0 || phase === "crawling") && (
            <button
              type="button"
              onClick={() => router.replace("/website")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs font-bold text-brand-950 transition hover:border-brand-300 hover:bg-surface-3 cursor-pointer"
            >
              <span>Website Audit</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </header>

      {/* ── FULL-SCREEN RAW WEBSITE STRUCTURE & CRAWLER TELEMETRY CANVAS ── */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-center px-4 pb-36 pt-4 sm:px-6 lg:px-8">
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
          {/* =================================================================
              LEFT PANEL (4 COLS): SITEMAP NODE GRAPH & LIVE URL TREE
             ================================================================= */}
          <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1/90 p-4 shadow-card backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between border-b border-brand-200 pb-3">
                <div className="flex items-center gap-2">
                  <Link2 size={14} className="text-signal-400" />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-brand-950">
                    01 · Sitemap & Link Graph Tree
                  </span>
                </div>
                <span className="rounded border border-brand-200 bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-brand-500">
                  {phase === "crawling" ? `${totalPagesRecorded} nodes` : "Blueprint"}
                </span>
              </div>

              {/* Root Domain Node */}
              <div className="mt-3.5">
                <div
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2.5 font-mono text-xs transition-all",
                    phase === "crawling"
                      ? "border-signal-400/60 bg-surface-2 text-brand-950 shadow-xs"
                      : "border-brand-200 bg-surface-2/70 text-brand-700",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-signal-400" />
                    <span className="truncate font-bold text-brand-950">
                      https://{displayDomain}
                    </span>
                  </div>
                  <span className="shrink-0 rounded bg-surface-1 px-1.5 py-0.5 text-[9.5px] font-bold text-signal-400 border border-brand-200">
                    ROOT
                  </span>
                </div>

                {/* Branching Child Page Nodes (Real Crawled Pages or Blueprint Nodes) */}
                <div className="relative ml-4 mt-2 space-y-1.5 border-l border-dashed border-brand-300 pl-4">
                  {phase === "crawling" && crawledPages.length > 0
                    ? crawledPages.slice(0, 8).map((p, idx) => {
                        const isCurrent = idx === activeNodeIdx % Math.min(crawledPages.length, 8);
                        const ok = p.statusCode >= 200 && p.statusCode < 300;
                        return (
                          <div
                            key={p.id}
                            className={cn(
                              "relative flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 font-mono text-[11px] transition-all",
                              isCurrent
                                ? "border-signal-400 bg-surface-2 text-brand-950"
                                : "border-brand-200/80 bg-surface-2/40 text-brand-600",
                            )}
                          >
                            {/* Horizontal branch connector line */}
                            <span className="absolute -left-4 top-1/2 h-px w-4 border-t border-dashed border-brand-300" />
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  "shrink-0 rounded px-1 py-px text-[9.5px] font-bold",
                                  ok
                                    ? "bg-success-50 text-success-700"
                                    : "bg-warning-50 text-warning-700",
                                )}
                              >
                                {p.statusCode || "—"}
                              </span>
                              <span className="truncate font-semibold text-brand-950">
                                {pathFromUrl(p.url)}
                              </span>
                            </div>
                            <span className="shrink-0 text-[10px] text-brand-400">
                              {p.responseTimeMs > 0 ? `${p.responseTimeMs}ms` : "parsed"}
                            </span>
                          </div>
                        );
                      })
                    : BLUEPRINT_NODES.map((node, idx) => {
                        const scanningThis = phase === "crawling" && idx === activeNodeIdx % BLUEPRINT_NODES.length;
                        return (
                          <div
                            key={node.path}
                            className={cn(
                              "relative flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 font-mono text-[11px] transition-all",
                              scanningThis
                                ? "border-signal-400 bg-surface-2 text-brand-950"
                                : "border-brand-200/70 bg-surface-2/30 text-brand-500",
                            )}
                          >
                            <span className="absolute -left-4 top-1/2 h-px w-4 border-t border-dashed border-brand-300" />
                            <div className="flex min-w-0 items-center gap-2">
                              {scanningThis ? (
                                <Loader2 size={11} className="shrink-0 animate-spin text-signal-400" />
                              ) : (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                              )}
                              <span className="truncate font-semibold text-brand-800">
                                {node.path}
                              </span>
                            </div>
                            <span className="shrink-0 text-[9.5px] text-brand-400">
                              {node.type}
                            </span>
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>

            {/* Bottom Spider Telemetry Log inside Left Panel */}
            <div className="mt-4 rounded-xl border border-brand-200 bg-surface-2/70 p-3 font-mono text-[10.5px]">
              <div className="mb-1.5 flex items-center justify-between text-[9.5px] font-bold uppercase tracking-wider text-brand-400">
                <span className="flex items-center gap-1.5">
                  <Terminal size={11} className="text-signal-400" />
                  Spider Stream
                </span>
                <span>{phase === "crawling" ? "LIVE" : "IDLE"}</span>
              </div>
              {phase === "crawling" ? (
                <div className="space-y-1 text-brand-600">
                  {autopilotLogs.length > 0 ? (
                    autopilotLogs.slice(-3).map((l, i) => (
                      <p key={i} className="truncate">
                        <span className="text-signal-400">›</span> {l.message}
                      </p>
                    ))
                  ) : (
                    <>
                      <p className="truncate">
                        <span className="text-signal-400">›</span> GET https://{displayDomain}/robots.txt
                      </p>
                      <p className="truncate">
                        <span className="text-signal-400">›</span> Parsing XML sitemaps & internal hrefs…
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-brand-500">
                  <span className="text-signal-400">›</span> Enter your domain in the bottom bar to start crawling your live website structure.
                </p>
              )}
            </div>
          </div>

          {/* =================================================================
              CENTER/RIGHT PANEL (8 COLS): RAW WEBSITE WIREFRAME & DOM X-RAY
             ================================================================= */}
          <div className="lg:col-span-8 relative flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200 bg-surface-1/95 p-4 sm:p-5 shadow-card backdrop-blur-md">
            {/* Animated Laser Scan Beam (Active while crawling) */}
            {phase === "crawling" && !isCompleted && (
              <div
                aria-hidden="true"
                className="reigel-laser-sweep pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-signal-400 shadow-[0_0_24px_4px_rgba(200,245,58,0.55)]"
              />
            )}

            {/* Wireframe Browser Top Chrome */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-signal-400" />
                  <span className="ml-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-brand-950">
                    02 · Raw Website DOM & Structure X-Ray
                  </span>
                </div>

                {/* Live URL Bar inside Wireframe */}
                <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1 font-mono text-[11px]">
                  <span className="text-signal-400 font-bold">GET</span>
                  <span className="max-w-[260px] sm:max-w-[380px] truncate text-brand-950">
                    https://{displayDomain}
                    {inspectedPage ? pathFromUrl(inspectedPage.url) : "/"}
                  </span>
                  {inspectedPage && (
                    <span className="rounded bg-success-50 px-1.5 py-0.5 text-[9.5px] font-bold text-success-700">
                      {inspectedPage.statusCode || "—"}
                    </span>
                  )}
                </div>
              </div>

              {/* RAW HTML STRUCTURE SKELETON GRID */}
              <div className="mt-4 space-y-3 font-mono">
                {/* 1. <head> Metadata & Indexability Wireframe Block */}
                <div className="rounded-xl border border-brand-200 bg-surface-2/60 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-signal-400">
                      <Code2 size={13} />
                      &lt;head&gt; · DOCUMENT METADATA &amp; DIRECTIVES
                    </span>
                    <span className="rounded border border-brand-200 bg-surface-1 px-2 py-0.5 text-[9.5px] text-brand-500">
                      {inspectedPage?.indexability ?? (phase === "crawling" ? "INSPECTING_HEADERS" : "AWAITING_DOM")}
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3 text-[11px]">
                    <div className="rounded-lg border border-brand-200 bg-surface-1 p-2.5">
                      <p className="text-[9.5px] text-brand-400">&lt;title&gt;</p>
                      <p className="mt-1 truncate font-sans text-xs font-semibold text-brand-950">
                        {inspectedPage?.title ||
                          (phase === "crawling"
                            ? `Scanning title tag on ${displayDomain}…`
                            : `${displayDomain} — Primary Page Title`)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-brand-200 bg-surface-1 p-2.5">
                      <p className="text-[9.5px] text-brand-400">&lt;link rel=&quot;canonical&quot;&gt;</p>
                      <p className="mt-1 truncate text-xs text-brand-700">
                        {inspectedPage?.canonicalUrl || `https://${displayDomain}/`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-brand-200 bg-surface-1 p-2.5">
                      <p className="text-[9.5px] text-brand-400">&lt;meta name=&quot;description&quot;&gt;</p>
                      <p className="mt-1 truncate font-sans text-xs text-brand-600">
                        {inspectedPage?.metaDescription ||
                          (phase === "crawling"
                            ? "Extracting meta description length & keywords…"
                            : "Meta description snippet & SERP preview block")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. <body> Visual Wireframe Skeleton (Header / Hero H1 / Content Grid) */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  {/* Left 7 Cols: Raw Page Layout Skeleton */}
                  <div className="md:col-span-7 space-y-2.5 rounded-xl border border-brand-200 bg-surface-2/60 p-3.5">
                    <div className="flex items-center justify-between text-[10.5px] font-bold text-brand-500">
                      <span className="flex items-center gap-1.5 text-brand-950">
                        <Layers size={13} className="text-signal-400" />
                        &lt;body&gt; · PAGE WIREFRAME STRUCTURE
                      </span>
                      <span>
                        {inspectedPage?.wordCount
                          ? `${inspectedPage.wordCount} words`
                          : "DOM Tree"}
                      </span>
                    </div>

                    {/* Simulated <nav> wireframe bar */}
                    <div className="flex items-center justify-between rounded-lg border border-dashed border-brand-300 bg-surface-1/80 px-3 py-1.5 text-[10px] text-brand-400">
                      <span>&lt;header&gt; / &lt;nav&gt;</span>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-8 rounded bg-brand-200" />
                        <span className="h-2 w-8 rounded bg-brand-200" />
                        <span className="h-2 w-8 rounded bg-brand-200" />
                      </div>
                    </div>

                    {/* Simulated <main> Hero & <h1> Block */}
                    <div className="rounded-lg border border-brand-200 bg-surface-1 p-3">
                      <div className="flex items-center justify-between text-[9.5px] text-brand-400">
                        <span className="text-signal-400 font-bold">&lt;h1&gt; PRIMARY HEADING</span>
                        <span>{inspectedPage?.h1?.length ? `${inspectedPage.h1.length} tag found` : "Heading hierarchy"}</span>
                      </div>
                      <p className="mt-1 truncate font-sans text-sm font-bold text-brand-950">
                        {inspectedPage?.h1?.[0] ||
                          (phase === "crawling"
                            ? `Parsing <h1> and content blocks on ${pathFromUrl(inspectedPage?.url || "/")}…`
                            : `Primary <h1> headline structure for ${displayDomain}`)}
                      </p>
                      <div className="mt-2.5 space-y-1.5">
                        <div className="h-2 w-full rounded bg-brand-200/80" />
                        <div className="h-2 w-4/5 rounded bg-brand-200/60" />
                      </div>
                    </div>

                    {/* Simulated 3-Column Section Blocks */}
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((col) => (
                        <div
                          key={col}
                          className="rounded-lg border border-dashed border-brand-300 bg-surface-1/70 p-2.5"
                        >
                          <p className="text-[9px] text-brand-400">&lt;section&gt;</p>
                          <p className="mt-1 truncate font-sans text-[10.5px] font-semibold text-brand-700">
                            {inspectedPage?.h2?.[col] || `<h2> Block 0${col + 1}`}
                          </p>
                          <div className="mt-2 h-1.5 w-3/4 rounded bg-brand-200" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right 5 Cols: Real-Time Audit Checks & Findings Stream */}
                  <div className="md:col-span-5 flex flex-col justify-between rounded-xl border border-brand-200 bg-surface-2/60 p-3.5">
                    <div>
                      <div className="flex items-center justify-between text-[10.5px] font-bold text-brand-950">
                        <span className="flex items-center gap-1.5">
                          <FileCode2 size={13} className="text-signal-400" />
                          LIVE AUDIT TELEMETRY
                        </span>
                        <span className="text-[9.5px] text-brand-400">
                          {healthScore != null ? `Score ${healthScore}/100` : "128 checks"}
                        </span>
                      </div>

                      {/* Real-Time Pipeline Checklist */}
                      <div className="mt-3 space-y-2 text-[11px]">
                        {[
                          {
                            name: "HTTPS, SSL & Robots.txt",
                            status: phase === "crawling" ? "VERIFIED" : "READY",
                            done: phase === "crawling",
                          },
                          {
                            name: "Internal Page & Sitemap Crawl",
                            status:
                              phase === "crawling"
                                ? `${totalPagesRecorded} pages`
                                : "STANDBY",
                            done: isCompleted,
                            active: phase === "crawling" && !isCompleted,
                          },
                          {
                            name: "Technical SEO & CWV Rules",
                            status:
                              phase === "crawling"
                                ? `${totalIssuesRecorded} findings`
                                : "STANDBY",
                            done: isCompleted,
                            active: phase === "crawling" && totalPagesRecorded > 0 && !isCompleted,
                          },
                          {
                            name: "Website Audit Report Sync",
                            status: isCompleted ? "COMPLETE" : "AUTO-OPEN",
                            done: isCompleted,
                          },
                        ].map((chk) => (
                          <div
                            key={chk.name}
                            className="flex items-center justify-between rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {chk.done ? (
                                <Check size={12} className="shrink-0 text-signal-400" strokeWidth={3} />
                              ) : chk.active ? (
                                <Loader2 size={12} className="shrink-0 animate-spin text-signal-400" />
                              ) : (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                              )}
                              <span className="truncate font-sans text-[11px] font-medium text-brand-800">
                                {chk.name}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold",
                                chk.done
                                  ? "bg-primary-50 text-signal-400"
                                  : chk.active
                                    ? "bg-warning-50 text-warning-700"
                                    : "text-brand-400",
                              )}
                            >
                              {chk.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Live Detected Findings Box */}
                    <div className="mt-3 rounded-lg border border-brand-200 bg-surface-1 p-2.5">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-brand-400">
                        {crawledIssues.length > 0
                          ? `Latest Detected Findings (${totalIssuesRecorded})`
                          : "Real-Time Defect Scanner"}
                      </p>
                      {crawledIssues.length > 0 ? (
                        <div className="mt-1.5 space-y-1.5">
                          {crawledIssues.slice(0, 2).map((iss) => (
                            <div
                              key={iss.id}
                              className="flex items-center justify-between gap-2 text-[10.5px]"
                            >
                              <span className="truncate font-sans text-brand-700">
                                {iss.description}
                              </span>
                              <span className="shrink-0 rounded bg-error-50 px-1.5 py-px text-[9px] font-bold text-error-700">
                                {iss.severity}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 font-sans text-[11px] text-brand-500">
                          {phase === "crawling"
                            ? "Inspecting crawled DOM nodes for missing titles, slow LCP, broken links, and canonical errors…"
                            : "Once started, technical SEO defects and page speed bottlenecks appear here live."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── BOTTOM-DOCKED COMMAND & CRAWLER PROGRESS BAR ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-200 bg-surface-1/95 px-4 py-3.5 shadow-2xl backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-4xl">
          {phase === "input" ? (
            <form onSubmit={handleStartAudit} noValidate>
              {error && (
                <div
                  role="alert"
                  className="mb-2.5 flex items-center gap-2 rounded-xl border border-error-500/40 bg-error-50 px-3.5 py-2 text-xs font-semibold text-error-700"
                >
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-brand-300 bg-surface-2 px-3.5 py-2.5 focus-within:border-signal-400 transition-colors">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-signal-400">
                    <Globe size={15} />
                  </span>
                  <span className="select-none font-mono text-xs font-bold text-brand-400">
                    https://
                  </span>
                  <input
                    id="onboarding-domain"
                    type="text"
                    required
                    autoFocus
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="Enter your website domain (e.g. yourwebsite.com)"
                    className="w-full min-w-0 bg-transparent font-mono text-sm font-bold text-brand-950 placeholder:text-brand-400 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-signal-400 px-6 py-3 text-sm font-extrabold text-signal-ink shadow-md transition hover:opacity-95 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Initializing Crawler…</span>
                    </>
                  ) : (
                    <>
                      <span>Start Website Crawl</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink">
                  {isCompleted ? (
                    <Check size={18} strokeWidth={3} />
                  ) : (
                    <Loader2 size={18} className="animate-spin" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-mono text-xs font-bold text-brand-950">
                      {isCompleted
                        ? `Audit complete for ${activeDomain} — opening Website Audit…`
                        : `Crawling https://${activeDomain} (${totalPagesRecorded} pages scanned)`}
                    </p>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-200">
                    <div
                      className="h-full rounded-full bg-signal-400 transition-all duration-500"
                      style={{
                        width: isCompleted
                          ? "100%"
                          : `${Math.min(92, Math.max(18, totalPagesRecorded * 4))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.replace("/website")}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-signal-400 px-5 py-2.5 text-xs font-extrabold text-signal-ink shadow-xs transition hover:opacity-95 cursor-pointer"
              >
                <span>Open Website Audit</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div
          className="dash-dark dark flex min-h-screen items-center justify-center"
          style={{ background: "var(--color-canvas)" }}
        >
          <Loader2 size={24} className="animate-spin text-signal-400" />
        </div>
      }
    >
      <AnalyzeOnboardingInner />
    </Suspense>
  );
}
