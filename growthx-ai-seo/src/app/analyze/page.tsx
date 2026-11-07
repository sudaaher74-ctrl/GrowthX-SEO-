"use client";

import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Folder,
  Globe,
  Home,
  Layers,
  Loader2,
  Radar,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { api, auth, subscribeToAuthChange, type AutopilotRun } from "@/lib/api-client";
import type { CrawlPage } from "@/lib/api-types";
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

function getPathname(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.pathname || "/";
  } catch {
    if (!rawUrl) return "/";
    return rawUrl.startsWith("/") ? rawUrl : `/${rawUrl}`;
  }
}

interface TreeNodeData {
  path: string;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string[];
  wordCount?: number;
  statusCode?: number | null;
  indexability?: string | null;
  responseTimeMs?: number;
}

/**
 * Builds the tree strictly from real discovered pages (no hardcoded fake routes).
 */
function buildRealTree(pages: CrawlPage[]): {
  rootHome: TreeNodeData;
  sections: TreeNodeData[];
  children: TreeNodeData[];
} {
  const homePage = pages.find((p) => getPathname(p.url) === "/");
  const rootHome: TreeNodeData = {
    path: "/",
    title: homePage?.title ?? null,
    metaDescription: homePage?.metaDescription ?? null,
    h1: homePage?.h1,
    wordCount: homePage?.wordCount,
    statusCode: homePage?.statusCode,
    indexability: homePage?.indexability,
    responseTimeMs: homePage?.responseTimeMs,
  };

  const sectionMap = new Map<string, TreeNodeData>();
  const deepPages: TreeNodeData[] = [];

  for (const page of pages) {
    const pathname = getPathname(page.url).replace(/\/+$/, "") || "/";
    if (pathname === "/") continue;

    const segments = pathname.split("/").filter(Boolean);
    const topPath = `/${segments[0]}`;

    if (!sectionMap.has(topPath)) {
      sectionMap.set(topPath, {
        path: topPath,
        title: page.title,
        metaDescription: page.metaDescription,
        h1: page.h1,
        wordCount: page.wordCount,
        statusCode: page.statusCode,
        indexability: page.indexability,
        responseTimeMs: page.responseTimeMs,
      });
    }

    if (segments.length >= 2) {
      if (!deepPages.some((d) => d.path === pathname)) {
        deepPages.push({
          path: pathname,
          title: page.title,
          metaDescription: page.metaDescription,
          h1: page.h1,
          wordCount: page.wordCount,
          statusCode: page.statusCode,
          indexability: page.indexability,
          responseTimeMs: page.responseTimeMs,
        });
      }
    }
  }

  // If fewer than 3 multi-segment pages exist, use any remaining discovered pages beyond the top 4 sections
  const sections = Array.from(sectionMap.values()).slice(0, 4);
  if (deepPages.length < 3 && pages.length > sections.length + 1) {
    for (const extra of pages) {
      if (deepPages.length >= 3) break;
      const pathname = getPathname(extra.url).replace(/\/+$/, "") || "/";
      if (
        pathname !== "/" &&
        !sections.some((s) => s.path === pathname) &&
        !deepPages.some((d) => d.path === pathname)
      ) {
        deepPages.push({
          path: pathname,
          title: extra.title,
          metaDescription: extra.metaDescription,
          h1: extra.h1,
          wordCount: extra.wordCount,
          statusCode: extra.statusCode,
          indexability: extra.indexability,
          responseTimeMs: extra.responseTimeMs,
        });
      }
    }
  }

  return {
    rootHome,
    sections,
    children: deepPages.slice(0, 3),
  };
}

/**
 * Generates a smooth SVG rounded orthogonal elbow path from (x1, 0) to (x2, height).
 */
