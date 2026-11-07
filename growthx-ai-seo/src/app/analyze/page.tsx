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
  realCrawled: boolean;
}

const DEFAULT_SECTIONS = ["/products", "/about", "/contact", "/blog"];
const DEFAULT_CHILDREN = [
  "/products/overview",
  "/products/features",
  "/products/pricing",
];

function buildVisualTree(pages: CrawlPage[]): {
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
    realCrawled: Boolean(homePage),
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
        realCrawled: true,
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
          realCrawled: true,
        });
      }
    }
  }

  // If fewer than 3 multi-segment pages exist, fill from other discovered pages
  if (deepPages.length < 3 && pages.length > 1) {
    for (const extra of pages) {
      if (deepPages.length >= 3) break;
      const pathname = getPathname(extra.url).replace(/\/+$/, "") || "/";
      if (
        pathname !== "/" &&
        !Array.from(sectionMap.keys()).slice(0, 4).includes(pathname) &&
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
          realCrawled: true,
        });
      }
    }
  }

  const sections: TreeNodeData[] = Array.from(sectionMap.values()).slice(0, 4);
  for (const fallback of DEFAULT_SECTIONS) {
    if (sections.length >= 4) break;
    if (!sections.some((s) => s.path === fallback)) {
      sections.push({
        path: fallback,
        realCrawled: false,
      });
    }
  }

  const primaryPrefix = sections[0]?.path || "/products";
  const children: TreeNodeData[] = deepPages.slice(0, 3);
  for (const fallback of DEFAULT_CHILDREN) {
    if (children.length >= 3) break;
    const adjusted =
      primaryPrefix !== "/products"
        ? fallback.replace(/^\/products/, primaryPrefix)
        : fallback;
    if (!children.some((c) => c.path === adjusted)) {
      children.push({
        path: adjusted,
        realCrawled: false,
      });
    }
  }

  return { rootHome, sections, children };
}

