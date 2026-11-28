"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlanModal } from "@/components/competitor/plan-modal";
import { useQuery } from "@tanstack/react-query";
import {
  Zap,
  ExternalLink,
  Loader2,
  FileText,
  LayoutGrid,
  Layers,
  HelpCircle,
  Code2,
  BookOpen,
  Building2,
  Globe,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Search,
  EyeOff,
  RotateCcw,
} from "lucide-react";
import { useProgrammaticMatrix, useWorkspace } from "@/hooks/use-growthx";
import { api, type TrackedCompetitor } from "@/lib/api-client";
import { buildGapBlueprint, buildGapItems, buildGapPlan, type GapItem, type GapKind } from "@/lib/gaps-plain";
import { stagingEngine } from "@/lib/staging-engine";
import { useSubscription } from "@/lib/subscription-engine";
import { cn } from "@/lib/utils";

interface SectionTheme {
  icon: typeof FileText;
  badge: string;
  badgeClass: string;
  accentBar: string;
}

const SECTION_THEMES: Record<GapKind, SectionTheme> = {
  topic: {
    icon: FileText,
    badge: "Missing Pages",
    badgeClass: "bg-error-50 text-error-700 border-error-200/50",
    accentBar: "bg-error-500",
  },
  pageType: {
    icon: LayoutGrid,
    badge: "Page Architecture",
    badgeClass: "bg-brand-100 text-brand-700 border-brand-200/50",
    accentBar: "bg-brand-400",
  },
  series: {
    icon: Layers,
    badge: "Programmatic Sets",
    badgeClass: "bg-series-6/10 text-series-6 border-series-6/20",
    accentBar: "bg-series-6",
  },
  question: {
    icon: HelpCircle,
    badge: "AI & Search Answers",
    badgeClass: "bg-signal-400/15 text-signal-400 border-signal-400/30",
    accentBar: "bg-signal-400",
  },
  schema: {
    icon: Code2,
    badge: "Rich SERP Snippets",
    badgeClass: "bg-success-50 text-success-700 border-success-200/50",
    accentBar: "bg-success-500",
  },
  depth: {
    icon: BookOpen,
    badge: "Content Depth",
    badgeClass: "bg-series-2/10 text-series-2 border-series-2/20",
    accentBar: "bg-series-2",
  },
};

const SECTIONS: Array<{ kind: GapKind; title: string; explain: string }> = [
  {
    kind: "topic",
    title: "Topics they have a page for, and you don't",
    explain: "Our crawl found a competitor page on this topic but no matching page on yours. Dismiss irrelevant competitor SKUs to keep your list focused.",
  },
  {
    kind: "pageType",
    title: "Page Architecture Comparison",
    explain: "How your page counts compare against every tracked rival by page type (unclassified generic pages are excluded).",
  },
  {
    kind: "series",
    title: "Sets of similar pages they publish",
    explain: "Some competitors publish programmatic families of pages from one template, such as one page per city or comparison.",
  },
  {
    kind: "question",
    title: "Customer questions they answer",
    explain: "Compares question-related content found in website crawls; does not measure Google rankings or AI answers.",
  },
  {
    kind: "schema",
    title: "Structured data they give Google",
    explain: "Schema.org details search engines and AI crawlers use to understand pricing, FAQs, ratings, and entities.",
  },
  {
    kind: "depth",
    title: "Content depth comparison",
    explain: "Compares median page word counts across crawled pages; focus on usefulness rather than word count alone.",
  },
];

const SHOWN_PER_SECTION = 8;
const safeUrl = (url: string) => (/^https?:\/\//.test(url) ? url : undefined);
const safePath = (url: string) => {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch {
    return url;
  }
};

function loadDismissed(projectId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(`reigel.gaps.dismissed.${projectId}`);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(projectId: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`reigel.gaps.dismissed.${projectId}`, JSON.stringify(Array.from(set)));
  } catch {
    // ignore storage quota errors
  }
}