function buildElbowPath(x1: number, x2: number, height = 52): string {
  const dx = x2 - x1;
  if (Math.abs(dx) < 2) {
    return `M ${x1} 0 L ${x2} ${height}`;
  }
  const dir = dx > 0 ? 1 : -1;
  const r = Math.min(14, Math.abs(dx) / 2);
  const midY = Math.round(height * 0.48);
  return `M ${x1} 0 L ${x1} ${midY - r} Q ${x1} ${midY} ${x1 + dir * r} ${midY} L ${x2 - dir * r} ${midY} Q ${x2} ${midY} ${x2} ${midY + r} L ${x2} ${height}`;
}

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

  /**
   * Step-by-step progressive reveal counter:
   * 0 = ONLY [ 🌐 domain.com ] is shown on screen (no / Home or child nodes yet!)
   * 1 = [ 🏠 / (Home) ] appears and scans
   * 2..N = Each discovered section & child file appears one by one!
   */
  const [revealStep, setRevealStep] = useState<number>(0);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

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
      return 1500;
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
    queryFn: () => api.getCrawlPages(crawlId!, { page: 1, limit: 24 }),
    enabled: phase === "crawling" && Boolean(crawlId),
    refetchInterval: isCompleted || isFailed ? false : 1500,
  });

  // Poll live detected issues from the active crawl job
  const issuesQuery = useQuery({
    queryKey: ["onboarding-crawl-issues", crawlId],
    queryFn: () => api.getCrawlIssues(crawlId!, { page: 1, limit: 10 }),
    enabled: phase === "crawling" && Boolean(crawlId),
    refetchInterval: isCompleted || isFailed ? false : 2000,
  });

  const autopilotQuery = useQuery({
    queryKey: ["onboarding-autopilot", activeProjectId],
    queryFn: () => api.autopilot.latest(activeProjectId!),
    enabled: phase === "crawling" && Boolean(activeProjectId),
    initialData: initialRun,
    refetchInterval: isCompleted || isFailed ? false : 2500,
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

  const { rootHome, sections, children } = useMemo(
    () => buildRealTree(crawledPages),
    [crawledPages],
  );

  // Total available nodes based on real data discovered so far:
  // Node 1 is / (Home), then each discovered section, then each discovered child page
  const maxAvailableStep = 1 + sections.length + children.length;

  // Step-by-step timer: starts at 0 (only domain pill), then reveals 1 node at a time as pages arrive
  useEffect(() => {
    if (phase !== "crawling") return;
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
      setRevealStep((prev) => {
        if (isCompleted) return maxAvailableStep + 1;
        // Always allow advancing to step 1 (/ Home), then advance one by one up to maxAvailableStep
        if (prev < 1) return 1;
        if (prev < maxAvailableStep) return prev + 1;
        return prev;
      });
    }, 1100);
    return () => clearInterval(timer);
  }, [phase, isCompleted, maxAvailableStep]);

  // Automatically redirect to Website Audit (/website) only after the crawl finishes AND the tree steps have revealed
  useEffect(() => {
    if (phase !== "crawling" || !isCompleted) return;
    if (revealStep < maxAvailableStep) return;
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["latest-crawl"] });
      queryClient.invalidateQueries({ queryKey: ["issue-counts"] });
      queryClient.invalidateQueries({ queryKey: ["issue-groups"] });
      router.replace("/website");
    }, 1200);
    return () => clearTimeout(timer);
  }, [phase, isCompleted, revealStep, maxAvailableStep, queryClient, router]);

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

      // Start at step 0: ONLY the website domain pill is visible at first!
      setRevealStep(0);
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

  // ===========================================================================
  // SCREEN 1: INPUT PHASE — NO BACKGROUND TREE OR PANELS, ONLY THE WEBSITE BAR
  // ===========================================================================
  if (phase === "input") {
    return (
      <div
        className="dash-dark dark relative flex h-screen w-full flex-col justify-between overflow-hidden select-none"
        style={{ background: "var(--color-canvas)" }}
      >
        {/* Minimal Top Logo */}
        <header className="relative z-20 flex h-16 shrink-0 items-center justify-between px-6 sm:px-10">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal-400 font-mono text-xs font-black text-signal-ink">
              R
            </span>
            <span className="text-lg font-extrabold tracking-tight text-brand-950">
              Reigel
            </span>
          </Link>

          {projects.length > 0 && (
            <button
              type="button"
              onClick={() => router.push("/website")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3.5 py-2 text-xs font-bold text-brand-800 transition hover:border-brand-300 hover:text-brand-950 cursor-pointer"
            >
              <span>Website Audit</span>
              <ArrowRight size={13} />
            </button>
          )}
        </header>

        {/* Centered Website Input Bar Only (No Background Clutter) */}
        <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 pb-16">
          <form onSubmit={handleStartAudit} noValidate className="w-full">
            {error && (
              <div
                role="alert"
                className="mb-3 flex items-center gap-2 rounded-xl border border-error-500/40 bg-error-50 px-4 py-2.5 text-xs font-semibold text-error-700"
              >
                <AlertTriangle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-brand-300 bg-surface-1 px-4 py-3.5 focus-within:border-signal-400 transition-colors shadow-card">
                <Globe size={18} className="shrink-0 text-signal-400" />
                <span className="select-none font-mono text-sm font-bold text-brand-400">
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
                  className="w-full min-w-0 border-0 bg-transparent font-mono text-base font-bold text-brand-950 placeholder:text-brand-400 outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
                  style={{ outline: "none", boxShadow: "none" }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-signal-400 px-7 py-4 text-sm font-extrabold text-signal-ink shadow-md transition hover:opacity-95 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Starting…</span>
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
        </main>

        <div className="h-12 shrink-0" />
      </div>
    );
  }

  // ===========================================================================
  // SCREEN 2: CRAWLING PHASE — STARTS FROM DOMAIN ONLY, REVEALS STEP BY STEP
  // ===========================================================================
  const displayDomain = activeDomain || cleanDomainInput(domainInput);

  // Determine which nodes have appeared so far based on revealStep:
  // Step 0: Only [ 🌐 domain ] is visible
  // Step 1: [ 🏠 / (Home) ] appears
  // Step 2..(1 + sections.length): sections appear one by one
  // Step (2 + sections.length)..(1 + sections.length + children.length): children appear one by one
  const showHome = revealStep >= 1;
  const homeDone = revealStep > 1 || isCompleted;

  const visibleSectionsCount = Math.max(
    0,
    Math.min(sections.length, revealStep - 1),
  );
  const visibleSections = sections.slice(0, visibleSectionsCount);

  const childStartStep = 1 + sections.length + 1;
  const visibleChildrenCount = Math.max(
    0,
    Math.min(children.length, revealStep - (1 + sections.length)),
  );
  const visibleChildren = children.slice(0, visibleChildrenCount);

  // List of all revealed nodes in order for the Active Scanner & Finished Files list
  const revealedNodes: { node: TreeNodeData; done: boolean }[] = [];
  if (showHome) {
    revealedNodes.push({ node: rootHome, done: homeDone });
  }
  visibleSections.forEach((sec, idx) => {
    const stepForThisSection = 2 + idx;
    const isDone = revealStep > stepForThisSection || isCompleted;
    revealedNodes.push({ node: sec, done: isDone });
  });
  visibleChildren.forEach((child, idx) => {
    const stepForThisChild = childStartStep + idx;
    const isDone = revealStep > stepForThisChild || isCompleted;
    revealedNodes.push({ node: child, done: isDone });
  });

  const currentScanningNode =
    revealedNodes.find((item) => !item.done)?.node ||
    revealedNodes[revealedNodes.length - 1]?.node ||
    rootHome;

  const finishedNodesList = revealedNodes
    .filter((item) => item.done)
    .map((item) => item.node);

  // Average response speed from real crawled pages
  const avgSpeedMs =
    crawledPages.length > 0
      ? Math.round(
          crawledPages.reduce((acc, p) => acc + (p.responseTimeMs || 0), 0) /
            crawledPages.length,
        )
      : null;

  const filesFinishedCount = Math.max(
    finishedNodesList.length,
    isCompleted ? totalPagesRecorded : 0,
  );

  const progressPct = isCompleted
    ? 100
    : Math.min(
        95,
        Math.max(
          6,
          Math.round(
            (revealStep / Math.max(4, maxAvailableStep + 1)) * 88,
          ),
        ),
      );

  // Runtime tasks that activate step by step
  const runtimeEngines = [
    {
      name: "Root DNS, SSL & Home (/) Handshake",
      detail: homeDone
        ? "Home (/) verified"
        : showHome
          ? "Scanning / (Home)…"
          : `Connecting to ${displayDomain}…`,
      status: homeDone ? "done" : "scanning",
    },
    ...(showHome
      ? [
          {
            name: "Sitemap & Internal Folder Spider",
            detail:
              visibleSections.length > 0
                ? `${Math.max(visibleSections.length, totalPagesRecorded)} routes discovered`
                : "Discovering top-level links from /…",
            status:
              visibleChildren.length > 0 || isCompleted ? "done" : "scanning",
          },
        ]
      : []),
    ...(visibleSections.length > 0
      ? [
          {
            name: "Deep File DOM & Metadata Parser",
            detail: `Inspecting ${currentScanningNode.path}`,
            status: isCompleted ? "done" : "scanning",
          },
        ]
      : []),
    ...(visibleSections.length > 1 || totalIssuesRecorded > 0
      ? [
          {
            name: "SEO Defect & Speed Rule Engine",
            detail:
              totalIssuesRecorded > 0
                ? `${totalIssuesRecorded} issues flagged`
                : "Checking titles, headings & speed…",
            status: isCompleted ? "done" : "scanning",
          },
        ]
      : []),
  ];

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  // Calculate SVG column positions for currently visible sections & children
  const secTotalCols = Math.max(1, visibleSections.length);
  const firstSectionX = ((0 + 0.5) / secTotalCols) * 800;
  const childTotalCols = Math.max(1, visibleChildren.length);

  return (
    <div
      className="dash-dark dark relative min-h-screen lg:h-screen w-full overflow-x-hidden lg:overflow-hidden flex flex-col justify-between select-none"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* ── MATTE-BLACK TECHNICAL BLUEPRINT GRID & RADIAL GLOW ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-[520px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(200, 245, 58, 0.14) 0%, rgba(9, 10, 13, 0) 70%)",
          }}
        />
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.10]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="tree-subgrid"
              width="28"
              height="28"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 28 0 L 0 0 0 28"
                fill="none"
                stroke="var(--color-brand-300)"
                strokeWidth="0.5"
              />
            </pattern>
            <pattern
              id="tree-grid"
              width="140"
              height="140"
              patternUnits="userSpaceOnUse"
            >
              <rect width="140" height="140" fill="url(#tree-subgrid)" />
              <path
                d="M 140 0 L 0 0 0 140"
                fill="none"
                stroke="var(--color-brand-400)"
                strokeWidth="1"
              />
              <circle cx="0" cy="0" r="1.5" fill="var(--color-signal-400)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tree-grid)" />
        </svg>
      </div>

      {/* ── TOP RUNTIME TELEMETRY HEADER ── */}
      <header
        className="relative z-20 flex h-14 shrink-0 items-center justify-between border-b bg-surface-1/90 px-4 sm:px-6 backdrop-blur-md"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-signal-400 font-mono text-xs font-black text-signal-ink">
              R
            </span>
            <span className="text-sm font-extrabold tracking-tight text-brand-950">
              Reigel
            </span>
          </Link>
          <span className="text-brand-300">/</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-3 py-1 text-xs font-bold text-brand-700">
            <Radar
              size={12}
              className={cn(
                "text-signal-400",
                !isCompleted && "animate-spin",
              )}
            />
            {isCompleted
              ? "Crawl Complete"
              : showHome
                ? `Scanning: ${currentScanningNode.path}`
                : `Connecting: ${displayDomain}`}
          </span>
        </div>

        {/* Center Live Runtime Counters */}
        <div className="hidden xl:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1">
            <CheckCircle2 size={12} className="text-signal-400" />
            <span className="text-brand-500">Files Finished:</span>
            <strong className="font-mono text-brand-950">
              {filesFinishedCount}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1">
            <Zap size={12} className="text-signal-400" />
            <span className="text-brand-500">Avg Speed:</span>
            <strong className="font-mono text-brand-950">
              {avgSpeedMs ? `${avgSpeedMs}ms` : "—"}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1">
            <AlertTriangle size={12} className="text-warning-700" />
            <span className="text-brand-500">Issues Spotted:</span>
            <strong className="font-mono text-warning-700">
              {totalIssuesRecorded}
            </strong>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1">
            <Clock size={12} className="text-brand-400" />
            <span className="font-mono text-brand-950">
              {formatElapsed(elapsedSec)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/website")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-2 px-3.5 py-1.5 text-xs font-bold text-brand-800 transition hover:border-brand-300 hover:text-brand-950 cursor-pointer"
          >
            <span>Website Audit</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      {/* ── MAIN WORKSPACE: LEFT RUNTIME PANEL + CENTER PROGRESSIVE TREE + RIGHT FINISHED LOG ── */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-4 pt-3 pb-24 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-5 lg:grid-cols-12">
          {/* =================================================================
              LEFT COLUMN (3 COLS): ACTIVE FILE INSPECTOR & RUNTIME TASKS
             ================================================================= */}
          <div className="lg:col-span-3 flex flex-col gap-3.5">
            {/* Card 1: Currently Scanning File Inspector */}
            <div className="rounded-2xl border border-brand-200 bg-surface-1/95 p-4 shadow-card backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-brand-200 pb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                  <Activity size={13} className="text-signal-400" />
                  Active File Scanner
                </span>
                <span className="rounded-md bg-primary-50 px-2 py-0.5 font-mono text-[10px] font-bold text-signal-400">
                  {isCompleted ? "DONE" : "LIVE"}
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-brand-200 bg-surface-2/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                  Currently Crawling File
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs font-extrabold text-signal-400">
                    {showHome
                      ? currentScanningNode.path === "/"
                        ? "/ (Home)"
                        : currentScanningNode.path
                      : `https://${displayDomain}`}
                  </span>
                  {!isCompleted && (
                    <Loader2 size={13} className="shrink-0 animate-spin text-signal-400" />
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs font-medium text-brand-700">
                  {showHome
                    ? currentScanningNode.title ||
                      `Reading HTML & internal links on ${currentScanningNode.path}…`
                    : `Establishing connection to ${displayDomain}…`}
                </p>
              </div>

              {/* Live File Telemetry Metrics */}
              <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-2.5">
                  <p className="text-[10px] text-brand-400">HTTP Status</p>
                  <p className="mt-0.5 font-mono font-bold text-brand-950">
                    {showHome
                      ? currentScanningNode.statusCode
                        ? `${currentScanningNode.statusCode} OK`
                        : "Verified"
                      : "Connecting…"}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-2.5">
                  <p className="text-[10px] text-brand-400">Response Speed</p>
                  <p className="mt-0.5 font-mono font-bold text-brand-950">
                    {currentScanningNode.responseTimeMs
                      ? `${currentScanningNode.responseTimeMs}ms`
                      : avgSpeedMs
                        ? `${avgSpeedMs}ms`
                        : "Measuring…"}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Step-by-Step Runtime Crawler Tasks */}
            <div className="rounded-2xl border border-brand-200 bg-surface-1/95 p-4 shadow-card backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-brand-200 pb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                  <Layers size={13} className="text-signal-400" />
                  Runtime Crawler Tasks
                </span>
                <span className="text-[10px] font-semibold text-brand-400">
                  Step-by-step
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {runtimeEngines.map((eng) => (
                  <div
                    key={eng.name}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-all",
                      eng.status === "done"
                        ? "border-signal-400/50 bg-primary-50/50 text-brand-950"
                        : "border-signal-400 bg-surface-2 text-brand-950",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {eng.status === "done" ? (
                        <Check size={13} className="shrink-0 text-signal-400" strokeWidth={3} />
                      ) : (
                        <Loader2 size={13} className="shrink-0 animate-spin text-signal-400" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-brand-900">
                          {eng.name}
                        </p>
                        <p className="truncate text-[10px] text-brand-500">
                          {eng.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* =================================================================
              CENTER COLUMN (6 COLS): PROGRESSIVE TREE (STARTS FROM DOMAIN ONLY!)
             ================================================================= */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center min-h-[380px]">
            <div className="w-full">
              {/* LEVEL 0: TOP DOMAIN PILL (Always visible first!) */}
              <div className="flex flex-col items-center">
                <div className="relative flex items-center gap-3 rounded-full border border-signal-400 bg-surface-1 px-6 py-3 shadow-[0_0_28px_rgba(200,245,58,0.18)] transition-all duration-300">
                  <Globe size={18} className="shrink-0 text-signal-400" />
                  <span className="font-sans text-base font-extrabold tracking-tight text-brand-950 sm:text-lg">
                    {displayDomain}
                  </span>
                  <span className="rounded-full bg-primary-50 px-2 py-0.5 font-mono text-[10px] font-bold text-signal-400">
                    LIVE
                  </span>

                  {showHome && (
                    <span className="absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-surface-1 bg-signal-400" />
                  )}
                </div>

                {/* Vertical Connector to Home (/) — ONLY appears when step >= 1 */}
                {showHome && (
                  <div className="h-9 w-0.5 bg-signal-400 transition-all duration-500" />
                )}
              </div>

              {/* LEVEL 1: HOME NODE (/ (Home)) — ONLY appears when step >= 1 */}
              {showHome && (
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "relative flex min-w-[170px] items-center justify-center gap-2 rounded-2xl border px-5 py-2.5 shadow-card transition-all duration-300",
                      homeDone
                        ? "border-signal-400 bg-primary-50/90 text-brand-950 shadow-[0_0_24px_rgba(200,245,58,0.15)]"
                        : "border-signal-400 bg-surface-1 text-brand-950 shadow-[0_0_28px_rgba(200,245,58,0.25)]",
                    )}
                  >
                    <span className="absolute -top-1.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-signal-400" />

                    {homeDone ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-signal-400 text-signal-ink">
                        <Check size={11} strokeWidth={3.5} />
                      </span>
                    ) : (
                      <Loader2 size={15} className="shrink-0 animate-spin text-signal-400" />
                    )}

                    <Home size={14} className="shrink-0 text-signal-400" />
                    <span className="font-mono text-sm font-extrabold text-brand-950">
                      / (Home)
                    </span>

                    <span className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-signal-400">
                      {homeDone
                        ? rootHome.responseTimeMs
                          ? `${rootHome.responseTimeMs}ms`
                          : "Done"
                        : "Scanning…"}
                    </span>
                  </div>
                </div>
              )}

              {/* LEVEL 2: DISCOVERED SECTION FOLDERS — Appear one by one as revealStep advances! */}
              {visibleSections.length > 0 && (
                <>
                  <div className="w-full">
                    <svg
                      viewBox="0 0 800 52"
                      className="h-11 w-full overflow-visible sm:h-12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {visibleSections.map((sec, idx) => {
                        const targetX = ((idx + 0.5) / secTotalCols) * 800;
                        const pathD = buildElbowPath(400, targetX, 52);
                        return (
                          <g key={sec.path}>
                            <path
                              d={pathD}
                              stroke="var(--color-signal-400)"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                            />
                            <circle
                              cx={targetX}
                              cy={52}
                              r="3.2"
                              fill="var(--color-signal-400)"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div
                    className="grid gap-0"
                    style={{
                      gridTemplateColumns: `repeat(${secTotalCols}, minmax(0, 1fr))`,
                    }}
                  >
                    {visibleSections.map((sec, idx) => {
                      const stepForThis = 2 + idx;
                      const isDone = revealStep > stepForThis || isCompleted;
                      return (
                        <div key={sec.path} className="px-1.5 sm:px-2">
                          <div
                            className={cn(
                              "relative flex flex-col items-center justify-center rounded-2xl border px-3 py-2.5 shadow-card transition-all duration-300",
                              isDone
                                ? "border-signal-400/80 bg-surface-1 text-brand-950 shadow-[0_0_18px_rgba(200,245,58,0.10)]"
                                : "border-signal-400 bg-primary-50/80 text-brand-950 shadow-[0_0_24px_rgba(200,245,58,0.22)]",
                            )}
                          >
                            <div className="flex w-full items-center justify-center gap-1.5">
                              {isDone ? (
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-signal-400 text-signal-ink">
                                  <Check size={10} strokeWidth={3.5} />
                                </span>
                              ) : (
                                <Loader2
                                  size={13}
                                  className="shrink-0 animate-spin text-signal-400"
                                />
                              )}
                              <Folder size={13} className="shrink-0 text-signal-400" />
                              <span className="truncate font-mono text-[11px] font-bold text-brand-950 sm:text-xs">
                                {sec.path}
                              </span>
                            </div>

                            <span className="mt-1 font-mono text-[9.5px] font-semibold text-signal-400">
                              {isDone
                                ? sec.responseTimeMs
                                  ? `✓ ${sec.responseTimeMs}ms`
                                  : "✓ Done"
                                : "Scanning…"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* LEVEL 3: DISCOVERED CHILD FILES — Appear one by one after sections! */}
              {visibleChildren.length > 0 && (
                <>
                  <div className="w-full">
                    <svg
                      viewBox="0 0 800 52"
                      className="h-11 w-full overflow-visible sm:h-12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        cx={firstSectionX}
                        cy="0"
                        r="3.2"
                        fill="var(--color-signal-400)"
                      />
                      {visibleChildren.map((child, idx) => {
                        const targetX = ((idx + 0.5) / childTotalCols) * 800;
                        const pathD = buildElbowPath(firstSectionX, targetX, 52);
                        return (
                          <g key={child.path}>
                            <path
                              d={pathD}
                              stroke="var(--color-signal-400)"
                              strokeWidth="2.2"
                              strokeLinecap="round"
                            />
                            <circle
                              cx={targetX}
                              cy={52}
                              r="3.2"
                              fill="var(--color-signal-400)"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div
                    className="grid gap-0"
                    style={{
                      gridTemplateColumns: `repeat(${childTotalCols}, minmax(0, 1fr))`,
                    }}
                  >
                    {visibleChildren.map((child, idx) => {
                      const stepForThis = childStartStep + idx;
                      const isDone = revealStep > stepForThis || isCompleted;
                      return (
                        <div key={child.path} className="px-1.5 sm:px-2">
                          <div
                            className={cn(
                              "flex flex-col items-center justify-center rounded-2xl border px-3 py-2.5 shadow-card transition-all duration-300",
                              isDone
                                ? "border-signal-400/80 bg-surface-1 text-brand-950 shadow-[0_0_18px_rgba(200,245,58,0.10)]"
                                : "border-signal-400 bg-primary-50/80 text-brand-950 shadow-[0_0_24px_rgba(200,245,58,0.22)]",
                            )}
                          >
                            <div className="flex w-full items-center justify-center gap-1.5">
                              {isDone ? (
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-signal-400 text-signal-ink">
                                  <Check size={10} strokeWidth={3.5} />
                                </span>
                              ) : (
                                <Loader2
                                  size={13}
                                  className="shrink-0 animate-spin text-signal-400"
                                />
                              )}
                              <FileText size={13} className="shrink-0 text-signal-400" />
                              <span className="truncate font-mono text-[10.5px] font-bold text-brand-950 sm:text-[11px]">
                                {child.path}
                              </span>
                            </div>

                            <span className="mt-1 font-mono text-[9.5px] font-semibold text-signal-400">
                              {isDone
                                ? child.responseTimeMs
                                  ? `✓ ${child.responseTimeMs}ms`
                                  : "✓ Done"
                                : "Scanning…"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* =================================================================
              RIGHT COLUMN (3 COLS): STEP-BY-STEP FINISHED FILES & LIVE ISSUES
             ================================================================= */}
          <div className="lg:col-span-3 flex flex-col gap-3.5">
            {/* Card 1: Files Finished Step by Step (No pre-rendered queued items!) */}
            <div className="rounded-2xl border border-brand-200 bg-surface-1/95 p-4 shadow-card backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-brand-200 pb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                  <ShieldCheck size={13} className="text-signal-400" />
                  Finished Files
                </span>
                <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-signal-400">
                  {filesFinishedCount} done
                </span>
              </div>

              {revealedNodes.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  {revealedNodes.slice(0, 6).map(({ node, done }) => (
                    <div
                      key={node.path}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 font-mono text-[11px] transition-all",
                        done
                          ? "border-brand-200 bg-surface-2/80 text-brand-950"
                          : "border-signal-400 bg-primary-50/70 text-brand-950",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {done ? (
                          <Check
                            size={12}
                            className="shrink-0 text-signal-400"
                            strokeWidth={3}
                          />
                        ) : (
                          <Loader2
                            size={12}
                            className="shrink-0 animate-spin text-signal-400"
                          />
                        )}
                        <span className="truncate font-semibold">
                          {node.path === "/" ? "/ (Home)" : node.path}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] font-bold",
                          done ? "text-signal-400" : "text-warning-700",
                        )}
                      >
                        {done
                          ? node.responseTimeMs
                            ? `${node.responseTimeMs}ms`
                            : "Done"
                          : "Scanning"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-2/40 p-3 text-xs text-brand-500">
                  <Loader2 size={13} className="shrink-0 animate-spin text-signal-400" />
                  <span>Starting from {displayDomain}…</span>
                </div>
              )}
            </div>

            {/* Card 2: Live SEO Issues & Runtime Stream */}
            <div className="rounded-2xl border border-brand-200 bg-surface-1/95 p-4 shadow-card backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-brand-200 pb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                  <Sparkles size={13} className="text-signal-400" />
                  Live Findings
                </span>
                <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-warning-700">
                  {totalIssuesRecorded > 0
                    ? `${totalIssuesRecorded} issues`
                    : "Scanning…"}
                </span>
              </div>

              {crawledIssues.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {crawledIssues.slice(0, 3).map((iss) => (
                    <div
                      key={iss.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-brand-200 bg-surface-2/60 px-2.5 py-2 text-xs"
                    >
                      <span className="truncate font-medium text-brand-800">
                        {iss.description}
                      </span>
                      <span className="shrink-0 rounded bg-error-50 px-1.5 py-0.5 text-[9.5px] font-bold text-error-700">
                        {iss.severity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 space-y-1.5 text-[11px] text-brand-600">
                  {autopilotLogs.length > 0 ? (
                    autopilotLogs.slice(-3).map((l, i) => (
                      <p key={i} className="truncate">
                        <span className="font-bold text-signal-400">›</span> {l.message}
                      </p>
                    ))
                  ) : (
                    <>
                      <p className="truncate">
                        <span className="font-bold text-signal-400">›</span> Connected to {displayDomain}
                      </p>
                      <p className="truncate">
                        <span className="font-bold text-signal-400">›</span> Mapping pages step by step…
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── BOTTOM CRAWLER PROGRESS BAR ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-200/80 bg-surface-1/95 px-4 py-3.5 shadow-2xl backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-col items-center">
            <div className="flex w-full items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isCompleted ? (
                  <Check size={17} className="text-signal-400" strokeWidth={3} />
                ) : (
                  <Loader2 size={16} className="animate-spin text-signal-400" />
                )}
                <p className="text-sm font-extrabold tracking-tight text-brand-950 sm:text-base">
                  {isCompleted
                    ? "Audit Complete — Opening Website Audit..."
                    : showHome
                      ? `Crawling Website... (${currentScanningNode.path === "/" ? "/ Home" : currentScanningNode.path})`
                      : `Connecting to ${displayDomain}...`}
                </p>
              </div>

              <span className="font-mono text-xs font-bold text-brand-500">
                {filesFinishedCount} files finished
              </span>
            </div>

            <div className="mt-2 flex w-full items-center gap-3.5">
              <div className="h-3 flex-1 overflow-hidden rounded-full border border-brand-200 bg-surface-2 p-0.5">
                <div
                  className="h-full rounded-full bg-signal-400 shadow-[0_0_16px_rgba(200,245,58,0.6)] transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="w-11 shrink-0 text-right font-mono text-sm font-extrabold text-signal-400">
                {progressPct}%
              </span>
            </div>
          </div>
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
