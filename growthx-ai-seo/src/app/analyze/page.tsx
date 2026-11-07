"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  Globe,
  Layers,
  Link2,
  Loader2,
  Radar,
  Search,
  ShieldCheck,
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

const DEFAULT_PAGE_NODES = [
  { path: "/", label: "Home Page", type: "Main Entry" },
  { path: "/products", label: "Products", type: "Core Page" },
  { path: "/services", label: "Services", type: "Core Page" },
  { path: "/about", label: "About Us", type: "Company Info" },
  { path: "/contact", label: "Contact", type: "Contact Page" },
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
  const [selectedPageIdx, setSelectedPageIdx] = useState<number | null>(null);

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

  // Cycle the highlighted node in the website structure view while crawling
  useEffect(() => {
    if (phase !== "crawling" || isCompleted || isFailed) return;
    const interval = setInterval(() => {
      setElapsedSec((s) => s + 1);
      setActiveNodeIdx((idx) => idx + 1);
    }, 1200);
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
      setSelectedPageIdx(null);
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
      ? selectedPageIdx !== null && crawledPages[selectedPageIdx]
        ? crawledPages[selectedPageIdx]
        : crawledPages[activeNodeIdx % crawledPages.length]
      : null;

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  return (
    <div
      className="dash-dark dark relative min-h-screen lg:h-screen w-full overflow-x-hidden lg:overflow-hidden flex flex-col justify-between select-none"
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

      {/* ── TOP HEADER BAR ── */}
      <header
        className="relative z-20 flex h-[54px] shrink-0 items-center justify-between border-b bg-surface-1/90 px-4 sm:px-6 backdrop-blur-md"
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
          <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <Radar size={12} className={phase === "crawling" ? "text-signal-400 animate-spin" : "text-signal-400"} />
            {phase === "crawling" ? "Live Website Scanner" : "Website Health Scanner"}
          </span>
        </div>

        {/* Center Status Pills */}
        <div className="hidden lg:flex items-center gap-4 text-xs text-brand-500">
          <span>
            Website: <strong className="font-mono text-brand-950">https://{displayDomain}</strong>
          </span>
          <span className="text-brand-300">·</span>
          <span>
            Status:{" "}
            <strong className={phase === "crawling" ? "text-signal-400" : "text-brand-600"}>
              {phase === "crawling" ? (isCompleted ? "Complete" : "Scanning Live") : "Ready to Scan"}
            </strong>
          </span>
          {phase === "crawling" && (
            <>
              <span className="text-brand-300">·</span>
              <span>
                Time: <strong className="font-mono text-brand-950">{formatElapsed(elapsedSec)}</strong>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {phase === "crawling" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-brand-950">
                <strong className="text-signal-400">{totalPagesRecorded}</strong> pages
              </span>
              <span className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-brand-950">
                <strong className="text-warning-700">{totalIssuesRecorded}</strong> issues
              </span>
            </div>
          )}

          {(projects.length > 0 || phase === "crawling") && (
            <button
              type="button"
              onClick={() => router.push("/website")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs font-bold text-brand-800 transition hover:border-brand-300 hover:text-brand-950 cursor-pointer"
            >
              <span>Website Audit</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      </header>

      {/* ── FULL-SCREEN LIVE WEBSITE STRUCTURE VISUALIZER ── */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-4 pt-3 pb-24 sm:px-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
          {/* =================================================================
              LEFT PANEL (4 COLS): WEBSITE PAGES & SITEMAP TREE
             ================================================================= */}
          <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1/95 p-4 sm:p-5 shadow-card backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between border-b border-brand-200 pb-3">
                <div className="flex items-center gap-2">
                  <Link2 size={14} className="text-signal-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-950">
                    01 · Website Pages Found
                  </span>
                </div>
                <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-signal-400">
                  {crawledPages.length > 0 ? `${totalPagesRecorded} pages` : "Ready"}
                </span>
              </div>

              {/* Root Domain Node */}
              <div className="mt-4">
                <div className="flex items-center justify-between rounded-xl border border-signal-400/60 bg-primary-50 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-signal-400 animate-pulse" />
                    <span className="truncate font-mono text-xs font-bold text-brand-950">
                      https://{displayDomain}
                    </span>
                  </div>
                  <span className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-signal-400">
                    MAIN SITE
                  </span>
                </div>

                {/* Branching Child URLs */}
                <div className="ml-4 mt-2 space-y-2 border-l border-dashed border-brand-300 pl-4">
                  {crawledPages.length > 0
                    ? crawledPages.slice(0, 6).map((p, idx) => {
                        const isInspecting =
                          selectedPageIdx !== null
                            ? selectedPageIdx === idx
                            : idx === activeNodeIdx % crawledPages.length;
                        const ok = !p.statusCode || (p.statusCode >= 200 && p.statusCode < 400);
                        return (
                          <button
                            key={p.id || p.url}
                            type="button"
                            onClick={() => setSelectedPageIdx(idx)}
                            className={cn(
                              "relative flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left font-mono text-[11px] transition-all cursor-pointer",
                              isInspecting
                                ? "border-signal-400 bg-surface-2 text-brand-950 shadow-xs"
                                : "border-brand-200 bg-surface-2/40 text-brand-600 hover:border-brand-300",
                            )}
                          >
                            <span className="absolute -left-4 top-1/2 h-px w-4 border-t border-dashed border-brand-300" />
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={cn(
                                  "shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold",
                                  ok
                                    ? "bg-success-50 text-success-700"
                                    : "bg-warning-50 text-warning-700",
                                )}
                              >
                                {ok ? "OK" : p.statusCode || "—"}
                              </span>
                              <span className="truncate font-semibold text-brand-950">
                                {pathFromUrl(p.url)}
                              </span>
                            </div>
                            <span className="shrink-0 text-[10px] text-brand-400">
                              {p.responseTimeMs > 0 ? `${p.responseTimeMs}ms` : "Checked"}
                            </span>
                          </button>
                        );
                      })
                    : DEFAULT_PAGE_NODES.map((node, idx) => {
                        const scanningThis =
                          phase === "crawling" && idx === activeNodeIdx % DEFAULT_PAGE_NODES.length;
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
                            <span className="shrink-0 font-sans text-[10px] text-brand-400">
                              {node.label}
                            </span>
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>

            {/* Bottom Live Activity Log inside Left Panel */}
            <div className="mt-4 rounded-xl border border-brand-200 bg-surface-2/70 p-3 text-xs">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-brand-400">
                <span className="flex items-center gap-1.5">
                  <Terminal size={11} className="text-signal-400" />
                  Live Scanner Activity
                </span>
                <span className={phase === "crawling" ? "text-signal-400" : "text-brand-400"}>
                  {phase === "crawling" ? "ACTIVE" : "READY"}
                </span>
              </div>
              {phase === "crawling" ? (
                <div className="space-y-1 text-[11px] text-brand-600">
                  {autopilotLogs.length > 0 ? (
                    autopilotLogs.slice(-3).map((l, i) => (
                      <p key={i} className="truncate">
                        <span className="font-bold text-signal-400">›</span> {l.message}
                      </p>
                    ))
                  ) : (
                    <>
                      <p className="truncate">
                        <span className="font-bold text-signal-400">›</span> Connected to https://{displayDomain}
                      </p>
                      <p className="truncate">
                        <span className="font-bold text-signal-400">›</span> Discovering pages & checking SEO health…
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-brand-500">
                  <span className="font-bold text-signal-400">›</span> Enter your website below to start scanning your pages in real time.
                </p>
              )}
            </div>
          </div>

          {/* =================================================================
              RIGHT PANEL (8 COLS): LIVE WEBSITE STRUCTURE & PREVIEW
             ================================================================= */}
          <div className="lg:col-span-8 relative flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200 bg-surface-1/95 p-4 sm:p-5 shadow-card backdrop-blur-md">
            {/* Animated Laser Scan Beam (Active while crawling) */}
            {phase === "crawling" && !isCompleted && (
              <div
                aria-hidden="true"
                className="reigel-laser-sweep pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-signal-400 shadow-[0_0_24px_4px_rgba(200,245,58,0.55)]"
              />
            )}

            <div>
              {/* Browser Window Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-signal-400" />
                  <span className="ml-1.5 text-xs font-bold uppercase tracking-wider text-brand-950">
                    02 · Live Website Structure & SEO Preview
                  </span>
                </div>

                {/* Live URL Bar inside Browser Preview */}
                <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1 font-mono text-[11px]">
                  <span className="font-bold text-signal-400">PAGE</span>
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

              {/* WEBSITE STRUCTURE SKELETON GRID */}
              <div className="mt-4 space-y-3">
                {/* 1. Google Search & Page Details Block */}
                <div className="rounded-xl border border-brand-200 bg-surface-2/60 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-signal-400">
                      <Search size={13} />
                      Google Search Appearance & Page Info
                    </span>
                    <span className="rounded border border-brand-200 bg-surface-1 px-2 py-0.5 text-[10px] font-semibold text-brand-600">
                      {inspectedPage
                        ? inspectedPage.indexability === "INDEXABLE"
                          ? "Ready for Google"
                          : inspectedPage.indexability
                        : phase === "crawling"
                          ? "Checking Page…"
                          : "Preview"}
                    </span>
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div className="rounded-lg border border-brand-200 bg-surface-1 p-2.5">
                      <p className="text-[10px] font-semibold text-brand-400">Page Title</p>
                      <p className="mt-1 truncate text-xs font-bold text-brand-950">
                        {inspectedPage?.title ||
                          (phase === "crawling"
                            ? `Reading title on ${displayDomain}…`
                            : `${displayDomain} — Main Page Title`)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-brand-200 bg-surface-1 p-2.5">
                      <p className="text-[10px] font-semibold text-brand-400">Official Page Link</p>
                      <p className="mt-1 truncate font-mono text-xs text-brand-700">
                        {inspectedPage?.canonicalUrl || `https://${displayDomain}/`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-brand-200 bg-surface-1 p-2.5">
                      <p className="text-[10px] font-semibold text-brand-400">Google Summary Description</p>
                      <p className="mt-1 truncate text-xs text-brand-600">
                        {inspectedPage?.metaDescription ||
                          (phase === "crawling"
                            ? "Checking page summary description…"
                            : "Summary shown to customers on Google Search")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Visual Page Wireframe + Live Audit Checklist */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                  {/* Left 7 Cols: Visual Page Layout Wireframe */}
                  <div className="md:col-span-7 space-y-2.5 rounded-xl border border-brand-200 bg-surface-2/60 p-3.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-brand-500">
                      <span className="flex items-center gap-1.5 uppercase tracking-wider text-brand-950">
                        <Layers size={13} className="text-signal-400" />
                        Visual Page Layout
                      </span>
                      <span>
                        {inspectedPage?.wordCount
                          ? `${inspectedPage.wordCount} words on page`
                          : "Page Structure"}
                      </span>
                    </div>

                    {/* Visual Top Navigation Bar Wireframe */}
                    <div className="flex items-center justify-between rounded-lg border border-dashed border-brand-300 bg-surface-1/80 px-3 py-1.5 text-[10.5px] text-brand-400">
                      <span>Top Menu & Navigation</span>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-8 rounded bg-brand-200" />
                        <span className="h-2 w-8 rounded bg-brand-200" />
                        <span className="h-2 w-8 rounded bg-brand-200" />
                      </div>
                    </div>

                    {/* Visual Hero & Main Headline Block */}
                    <div className="rounded-lg border border-brand-200 bg-surface-1 p-3">
                      <div className="flex items-center justify-between text-[10px] text-brand-400">
                        <span className="font-bold uppercase tracking-wider text-signal-400">
                          Main Page Heading
                        </span>
                        <span>
                          {inspectedPage?.h1?.length
                            ? `${inspectedPage.h1.length} heading found`
                            : "Hero Section"}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-bold text-brand-950">
                        {inspectedPage?.h1?.[0] ||
                          (phase === "crawling"
                            ? `Reading main headline on ${pathFromUrl(inspectedPage?.url || "/")}…`
                            : `Main Headline on ${displayDomain}`)}
                      </p>
                      <div className="mt-2.5 space-y-1.5">
                        <div className="h-2 w-full rounded bg-brand-200/80" />
                        <div className="h-2 w-4/5 rounded bg-brand-200/60" />
                      </div>
                    </div>

                    {/* Visual 3-Column Content Sections */}
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((col) => (
                        <div
                          key={col}
                          className="rounded-lg border border-dashed border-brand-300 bg-surface-1/70 p-2.5"
                        >
                          <p className="text-[9.5px] font-medium text-brand-400">
                            Page Section {col + 1}
                          </p>
                          <p className="mt-1 truncate text-[11px] font-semibold text-brand-800">
                            {inspectedPage?.h2?.[col] || `Content Block 0${col + 1}`}
                          </p>
                          <div className="mt-2 h-1.5 w-3/4 rounded bg-brand-200" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right 5 Cols: Live Audit Progress & Spotted Issues */}
                  <div className="md:col-span-5 flex flex-col justify-between rounded-xl border border-brand-200 bg-surface-2/60 p-3.5">
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-brand-950">
                        <span className="flex items-center gap-1.5 uppercase tracking-wider">
                          <ShieldCheck size={14} className="text-signal-400" />
                          Audit Progress
                        </span>
                        <span className="text-[10px] font-semibold text-brand-400">
                          {healthScore != null ? `Score ${healthScore}/100` : "Live Checks"}
                        </span>
                      </div>

                      {/* 4 Clean Progress Rows */}
                      <div className="mt-3 space-y-2">
                        {[
                          {
                            name: "Website Connection & Security",
                            status: phase === "crawling" ? "Verified" : "Ready",
                            done: phase === "crawling",
                          },
                          {
                            name: "Finding Website Pages",
                            status:
                              phase === "crawling"
                                ? `${totalPagesRecorded} pages`
                                : "Standby",
                            done: isCompleted,
                            active: phase === "crawling" && !isCompleted,
                          },
                          {
                            name: "Checking SEO & Page Speed",
                            status:
                              phase === "crawling"
                                ? `${totalIssuesRecorded} issues`
                                : "Standby",
                            done: isCompleted,
                            active: phase === "crawling" && totalPagesRecorded > 0 && !isCompleted,
                          },
                          {
                            name: "Opening Website Audit Report",
                            status: isCompleted ? "Complete" : "Auto-open",
                            done: isCompleted,
                          },
                        ].map((chk) => (
                          <div
                            key={chk.name}
                            className="flex items-center justify-between rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {chk.done ? (
                                <Check size={12} className="shrink-0 text-signal-400" strokeWidth={3} />
                              ) : chk.active ? (
                                <Loader2 size={12} className="shrink-0 animate-spin text-signal-400" />
                              ) : (
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                              )}
                              <span className="truncate text-[11px] font-medium text-brand-800">
                                {chk.name}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
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

                    {/* Live Detected Issues Box */}
                    <div className="mt-3 rounded-lg border border-brand-200 bg-surface-1 p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">
                        {crawledIssues.length > 0
                          ? `Issues Spotted So Far (${totalIssuesRecorded})`
                          : "Real-Time Issue Detector"}
                      </p>
                      {crawledIssues.length > 0 ? (
                        <div className="mt-1.5 space-y-1.5">
                          {crawledIssues.slice(0, 2).map((iss) => (
                            <div
                              key={iss.id}
                              className="flex items-center justify-between gap-2 text-[11px]"
                            >
                              <span className="truncate text-brand-700">
                                {iss.description}
                              </span>
                              <span className="shrink-0 rounded bg-error-50 px-1.5 py-px text-[9.5px] font-bold text-error-700">
                                {iss.severity}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-[11px] leading-snug text-brand-500">
                          {phase === "crawling"
                            ? "Checking pages for missing titles, slow speed, broken links, and SEO issues…"
                            : "Once started, any SEO or speed issues found on your pages appear here live."}
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
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-200 bg-surface-1/95 px-4 py-3 shadow-2xl backdrop-blur-xl sm:px-6">
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
                    placeholder="yourwebsite.com"
                    className="w-full min-w-0 border-0 bg-transparent font-mono text-sm font-bold text-brand-950 placeholder:text-brand-400 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                    style={{ outline: "none", boxShadow: "none" }}
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
                      <span>Starting Scan…</span>
                    </>
                  ) : (
                    <>
                      <span>Start Website Audit</span>
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-xs font-bold text-brand-950">
                      {isCompleted
                        ? `Audit complete for ${activeDomain} — opening Website Audit…`
                        : `Scanning https://${activeDomain} (${totalPagesRecorded} pages checked)`}
                    </p>
                    <span className="hidden sm:inline font-mono text-[11px] font-bold text-signal-400">
                      {isCompleted
                        ? "100%"
                        : `${Math.min(92, Math.max(18, totalPagesRecorded * 4))}%`}
                    </span>
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
