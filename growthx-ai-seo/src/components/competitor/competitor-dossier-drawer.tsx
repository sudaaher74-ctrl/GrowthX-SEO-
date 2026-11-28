"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  Radar,
  RotateCw,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { PlanModal } from "@/components/competitor/plan-modal";
import { relativeTime } from "@/components/ui/console";
import {
  api,
  type CompetitorWebsite,
  type IntelReportRival,
  type ProgrammaticCluster,
  type RivalMove,
  type TrackedCompetitor,
} from "@/lib/api-client";
import { buildGapBlueprint, buildGapItems, buildGapPlan, type GapExecutionBlueprint, type GapItem } from "@/lib/gaps-plain";
import { buildRadarPlan, KIND_LABEL, toRadarItem } from "@/lib/radar-plain";
import { stagingEngine } from "@/lib/staging-engine";
import { cn } from "@/lib/utils";

type DossierTab = "overview" | "pages" | "gaps" | "changes";

const SERIES_BAR = ["bg-series-1", "bg-series-2", "bg-series-3", "bg-series-4", "bg-series-5"];

const PAGE_TYPE_LABEL: Record<string, string> = {
  HOME: "Homepage",
  BLOG: "Blog / Guide",
  PRODUCT: "Product",
  SERVICE: "Service",
  CATEGORY: "Category",
  LOCATION: "Location",
  FAQ: "FAQ",
  CASE_STUDY: "Case Study",
  ABOUT: "About",
  CONTACT: "Contact",
  LEGAL: "Legal",
  OTHER: "Page",
};

function formatPageType(raw: string): string {
  return PAGE_TYPE_LABEL[raw?.toUpperCase()] ?? raw?.replace(/_/g, " ") ?? "Page";
}

function safePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
}

export interface CompetitorDossierDrawerProps {
  projectId: string;
  yourDomain: string;
  yourHealth: number | null;
  yourPages: number | null;
  competitor: TrackedCompetitor | null;
  site?: CompetitorWebsite | null;
  rivalFacts?: IntelReportRival | null;
  clusters?: ProgrammaticCluster[];
  moves?: RivalMove[];
  canUseFixEngine: boolean;
  onClose: () => void;
  onRecrawl?: (competitorId: string, domain: string) => void;
}

