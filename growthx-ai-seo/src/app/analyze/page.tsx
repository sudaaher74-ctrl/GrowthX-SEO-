"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  Globe,
  Loader2,
  Lock,
  Search,
  Sparkles,
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
    const p = (parsed.pathname || "/") + (parsed.search || "");
    return p === "/" ? "/ (Home page)" : p;
  } catch {
    return url === "/" || !url ? "/ (Home page)" : url;
  }
}

const SAMPLE_PAGES = [
  { path: "/ (Home page)", label: "Home page" },
  { path: "/products", label: "Products" },
  { path: "/services", label: "Services" },
  { path: "/about", label: "About Us" },
  { path: "/contact", label: "Contact" },
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

  // Poll autopilot run log for friendly status updates
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
  const autopilotLogs = autopilotQuery.data?.log ?? initialRun?.log ?? [];

  // Cycle the highlighted page while crawling
  useEffect(() => {
    if (phase !== "crawling" || isCompleted || isFailed) return;
    const interval = setInterval(() => {
      setElapsedSec((s) => s + 1);
      setActiveNodeIdx((idx) => idx + 1);
    }, 1400);
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
      setError("Please enter a valid website address (for example: yourwebsite.com)");
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
      setError(err instanceof Error ? err.message : "Could not start the website check. Please try again.");
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

  const steps = [
    {
      label: "Connect to website",
      done: phase === "crawling",
      active: false,
    },
    {
      label:
        totalPagesRecorded > 0
          ? `Find pages (${totalPagesRecorded} found)`
          : "Find website pages",
      done: totalPagesRecorded > 0,
      active: phase === "crawling" && totalPagesRecorded === 0,
    },
    {
      label:
        totalIssuesRecorded > 0
          ? `Spot SEO issues (${totalIssuesRecorded})`
          : "Check SEO & speed",
      done: isCompleted,
      active: phase === "crawling" && totalPagesRecorded > 0 && !isCompleted,
    },
    {
      label: "Open Website Audit",
      done: isCompleted,
      active: isCompleted,
    },
  ];

  const latestStatusMessage =
    autopilotLogs.length > 0
      ? autopilotLogs[autopilotLogs.length - 1]?.message
      : phase === "crawling"
        ? `Reading pages on ${displayDomain}…`
        : "We safely scan your public pages just like Google Search.";

  return (
    <div
      className="dash-dark dark relative min-h-screen w-full overflow-x-hidden flex flex-col justify-between"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* ── LASER SCANLINE KEYFRAMES ── */}
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

      {/* ── SUBTLE MATTE-BLACK BLUEPRINT GRID ── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <svg className="absolute inset-0 h-full w-full opacity-[0.10]" xmlns="http://www.w3.org/2000/svg">
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
      </div>

      {/* ── CLEAN TOP BAR ── */}
      <header
        className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b bg-surface-1/90 px-4 sm:px-6 backdrop-blur-md"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal-400 text-xs font-black text-signal-ink">
              R
            </span>
            <span className="text-sm font-extrabold tracking-tight text-brand-950">
              Reigel
            </span>
          </Link>
          <span className="text-brand-300">/</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-3 py-1 text-xs font-medium text-brand-700">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                phase === "crawling" ? "bg-signal-400 animate-pulse" : "bg-brand-400",
              )}
            />
            {phase === "crawling" ? "Live Website Scanner" : "Step 1 · Add your website"}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {phase === "crawling" && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="rounded-lg border border-brand-200 bg-surface-2 px-3 py-1 font-medium text-brand-800">
                <strong className="font-bold text-signal-400">{totalPagesRecorded}</strong> pages checked
              </span>
              <span className="rounded-lg border border-brand-200 bg-surface-2 px-3 py-1 font-medium text-brand-800">
                <strong className="font-bold text-warning-700">{totalIssuesRecorded}</strong> issues spotted
              </span>
            </div>
          )}

          {(projects.length > 0 || phase === "crawling") && (
            <button
              type="button"
              onClick={() => router.push("/website")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-2 px-3.5 py-1.5 text-xs font-bold text-brand-800 transition hover:border-brand-300 hover:text-brand-950 cursor-pointer"
            >
              <span>Website Audit</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </header>

      {/* ── MAIN USER-FRIENDLY WORKSPACE ── */}
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pt-6 pb-28 sm:px-6">
        {/* Friendly Headline & 4 Simple Step Pills */}
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-1 px-3 py-1 text-xs font-semibold text-signal-400">
              <Sparkles size={12} />
              <span>
                {phase === "crawling"
                  ? isCompleted
                    ? "Scan complete — opening your report"
                    : `Scanning ${displayDomain} in real time`
                  : "Quick Website Setup"}
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-brand-950 sm:text-3xl">
              {phase === "crawling"
                ? isCompleted
                  ? `Your Website Audit for ${displayDomain} is ready!`
                  : `Checking ${displayDomain} page by page…`
                : "Add your website for a live health check"}
            </h1>
            <p className="mt-1 text-sm text-brand-500">
              {phase === "crawling"
                ? "Watch live as we discover your pages, preview how they appear on Google, and spot things to fix."
                : "Enter your website address in the bar at the bottom. We'll scan your pages and open your Website Audit report automatically."}
            </p>
          </div>

          {/* 4 Simple Steps */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all",
                  step.done
                    ? "border-signal-400/50 bg-primary-50 text-brand-950"
                    : step.active
                      ? "border-signal-400 bg-surface-1 text-brand-950"
                      : "border-brand-200 bg-surface-1/70 text-brand-500",
                )}
              >
                {step.done ? (
                  <CheckCircle2 size={14} className="shrink-0 text-signal-400" />
                ) : step.active ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-signal-400" />
                ) : (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-brand-300 text-[10px] text-brand-400">
                    {idx + 1}
                  </span>
                )}
                <span className="truncate">{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2-COLUMN VISUAL PREVIEW ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* LEFT CARD (4 COLS): PAGES FOUND ON YOUR WEBSITE */}
          <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1/95 p-5 shadow-card backdrop-blur-md">
            <div>
              <div className="flex items-center justify-between border-b border-brand-200 pb-3.5">
                <div>
                  <h2 className="text-sm font-bold text-brand-950">
                    Pages on your website
                  </h2>
                  <p className="mt-0.5 text-xs text-brand-500">
                    {crawledPages.length > 0
                      ? "Click any page to preview it"
                      : "Pages appear here live as we scan"}
                  </p>
                </div>
                <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-bold text-signal-400">
                  {crawledPages.length > 0 ? `${totalPagesRecorded} found` : "Ready"}
                </span>
              </div>

              {/* Root Website Pill */}
              <div className="mt-4">
                <div className="flex items-center justify-between rounded-xl border border-signal-400/60 bg-primary-50 px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Globe size={15} className="shrink-0 text-signal-400" />
                    <span className="truncate text-xs font-bold text-brand-950">
                      {displayDomain}
                    </span>
                  </div>
                  <span className="rounded-md bg-signal-400 px-2 py-0.5 text-[10px] font-extrabold text-signal-ink">
                    Website
                  </span>
                </div>

                {/* Discovered Pages List */}
                <div className="ml-4 mt-2.5 space-y-2 border-l-2 border-brand-200 pl-3.5">
                  {crawledPages.length > 0
                    ? crawledPages.slice(0, 5).map((p, idx) => {
                        const isSelected =
                          selectedPageIdx !== null
                            ? selectedPageIdx === idx
                            : idx === activeNodeIdx % crawledPages.length;
                        return (
                          <button
                            key={p.id || p.url}
                            type="button"
                            onClick={() => setSelectedPageIdx(idx)}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-all cursor-pointer",
                              isSelected
                                ? "border-signal-400 bg-surface-2 text-brand-950 shadow-xs"
                                : "border-brand-200 bg-surface-2/40 text-brand-700 hover:border-brand-300",
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <CheckCircle2 size={14} className="shrink-0 text-signal-400" />
                              <span className="truncate font-semibold text-brand-950">
                                {pathFromUrl(p.url)}
                              </span>
                            </div>
                            <span className="shrink-0 text-[11px] text-brand-400">
                              {p.responseTimeMs > 0 ? `${p.responseTimeMs}ms` : "Checked"}
                            </span>
                          </button>
                        );
                      })
                    : SAMPLE_PAGES.map((node, idx) => {
                        const scanningThis =
                          phase === "crawling" && idx === activeNodeIdx % SAMPLE_PAGES.length;
                        return (
                          <div
                            key={node.path}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-all",
                              scanningThis
                                ? "border-signal-400 bg-surface-2 text-brand-950"
                                : "border-brand-200/70 bg-surface-2/30 text-brand-500",
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {scanningThis ? (
                                <Loader2 size={13} className="shrink-0 animate-spin text-signal-400" />
                              ) : (
                                <FileText size={13} className="shrink-0 text-brand-400" />
                              )}
                              <span className="truncate font-medium text-brand-800">
                                {node.path}
                              </span>
                            </div>
                            <span className="shrink-0 text-[11px] text-brand-400">
                              {scanningThis ? "Scanning…" : node.label}
                            </span>
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>

            {/* Simple Friendly Activity Line */}
            <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-brand-200 bg-surface-2/60 px-3.5 py-2.5 text-xs text-brand-600">
              <span className="truncate">{latestStatusMessage}</span>
              {phase === "crawling" && (
                <span className="shrink-0 font-semibold text-brand-400">{elapsedSec}s</span>
              )}
            </div>
          </div>

          {/* RIGHT CARD (8 COLS): LIVE PAGE PREVIEW */}
          <div className="lg:col-span-8 relative flex flex-col justify-between overflow-hidden rounded-2xl border border-brand-200 bg-surface-1/95 p-5 shadow-card backdrop-blur-md">
            {/* Animated Laser Scan Beam (Active while crawling) */}
            {phase === "crawling" && !isCompleted && (
              <div
                aria-hidden="true"
                className="reigel-laser-sweep pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-signal-400 shadow-[0_0_24px_4px_rgba(200,245,58,0.55)]"
              />
            )}

            <div>
              {/* Clean Browser Window Top Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-200 pb-3.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-signal-400" />
                  <span className="ml-1.5 text-sm font-bold text-brand-950">
                    Live Page Preview
                  </span>
                </div>

                {/* Browser Address Pill */}
                <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs">
                  <Lock size={12} className="text-signal-400" />
                  <span className="max-w-[240px] sm:max-w-[360px] truncate font-medium text-brand-950">
                    https://{displayDomain}
                    {inspectedPage
                      ? pathFromUrl(inspectedPage.url).replace(" (Home page)", "")
                      : ""}
                  </span>
                  {inspectedPage && (
                    <span className="rounded-md bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-700">
                      Checked
                    </span>
                  )}
                </div>
              </div>

              {/* 1. HOW THIS PAGE APPEARS ON GOOGLE SEARCH */}
              <div className="mt-4 rounded-xl border border-brand-200 bg-surface-2/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-800">
                    <Search size={13} className="text-signal-400" />
                    How this page looks on Google Search
                  </span>
                  <span className="rounded-full border border-brand-200 bg-surface-1 px-2.5 py-0.5 text-[11px] font-semibold text-brand-600">
                    {inspectedPage
                      ? inspectedPage.indexability === "INDEXABLE"
                        ? "Ready to rank"
                        : "Needs review"
                      : "Google Preview"}
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-brand-200 bg-surface-1 p-3.5">
                  <p className="truncate text-xs text-brand-500">
                    https://{displayDomain}
                    {inspectedPage
                      ? pathFromUrl(inspectedPage.url).replace(" (Home page)", "")
                      : ""}
                  </p>
                  <p className="mt-1 truncate text-base font-bold text-signal-400">
                    {inspectedPage?.title ||
                      (phase === "crawling"
                        ? `Reading page title on ${displayDomain}…`
                        : `${displayDomain} — Your Website Title`)}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-600">
                    {inspectedPage?.metaDescription ||
                      (phase === "crawling"
                        ? "Checking your page summary description so customers see a clear preview on Google."
                        : "Your page summary description will appear here as soon as the scan starts.")}
                  </p>
                </div>
              </div>

              {/* 2. PAGE CONTENT & THINGS TO IMPROVE */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Left: Main Headline & Page Sections */}
                <div className="rounded-xl border border-brand-200 bg-surface-2/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-950">
                      Page Content & Headings
                    </span>
                    <span className="text-xs text-brand-500">
                      {inspectedPage?.wordCount
                        ? `${inspectedPage.wordCount} words`
                        : "Content check"}
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl border border-brand-200 bg-surface-1 p-3">
                    <p className="text-[11px] font-semibold text-brand-400">
                      Main Headline on Page
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-brand-950">
                      {inspectedPage?.h1?.[0] ||
                        (phase === "crawling"
                          ? "Reading main headline…"
                          : `Welcome to ${displayDomain}`)}
                    </p>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {(inspectedPage?.h2?.length
                      ? inspectedPage.h2.slice(0, 3)
                      : ["Overview", "Products & Services", "Contact"]
                    ).map((sec, i) => (
                      <span
                        key={i}
                        className="truncate max-w-[160px] rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-xs font-medium text-brand-700"
                      >
                        {sec}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right: Issues & Improvements Found */}
                <div className="rounded-xl border border-brand-200 bg-surface-2/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-950">
                      <Zap size={13} className="text-signal-400" />
                      Things to Improve
                    </span>
                    <span className="rounded-full bg-surface-1 px-2.5 py-0.5 text-xs font-bold text-signal-400">
                      {totalIssuesRecorded > 0
                        ? `${totalIssuesRecorded} spotted`
                        : "Checking…"}
                    </span>
                  </div>

                  {crawledIssues.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {crawledIssues.slice(0, 3).map((iss) => (
                        <div
                          key={iss.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-brand-200 bg-surface-1 px-3 py-2 text-xs"
                        >
                          <span className="truncate font-medium text-brand-800">
                            {iss.description}
                          </span>
                          <span className="shrink-0 rounded-md bg-warning-50 px-2 py-0.5 text-[10px] font-bold text-warning-700">
                            To fix
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-brand-200 bg-surface-1 p-3.5 text-xs leading-relaxed text-brand-500">
                      {phase === "crawling"
                        ? "Checking your pages for missing titles, slow speed, broken links, and SEO issues…"
                        : "Once you start the scan below, any problems stopping your website from ranking on Google will appear here."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── BOTTOM-DOCKED INPUT & LIVE PROGRESS BAR ── */}
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
                  <span className="select-none text-sm font-semibold text-brand-400">
                    https://
                  </span>
                  <input
                    id="onboarding-domain"
                    type="text"
                    required
                    autoFocus
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="Enter your website (e.g. yourwebsite.com)"
                    className="w-full min-w-0 bg-transparent text-sm font-bold text-brand-950 placeholder:text-brand-400 focus:outline-none"
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
                    <p className="truncate text-sm font-bold text-brand-950">
                      {isCompleted
                        ? `Audit complete for ${activeDomain} — opening your Website Audit…`
                        : `Scanning ${activeDomain} (${totalPagesRecorded} pages checked)`}
                    </p>
                    <span className="hidden sm:inline text-xs font-semibold text-brand-500">
                      {isCompleted
                        ? "100%"
                        : `${Math.min(92, Math.max(18, totalPagesRecorded * 5))}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-brand-200">
                    <div
                      className="h-full rounded-full bg-signal-400 transition-all duration-500"
                      style={{
                        width: isCompleted
                          ? "100%"
                          : `${Math.min(92, Math.max(18, totalPagesRecorded * 5))}%`,
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