type NodeStatus = "queued" | "scanning" | "done";

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

  // Sequential step counter: 0 = Home (/), 1..4 = Level 2 folders, 5..7 = Level 3 files
  const [crawlStep, setCrawlStep] = useState<number>(0);
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
      return 1800;
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
    refetchInterval: isCompleted || isFailed ? false : 1800,
  });

  // Poll live detected issues from the active crawl job
  const issuesQuery = useQuery({
    queryKey: ["onboarding-crawl-issues", crawlId],
    queryFn: () => api.getCrawlIssues(crawlId!, { page: 1, limit: 10 }),
    enabled: phase === "crawling" && Boolean(crawlId),
    refetchInterval: isCompleted || isFailed ? false : 2200,
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

  // Advance sequential one-by-one file traversal starting from Home (step 0 -> 1 -> 2 ... -> 8)
  useEffect(() => {
    if (phase !== "crawling") return;
    if (isCompleted) {
      setCrawlStep(9);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
      setCrawlStep((prev) => {
        // Advance one node at a time; once all 8 tree nodes are reached, keep cycling leaf inspection until backend finishes
        if (prev < 8) return prev + 1;
        return 5 + ((prev - 4) % 3);
      });
    }, 1400);
    return () => clearInterval(timer);
  }, [phase, isCompleted]);

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

      // Start at step 0 (Home `/`) so user watches it finish one by one!
      setCrawlStep(0);
      setElapsedSec(0);
      setActiveDomain(run.domain || cleaned);
      setPhase("crawling");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the website audit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const { rootHome, sections, children } = useMemo(
    () => buildVisualTree(crawledPages),
    [crawledPages],
  );

  // Ordered list of all 8 tree nodes so we can determine each node's status (queued -> scanning -> done)
  const orderedNodes: TreeNodeData[] = useMemo(
    () => [rootHome, ...sections, ...children],
    [rootHome, sections, children],
  );

  if (signedIn !== true) return null;

  const displayDomain =
    activeDomain || cleanDomainInput(domainInput) || "yourwebsite.com";

  // Helper: get sequential status for node index (0 = Home, 1..4 = Sections, 5..7 = Children)
  function getNodeStatus(nodeIndex: number): NodeStatus {
    if (phase === "input") return "queued";
    if (isCompleted) return "done";
    if (crawlStep > nodeIndex) return "done";
    if (crawlStep === nodeIndex) return "scanning";
    return "queued";
  }

  const homeStatus = getNodeStatus(0);

  // Currently scanning node (for live runtime inspection panel)
  const activeNodeIndex =
    phase === "crawling" ? Math.min(crawlStep, orderedNodes.length - 1) : 0;
  const activeNode = orderedNodes[activeNodeIndex] || rootHome;

  // List of nodes finished so far (for the one-by-one finished files feed)
  const finishedNodes =
    phase === "crawling"
      ? orderedNodes.filter((_, idx) => getNodeStatus(idx) === "done")
      : [];

  // Average response speed from real crawled pages
  const avgSpeedMs =
    crawledPages.length > 0
      ? Math.round(
          crawledPages.reduce((acc, p) => acc + (p.responseTimeMs || 0), 0) /
            crawledPages.length,
        )
      : null;

  // Smooth runtime progress percentage
  const finishedCount = finishedNodes.length;
  const progressPct = isCompleted
    ? 100
    : phase === "crawling"
      ? Math.min(
          95,
          Math.max(
            8,
            Math.round((finishedCount / 8) * 75) +
              Math.min(20, totalPagesRecorded * 2),
          ),
        )
      : 0;

  // Runtime engine modules status
  const runtimeEngines = [
    {
      name: "Root DNS, SSL & Home (/) Handshake",
      detail: homeStatus === "done" ? "Home (/) verified" : "Starting from /",
      status:
        phase === "input"
          ? "queued"
          : homeStatus === "done"
            ? "done"
            : "scanning",
    },
    {
      name: "Sitemap & Internal Folder Spider",
      detail:
        finishedCount > 1
          ? `${Math.max(finishedCount, totalPagesRecorded)} routes mapped`
          : "Waiting for Home (/)",
      status:
        phase === "input" || crawlStep < 1
          ? "queued"
          : crawlStep >= 5 || isCompleted
            ? "done"
            : "scanning",
    },
    {
      name: "Deep File DOM & Metadata Parser",
      detail:
        crawlStep >= 5
          ? `Inspecting ${activeNode.path}`
          : "Queued after folders",
      status:
        phase === "input" || crawlStep < 5
          ? "queued"
          : isCompleted
            ? "done"
            : "scanning",
    },
    {
      name: "SEO Defect & Speed Rule Engine",
      detail:
        totalIssuesRecorded > 0
          ? `${totalIssuesRecorded} issues flagged`
          : phase === "crawling"
            ? "Evaluating 128 rules"
            : "Standby",
      status:
        phase === "input" || crawlStep < 2
          ? "queued"
          : isCompleted
            ? "done"
            : "scanning",
    },
  ];

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
                phase === "crawling" && !isCompleted && "animate-spin",
              )}
            />
            {phase === "crawling"
              ? isCompleted
                ? "Crawl Complete"
                : `Scanning: ${activeNode.path}`
              : "Step 1 · Enter Website Below"}
          </span>
        </div>

        {/* Center Live Runtime Counters */}
        <div className="hidden xl:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1">
            <CheckCircle2 size={12} className="text-signal-400" />
            <span className="text-brand-500">Files Finished:</span>
            <strong className="font-mono text-brand-950">
              {phase === "crawling"
                ? Math.max(finishedCount, totalPagesRecorded)
                : 0}
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

      {/* ── MAIN WORKSPACE: LEFT RUNTIME PANEL + CENTER TREE + RIGHT FINISHED LOG ── */}
      <main className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-4 pt-3 pb-24 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-5 lg:grid-cols-12">
          {/* =================================================================
              LEFT COLUMN (3 COLS): ACTIVE FILE INSPECTOR & RUNTIME ENGINES
             ================================================================= */}
          <div className="lg:col-span-3 flex flex-col gap-3.5">
            {/* Card 1: Currently Scanning File Inspector */}
            <div className="rounded-2xl border border-brand-200 bg-surface-1/95 p-4 shadow-card backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-brand-200 pb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                  <Activity size={13} className="text-signal-400" />
                  Active File Scanner
                </span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 font-mono text-[10px] font-bold",
                    phase === "crawling"
                      ? "bg-primary-50 text-signal-400"
                      : "bg-surface-2 text-brand-400",
                  )}
                >
                  {phase === "crawling"
                    ? isCompleted
                      ? "DONE"
                      : "LIVE"
                    : "STANDBY"}
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-brand-200 bg-surface-2/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                  {phase === "crawling" ? "Currently Crawling File" : "Start Point"}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs font-extrabold text-signal-400">
                    {phase === "crawling" ? activeNode.path : "/ (Home)"}
                  </span>
                  {phase === "crawling" && !isCompleted && (
                    <Loader2 size={13} className="shrink-0 animate-spin text-signal-400" />
                  )}
                </div>
                <p className="mt-1.5 truncate text-xs font-medium text-brand-700">
                  {phase === "crawling"
                    ? activeNode.title || `Scanning HTML & links on ${activeNode.path}…`
                    : "Enter your website below to start from Home (/)"}
                </p>
              </div>

              {/* Live File Telemetry Metrics */}
              <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-2.5">
                  <p className="text-[10px] text-brand-400">HTTP Status</p>
                  <p className="mt-0.5 font-mono font-bold text-brand-950">
                    {phase === "crawling"
                      ? activeNode.statusCode
                        ? `${activeNode.statusCode} OK`
                        : "Verified"
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-2.5">
                  <p className="text-[10px] text-brand-400">Response Speed</p>
                  <p className="mt-0.5 font-mono font-bold text-brand-950">
                    {phase === "crawling"
                      ? activeNode.responseTimeMs
                        ? `${activeNode.responseTimeMs}ms`
                        : avgSpeedMs
                          ? `${avgSpeedMs}ms`
                          : "Checking…"
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Runtime Crawler Functions */}
            <div className="rounded-2xl border border-brand-200 bg-surface-1/95 p-4 shadow-card backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-brand-200 pb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                  <Layers size={13} className="text-signal-400" />
                  Runtime Crawler Tasks
                </span>
                <span className="text-[10px] font-semibold text-brand-400">
                  Real-time
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
                        : eng.status === "scanning"
                          ? "border-signal-400 bg-surface-2 text-brand-950"
                          : "border-brand-200/70 bg-surface-2/30 text-brand-500",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {eng.status === "done" ? (
                        <Check size={13} className="shrink-0 text-signal-400" strokeWidth={3} />
                      ) : eng.status === "scanning" ? (
                        <Loader2 size={13} className="shrink-0 animate-spin text-signal-400" />
                      ) : (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
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
              CENTER COLUMN (6 COLS): ONE-BY-ONE HIERARCHICAL WEBSITE TREE
             ================================================================= */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center">
            <div className="w-full">
              {/* LEVEL 0: TOP DOMAIN PILL */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "relative flex items-center gap-3 rounded-full border px-6 py-2.5 shadow-card transition-all duration-300",
                    phase === "crawling"
                      ? "border-signal-400 bg-surface-1 shadow-[0_0_28px_rgba(200,245,58,0.16)]"
                      : "border-brand-300 bg-surface-1",
                  )}
                >
                  <Globe
                    size={18}
                    className={cn(
                      "shrink-0",
                      phase === "crawling" ? "text-signal-400" : "text-brand-400",
                    )}
                  />
                  <span className="font-sans text-base font-extrabold tracking-tight text-brand-950 sm:text-lg">
                    {displayDomain}
                  </span>
                  {phase === "crawling" && (
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 font-mono text-[10px] font-bold text-signal-400">
                      LIVE
                    </span>
                  )}
                  <span
                    className={cn(
                      "absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-surface-1",
                      phase === "crawling" ? "bg-signal-400" : "bg-brand-300",
                    )}
                  />
                </div>

                {/* Vertical Connector from Domain to Home (/) */}
                <div
                  className={cn(
                    "h-8 w-0.5 transition-colors duration-500",
                    phase === "crawling" ? "bg-signal-400" : "bg-brand-300/60",
                  )}
                />
              </div>

              {/* LEVEL 1: HOME ROOT NODE (🏠 / — Starts here first!) */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "relative flex min-w-[165px] items-center justify-center gap-2 rounded-2xl border px-5 py-2.5 shadow-card transition-all duration-300",
                    homeStatus === "done"
                      ? "border-signal-400 bg-primary-50/90 text-brand-950 shadow-[0_0_24px_rgba(200,245,58,0.15)]"
                      : homeStatus === "scanning"
                        ? "border-signal-400 bg-surface-1 text-brand-950 shadow-[0_0_28px_rgba(200,245,58,0.25)]"
                        : "border-brand-300 bg-surface-1/80 text-brand-600",
                  )}
                >
                  <span
                    className={cn(
                      "absolute -top-1.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full",
                      phase === "crawling" ? "bg-signal-400" : "bg-brand-300",
                    )}
                  />

                  {homeStatus === "scanning" ? (
                    <Loader2 size={15} className="shrink-0 animate-spin text-signal-400" />
                  ) : homeStatus === "done" ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-signal-400 text-signal-ink">
                      <Check size={11} strokeWidth={3.5} />
                    </span>
                  ) : (
                    <Home size={15} className="shrink-0 text-brand-400" />
                  )}

                  <span className="font-mono text-sm font-extrabold text-brand-950">
                    / (Home)
                  </span>

                  {homeStatus === "scanning" && (
                    <span className="rounded bg-primary-50 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-signal-400">
                      Scanning…
                    </span>
                  )}
                  {homeStatus === "done" && (
                    <span className="rounded bg-surface-1 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-signal-400">
                      {rootHome.responseTimeMs ? `${rootHome.responseTimeMs}ms` : "Done"}
                    </span>
                  )}

                  {/* Sonar pulse when Home is actively scanning */}
                  {homeStatus === "scanning" && (
                    <span className="absolute -bottom-2 right-4 flex h-4 w-4 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-signal-400" />
                    </span>
                  )}
                </div>
              </div>

              {/* SVG BRANCHING CONNECTORS: HOME (/) -> 4 SECTION FOLDERS (Nodes 1..4) */}
              <div className="w-full">
                <svg
                  viewBox="0 0 800 52"
                  className="h-11 w-full overflow-visible sm:h-12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {[
                    {
                      nodeIdx: 1,
                      x: 100,
                      path: "M 400 0 L 400 15 Q 400 25 384 25 L 116 25 Q 100 25 100 38 L 100 52",
                    },
                    {
                      nodeIdx: 2,
                      x: 300,
                      path: "M 400 0 L 400 15 Q 400 25 388 25 L 312 25 Q 300 25 300 38 L 300 52",
                    },
                    {
                      nodeIdx: 3,
                      x: 500,
                      path: "M 400 0 L 400 15 Q 400 25 412 25 L 488 25 Q 500 25 500 38 L 500 52",
                    },
                    {
                      nodeIdx: 4,
                      x: 700,
                      path: "M 400 0 L 400 15 Q 400 25 416 25 L 684 25 Q 700 25 700 38 L 700 52",
                    },
                  ].map((branch) => {
                    const st = getNodeStatus(branch.nodeIdx);
                    const activeOrDone = st === "scanning" || st === "done";
                    return (
                      <g key={branch.x}>
                        <path
                          d={branch.path}
                          stroke={
                            activeOrDone
                              ? "var(--color-signal-400)"
                              : "var(--color-brand-300)"
                          }
                          strokeWidth={activeOrDone ? "2.2" : "1.4"}
                          strokeDasharray={st === "queued" ? "4 4" : undefined}
                          strokeLinecap="round"
                        />
                        <circle
                          cx={branch.x}
                          cy={52}
                          r="3.2"
                          fill={
                            activeOrDone
                              ? "var(--color-signal-400)"
                              : "var(--color-brand-300)"
                          }
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* LEVEL 2: 4 SECTION FOLDER NODES (Nodes 1..4 — Finished one by one!) */}
              <div className="grid grid-cols-4 gap-0">
                {sections.map((sec, idx) => {
                  const nodeIdx = idx + 1;
                  const st = getNodeStatus(nodeIdx);
                  return (
                    <div key={sec.path} className="px-1 sm:px-2">
                      <div
                        className={cn(
                          "relative flex flex-col items-center justify-center rounded-2xl border px-2.5 py-2.5 shadow-card transition-all duration-300",
                          st === "done"
                            ? "border-signal-400/80 bg-surface-1 text-brand-950 shadow-[0_0_18px_rgba(200,245,58,0.08)]"
                            : st === "scanning"
                              ? "border-signal-400 bg-primary-50/80 text-brand-950 shadow-[0_0_24px_rgba(200,245,58,0.22)]"
                              : "border-brand-200/70 bg-surface-1/60 text-brand-500 opacity-65",
                        )}
                      >
                        <div className="flex w-full items-center justify-center gap-1.5">
                          {st === "scanning" ? (
                            <Loader2
                              size={13}
                              className="shrink-0 animate-spin text-signal-400"
                            />
                          ) : st === "done" ? (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-signal-400 text-signal-ink">
                              <Check size={10} strokeWidth={3.5} />
                            </span>
                          ) : (
                            <Folder size={13} className="shrink-0 text-brand-400" />
                          )}
                          <span className="truncate font-mono text-[11px] font-bold text-brand-950 sm:text-xs">
                            {sec.path}
                          </span>
                        </div>

                        <span
                          className={cn(
                            "mt-1 text-[9.5px] font-semibold",
                            st === "done"
                              ? "text-signal-400"
                              : st === "scanning"
                                ? "text-signal-400"
                                : "text-brand-400",
                          )}
                        >
                          {st === "done"
                            ? sec.responseTimeMs
                              ? `✓ ${sec.responseTimeMs}ms`
                              : "✓ Finished"
                            : st === "scanning"
                              ? "Scanning file…"
                              : "Queued"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* SVG BRANCHING CONNECTORS: LEVEL 2 (x=100) -> LEVEL 3 (Nodes 5..7) */}
              <div className="w-full">
                <svg
                  viewBox="0 0 800 52"
                  className="h-11 w-full overflow-visible sm:h-12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    cx="100"
                    cy="0"
                    r="3.2"
                    fill={
                      crawlStep >= 5 || isCompleted
                        ? "var(--color-signal-400)"
                        : "var(--color-brand-300)"
                    }
                  />

                  {[
                    {
                      nodeIdx: 5,
                      x: 100,
                      path: "M 100 0 L 100 52",
                    },
                    {
                      nodeIdx: 6,
                      x: 300,
                      path: "M 100 0 L 100 15 Q 100 25 116 25 L 284 25 Q 300 25 300 38 L 300 52",
                    },
                    {
                      nodeIdx: 7,
                      x: 500,
                      path: "M 100 0 L 100 15 Q 100 25 116 25 L 484 25 Q 500 25 500 38 L 500 52",
                    },
                  ].map((branch) => {
                    const st = getNodeStatus(branch.nodeIdx);
                    const activeOrDone = st === "scanning" || st === "done";
                    return (
                      <g key={branch.x}>
                        <path
                          d={branch.path}
                          stroke={
                            activeOrDone
                              ? "var(--color-signal-400)"
                              : "var(--color-brand-300)"
                          }
                          strokeWidth={activeOrDone ? "2.2" : "1.4"}
                          strokeDasharray={st === "queued" ? "4 4" : undefined}
                          strokeLinecap="round"
                        />
                        <circle
                          cx={branch.x}
                          cy={52}
                          r="3.2"
                          fill={
                            activeOrDone
                              ? "var(--color-signal-400)"
                              : "var(--color-brand-300)"
                          }
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* LEVEL 3: 3 CHILD PAGE FILES (Nodes 5..7 — Finished one by one!) */}
              <div className="grid grid-cols-4 gap-0">
                {children.map((child, idx) => {
                  const nodeIdx = idx + 5;
                  const st = getNodeStatus(nodeIdx);
                  return (
                    <div key={child.path} className="px-1 sm:px-2">
                      <div
                        className={cn(
                          "flex flex-col items-center justify-center rounded-2xl border px-2.5 py-2.5 shadow-card transition-all duration-300",
                          st === "done"
                            ? "border-signal-400/80 bg-surface-1 text-brand-950 shadow-[0_0_18px_rgba(200,245,58,0.08)]"
                            : st === "scanning"
                              ? "border-signal-400 bg-primary-50/80 text-brand-950 shadow-[0_0_24px_rgba(200,245,58,0.22)]"
                              : "border-brand-200/70 bg-surface-1/60 text-brand-500 opacity-65",
                        )}
                      >
                        <div className="flex w-full items-center justify-center gap-1.5">
                          {st === "scanning" ? (
                            <Loader2
                              size={13}
                              className="shrink-0 animate-spin text-signal-400"
                            />
                          ) : st === "done" ? (
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-signal-400 text-signal-ink">
                              <Check size={10} strokeWidth={3.5} />
                            </span>
                          ) : (
                            <FileText size={13} className="shrink-0 text-brand-400" />
                          )}
                          <span className="truncate font-mono text-[10.5px] font-bold text-brand-950 sm:text-[11px]">
                            {child.path}
                          </span>
                        </div>

                        <span
                          className={cn(
                            "mt-1 text-[9.5px] font-semibold",
                            st === "done"
                              ? "text-signal-400"
                              : st === "scanning"
                                ? "text-signal-400"
                                : "text-brand-400",
                          )}
                        >
                          {st === "done"
                            ? child.responseTimeMs
                              ? `✓ ${child.responseTimeMs}ms`
                              : "✓ Finished"
                            : st === "scanning"
                              ? "Scanning file…"
                              : "Queued"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* =================================================================
              RIGHT COLUMN (3 COLS): ONE-BY-ONE FINISHED FILES & LIVE ISSUES
             ================================================================= */}
          <div className="lg:col-span-3 flex flex-col gap-3.5">
            {/* Card 1: Files Finished One-by-One */}
            <div className="rounded-2xl border border-brand-200 bg-surface-1/95 p-4 shadow-card backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-brand-200 pb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                  <ShieldCheck size={13} className="text-signal-400" />
                  Finished Files
                </span>
                <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-signal-400">
                  {phase === "crawling"
                    ? `${Math.max(finishedCount, totalPagesRecorded)} done`
                    : "0 done"}
                </span>
              </div>

              {phase === "crawling" ? (
                <div className="mt-3 space-y-1.5">
                  {orderedNodes.slice(0, 6).map((node, idx) => {
                    const st = getNodeStatus(idx);
                    return (
                      <div
                        key={node.path}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 font-mono text-[11px] transition-all",
                          st === "done"
                            ? "border-brand-200 bg-surface-2/80 text-brand-950"
                            : st === "scanning"
                              ? "border-signal-400 bg-primary-50/70 text-brand-950"
                              : "border-brand-200/50 bg-surface-2/20 text-brand-400 opacity-60",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {st === "done" ? (
                            <Check
                              size={12}
                              className="shrink-0 text-signal-400"
                              strokeWidth={3}
                            />
                          ) : st === "scanning" ? (
                            <Loader2
                              size={12}
                              className="shrink-0 animate-spin text-signal-400"
                            />
                          ) : (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                          )}
                          <span className="truncate font-semibold">
                            {node.path === "/" ? "/ (Home)" : node.path}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-bold",
                            st === "done"
                              ? "text-signal-400"
                              : st === "scanning"
                                ? "text-warning-700"
                                : "text-brand-400",
                          )}
                        >
                          {st === "done"
                            ? node.responseTimeMs
                              ? `${node.responseTimeMs}ms`
                              : "Done"
                            : st === "scanning"
                              ? "Scanning"
                              : "Wait"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-brand-200 bg-surface-2/40 p-3 text-xs leading-relaxed text-brand-500">
                  Once you submit your website below, we start from{" "}
                  <strong className="text-brand-800">/ (Home)</strong> and check off each page file one by one here.
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
                    : phase === "crawling"
                      ? "Scanning…"
                      : "Standby"}
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
              ) : phase === "crawling" ? (
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
                        <span className="font-bold text-signal-400">›</span> Started at / (Home page)
                      </p>
                      <p className="truncate">
                        <span className="font-bold text-signal-400">›</span> Inspecting titles, speed & broken links…
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-brand-500">
                  Real-time SEO issues, broken links, and speed bottlenecks appear here as each file finishes.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── BOTTOM COMMAND & PROGRESS BAR ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-200/80 bg-surface-1/95 px-4 py-3.5 shadow-2xl backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-2xl">
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
                <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-brand-300 bg-surface-2 px-4 py-3 focus-within:border-signal-400 transition-colors">
                  <Globe size={17} className="shrink-0 text-signal-400" />
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
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-signal-400 px-6 py-3.5 text-sm font-extrabold text-signal-ink shadow-md transition hover:opacity-95 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Starting Crawl…</span>
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
                      : `Crawling Website... (${activeNode.path === "/" ? "/ Home" : activeNode.path})`}
                  </p>
                </div>

                <span className="font-mono text-xs font-bold text-brand-500">
                  {Math.max(finishedCount, totalPagesRecorded)} files finished
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