export function CompetitorDossierDrawer({
  projectId,
  yourDomain,
  yourHealth,
  yourPages,
  competitor,
  site,
  rivalFacts,
  clusters = [],
  moves = [],
  canUseFixEngine,
  onClose,
  onRecrawl,
}: CompetitorDossierDrawerProps) {
  const [tab, setTab] = useState<DossierTab>("overview");
  const [pageSearch, setPageSearch] = useState("");
  const [pageTypeFilter, setPageTypeFilter] = useState<string>("ALL");
  const [pageSort, setPageSort] = useState<"words" | "title">("words");
  const [planState, setPlanState] = useState<{
    headline: string;
    subtitle: string;
    why: string;
    steps: string[];
    plan: string;
    blueprint?: GapExecutionBlueprint;
  } | null>(null);
  const [stagedTitles, setStagedTitles] = useState<Set<string>>(() => {
    const s = new Set<string>();
    stagingEngine.getStaged(projectId).forEach((item) => s.add(item.title));
    return s;
  });

  // Reset tab & filters whenever a different competitor is opened
  useEffect(() => {
    setTab("overview");
    setPageSearch("");
    setPageTypeFilter("ALL");
  }, [competitor?.id]);

  // Close on Escape
  useEffect(() => {
    if (!competitor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [competitor, onClose]);

  // Load full crawled pages for this competitor on demand
  const pagesQuery = useQuery({
    queryKey: ["competitor-pages-dossier", projectId, competitor?.id],
    queryFn: () => api.listCompetitorPages(projectId, competitor!.id),
    enabled: Boolean(projectId && competitor?.id),
    staleTime: 5 * 60 * 1000,
  });

  const allPages = useMemo(() => pagesQuery.data ?? [], [pagesQuery.data]);

  const pageTypeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of allPages) {
      const k = (p.pageType || "OTHER").toUpperCase();
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [allPages]);

  const filteredPages = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    return allPages
      .filter((p) => {
        if (pageTypeFilter !== "ALL" && (p.pageType || "OTHER").toUpperCase() !== pageTypeFilter) return false;
        if (!q) return true;
        return (
          (p.title || "").toLowerCase().includes(q) ||
          p.url.toLowerCase().includes(q) ||
          (p.metaDescription || "").toLowerCase().includes(q) ||
          (p.h1?.[0] || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) =>
        pageSort === "words"
          ? (b.wordCount || 0) - (a.wordCount || 0)
          : (a.title || a.url).localeCompare(b.title || b.url),
      );
  }, [allPages, pageSearch, pageTypeFilter, pageSort]);

  const rivalGaps = useMemo<GapItem[]>(() => {
    if (!rivalFacts) return [];
    const rivalClusters = clusters.filter(
      (c) => c.competitorDomain.toLowerCase() === rivalFacts.domain.toLowerCase(),
    );
    return buildGapItems([rivalFacts], rivalClusters);
  }, [rivalFacts, clusters]);

  const rivalMoves = useMemo(() => {
    if (!competitor) return [];
    const dom = competitor.domain.toLowerCase();
    return moves.filter((m) => m.rivalDomain.toLowerCase() === dom).map(toRadarItem);
  }, [moves, competitor]);

  if (!competitor) return null;

  const displayName = competitor.name || competitor.label || competitor.domain;
  const reading = competitor.crawlStatus === "RUNNING" || competitor.crawlStatus === "PENDING";
  const health = site?.healthScore ?? competitor.healthScore ?? null;
  const pagesRead = site?.pagesRead ?? competitor.pagesCrawled ?? (allPages.length || null);
  const healthDelta = health != null && yourHealth != null ? health - yourHealth : null;
  const pagesDelta = pagesRead != null && yourPages != null ? pagesRead - yourPages : null;
  const medianWords = rivalFacts?.advantages?.depth?.theirMedianWords ?? null;
  const yourMedianWords = rivalFacts?.advantages?.depth?.yourMedianWords ?? null;
  const sitePageTypes = site?.pageTypes ?? [];
  const totalTypedPages = sitePageTypes.reduce((sum, pt) => sum + pt.count, 0);

  const stageGap = (item: GapItem) => {
    stagingEngine.stage(projectId, {
      title: item.headline,
      category: "Competitor Intelligence",
      source: "COMPETITOR_CONTENT",
      priority: item.kind === "topic" || item.kind === "pageType" ? "HIGH" : "MEDIUM",
      impact: item.why,
      effortHours: 2,
      deliverable: buildGapPlan(item, { domain: yourDomain }),
      evidence: `${item.rival} · counted from both websites`,
    });
    setStagedTitles((prev) => new Set(prev).add(item.headline));
  };

  const tabs: Array<{ id: DossierTab; label: string; count?: number; icon: typeof ShieldCheck }> = [
    { id: "overview", label: "Overview", icon: ShieldCheck },
    { id: "pages", label: "Pages & Content", count: allPages.length || pagesRead || undefined, icon: BookOpen },
    { id: "gaps", label: "Gaps vs You", count: rivalGaps.length || undefined, icon: Layers },
    { id: "changes", label: "Recent Moves", count: rivalMoves.length || undefined, icon: Radar },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${displayName} complete competitor dossier`}>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close competitor dossier"
        onClick={onClose}
        className="fixed inset-0 bg-brand-950/40 backdrop-blur-[2px] transition-opacity"
      />

      {/* Slide-Over Panel */}
      <div className="relative z-10 flex h-full w-full max-w-3xl flex-col bg-surface-1 shadow-2xl border-l border-brand-200">
        {/* Sticky Header */}
        <div className="flex items-start justify-between gap-4 border-b border-brand-200 bg-surface-1 px-6 py-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-mono text-sm font-black shadow-2xs">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-base font-bold text-brand-950">{displayName}</h2>
                {reading ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-signal-400/15 border border-signal-400/30 px-2 py-0.5 text-[10px] font-semibold text-brand-950">
                    <Loader2 size={10} className="animate-spin text-signal-400" />
                    Crawling…
                  </span>
                ) : site?.lastReadAt ? (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-500">
                    Updated {relativeTime(site.lastReadAt)}
                  </span>
                ) : null}
              </div>
              <a
                href={`https://${competitor.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-brand-500 hover:text-brand-950 hover:underline"
              >
                <span>{competitor.domain}</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onRecrawl && (
              <button
                type="button"
                onClick={() => onRecrawl(competitor.id, competitor.domain)}
                disabled={reading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-950 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <RotateCw size={12} className={reading ? "animate-spin text-signal-400" : ""} />
                <span>{reading ? "Reading…" : "Re-crawl"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg border border-brand-200 p-1.5 text-brand-500 hover:bg-brand-100 hover:text-brand-950 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-brand-200 bg-surface-2/60 px-6 py-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                  active
                    ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                    : "text-brand-600 hover:bg-brand-100 hover:text-brand-950",
                )}
              >
                <Icon size={13} />
                <span>{t.label}</span>
                {t.count != null && t.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                      active ? "bg-signal-ink/15 text-signal-ink" : "bg-brand-200/70 text-brand-700",
                    )}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
          {/* ── TAB 1: OVERVIEW & VERDICT ── */}
          {tab === "overview" && (
            <>
              {/* 4 Key Stat Tiles */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Site Health</p>
                  <p className="mt-1 font-mono text-xl font-black text-brand-950">
                    {health != null ? `${health}/100` : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px]">
                    {healthDelta != null ? (
                      healthDelta > 0 ? (
                        <span className="font-semibold text-error-700">+{healthDelta} ahead of you</span>
                      ) : healthDelta < 0 ? (
                        <span className="font-semibold text-success-700">You lead by +{Math.abs(healthDelta)}</span>
                      ) : (
                        <span className="text-brand-500">Tied with you</span>
                      )
                    ) : (
                      <span className="text-brand-400">Crawl score</span>
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Pages Crawled</p>
                  <p className="mt-1 font-mono text-xl font-black text-brand-950">
                    {pagesRead != null ? pagesRead.toLocaleString() : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px]">
                    {pagesDelta != null ? (
                      pagesDelta > 0 ? (
                        <span className="font-semibold text-warning-700">+{pagesDelta.toLocaleString()} more than you</span>
                      ) : pagesDelta < 0 ? (
                        <span className="font-semibold text-success-700">You have +{Math.abs(pagesDelta).toLocaleString()} more</span>
                      ) : (
                        <span className="text-brand-500">Same size</span>
                      )
                    ) : (
                      <span className="text-brand-400">Discovered pages</span>
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Median Words</p>
                  <p className="mt-1 font-mono text-xl font-black text-brand-950">
                    {medianWords != null ? medianWords.toLocaleString() : "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-brand-500">
                    {yourMedianWords != null ? `Yours: ${yourMedianWords.toLocaleString()} words` : "Per page depth"}
                  </p>
                </div>

                <div className="rounded-xl border border-brand-200 bg-surface-2/50 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Gaps Found</p>
                  <p className="mt-1 font-mono text-xl font-black text-brand-950">{rivalGaps.length}</p>
                  <button
                    type="button"
                    onClick={() => setTab("gaps")}
                    className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-700 hover:text-brand-950 hover:underline cursor-pointer"
                  >
                    <span>Explore gaps</span>
                    <ArrowUpRight size={11} />
                  </button>
                </div>
              </div>

              {/* Head-to-Head Verdict Matrix */}
              {rivalFacts?.comparison && rivalFacts.comparison.length > 0 && (
                <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
                      Side-by-Side Scorecard: You vs {displayName}
                    </h3>
                    <p className="text-[11px] text-brand-500">
                      Direct comparison across every measured crawl & visibility dimension.
                    </p>
                  </div>
                  <div className="divide-y divide-brand-100">
                    {rivalFacts.comparison.map((row) => {
                      const maxVal = Math.max(row.you ?? 0, row.them ?? 0, 1);
                      const youPct = row.you != null ? Math.round((row.you / maxVal) * 100) : 0;
                      const themPct = row.them != null ? Math.round((row.them / maxVal) * 100) : 0;
                      return (
                        <div key={row.label} className="py-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-brand-900">{row.label}</span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
                                row.leader === "you"
                                  ? "bg-success-50 text-success-700 border border-success-200/60"
                                  : row.leader === "them"
                                    ? "bg-error-50 text-error-700 border border-error-200/60"
                                    : "bg-brand-100 text-brand-600",
                              )}
                            >
                              {row.leader === "you" && <TrendingUp size={10} />}
                              {row.leader === "them" && <TrendingDown size={10} />}
                              {row.leader === "you"
                                ? "You Lead"
                                : row.leader === "them"
                                  ? `${displayName} Leads`
                                  : row.leader === "level"
                                    ? "Tied"
                                    : "Unmeasured"}
                            </span>
                          </div>
                          {(row.you != null || row.them != null) && (
                            <div className="grid grid-cols-2 gap-3 text-[11px]">
                              <div>
                                <div className="flex justify-between text-brand-500 mb-0.5">
                                  <span>You</span>
                                  <span className="font-mono font-semibold text-brand-950">
                                    {row.you != null ? row.you.toLocaleString() : "—"}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
                                  <div className="h-full rounded-full bg-success-500" style={{ width: `${youPct}%` }} />
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between text-brand-500 mb-0.5">
                                  <span className="truncate max-w-[120px]">{displayName}</span>
                                  <span className="font-mono font-semibold text-brand-950">
                                    {row.them != null ? row.them.toLocaleString() : "—"}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
                                  <div className="h-full rounded-full bg-series-2" style={{ width: `${themPct}%` }} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Content Architecture Breakdown */}
              {sitePageTypes.length > 0 && (
                <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
                        Content Architecture ({totalTypedPages.toLocaleString()} Pages)
                      </h3>
                      <p className="text-[11px] text-brand-500">
                        How {displayName} distributes their pages across content types.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTab("pages")}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-100 transition-colors cursor-pointer"
                    >
                      <span>Browse All Pages</span>
                      <ArrowUpRight size={11} />
                    </button>
                  </div>

                  {/* Stacked proportion bar */}
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-brand-100">
                    {sitePageTypes.slice(0, 5).map((pt, idx) => (
                      <div
                        key={pt.type}
                        className={cn(SERIES_BAR[idx % SERIES_BAR.length], "h-full transition-all")}
                        style={{ width: `${Math.max(2, Math.round((pt.count / Math.max(totalTypedPages, 1)) * 100))}%` }}
                        title={`${pt.label}: ${pt.count} pages`}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {sitePageTypes.map((pt, idx) => (
                      <button
                        key={pt.type}
                        type="button"
                        onClick={() => {
                          setPageTypeFilter(pt.type.toUpperCase());
                          setTab("pages");
                        }}
                        className="flex items-center justify-between rounded-lg border border-brand-200/70 bg-surface-2/60 px-2.5 py-1.5 text-left hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-medium text-brand-800 truncate">
                          <span className={cn("h-2 w-2 rounded-full shrink-0", SERIES_BAR[idx % SERIES_BAR.length])} />
                          <span className="truncate">{pt.label}</span>
                        </span>
                        <span className="font-mono text-xs font-bold text-brand-950 ml-2">{pt.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Catalog Highlights & Marketing Signals (previously hidden!) */}
              {((rivalFacts?.catalogHighlights && rivalFacts.catalogHighlights.length > 0) ||
                (rivalFacts?.marketingSignals && rivalFacts.marketingSignals.length > 0)) && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {rivalFacts?.catalogHighlights && rivalFacts.catalogHighlights.length > 0 && (
                    <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Tag size={13} className="text-signal-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
                          Detected Offerings & Pricing
                        </h3>
                      </div>
                      <ul className="space-y-1.5">
                        {rivalFacts.catalogHighlights.slice(0, 8).map((item, i) => (
                          <li key={i} className="flex items-center justify-between gap-2 text-xs border-b border-brand-100 pb-1 last:border-0">
                            <span className="truncate text-brand-800 font-medium">{item.name}</span>
                            {item.price && (
                              <span className="shrink-0 rounded-md bg-brand-100 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-brand-900">
                                {item.price}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rivalFacts?.marketingSignals && rivalFacts.marketingSignals.length > 0 && (
                    <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Sparkles size={13} className="text-signal-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
                          Observed Marketing Signals
                        </h3>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {rivalFacts.marketingSignals.map((sig, i) => (
                          <span
                            key={i}
                            className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-brand-800"
                          >
                            {sig}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Top Missing Topics Preview */}
              {rivalGaps.filter((g) => g.kind === "topic").length > 0 && (
                <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-950">
                      Top Topics They Cover & You Don&apos;t
                    </h3>
                    <button
                      type="button"
                      onClick={() => setTab("gaps")}
                      className="text-[11px] font-semibold text-brand-700 hover:text-brand-950 hover:underline cursor-pointer"
                    >
                      View all {rivalGaps.length} gaps →
                    </button>
                  </div>
                  <ul className="space-y-2">
                    {rivalGaps
                      .filter((g) => g.kind === "topic")
                      .slice(0, 4)
                      .map((g) => (
                        <li
                          key={g.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-brand-100 bg-surface-2/50 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-brand-950">{g.headline}</p>
                            {g.example?.url && (
                              <a
                                href={g.example.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-[10.5px] text-brand-500 hover:underline"
                              >
                                <span className="truncate max-w-[300px]">{safePath(g.example.url)}</span>
                                <ExternalLink size={9} />
                              </a>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setPlanState({
                                headline: g.headline,
                                subtitle: `${displayName} · ${g.headline}`,
                                why: g.why,
                                steps: g.steps,
                                plan: buildGapPlan(g, { domain: yourDomain }),
                                blueprint: buildGapBlueprint(g, { domain: yourDomain }),
                              })
                            }
                            className="shrink-0 rounded-lg bg-signal-400 px-2.5 py-1 text-[11px] font-bold text-signal-ink hover:bg-signal-500 transition-colors cursor-pointer"
                          >
                            Get Plan
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* ── TAB 2: PAGES & CONTENT EXPLORER ── */}
          {tab === "pages" && (
            <div className="space-y-4">
              {/* Search + Sort Bar */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                  <input
                    type="search"
                    value={pageSearch}
                    onChange={(e) => setPageSearch(e.target.value)}
                    placeholder={`Search ${allPages.length} crawled pages by title, URL, or heading…`}
                    className="w-full rounded-xl border border-brand-200 bg-surface-1 py-2 pl-9 pr-3 text-xs text-brand-950 placeholder:text-brand-400 focus:border-brand-400 focus:outline-none"
                  />
                </div>
                <select
                  aria-label="Sort competitor pages"
                  value={pageSort}
                  onChange={(e) => setPageSort(e.target.value as "words" | "title")}
                  className="rounded-xl border border-brand-200 bg-surface-1 px-3 py-2 text-xs font-medium text-brand-800 focus:outline-none"
                >
                  <option value="words">Sort: Most Detailed (Words)</option>
                  <option value="title">Sort: Title (A–Z)</option>
                </select>
              </div>

              {/* Page Type Filter Pills */}
              {pageTypeCounts.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPageTypeFilter("ALL")}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
                      pageTypeFilter === "ALL"
                        ? "bg-signal-400 text-signal-ink font-bold"
                        : "border border-brand-200 bg-surface-1 text-brand-600 hover:bg-brand-50",
                    )}
                  >
                    All ({allPages.length})
                  </button>
                  {pageTypeCounts.map(([type, count]) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setPageTypeFilter(type)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
                        pageTypeFilter === type
                          ? "bg-signal-400 text-signal-ink font-bold"
                          : "border border-brand-200 bg-surface-1 text-brand-600 hover:bg-brand-50",
                      )}
                    >
                      {formatPageType(type)} ({count})
                    </button>
                  ))}
                </div>
              )}

              {pagesQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-xs text-brand-500">
                  <Loader2 size={15} className="animate-spin text-signal-400" />
                  <span>Loading {displayName}&apos;s crawled pages…</span>
                </div>
              ) : filteredPages.length === 0 ? (
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-8 text-center">
                  <FileText size={20} className="mx-auto text-brand-400" />
                  <p className="mt-2 text-xs font-semibold text-brand-800">
                    {allPages.length === 0
                      ? "No crawled pages stored for this competitor yet."
                      : "No pages match your current filter."}
                  </p>
                  <p className="mt-1 text-[11px] text-brand-500">
                    {allPages.length === 0
                      ? "Click Re-crawl above to inspect their full page titles, content depth, and structure."
                      : "Try clearing the search box or switching back to All page types."}
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {filteredPages.slice(0, 100).map((p) => (
                    <li
                      key={p.url}
                      className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 hover:border-brand-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-700">
                              {formatPageType(p.pageType)}
                            </span>
                            {p.wordCount >= 1000 && (
                              <span className="rounded-md bg-success-50 border border-success-200/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-success-700">
                                In-depth
                              </span>
                            )}
                            <span className="font-mono text-[10.5px] text-brand-400">
                              {(p.wordCount || 0).toLocaleString()} words
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs font-bold text-brand-950 leading-snug">
                            {p.title || p.h1?.[0] || safePath(p.url)}
                          </p>
                          {p.metaDescription && (
                            <p className="mt-1 text-[11.5px] leading-relaxed text-brand-600 line-clamp-2">
                              {p.metaDescription}
                            </p>
                          )}
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10.5px] text-brand-500 hover:text-brand-950 hover:underline break-all"
                          >
                            <span>{safePath(p.url)}</span>
                            <ExternalLink size={10} className="shrink-0" />
                          </a>
                        </div>
                      </div>
                    </li>
                  ))}
                  {filteredPages.length > 100 && (
                    <li className="text-center text-[11px] text-brand-400 py-2">
                      Showing top 100 of {filteredPages.length} matching pages. Narrow your search to inspect specific URLs.
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* ── TAB 3: GAPS VS YOU ── */}
          {tab === "gaps" && (
            <div className="space-y-3">
              {rivalGaps.length === 0 ? (
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-8 text-center">
                  <CheckCircle2 size={20} className="mx-auto text-success-600" />
                  <p className="mt-2 text-xs font-semibold text-brand-900">
                    No unaddressed content or technical gaps found against {displayName}.
                  </p>
                </div>
              ) : (
                rivalGaps.map((item) => {
                  const isStaged = stagedTitles.has(item.headline);
                  const maxCompare = item.compare ? Math.max(item.compare.you, item.compare.them, 1) : 1;
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="inline-block rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-brand-700">
                            {item.kind}
                          </span>
                          <p className="mt-1 text-xs font-bold text-brand-950">{item.headline}</p>
                          <p className="mt-1 text-[11.5px] text-brand-600 leading-relaxed">{item.why}</p>
                        </div>
                      </div>

                      {item.compare && (
                        <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface-2/70 p-2.5 text-[11px]">
                          <div>
                            <div className="flex justify-between text-brand-500 mb-1">
                              <span>You</span>
                              <span className="font-mono font-bold text-brand-950">
                                {item.compare.you.toLocaleString()} {item.compare.unit}
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-brand-200/70 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-success-500"
                                style={{ width: `${Math.round((item.compare.you / maxCompare) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-brand-500 mb-1">
                              <span className="truncate max-w-[120px]">{displayName}</span>
                              <span className="font-mono font-bold text-brand-950">
                                {item.compare.them.toLocaleString()} {item.compare.unit}
                              </span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-brand-200/70 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-series-2"
                                style={{ width: `${Math.round((item.compare.them / maxCompare) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setPlanState({
                              headline: item.headline,
                              subtitle: `${displayName} · ${item.headline}`,
                              why: item.why,
                              steps: item.steps,
                              plan: buildGapPlan(item, { domain: yourDomain }),
                              blueprint: buildGapBlueprint(item, { domain: yourDomain }),
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-signal-400 px-3 py-1.5 text-[11px] font-bold text-signal-ink hover:bg-signal-500 transition-colors cursor-pointer"
                        >
                          <span>Get Plan</span>
                        </button>
                        {canUseFixEngine && (
                          <button
                            type="button"
                            onClick={() => stageGap(item)}
                            disabled={isStaged}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors cursor-pointer",
                              isStaged
                                ? "border-success-200 bg-success-50 text-success-700"
                                : "border-brand-200 bg-surface-1 text-brand-700 hover:bg-brand-50",
                            )}
                          >
                            {isStaged ? <CheckCircle2 size={11} /> : <Zap size={11} className="text-signal-400" />}
                            <span>{isStaged ? "Staged in Fix Engine" : "Stage Fix"}</span>
                          </button>
                        )}
                        {item.example?.url && (
                          <a
                            href={item.example.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-950 hover:underline"
                          >
                            <span>See rival page</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── TAB 4: RECENT CHANGES ── */}
          {tab === "changes" && (
            <div className="space-y-3">
              {rivalMoves.length === 0 ? (
                <div className="rounded-xl border border-brand-200 bg-surface-2/40 p-8 text-center">
                  <Radar size={20} className="mx-auto text-brand-400" />
                  <p className="mt-2 text-xs font-semibold text-brand-900">
                    No recent website changes detected for {displayName}.
                  </p>
                  <p className="mt-1 text-[11px] text-brand-500">
                    Reigel monitors tracked competitors automatically and logs new pages, expanded guides, and schema updates here.
                  </p>
                </div>
              ) : (
                rivalMoves.map((move) => (
                  <div
                    key={move.id}
                    className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-700">
                        {KIND_LABEL[move.kind]}
                      </span>
                      <span className="text-[11px] text-brand-400">{relativeTime(move.at)}</span>
                    </div>
                    <p className="text-xs font-bold text-brand-950">{move.headline}</p>
                    <p className="text-[11.5px] text-brand-600">{move.why}</p>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPlanState({
                            headline: move.headline,
                            subtitle: `${displayName} · ${move.seenBy}`,
                            why: move.why,
                            steps: move.steps,
                            plan: buildRadarPlan(move, { domain: yourDomain }),
                          })
                        }
                        className="rounded-lg bg-signal-400 px-3 py-1.5 text-[11px] font-bold text-signal-ink hover:bg-signal-500 transition-colors cursor-pointer"
                      >
                        Get Counter-Plan
                      </button>
                      {move.example?.url && (
                        <a
                          href={move.example.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-950 hover:underline"
                        >
                          <span>{move.example.label || "Open page"}</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {planState && (
        <PlanModal
          subtitle={planState.subtitle}
          why={planState.why}
          steps={planState.steps}
          plan={planState.plan}
          blueprint={planState.blueprint}
          onClose={() => setPlanState(null)}
          onSave={(savedPlan) => {
            stagingEngine.stage(projectId, {
              title: planState.headline,
              category: "Competitor Intelligence",
              source: "COMPETITOR_CONTENT",
              priority: "HIGH",
              impact: planState.why,
              effortHours: 2,
              deliverable: savedPlan,
              evidence: `${displayName} · competitor dossier`,
            });
            setStagedTitles((prev) => new Set(prev).add(planState.headline));
            setPlanState(null);
          }}
        />
      )}
    </div>
  );
}