function GapMetricCard({
  label,
  value,
  sub,
  tag,
  icon: Icon,
  variant,
  active,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  tag: string;
  icon: typeof FileText;
  variant: "error" | "accent" | "warning" | "success";
  active?: boolean;
  onClick?: () => void;
}) {
  const badgeStyle = {
    error: "bg-error-50 text-error-700 border-error-200/50",
    accent: "bg-brand-100 text-brand-700 border-brand-200/60",
    warning: "bg-signal-400/15 text-signal-400 border-signal-400/30",
    success: "bg-success-50 text-success-700 border-success-200/50",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-surface-1 p-3.5 text-left shadow-2xs transition-all cursor-pointer",
        active
          ? "border-signal-400 ring-1 ring-signal-400/40"
          : "hover:border-brand-300/60",
      )}
      style={{ borderColor: active ? undefined : "var(--border-color)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-400">{label}</p>
        <Icon size={13.5} className="text-brand-400" />
      </div>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="text-xl font-extrabold font-mono text-brand-950 tracking-tight">{value}</span>
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.2 text-[9.5px] font-mono font-bold", badgeStyle)}>
          {tag}
        </span>
      </div>
      <p className="mt-0.5 text-[10.5px] text-brand-400 truncate">{sub}</p>
    </button>
  );
}

