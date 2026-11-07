"use client";

import { Suspense, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  Folder,
  Globe,
  Home,
  Loader2,
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
  responseTimeMs?: number;
  crawled: boolean;
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
    responseTimeMs: homePage?.responseTimeMs,
    crawled: Boolean(homePage),
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
        title: segments.length === 1 ? page.title : null,
        responseTimeMs: segments.length === 1 ? page.responseTimeMs : undefined,
        crawled: true,
      });
    }

    if (segments.length >= 2) {
      if (!deepPages.some((d) => d.path === pathname)) {
        deepPages.push({
          path: pathname,
          title: page.title,
          responseTimeMs: page.responseTimeMs,
          crawled: true,
        });
      }
    }
  }

  // If no multi-segment pages exist yet, show additional discovered pages in the bottom row
  if (deepPages.length === 0 && pages.length > 4) {
    for (const extra of pages.slice(4, 7)) {
      const pathname = getPathname(extra.url).replace(/\/+$/, "") || "/";
      if (pathname !== "/" && !deepPages.some((d) => d.path === pathname)) {
        deepPages.push({
          path: pathname,
          title: extra.title,
          responseTimeMs: extra.responseTimeMs,
          crawled: true,
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
        crawled: false,
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
        crawled: false,
      });
    }
  }

  return { rootHome, sections, children };
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
  const [pulseStep, setPulseStep] = useState(0);

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
    queryFn: () => api.getCrawlPages(crawlId!, { page: 1, limit: 24 }),
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

  useQuery({
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

  // Animate the active crawler node pulse across the tree
  useEffect(() => {
    if (phase !== "crawling" || isCompleted || isFailed) return;
    const interval = setInterval(() => {
      setPulseStep((s) => s + 1);
    }, 1100);
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

      setPulseStep(0);
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

  if (signedIn !== true) return null;

  const displayDomain = activeDomain || cleanDomainInput(domainInput) || "yourwebsite.com";

  // Smooth progress percentage calculation
  const progressPct = isCompleted
    ? 100
    : phase === "crawling"
      ? Math.min(94, Math.max(16, totalPagesRecorded * 6 + (pulseStep % 12)))
      : 0;

  const activeSectionIdx = phase === "crawling" ? pulseStep % 4 : 0;
  const activeChildIdx = phase === "crawling" ? pulseStep % 3 : 0;

  return (
    <div
      className="dash-dark dark relative h-screen w-full overflow-hidden flex flex-col justify-between select-none"
      style={{ background: "var(--color-canvas)" }}
    >
      {/* ── SUBTLE MATTE-BLACK TECHNICAL BACKGROUND GRID & RADIAL GLOW ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 h-[540px] w-[780px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(200, 245, 58, 0.16) 0%, rgba(9, 10, 13, 0) 70%)",
          }}
        />
        <svg className="absolute inset-0 h-full w-full opacity-[0.10]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="tree-subgrid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="var(--color-brand-300)" strokeWidth="0.5" />
            </pattern>
            <pattern id="tree-grid" width="140" height="140" patternUnits="userSpaceOnUse">
              <rect width="140" height="140" fill="url(#tree-subgrid)" />
              <path d="M 140 0 L 0 0 0 140" fill="none" stroke="var(--color-brand-400)" strokeWidth="1" />
              <circle cx="0" cy="0" r="1.5" fill="var(--color-signal-400)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tree-grid)" />
        </svg>
      </div>

      {/* ── CLEAN TOP HEADER ── */}
      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between px-6 sm:px-10">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal-400 font-mono text-xs font-black text-signal-ink shadow-xs">
            R
          </span>
          <span className="text-lg font-extrabold tracking-tight text-brand-950">
            Reigel
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {phase === "crawling" && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="rounded-full border border-brand-200 bg-surface-1/90 px-3 py-1 font-medium text-brand-700">
                <strong className="font-bold text-signal-400">{totalPagesRecorded}</strong> pages found
              </span>
              {totalIssuesRecorded > 0 && (
                <span className="rounded-full border border-brand-200 bg-surface-1/90 px-3 py-1 font-medium text-brand-700">
                  <strong className="font-bold text-warning-700">{totalIssuesRecorded}</strong> issues spotted
                </span>
              )}
            </div>
          )}

          {(projects.length > 0 || phase === "crawling") && (
            <button
              type="button"
              onClick={() => router.push("/website")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1/90 px-3.5 py-2 text-xs font-bold text-brand-800 transition hover:border-brand-300 hover:text-brand-950 cursor-pointer"
            >
              <span>Website Audit</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </header>

      {/* ── CENTERPIECE: HIERARCHICAL WEBSITE STRUCTURE TREE DIAGRAM ── */}
      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pb-24">
        <div className="w-full">
          {/* =================================================================
              LEVEL 0: TOP DOMAIN PILL
             ================================================================= */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "relative flex items-center gap-3 rounded-full border px-7 py-3 shadow-card transition-all duration-300",
                phase === "crawling"
                  ? "border-signal-400 bg-surface-1 shadow-[0_0_30px_rgba(200,245,58,0.14)]"
                  : "border-brand-300 bg-surface-1",
              )}
            >
              <Globe size={20} className="shrink-0 text-signal-400" />
              <span className="font-sans text-lg font-extrabold tracking-tight text-brand-950 sm:text-xl">
                {displayDomain}
              </span>
              {/* Bottom connector dot */}
              <span className="absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-surface-1 bg-signal-400" />
            </div>

            {/* Vertical connector line from Domain to `/` */}
            <div className="h-9 w-0.5 bg-signal-400/80" />
          </div>

          {/* =================================================================
              LEVEL 1: HOME ROOT NODE (🏠 /)
             ================================================================= */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "relative flex min-w-[160px] items-center justify-center gap-2.5 rounded-2xl border px-6 py-3 shadow-card transition-all",
                phase === "crawling" || rootHome.crawled
                  ? "border-signal-400 bg-primary-50/90 text-brand-950"
                  : "border-brand-300 bg-surface-1 text-brand-950",
              )}
            >
              {/* Top connector dot */}
              <span className="absolute -top-1.5 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-signal-400" />

              <Home size={17} className="shrink-0 text-signal-400" />
              <span className="font-mono text-base font-extrabold text-brand-950">/</span>
              {rootHome.responseTimeMs ? (
                <span className="ml-1 rounded-md bg-surface-1/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-signal-400">
                  {rootHome.responseTimeMs}ms
                </span>
              ) : null}

              {/* Sonar pulse ring on `/` just like reference image */}
              {phase === "crawling" && (
                <span className="absolute -bottom-2.5 right-5 flex h-5 w-5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal-400 opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full border border-surface-1 bg-signal-400" />
                </span>
              )}
            </div>
          </div>

          {/* =================================================================
              SVG BRANCHING CONNECTORS: LEVEL 1 (/) -> LEVEL 2 (4 FOLDERS)
             ================================================================= */}
          <div className="w-full">
            <svg
              viewBox="0 0 800 54"
              className="h-12 w-full overflow-visible sm:h-14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 4 Rounded Orthogonal Branches to x = 100, 300, 500, 700 */}
              {[
                { x: 100, path: "M 400 0 L 400 16 Q 400 26 384 26 L 116 26 Q 100 26 100 40 L 100 54" },
                { x: 300, path: "M 400 0 L 400 16 Q 400 26 388 26 L 312 26 Q 300 26 300 40 L 300 54" },
                { x: 500, path: "M 400 0 L 400 16 Q 400 26 412 26 L 488 26 Q 500 26 500 40 L 500 54" },
                { x: 700, path: "M 400 0 L 400 16 Q 400 26 416 26 L 684 26 Q 700 26 700 40 L 700 54" },
              ].map((branch, idx) => {
                const isHighlighted =
                  idx === 0 ||
                  sections[idx]?.crawled ||
                  (phase === "crawling" && idx === activeSectionIdx);
                return (
                  <g key={branch.x}>
                    <path
                      d={branch.path}
                      stroke={
                        isHighlighted
                          ? "var(--color-signal-400)"
                          : "var(--color-brand-300)"
                      }
                      strokeWidth={isHighlighted ? "2.2" : "1.5"}
                      strokeLinecap="round"
                    />
                    <circle
                      cx={branch.x}
                      cy={54}
                      r="3.5"
                      fill={
                        isHighlighted
                          ? "var(--color-signal-400)"
                          : "var(--color-brand-300)"
                      }
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* =================================================================
              LEVEL 2: 4 SECTION FOLDER NODES (📁 /products, /about, /contact, /blog)
             ================================================================= */}
          <div className="grid grid-cols-4 gap-0">
            {sections.map((sec, idx) => {
              const isScanning = phase === "crawling" && idx === activeSectionIdx;
              const isHighlighted = idx === 0 || sec.crawled || isScanning;
              return (
                <div key={sec.path} className="px-1.5 sm:px-3">
                  <div
                    className={cn(
                      "relative flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 shadow-card transition-all duration-300",
                      isHighlighted
                        ? "border-signal-400/80 bg-surface-1 text-brand-950 shadow-[0_0_20px_rgba(200,245,58,0.08)]"
                        : "border-brand-200 bg-surface-1/80 text-brand-600",
                    )}
                  >
                    <Folder
                      size={16}
                      className={cn(
                        "shrink-0",
                        isHighlighted ? "text-signal-400" : "text-brand-400",
                      )}
                    />
                    <span className="truncate font-mono text-xs font-bold text-brand-950 sm:text-sm">
                      {sec.path}
                    </span>
                    {sec.crawled && (
                      <Check
                        size={13}
                        className="hidden sm:inline shrink-0 text-signal-400"
                        strokeWidth={3}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* =================================================================
              SVG BRANCHING CONNECTORS: LEVEL 2 (/products at x=100) -> LEVEL 3 (3 PAGES)
             ================================================================= */}
          <div className="w-full">
            <svg
              viewBox="0 0 800 54"
              className="h-12 w-full overflow-visible sm:h-14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Start dot under /products (x=100) */}
              <circle cx="100" cy="0" r="3.5" fill="var(--color-signal-400)" />

              {[
                {
                  x: 100,
                  path: "M 100 0 L 100 54",
                },
                {
                  x: 300,
                  path: "M 100 0 L 100 16 Q 100 26 116 26 L 284 26 Q 300 26 300 40 L 300 54",
                },
                {
                  x: 500,
                  path: "M 100 0 L 100 16 Q 100 26 116 26 L 484 26 Q 500 26 500 40 L 500 54",
                },
              ].map((branch, idx) => {
                const isHighlighted =
                  idx === 0 ||
                  children[idx]?.crawled ||
                  (phase === "crawling" && idx === activeChildIdx);
                return (
                  <g key={branch.x}>
                    <path
                      d={branch.path}
                      stroke={
                        isHighlighted
                          ? "var(--color-signal-400)"
                          : "var(--color-brand-300)"
                      }
                      strokeWidth={isHighlighted ? "2.2" : "1.5"}
                      strokeLinecap="round"
                    />
                    <circle
                      cx={branch.x}
                      cy={54}
                      r="3.5"
                      fill={
                        isHighlighted
                          ? "var(--color-signal-400)"
                          : "var(--color-brand-300)"
                      }
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* =================================================================
              LEVEL 3: 3 DEEP PAGE NODES
             ================================================================= */}
          <div className="grid grid-cols-4 gap-0">
            {children.map((child, idx) => {
              const isScanning = phase === "crawling" && idx === activeChildIdx;
              const isHighlighted = idx === 0 || child.crawled || isScanning;
              return (
                <div key={child.path} className="px-1.5 sm:px-3">
                  <div
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 shadow-card transition-all duration-300",
                      isHighlighted
                        ? "border-signal-400/80 bg-surface-1 text-brand-950 shadow-[0_0_20px_rgba(200,245,58,0.08)]"
                        : "border-brand-200 bg-surface-1/80 text-brand-600",
                    )}
                  >
                    <FileText
                      size={15}
                      className={cn(
                        "shrink-0",
                        isHighlighted ? "text-signal-400" : "text-brand-400",
                      )}
                    />
                    <span className="truncate font-mono text-[11px] font-bold text-brand-950 sm:text-xs">
                      {child.path}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* ── BOTTOM COMMAND & PROGRESS BAR (MATCHING REFERENCE IMAGE) ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-200/80 bg-surface-1/95 px-4 py-4 shadow-2xl backdrop-blur-xl sm:px-6">
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
              <div className="flex items-center gap-2.5">
                {isCompleted ? (
                  <Check size={18} className="text-signal-400" strokeWidth={3} />
                ) : (
                  <Loader2 size={17} className="animate-spin text-signal-400" />
                )}
                <p className="text-base font-extrabold tracking-tight text-brand-950 sm:text-lg">
                  {isCompleted
                    ? "Audit Complete — Opening Website Audit..."
                    : "Crawling Website..."}
                </p>
              </div>

              <div className="mt-2.5 flex w-full items-center gap-3.5">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2 p-0.5 border border-brand-200">
                  <div
                    className="h-full rounded-full bg-signal-400 transition-all duration-500 shadow-[0_0_16px_rgba(200,245,58,0.6)]"
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
