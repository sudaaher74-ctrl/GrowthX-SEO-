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
  Lock,
  Moon,
  Radar,
  Search,
  ShieldCheck,
  Sun,
  Zap,
} from "lucide-react";
import { api, auth, subscribeToAuthChange, type AutopilotRun } from "@/lib/api-client";
import type { CrawlPage } from "@/lib/api-types";
import { setActiveProject, useWorkspace } from "@/hooks/use-growthx";
import { useTheme } from "@/hooks/use-theme";
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

function formatShortChildLabel(path: string, parentSectionPath?: string): string {
  if (parentSectionPath && path.startsWith(`${parentSectionPath}/`)) {
    const sub = path.slice(parentSectionPath.length);
    return sub || path;
  }
  return path;
}

interface TreeNodeData {
  path: string;
  shortLabel: string;
  title?: string | null;
  metaDescription?: string | null;
  h1?: string[];
  wordCount?: number;
  statusCode?: number | null;
  indexability?: string | null;
  responseTimeMs?: number;
}

/**
 * Builds the tree strictly from real discovered pages (up to 4 top sections + up to 12 child pages in multi-row grid).
 */
function buildRealTree(pages: CrawlPage[]): {
  rootHome: TreeNodeData;
  sections: TreeNodeData[];
  children: TreeNodeData[];
} {
  const homePage = pages.find((p) => getPathname(p.url) === "/");
  const rootHome: TreeNodeData = {
    path: "/",
    shortLabel: "/ (Home)",
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
        shortLabel: topPath,
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
          shortLabel: `/${segments.slice(1).join("/")}`,
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

  const sections = Array.from(sectionMap.values()).slice(0, 4);
  const primarySectionPath = sections[0]?.path;

  // Also include any additional top-level pages beyond the first 4 sections so all discovered pages appear
  for (const extra of pages) {
    if (deepPages.length >= 12) break;
    const pathname = getPathname(extra.url).replace(/\/+$/, "") || "/";
    if (
      pathname !== "/" &&
      !sections.some((s) => s.path === pathname) &&
      !deepPages.some((d) => d.path === pathname)
    ) {
      deepPages.push({
        path: pathname,
        shortLabel: formatShortChildLabel(pathname, primarySectionPath),
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

  return {
    rootHome,
    sections,
    children: deepPages.slice(0, 12),
  };
}

/**
 * Generates a smooth SVG rounded orthogonal elbow path from (x1, 0) to (x2, height).
 */
function buildElbowPath(x1: number, x2: number, height = 44): string {
  const dx = x2 - x1;
  if (Math.abs(dx) < 2) {
    return `M ${x1} 0 L ${x2} ${height}`;
  }
  const dir = dx > 0 ? 1 : -1;
  const r = Math.min(12, Math.abs(dx) / 2);
  const midY = Math.round(height * 0.48);
  return `M ${x1} 0 L ${x1} ${midY - r} Q ${x1} ${midY} ${x1 + dir * r} ${midY} L ${x2 - dir * r} ${midY} Q ${x2} ${midY} ${x2} ${midY + r} L ${x2} ${height}`;
}

function AnalyzeOnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { orgId, setOrgId, projects } = useWorkspace();
  const { isDark, toggleTheme } = useTheme();

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
   * 0 = ONLY [ 🌐 domain.com ] is shown on screen
   * 1 = [ 🏠 / (Home) ] appears
   * 2..N = Every discovered section & child page appears one by one!
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
    queryFn: () => api.getCrawlPages(crawlId!, { page: 1, limit: 40 }),
    enabled: phase === "crawling" && Boolean(crawlId),
    refetchInterval: isCompleted || isFailed ? false : 1500,
  });

  // Poll live detected issues count from the active crawl job
  const issuesQuery = useQuery({
    queryKey: ["onboarding-crawl-issues", crawlId],
    queryFn: () => api.getCrawlIssues(crawlId!, { page: 1, limit: 6 }),
    enabled: phase === "crawling" && Boolean(crawlId),
    refetchInterval: isCompleted || isFailed ? false : 2000,
  });

  useQuery({
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

  const { rootHome, sections, children } = useMemo(
    () => buildRealTree(crawledPages),
    [crawledPages],
  );

  // Total available nodes based on real data discovered so far:
  // Node 1 is / (Home), then each discovered section, then each discovered child page (up to 12)
  const maxAvailableStep = 1 + sections.length + children.length;

  // Step-by-step timer: starts at 0 (only domain pill), then reveals 1 node at a time
  useEffect(() => {
    if (phase !== "crawling") return;
    const timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
      setRevealStep((prev) => {
        if (isCompleted && prev >= maxAvailableStep) return maxAvailableStep + 1;
        if (prev < 1) return 1;
        if (prev < maxAvailableStep) return prev + 1;
        return prev;
      });
    }, 850);
    return () => clearInterval(timer);
  }, [phase, isCompleted, maxAvailableStep]);

  // Automatically redirect to Website Audit (/website) after crawl finishes AND all nodes have revealed
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
    }, 1100);
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
  // SCREEN 1: ONBOARDING LAUNCH SCREEN — MATCHES REIGEL DASHBOARD & LANDING THEME
  // ===========================================================================
  if (phase === "input") {
    return (
      <div
        className="relative flex min-h-screen lg:h-screen w-full flex-col justify-between overflow-x-hidden lg:overflow-hidden select-none transition-colors duration-200"
        style={{ background: "var(--color-canvas)" }}
      >
        {/* Subtle Ambient Glow matching Landing Hero & Dashboard */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute left-1/2 top-1/3 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, rgba(212, 255, 0, 0.12) 0%, transparent 70%)",
            }}
          />
          <svg
            className="absolute inset-0 h-full w-full opacity-[0.05]"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="onboard-subgrid"
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
                id="onboard-grid"
                width="140"
                height="140"
                patternUnits="userSpaceOnUse"
              >
                <rect width="140" height="140" fill="url(#onboard-subgrid)" />
                <path
                  d="M 140 0 L 0 0 0 140"
                  fill="none"
                  stroke="var(--color-brand-400)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#onboard-grid)" />
          </svg>
        </div>

        {/* Top Header */}
        <header
          className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b bg-surface-1/90 px-6 backdrop-blur-md sm:px-10"
          style={{ borderColor: "var(--border-color)" }}
        >
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal-400 font-mono text-xs font-black text-signal-ink shadow-xs">
                R
              </span>
              <span className="text-lg font-extrabold tracking-tight text-brand-950">
                Reigel
              </span>
              <span className="hidden sm:inline rounded border border-brand-200 bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-brand-500">
                AI SEO
              </span>
            </Link>
            <span className="hidden sm:inline text-brand-300">/</span>
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-3 py-1 text-xs font-semibold text-brand-700">
              <span className="h-2 w-2 rounded-full bg-signal-400" />
              Step 1 · Add Your Website
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-2 px-3 py-1 font-mono text-[11px] font-semibold text-brand-500">
              <Lock size={11} className="text-brand-400" />
              Safe Read-Only Crawler
            </span>
            {projects.length > 0 && (
              <button
                type="button"
                onClick={() => router.push("/website")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-2 px-3.5 py-2 text-xs font-bold text-brand-800 transition hover:border-brand-300 hover:text-brand-950 cursor-pointer"
              >
                <span>Website Audit</span>
                <ArrowRight size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
              title={isDark ? "Switch to day mode" : "Switch to night mode"}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-200 bg-surface-2 text-brand-600 transition hover:bg-surface-3 hover:text-brand-950 cursor-pointer"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </header>

        {/* Centerpiece Onboarding Command Card */}
        <main className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-surface-1 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-brand-600 shadow-xs">
            <Radar size={13} className="text-signal-400" />
            <span>Autonomous Website Structure &amp; SEO Crawler</span>
          </div>

          <h1 className="mt-5 text-center text-3xl font-extrabold tracking-tight text-brand-950 sm:text-5xl sm:leading-[1.12]">
            Enter your website to start{" "}
            <span className="text-signal-400">a live technical audit.</span>
          </h1>

          <p className="mt-3.5 max-w-xl text-center text-sm leading-relaxed text-brand-500 sm:text-base">
            Add your domain below. Our crawler connects to your root domain, maps
            every discovered page step by step, checks speed and SEO health, and
            opens your <strong className="font-semibold text-brand-800">Website Audit</strong> report automatically.
          </p>

          {/* Elevated Command Bar Card */}
          <div className="mt-8 w-full rounded-3xl border border-brand-200 bg-surface-1/95 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
            <form onSubmit={handleStartAudit} noValidate>
              {error && (
                <div
                  role="alert"
                  className="mb-3.5 flex items-center gap-2 rounded-xl border border-error-500/40 bg-error-50 px-4 py-2.5 text-xs font-semibold text-error-700"
                >
                  <AlertTriangle size={14} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3 rounded-2xl border border-brand-300 bg-surface-2 px-4 py-3.5 focus-within:border-brand-400 transition-colors">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-1 text-signal-400">
                    <Globe size={17} />
                  </span>
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
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-signal-400 hover:bg-signal-500 active:scale-[0.98] px-7 py-4 text-sm font-extrabold text-signal-ink shadow-xs transition-all disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-signal-ink" />
                      <span>Starting Crawler…</span>
                    </>
                  ) : (
                    <>
                      <span>Start Website Audit</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brand-200/80 pt-3.5 text-xs text-brand-500">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-success-500" />
                  Starts from your root domain &amp; maps pages step by step
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Zap size={13} className="text-signal-400" />
                  128+ SEO, speed &amp; AI visibility checks
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck size={13} className="text-success-500" />
                  Opens Website Audit automatically
                </span>
              </div>
            </form>
          </div>

          {/* 3 Compact Feature Pillars Below Card */}
          <div className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-brand-200/80 bg-surface-1/80 p-4 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-950">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-2 text-signal-400">
                  <Radar size={13} />
                </span>
                <span>01 · Live Sitemap Spider</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-brand-500">
                Discovers your homepage, core folders, and sub-pages one by one in real time.
              </p>
            </div>

            <div className="rounded-2xl border border-brand-200/80 bg-surface-1/80 p-4 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-950">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-2 text-signal-400">
                  <Search size={13} />
                </span>
                <span>02 · Technical &amp; Speed Audit</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-brand-500">
                Checks HTTP status, response speed, titles, meta descriptions, and headings on every file.
              </p>
            </div>

            <div className="rounded-2xl border border-brand-200/80 bg-surface-1/80 p-4 backdrop-blur-md">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-950">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-2 text-signal-400">
                  <ShieldCheck size={13} />
                </span>
                <span>03 · Instant Audit Dashboard</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-brand-500">
                Takes you straight to your Website Audit report as soon as the scan completes.
              </p>
            </div>
          </div>
        </main>

        <footer className="relative z-10 pb-4 text-center font-mono text-[11px] text-brand-400">
          Reigel Autonomous SEO &amp; AI Search Engine
        </footer>
      </div>
    );
  }

  // ===========================================================================
  // SCREEN 2: CRAWLING PHASE — PURE BLACK THEME, MULTI-ROW STEP-BY-STEP TREE
  // ===========================================================================
  const displayDomain = activeDomain || cleanDomainInput(domainInput);

  // Step 0: Only [ 🌐 domain ] is visible
  // Step 1: [ 🏠 / (Home) ] appears
  // Step 2..(1 + sections.length): sections appear one by one
  // Step (2 + sections.length)..(1 + sections.length + children.length): ALL child pages appear one by one!
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

  // Chunk visibleChildren into rows of 3 so we can display up to 12 sub-pages cleanly!
  const childRows: TreeNodeData[][] = [];
  for (let i = 0; i < visibleChildren.length; i += 3) {
    childRows.push(visibleChildren.slice(i, i + 3));
  }

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
            (revealStep / Math.max(4, maxAvailableStep + 1)) * 90,
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
                ? `${Math.max(revealedNodes.length, totalPagesRecorded)} routes discovered`
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
            name: "SEO & Page Speed Rule Engine",
            detail:
              totalIssuesRecorded > 0
                ? `${totalIssuesRecorded} checks flagged`
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

  const secTotalCols = Math.max(1, visibleSections.length);
  const firstSectionX = ((0 + 0.5) / secTotalCols) * 800;

  return (
    <div
      className="relative min-h-screen lg:h-screen w-full overflow-x-hidden lg:overflow-hidden flex flex-col justify-between select-none transition-colors duration-200"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* ── AMBIENT GLOW & TECHNICAL GRID (MATCHES DASHBOARD THEME) ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-[500px] w-[740px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(212, 255, 0, 0.10) 0%, transparent 70%)",
          }}
        />
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.08]"
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
            <CheckCircle2 size={12} className="text-success-500" />
            <span className="text-brand-500">Pages Mapped:</span>
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
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
            title={isDark ? "Switch to day mode" : "Switch to night mode"}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-200 bg-surface-2 text-brand-600 transition hover:bg-surface-3 hover:text-brand-950 cursor-pointer"
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {/* ── MAIN WORKSPACE: LEFT INSPECTOR + CENTER MULTI-ROW TREE + RIGHT PAGES LOG ── */}
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
                <span className="rounded-md border border-brand-200 bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-signal-400">
                  {isCompleted ? "DONE" : "LIVE"}
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-brand-200 bg-surface-2/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                  Currently Crawling File
                </p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs font-extrabold text-brand-950">
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
                <p className="mt-1.5 truncate text-xs font-medium text-brand-600">
                  {showHome
                    ? currentScanningNode.title ||
                      `Reading HTML & internal links on ${currentScanningNode.path}…`
                    : `Establishing connection to ${displayDomain}…`}
                </p>
              </div>

              {/* Live File Telemetry Metrics */}
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-2.5">
                  <p className="text-[10px] text-brand-400">Status</p>
                  <p className="mt-0.5 font-mono font-bold text-success-500">
                    {showHome
                      ? currentScanningNode.statusCode
                        ? `${currentScanningNode.statusCode} OK`
                        : "Verified"
                      : "…"}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-2.5">
                  <p className="text-[10px] text-brand-400">Speed</p>
                  <p className="mt-0.5 font-mono font-bold text-brand-950">
                    {currentScanningNode.responseTimeMs
                      ? `${currentScanningNode.responseTimeMs}ms`
                      : avgSpeedMs
                        ? `${avgSpeedMs}ms`
                        : "…"}
                  </p>
                </div>
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-2.5">
                  <p className="text-[10px] text-brand-400">Words</p>
                  <p className="mt-0.5 font-mono font-bold text-brand-950">
                    {currentScanningNode.wordCount ?? "—"}
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
                        ? "border-brand-200 bg-surface-2/60 text-brand-950"
                        : "border-brand-400/60 bg-surface-2 text-brand-950",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {eng.status === "done" ? (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600">
                          <Check size={10} strokeWidth={3.5} />
                        </span>
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
              CENTER COLUMN (6 COLS): MULTI-ROW PROGRESSIVE WEBSITE TREE
             ================================================================= */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center min-h-[420px]">
            <div className="w-full">
              {/* LEVEL 0: TOP DOMAIN PILL (Starts from your website only!) */}
              <div className="flex flex-col items-center">
                <div className="relative flex items-center gap-3 rounded-full border border-brand-300 bg-surface-1 px-6 py-2.5 shadow-card transition-all duration-300">
                  <Globe size={17} className="shrink-0 text-signal-400" />
                  <span className="font-sans text-base font-extrabold tracking-tight text-brand-950 sm:text-lg">
                    {displayDomain}
                  </span>
                  <span className="rounded-full border border-brand-200 bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-success-500">
                    LIVE
                  </span>

                  {showHome && (
                    <span className="absolute -bottom-1.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-signal-400" />
                  )}
                </div>

                {/* Vertical Connector to Home (/) — Appears at step 1 */}
                {showHome && (
                  <div className="h-7 w-0.5 bg-brand-300 transition-all duration-500" />
                )}
              </div>

              {/* LEVEL 1: HOME NODE (/ (Home)) — Appears at step 1 */}
              {showHome && (
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "relative flex min-w-[165px] items-center justify-center gap-2 rounded-2xl border px-5 py-2 shadow-card transition-all duration-300",
                      homeDone
                        ? "border-brand-200 bg-surface-1 text-brand-950"
                        : "border-brand-400 bg-surface-1 text-brand-950",
                    )}
                  >
                    <span className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-signal-400" />

                    {homeDone ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600">
                        <Check size={10} strokeWidth={3.5} />
                      </span>
                    ) : (
                      <Loader2 size={14} className="shrink-0 animate-spin text-signal-400" />
                    )}

                    <Home size={14} className="shrink-0 text-signal-400" />
                    <span className="font-mono text-xs font-extrabold text-brand-950 sm:text-sm">
                      / (Home)
                    </span>

                    <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-brand-500">
                      {homeDone
                        ? rootHome.responseTimeMs
                          ? `${rootHome.responseTimeMs}ms`
                          : "Done"
                        : "Scanning…"}
                    </span>
                  </div>
                </div>
              )}

              {/* LEVEL 2: DISCOVERED SECTION FOLDERS — Appear one by one! */}
              {visibleSections.length > 0 && (
                <>
                  <div className="w-full">
                    <svg
                      viewBox="0 0 800 44"
                      className="h-9 w-full overflow-visible sm:h-10"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      {visibleSections.map((sec, idx) => {
                        const targetX = ((idx + 0.5) / secTotalCols) * 800;
                        const pathD = buildElbowPath(400, targetX, 44);
                        const stepForThis = 2 + idx;
                        const isCurrent = revealStep === stepForThis && !isCompleted;
                        return (
                          <g key={sec.path}>
                            <path
                              d={pathD}
                              stroke={
                                isCurrent
                                  ? "var(--color-signal-400)"
                                  : "var(--color-brand-300)"
                              }
                              strokeWidth={isCurrent ? "2.2" : "1.6"}
                              strokeLinecap="round"
                            />
                            <circle
                              cx={targetX}
                              cy={44}
                              r="3"
                              fill={
                                isCurrent
                                  ? "var(--color-signal-400)"
                                  : "var(--color-brand-400)"
                              }
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
                        <div key={sec.path} className="px-1.5">
                          <div
                            className={cn(
                              "relative flex flex-col items-center justify-center rounded-2xl border px-3 py-2 shadow-card transition-all duration-300",
                              isDone
                                ? "border-brand-200 bg-surface-1 text-brand-950"
                                : "border-brand-400 bg-surface-1 text-brand-950",
                            )}
                          >
                            <div className="flex w-full items-center justify-center gap-1.5">
                              {isDone ? (
                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600">
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

                            <span className="mt-0.5 font-mono text-[9.5px] font-semibold text-brand-500">
                              {isDone
                                ? sec.responseTimeMs
                                  ? `${sec.responseTimeMs}ms`
                                  : "Done"
                                : "Scanning…"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* LEVEL 3+: MULTI-ROW DISCOVERED CHILD FILES — Expands across rows as more files arrive! */}
              {childRows.map((rowNodes, rowIdx) => {
                const rowCols = Math.max(1, rowNodes.length);
                return (
                  <div key={rowIdx} className="w-full">
                    <div className="w-full">
                      <svg
                        viewBox="0 0 800 38"
                        className="h-8 w-full overflow-visible sm:h-9"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        {rowIdx === 0 ? (
                          <>
                            <circle
                              cx={firstSectionX}
                              cy="0"
                              r="3"
                              fill="var(--color-brand-400)"
                            />
                            {rowNodes.map((child, colIdx) => {
                              const targetX = ((colIdx + 0.5) / rowCols) * 800;
                              const pathD = buildElbowPath(firstSectionX, targetX, 38);
                              const globalChildIdx = rowIdx * 3 + colIdx;
                              const stepForThis = childStartStep + globalChildIdx;
                              const isCurrent =
                                revealStep === stepForThis && !isCompleted;
                              return (
                                <g key={child.path}>
                                  <path
                                    d={pathD}
                                    stroke={
                                      isCurrent
                                        ? "var(--color-signal-400)"
                                        : "var(--color-brand-300)"
                                    }
                                    strokeWidth={isCurrent ? "2.2" : "1.5"}
                                    strokeLinecap="round"
                                  />
                                  <circle
                                    cx={targetX}
                                    cy={38}
                                    r="2.8"
                                    fill={
                                      isCurrent
                                        ? "var(--color-signal-400)"
                                        : "var(--color-brand-400)"
                                    }
                                  />
                                </g>
                              );
                            })}
                          </>
                        ) : (
                          // Subsequent child rows connect vertically from the row above
                          rowNodes.map((child, colIdx) => {
                            const parentX = ((colIdx + 0.5) / 3) * 800;
                            const targetX = ((colIdx + 0.5) / rowCols) * 800;
                            const pathD = buildElbowPath(parentX, targetX, 38);
                            const globalChildIdx = rowIdx * 3 + colIdx;
                            const stepForThis = childStartStep + globalChildIdx;
                            const isCurrent =
                              revealStep === stepForThis && !isCompleted;
                            return (
                              <g key={child.path}>
                                <path
                                  d={pathD}
                                  stroke={
                                    isCurrent
                                      ? "var(--color-signal-400)"
                                      : "var(--color-brand-300)"
                                  }
                                  strokeWidth={isCurrent ? "2.2" : "1.5"}
                                  strokeLinecap="round"
                                />
                                <circle
                                  cx={targetX}
                                  cy={38}
                                  r="2.8"
                                  fill={
                                    isCurrent
                                      ? "var(--color-signal-400)"
                                      : "var(--color-brand-400)"
                                  }
                                />
                              </g>
                            );
                          })
                        )}
                      </svg>
                    </div>

                    <div
                      className="grid gap-0"
                      style={{
                        gridTemplateColumns: `repeat(${rowCols}, minmax(0, 1fr))`,
                      }}
                    >
                      {rowNodes.map((child, colIdx) => {
                        const globalChildIdx = rowIdx * 3 + colIdx;
                        const stepForThis = childStartStep + globalChildIdx;
                        const isDone = revealStep > stepForThis || isCompleted;
                        return (
                          <div key={child.path} className="px-1.5">
                            <div
                              className={cn(
                                "flex flex-col items-center justify-center rounded-2xl border px-2.5 py-2 shadow-card transition-all duration-300",
                                isDone
                                  ? "border-brand-200 bg-surface-1 text-brand-950"
                                  : "border-brand-400 bg-surface-1 text-brand-950",
                              )}
                            >
                              <div className="flex w-full items-center justify-center gap-1.5">
                                {isDone ? (
                                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600">
                                    <Check size={9} strokeWidth={3.5} />
                                  </span>
                                ) : (
                                  <Loader2
                                    size={12}
                                    className="shrink-0 animate-spin text-signal-400"
                                  />
                                )}
                                <FileText size={12} className="shrink-0 text-brand-400" />
                                <span
                                  title={child.path}
                                  className="truncate font-mono text-[10.5px] font-bold text-brand-950 sm:text-[11px]"
                                >
                                  {child.shortLabel}
                                </span>
                              </div>

                              <span className="mt-0.5 font-mono text-[9px] font-semibold text-brand-500">
                                {isDone
                                  ? child.responseTimeMs
                                    ? `${child.responseTimeMs}ms`
                                    : "Done"
                                  : "Scanning…"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* =================================================================
              RIGHT COLUMN (3 COLS): FULL STEP-BY-STEP FINISHED FILES LOG
             ================================================================= */}
          <div className="lg:col-span-3 flex flex-col">
            <div className="rounded-2xl border border-brand-200 bg-surface-1/95 p-4 shadow-card backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-brand-200 pb-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                  <ShieldCheck size={13} className="text-success-500" />
                  Crawled Website Files
                </span>
                <span className="rounded-md border border-brand-200 bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-success-500">
                  {filesFinishedCount} done
                </span>
              </div>

              {revealedNodes.length > 0 ? (
                <div className="mt-3 max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
                  {revealedNodes.map(({ node, done }) => (
                    <div
                      key={node.path}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 font-mono text-[11px] transition-all",
                        done
                          ? "border-brand-200 bg-surface-2/60 text-brand-950"
                          : "border-brand-400 bg-surface-2 text-brand-950",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        {done ? (
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600">
                            <Check size={10} strokeWidth={3.5} />
                          </span>
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
                          done ? "text-brand-500" : "text-signal-400",
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
                  <Check size={17} className="text-success-500" strokeWidth={3} />
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
                  className="h-full rounded-full bg-signal-400 transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="w-11 shrink-0 text-right font-mono text-sm font-extrabold text-brand-950">
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
          className="flex min-h-screen items-center justify-center transition-colors duration-200"
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