export function GapsTab({
  projectId,
  domain,
  competitors,
  onOpenCounterMoves,
}: {
  projectId: string;
  domain: string;
  competitors: TrackedCompetitor[];
  onOpenCounterMoves: () => void;
}) {
  const { orgId } = useWorkspace();
  const { canUseFixEngine } = useSubscription(orgId);
  const searchParams = useSearchParams();
  const initialRival = searchParams.get("rival") || "all";

  const [rivalFilter, setRivalFilter] = useState<string>(initialRival);
  const [kindFilter, setKindFilter] = useState<GapKind | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<GapKind>>(new Set());
  const [planFor, setPlanFor] = useState<GapItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => loadDismissed(projectId));

  const [stagedGapIds, setStagedGapIds] = useState<Set<string>>(() => {
    const staged = stagingEngine.getStaged(projectId);
    const set = new Set<string>();
    staged.forEach((s) => set.add(s.title));
    return set;
  });

  const handleCopyGapPlan = async (item: GapItem) => {
    try {
      await navigator.clipboard.writeText(buildGapPlan(item, { domain }));
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId((curr) => (curr === item.id ? null : curr)), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(projectId, next);
      return next;
    });
  };

  const handleRestoreDismissed = () => {
    const empty = new Set<string>();
    setDismissedIds(empty);
    saveDismissed(projectId, empty);
  };

  const facts = useQuery({
    queryKey: ["rival-advantages", projectId],
    queryFn: () => api.getRivalAdvantages(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });
  const series = useProgrammaticMatrix(projectId);

  const rivals = useMemo(() => facts.data?.rivals ?? [], [facts.data]);
  const allItems = useMemo(() => buildGapItems(rivals, series.data?.clusters ?? []), [rivals, series.data]);

  const rivalScoped = useMemo(
    () =>
      allItems.filter(
        (i) => !dismissedIds.has(i.id) && (rivalFilter === "all" || i.rivalDomain === rivalFilter),
      ),
    [allItems, dismissedIds, rivalFilter],
  );

  const shown = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rivalScoped.filter((i) => {
      if (kindFilter !== "all" && i.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        i.headline.toLowerCase().includes(q) ||
        i.why.toLowerCase().includes(q) ||
        i.rival.toLowerCase().includes(q) ||
        (i.example?.url || "").toLowerCase().includes(q)
      );
    });
  }, [rivalScoped, kindFilter, searchQuery]);

  const waiting = rivals.filter((r) => !r.advantages).map((r) => r.name);
  const count = (kind: GapKind) => rivalScoped.filter((i) => i.kind === kind).length;

  const handleQuickStage = (item: GapItem) => {
    stagingEngine.stage(projectId, {
      title: item.headline,
      category: "Competitor Intelligence",
      source: "COMPETITOR_CONTENT",
      priority: item.kind === "topic" || item.kind === "pageType" ? "HIGH" : "MEDIUM",
      impact: item.why,
      effortHours: 2,
      deliverable: buildGapPlan(item, { domain }),
      evidence: `${item.rival} · counted from both websites`,
    });
    setStagedGapIds((prev) => new Set(prev).add(item.headline));
  };

  const handleStageAllTopics = () => {
    const topics = shown.filter((i) => i.kind === "topic" && !stagedGapIds.has(i.headline));
    for (const item of topics) {
      stagingEngine.stage(projectId, {
        title: item.headline,
        category: "Competitor Intelligence",
        source: "COMPETITOR_CONTENT",
        priority: "HIGH",
        impact: item.why,
        effortHours: 2,
        deliverable: buildGapPlan(item, { domain }),
        evidence: `${item.rival} · counted from both websites`,
      });
    }
    setStagedGapIds((prev) => {
      const next = new Set(prev);
      topics.forEach((t) => next.add(t.headline));
      return next;
    });
  };

  const topicsCount = count("topic");
  const pageTypeCount = count("pageType");

  return (
    <div className="space-y-4">
      {facts.isLoading ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-surface-1 p-8 shadow-card"
          style={{ borderColor: "var(--border-color)" }}
        >
          <Loader2 size={24} className="animate-spin text-signal-400" />
          <p className="text-[13px] font-semibold text-brand-700">Comparing your website with your competitors…</p>
        </div>
      ) : facts.error ? (
        <div className="rounded-2xl border border-error-200 bg-error-50/50 p-6 text-center shadow-card">
          <p className="text-[13px] font-semibold text-error-700">
            Couldn&apos;t load the comparison: {(facts.error as Error).message}
          </p>
        </div>
      ) : !facts.data?.you?.crawledAt ? (
        <div className="rounded-2xl border border-warning-200 bg-warning-50/50 p-6 text-center shadow-card">
          <p className="text-[13px] text-brand-700">
            We haven&apos;t read your website yet. Start a website check from Website Audit, then come back here.
          </p>
        </div>
      ) : (
        <>
          {/* ── COMPACT CLICKABLE KPI STRIP (Acts as Quick Filter) ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GapMetricCard
              label="Missing Topics"
              value={String(topicsCount)}
              sub="competitor pages you don't have"
              tag="High Impact"
              icon={FileText}
              variant="error"
              active={kindFilter === "topic"}
              onClick={() => setKindFilter(kindFilter === "topic" ? "all" : "topic")}
            />
            <GapMetricCard
              label="Page Architecture"
              value={String(pageTypeCount)}
              sub="product, blog & location counts"
              tag="Structure"
              icon={LayoutGrid}
              variant="accent"
              active={kindFilter === "pageType"}
              onClick={() => setKindFilter(kindFilter === "pageType" ? "all" : "pageType")}
            />
            <GapMetricCard
              label="Customer Questions"
              value={String(count("question"))}
              sub="FAQ & answer opportunities"
              tag="AI Search"
              icon={HelpCircle}
              variant="warning"
              active={kindFilter === "question"}
              onClick={() => setKindFilter(kindFilter === "question" ? "all" : "question")}
            />
            <GapMetricCard
              label="Structured Schema"
              value={String(count("schema"))}
              sub="ratings, prices & FAQ markup"
              tag="Schema"
              icon={Code2}
              variant="success"
              active={kindFilter === "schema"}
              onClick={() => setKindFilter(kindFilter === "schema" ? "all" : "schema")}
            />
          </div>

          {/* ── UNIFIED COMPACT FILTER TOOLBAR (Rival + Search + Category in 1 Bar) ── */}
          <div
            className="flex flex-col gap-3 rounded-xl border bg-surface-1 p-3.5 shadow-2xs"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search size={13.5} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search topics, questions, schema, or rival URLs…"
                  className="w-full rounded-lg border border-brand-200 bg-surface-2/60 py-1.5 pl-8 pr-3 text-xs text-brand-950 placeholder:text-brand-400 focus:border-brand-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {competitors.length > 1 &&
                  [{ domain: "all", name: "All rivals" }, ...rivals].map((r) => {
                    const isSelected = rivalFilter === r.domain;
                    return (
                      <button
                        key={r.domain}
                        type="button"
                        onClick={() => setRivalFilter(r.domain)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer",
                          isSelected
                            ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                            : "border border-brand-200 bg-surface-2/60 text-brand-500 hover:text-brand-950",
                        )}
                      >
                        {r.domain === "all" ? <Layers size={10} /> : <Building2 size={10} />}
                        <span>{r.name}</span>
                      </button>
                    );
                  })}

                {canUseFixEngine && topicsCount > 0 && (
                  <button
                    type="button"
                    onClick={handleStageAllTopics}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-50 transition-colors cursor-pointer"
                  >
                    <Zap size={11} className="text-signal-400" />
                    <span>Stage All ({topicsCount})</span>
                  </button>
                )}

                {dismissedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleRestoreDismissed}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200/70 bg-surface-2 px-2.5 py-1 text-[10.5px] font-medium text-brand-500 hover:text-brand-950 cursor-pointer"
                  >
                    <RotateCcw size={10} />
                    <span>Restore {dismissedIds.size} hidden</span>
                  </button>
                )}
              </div>
            </div>

            {/* Category filter pills */}
            <div className="flex flex-wrap items-center gap-1.5 border-t border-brand-100/60 pt-2.5">
              <button
                type="button"
                onClick={() => setKindFilter("all")}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer",
                  kindFilter === "all"
                    ? "bg-signal-400 text-signal-ink font-bold"
                    : "border border-brand-200/80 bg-surface-1 text-brand-500 hover:text-brand-950",
                )}
              >
                All ({rivalScoped.length})
              </button>
              {SECTIONS.map((s) => {
                const c = count(s.kind);
                if (!c) return null;
                const active = kindFilter === s.kind;
                return (
                  <button
                    key={s.kind}
                    type="button"
                    onClick={() => setKindFilter(s.kind)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer",
                      active
                        ? "bg-signal-400 text-signal-ink font-bold"
                        : "border border-brand-200/80 bg-surface-1 text-brand-500 hover:text-brand-950",
                    )}
                  >
                    {SECTION_THEMES[s.kind].badge} ({c})
                  </button>
                );
              })}
            </div>
          </div>

          {waiting.length > 0 && (
            <div
              className="flex items-center gap-2.5 rounded-xl border bg-brand-50/50 p-3 text-[12px] text-brand-700 shadow-2xs"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Loader2 size={14} className="animate-spin text-signal-400 shrink-0" />
              <span>Still reading {waiting.join(", ")}&apos;s website. Their gaps will appear here once finished.</span>
            </div>
          )}

          {shown.length === 0 && waiting.length === 0 && (
            <div className="rounded-2xl border border-success-200 bg-success-50/40 p-8 text-center shadow-card">
              <p className="text-[13px] font-semibold text-success-700">
                No matching gaps found for your current filter.
              </p>
            </div>
          )}

          {/* ── GAP CATEGORY SECTIONS ── */}
          {SECTIONS.map((section) => {
            const list = shown.filter((i) => i.kind === section.kind);
            if (!list.length) return null;
            const theme = SECTION_THEMES[section.kind] || SECTION_THEMES.topic;
            const Icon = theme.icon;
            const open = expanded.has(section.kind) || kindFilter !== "all" || Boolean(searchQuery.trim());
            const visible = open ? list : list.slice(0, SHOWN_PER_SECTION);

            // Grouped 2-column Page Architecture Scorecard (eliminates duplicate per-rival cards!)
            if (section.kind === "pageType") {
              const grouped = new Map<string, { label: string; you: number; items: GapItem[] }>();
              for (const item of list) {
                const key = item.meta?.pageTypeKey || item.headline;
                const label = item.meta?.pageTypeLabel || "pages";
                const prev = grouped.get(key) ?? { label, you: item.compare?.you ?? 0, items: [] };
                prev.items.push(item);
                grouped.set(key, prev);
              }

              return (
                <div
                  key={section.kind}
                  className="overflow-hidden rounded-2xl border bg-surface-1 shadow-card"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div
                    className="flex items-center justify-between gap-2 border-b bg-surface-1 p-4"
                    style={{ borderColor: "var(--border-color)" }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs", theme.badgeClass)}>
                        <Icon size={15} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[14px] font-bold text-brand-950">{section.title}</h2>
                        <span className="rounded-full bg-brand-100 border border-brand-200/50 px-2 py-0.2 font-mono text-[10.5px] font-bold text-brand-950">
                          {grouped.size} types
                        </span>
                        <span
                          title={section.explain}
                          className="inline-flex items-center gap-1 rounded-full border border-brand-200/70 bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-brand-500 cursor-help"
                        >
                          <Info size={10} />
                          <span>Methodology</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
                    {Array.from(grouped.entries()).map(([key, group]) => {
                      const primaryItem = group.items[0];
                      const maxVal = Math.max(group.you, ...group.items.map((x) => x.compare?.them ?? 0), 1);
                      const titleCase = group.label.charAt(0).toUpperCase() + group.label.slice(1);
                      return (
                        <div
                          key={key}
                          className="flex flex-col justify-between rounded-xl border bg-brand-50/25 p-4 space-y-3"
                          style={{ borderColor: "var(--border-color)" }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="text-[13px] font-bold text-brand-950">{titleCase}</h3>
                              <p className="mt-0.5 text-[11px] text-brand-500 line-clamp-2">{primaryItem.why}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPlanFor(primaryItem)}
                              className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-signal-400 px-2.5 py-1 text-[11px] font-bold text-signal-ink hover:bg-signal-500 transition-colors cursor-pointer"
                            >
                              <Zap size={11} />
                              <span>Plan</span>
                            </button>
                          </div>

                          <div className="space-y-2 rounded-lg border border-brand-200/50 bg-surface-1 p-3 text-[11px]">
                            {/* Your Baseline Bar */}
                            <div>
                              <div className="flex justify-between mb-1">
                                <span className="font-semibold text-success-700">You</span>
                                <span className="font-mono font-bold text-brand-950">{group.you.toLocaleString()}</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-success-500"
                                  style={{ width: `${Math.max(group.you > 0 ? 4 : 0, Math.round((group.you / maxVal) * 100))}%` }}
                                />
                              </div>
                            </div>

                            {/* Rival Bars */}
                            {group.items.map((rItem) => {
                              const val = rItem.compare?.them ?? 0;
                              return (
                                <div key={rItem.id}>
                                  <div className="flex justify-between mb-1">
                                    <span className="text-brand-600 truncate max-w-[180px]">{rItem.rival}</span>
                                    <span className="font-mono font-bold text-brand-950">{val.toLocaleString()}</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-series-2"
                                      style={{ width: `${Math.max(4, Math.round((val / maxVal) * 100))}%` }}
                                    />
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
              );
            }

            return (
              <div
                key={section.kind}
                className="overflow-hidden rounded-2xl border bg-surface-1 shadow-card transition-all"
                style={{ borderColor: "var(--border-color)" }}
              >
                {/* Section Header */}
                <div
                  className="flex flex-col gap-2 border-b bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-2xs", theme.badgeClass)}>
                      <Icon size={15} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[14px] font-bold text-brand-950">{section.title}</h2>
                      <span className="inline-flex items-center rounded-full bg-brand-100 border border-brand-200/50 px-2 py-0.2 font-mono text-[10.5px] font-bold text-brand-950">
                        {list.length}
                      </span>
                      <span className={cn("hidden sm:inline-flex items-center rounded-md border px-2 py-0.2 font-mono text-[10px] font-semibold", theme.badgeClass)}>
                        {theme.badge}
                      </span>
                      <span
                        title={section.explain}
                        className="inline-flex items-center gap-1 rounded-full border border-brand-200/70 bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-brand-500 cursor-help"
                      >
                        <Info size={10} />
                        <span>Methodology</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Gap List */}
                <div className="p-4">
                  <ul className="space-y-2">
                    {visible.map((item) => (
                      <GapRow
                        key={item.id}
                        item={item}
                        showRival={rivalFilter === "all"}
                        accentBarClass={theme.accentBar}
                        canAutoApply={canUseFixEngine}
                        isStaged={stagedGapIds.has(item.headline)}
                        isCopied={copiedId === item.id}
                        onQuickStage={() => handleQuickStage(item)}
                        onCopyPlan={() => void handleCopyGapPlan(item)}
                        onDismiss={() => handleDismiss(item.id)}
                        onPlan={() => setPlanFor(item)}
                      />
                    ))}
                  </ul>
                  {list.length > SHOWN_PER_SECTION && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (open) next.delete(section.kind);
                          else next.add(section.kind);
                          return next;
                        })
                      }
                      className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg border bg-surface-1 px-3.5 py-1.5 text-[12px] font-bold text-brand-700 hover:text-brand-950 hover:bg-brand-100 transition-colors shadow-2xs cursor-pointer"
                      style={{ borderColor: "var(--border-color)" }}
                    >
                      {open ? "Show fewer" : `Show all ${list.length} opportunities`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {planFor && (
        <PlanModal
          subtitle={`${planFor.rival} · ${planFor.headline}`}
          why={planFor.why}
          steps={planFor.steps}
          plan={buildGapPlan(planFor, { domain })}
          blueprint={buildGapBlueprint(planFor, { domain })}
          onClose={() => setPlanFor(null)}
          onSave={(plan) => {
            stagingEngine.stage(projectId, {
              title: planFor.headline,
              category: "Competitor Intelligence",
              source: "COMPETITOR_CONTENT",
              priority: planFor.kind === "topic" || planFor.kind === "pageType" ? "HIGH" : "MEDIUM",
              impact: planFor.why,
              effortHours: 2,
              deliverable: plan,
              evidence: `${planFor.rival} · counted from both websites`,
            });
            setStagedGapIds((prev) => new Set(prev).add(planFor.headline));
            setPlanFor(null);
            onOpenCounterMoves();
          }}
        />
      )}
    </div>
  );
}

function GapRow({
  item,
  showRival,
  accentBarClass,
  canAutoApply,
  isStaged,
  isCopied,
  onQuickStage,
  onCopyPlan,
  onDismiss,
  onPlan,
}: {
  item: GapItem;
  showRival: boolean;
  accentBarClass: string;
  canAutoApply: boolean;
  isStaged: boolean;
  isCopied: boolean;
  onQuickStage: () => void;
  onCopyPlan: () => void;
  onDismiss: () => void;
  onPlan: () => void;
}) {
  const href = item.example ? safeUrl(item.example.url) : undefined;
  const isTopic = item.kind === "topic";

  return (
    <li
      className="group relative flex flex-col justify-between gap-3 overflow-hidden rounded-xl border bg-brand-50/30 p-3.5 pl-4 shadow-2xs transition-all hover:border-brand-300/50 hover:bg-brand-50/60 md:flex-row md:items-center"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", accentBarClass)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-bold text-brand-950 leading-snug group-hover:text-signal-400 transition-colors">
            {item.headline}
          </p>
          {showRival && (
            <span className="inline-flex items-center gap-1 rounded-md border border-brand-200/50 bg-brand-100 px-2 py-0.5 text-[10.5px] font-mono font-medium text-brand-500">
              <Globe size={10} className="text-brand-400" />
              {item.rival}
            </span>
          )}
        </div>

        {/* Clean scannable metadata pills on topics instead of repetitive 25-word boilerplate */}
        {isTopic ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-brand-500">
            {item.meta?.pageTypeLabel && (
              <span className="rounded bg-surface-1 border border-brand-200/60 px-1.5 py-0.2 font-medium capitalize text-brand-700">
                {item.meta.pageTypeLabel}
              </span>
            )}
            {item.meta?.wordCount != null && item.meta.wordCount > 0 && (
              <span className="font-mono text-[10.5px] text-brand-400">
                {item.meta.wordCount.toLocaleString()} words
              </span>
            )}
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[10.5px] text-brand-400 hover:text-signal-400 hover:underline truncate max-w-[280px]"
              >
                <span className="truncate">{safePath(href)}</span>
                <ExternalLink size={9} className="shrink-0" />
              </a>
            )}
          </div>
        ) : (
          <p className="mt-1 text-[11.5px] text-brand-400 leading-relaxed">{item.why}</p>
        )}

        {item.compare && (() => {
          const maxVal = Math.max(item.compare.you, item.compare.them, 1);
          const youPct = Math.round((item.compare.you / maxVal) * 100);
          const themPct = Math.round((item.compare.them / maxVal) * 100);
          return (
            <div className="mt-2.5 grid max-w-md grid-cols-2 gap-3 rounded-lg border border-brand-200/60 bg-surface-1 px-3 py-2 text-[10.5px]">
              <div>
                <div className="flex justify-between text-brand-500 mb-1">
                  <span>You</span>
                  <span className="font-mono font-bold text-brand-950">{item.compare.you.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
                  <div className="h-full rounded-full bg-success-500" style={{ width: `${youPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-brand-500 mb-1">
                  <span className="truncate max-w-[90px]">{item.rival}</span>
                  <span className="font-mono font-bold text-brand-950">{item.compare.them.toLocaleString()}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-brand-100 overflow-hidden">
                  <div className="h-full rounded-full bg-series-2" style={{ width: `${themPct}%` }} />
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 pt-1 md:pt-0">
        {isTopic && (
          <button
            type="button"
            onClick={onDismiss}
            title="Hide irrelevant competitor topic"
            aria-label={`Hide ${item.headline}`}
            className="rounded-lg border border-brand-200/60 bg-surface-1 p-1.5 text-brand-400 hover:bg-brand-100 hover:text-brand-900 transition-colors cursor-pointer"
          >
            <EyeOff size={12} />
          </button>
        )}
        {canAutoApply ? (
          isStaged ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-success-200/60 bg-success-50/60 px-3 py-1.5 text-[11.5px] font-bold text-success-700 shadow-2xs">
              <CheckCircle2 size={12} className="text-success-600" />
              <span>Staged ✓</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onQuickStage}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-surface-1 px-3 py-1.5 text-[11.5px] font-bold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs active:scale-[0.98] cursor-pointer"
            >
              <CheckCircle2 size={12} className="text-signal-400" />
              <span>Stage Fix</span>
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={onCopyPlan}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-surface-1 px-3 py-1.5 text-[11.5px] font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs cursor-pointer"
          >
            {isCopied ? <Check size={12} className="text-success-600" /> : <Copy size={12} />}
            <span>{isCopied ? "Copied!" : "Copy Brief"}</span>
          </button>
        )}
        <button
          type="button"
          onClick={onPlan}
          className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-[12px] font-bold text-signal-ink shadow-xs transition-all hover:bg-signal-500 active:scale-[0.98] cursor-pointer"
        >
          <Zap size={12} className="text-signal-ink" />
          <span>Get a plan</span>
        </button>
      </div>
    </li>
  );
}
