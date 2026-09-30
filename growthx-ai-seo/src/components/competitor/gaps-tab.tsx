"use client";

import { useMemo, useState } from "react";
import { PlanModal } from "@/components/competitor/plan-modal";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  ExternalLink,
  Loader2,
  FileText,
  LayoutGrid,
  Layers,
  HelpCircle,
  Code2,
  BookOpen,
  ArrowRight,
  ArrowUpRight,
  Globe,
  SlidersHorizontal,
} from "lucide-react";
import { useProgrammaticMatrix } from "@/hooks/use-growthx";
import { api, type TrackedCompetitor } from "@/lib/api-client";
import { buildGapItems, buildGapPlan, type GapItem, type GapKind } from "@/lib/gaps-plain";
import { stagingEngine } from "@/lib/staging-engine";
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

const safeUrl = (url: string) => (/^https?:\/\//.test(url) ? url : undefined);

function GapMetricCard({
  label,
  value,
  sub,
  tag,
  icon: Icon,
  variant,
}: {
  label: string;
  value: string;
  sub: string;
  tag: string;
  icon: typeof FileText;
  variant: "error" | "accent" | "warning" | "success";
}) {
  const badgeStyle = {
    error: "bg-error-50 text-error-700 border-error-200/50",
    accent: "bg-brand-100 text-brand-700 border-brand-200/60",
    warning: "bg-signal-400/15 text-signal-400 border-signal-400/30",
    success: "bg-success-50 text-success-700 border-success-200/50",
  }[variant];

  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-surface-1 p-4 shadow-card hover:border-brand-300/50 transition-all"
      style={{ borderColor: "var(--border-color)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-400">{label}</p>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-200/50 bg-brand-100 text-brand-400">
          <Icon size={13.5} />
        </div>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-2xl font-extrabold font-mono text-brand-950 tracking-tight">{value}</span>
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[9.5px] font-mono font-bold", badgeStyle)}>
          {tag}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-brand-400 truncate">{sub}</p>
    </div>
  );
}

/**
 * What competitors have that you don't, in plain words.
 *
 * Implements the signature high-contrast light panel ("Your to-do list" box style)
 * with ranked master-detail interaction and ready-to-use action plan modals.
 */
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
  const [rivalFilter, setRivalFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | GapKind>("ALL");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [planFor, setPlanFor] = useState<GapItem | null>(null);
  const [showAllItems, setShowAllItems] = useState<boolean>(false);

  const facts = useQuery({
    queryKey: ["rival-advantages", projectId],
    queryFn: () => api.getRivalAdvantages(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });
  const series = useProgrammaticMatrix(projectId);

  const rivals = useMemo(() => facts.data?.rivals ?? [], [facts.data]);
  const allItems = useMemo(() => buildGapItems(rivals, series.data?.clusters ?? []), [rivals, series.data]);

  // Filter by rival first
  const rivalItems = useMemo(
    () => (rivalFilter === "all" ? allItems : allItems.filter((i) => i.rivalDomain === rivalFilter)),
    [allItems, rivalFilter]
  );

  // Then filter by category
  const shownItems = useMemo(
    () => (categoryFilter === "ALL" ? rivalItems : rivalItems.filter((i) => i.kind === categoryFilter)),
    [rivalItems, categoryFilter]
  );

  const picked = useMemo(
    () => shownItems.find((i) => i.id === selectedItemId) ?? shownItems[0] ?? null,
    [shownItems, selectedItemId]
  );

  const waiting = rivals.filter((r) => !r.advantages).map((r) => r.name);

  const countOf = (kind: GapKind) => rivalItems.filter((i) => i.kind === kind).length;
  const topicsMissing = rivals
    .filter((r) => rivalFilter === "all" || r.domain === rivalFilter)
    .reduce((n, r) => n + (r.advantages?.missingTopicsTotal ?? 0), 0);

  const visibleList = showAllItems ? shownItems : shownItems.slice(0, 8);

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
            We haven&apos;t read your website yet. Click <span className="font-bold text-signal-400">Run audit</span> at the top, then come back here.
          </p>
        </div>
      ) : (
        <>
          {/* ── KPI HIGHLIGHT CARDS ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GapMetricCard
              label="Topics you're missing"
              value={String(topicsMissing)}
              sub="pages they have, you don't"
              tag="High Impact"
              icon={FileText}
              variant="error"
            />
            <GapMetricCard
              label="Kinds of pages behind"
              value={String(countOf("pageType"))}
              sub="e.g. city or service pages"
              tag="Structure"
              icon={LayoutGrid}
              variant="accent"
            />
            <GapMetricCard
              label="Question gaps"
              value={String(countOf("question"))}
              sub="competitors answering more questions"
              tag="AI Search"
              icon={HelpCircle}
              variant="warning"
            />
            <GapMetricCard
              label="Google extras missing"
              value={String(countOf("schema"))}
              sub="ratings, prices, FAQs, schema"
              tag="Schema"
              icon={Code2}
              variant="success"
            />
          </div>

          {waiting.length > 0 && (
            <div
              className="flex items-center gap-2.5 rounded-xl border bg-brand-50/50 p-3.5 text-[12px] text-brand-700 shadow-2xs"
              style={{ borderColor: "var(--border-color)" }}
            >
              <Loader2 size={14} className="animate-spin text-signal-400 shrink-0" />
              <span>
                Still reading {waiting.join(", ")}&apos;s website. Their gaps will appear here once that finishes.
              </span>
            </div>
          )}

          {/* ── THE SIGNATURE LIGHT PANEL (Matching Dashboard "Your to-do list") ── */}
          <section className="dash-light flex flex-col gap-3.5 rounded-2xl bg-brand-100 border border-brand-200 p-4 sm:p-5 text-brand-950 shadow-sm">
            <div className="flex flex-col justify-between gap-2.5 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-[16px] font-bold tracking-tight text-brand-950">
                  What your competitors have that you don&apos;t
                </h2>
                <p className="mt-0.5 max-w-lg text-[11.5px] text-brand-500 leading-normal">
                  The highest-impact gaps first — sorted by what will bring your website the most visitors.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Dark pill filter strip matching Dashboard */}
                <div
                  role="tablist"
                  aria-label="Filter gap opportunities"
                  className="dash-dark flex flex-wrap items-center gap-0.5 rounded-full bg-brand-50 border border-brand-200/60 p-1 shadow-xs"
                >
                  {[
                    { id: "ALL" as const, label: "All", count: rivalItems.length },
                    { id: "topic" as const, label: "Topics", count: countOf("topic") },
                    { id: "pageType" as const, label: "Page Types", count: countOf("pageType") },
                    { id: "question" as const, label: "Questions", count: countOf("question") },
                    { id: "schema" as const, label: "Schema", count: countOf("schema") },
                  ].map((tab) => {
                    if (tab.id !== "ALL" && tab.count === 0) return null;
                    const on = categoryFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => {
                          setCategoryFilter(tab.id);
                          setSelectedItemId(null);
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                          on
                            ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                            : "text-brand-400 hover:text-brand-950",
                        )}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.2 text-[10px]",
                            on ? "bg-signal-ink text-signal-400" : "bg-brand-200 text-brand-400",
                          )}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {shownItems.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllItems((prev) => !prev)}
                    className="text-[11.5px] font-bold text-brand-700 hover:underline shrink-0"
                  >
                    {showAllItems ? "Show fewer ↑" : `See all ${shownItems.length} →`}
                  </button>
                )}
              </div>
            </div>

            {/* Rival Filter sub-strip */}
            {competitors.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-brand-200/60">
                <span className="flex items-center gap-1 text-[10.5px] font-mono font-bold uppercase tracking-wider text-brand-500">
                  <SlidersHorizontal size={11} className="text-brand-400" />
                  Rival:
                </span>
                {[{ domain: "all", name: "All competitors" }, ...rivals].map((r) => {
                  const isSelected = rivalFilter === r.domain;
                  return (
                    <button
                      key={r.domain}
                      type="button"
                      onClick={() => {
                        setRivalFilter(r.domain);
                        setSelectedItemId(null);
                      }}
                      aria-pressed={isSelected}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-all",
                        isSelected
                          ? "dash-dark bg-brand-50 text-brand-950 font-bold border border-brand-200/60 shadow-xs"
                          : "bg-transparent text-brand-600 hover:bg-brand-200/60",
                      )}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Inner Master-Detail layout */}
            {shownItems.length === 0 ? (
              <div className="rounded-xl bg-brand-50 p-6 text-center text-[12px] text-brand-500">
                Good news: no competitor gaps found in this category.
              </div>
            ) : (
              <div className="grid gap-3.5 lg:grid-cols-[330px_1fr] items-start">
                {/* Left Column: Ranked List */}
                <ol className="space-y-1 max-h-[540px] overflow-y-auto pr-1">
                  {visibleList.map((item, i) => {
                    const isSelected = item.id === picked?.id;
                    const theme = SECTION_THEMES[item.kind] || SECTION_THEMES.topic;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedItemId(item.id)}
                          aria-pressed={isSelected}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                            isSelected
                              ? "dash-dark bg-brand-50 border border-brand-200/60 text-brand-950 shadow-xs"
                              : "bg-transparent hover:bg-brand-200/60 text-brand-950",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                              isSelected ? "bg-signal-400 text-signal-ink" : "bg-brand-200 text-brand-600",
                            )}
                            aria-hidden
                          >
                            {i + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-semibold truncate leading-tight text-brand-950">
                              {item.headline}
                            </span>
                            <span className="mt-1 flex items-center gap-1.5">
                              <span className={cn("inline-block rounded-full px-2 py-0.2 text-[10px] font-bold", theme.badgeClass)}>
                                {theme.badge}
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className={cn("block whitespace-nowrap text-[11px] font-medium truncate max-w-[80px]", isSelected ? "text-brand-400" : "text-brand-500")}>
                              {item.rival}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                {/* Right Column: Opportunity Detail */}
                {picked && (
                  <OpportunityDetail
                    item={picked}
                    onPlan={() => setPlanFor(picked)}
                  />
                )}
              </div>
            )}
          </section>
        </>
      )}

      {planFor && (
        <PlanModal
          subtitle={`${planFor.rival} · ${planFor.headline}`}
          why={planFor.why}
          steps={planFor.steps}
          plan={buildGapPlan(planFor, { domain })}
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
            setPlanFor(null);
            onOpenCounterMoves();
          }}
        />
      )}
    </div>
  );
}

function OpportunityDetail({ item, onPlan }: { item: GapItem; onPlan: () => void }) {
  const theme = SECTION_THEMES[item.kind] || SECTION_THEMES.topic;
  const href = item.example ? safeUrl(item.example.url) : undefined;

  return (
    <div className="dash-dark flex flex-col justify-between gap-3.5 rounded-xl border border-brand-200/60 bg-brand-50 p-4 sm:p-4.5 text-brand-950 shadow-md">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">Opportunity details</p>
          <div className="flex items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", theme.badgeClass)}>{theme.badge}</span>
            <span className="rounded-full bg-brand-200 px-2 py-0.5 text-[10.5px] font-bold text-brand-400">{item.rival}</span>
          </div>
        </div>
        <h3 className="mt-1 text-[17px] sm:text-[18px] font-semibold leading-snug tracking-tight text-brand-950">
          {item.headline}
        </h3>
        {item.why && (
          <p className="mt-1 text-[11.5px] leading-relaxed text-brand-400 max-w-xl">
            {item.why}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-[1fr_1.3fr_110px] gap-2">
        <div className="rounded-lg bg-brand-100 border border-brand-200/50 p-2.5">
          <div className="flex items-center justify-between text-brand-400">
            <p className="text-[10px] font-medium uppercase tracking-wider">Competitor</p>
            <ArrowUpRight size={12} className="text-brand-500" />
          </div>
          <p className="mt-0.5 text-[15px] font-bold tracking-tight text-brand-950 leading-tight truncate">
            {item.rival}
          </p>
        </div>

        <div className="rounded-lg bg-brand-100 border border-brand-200/50 p-2.5">
          <div className="flex items-center justify-between text-brand-400">
            <p className="text-[10px] font-medium uppercase tracking-wider">Advantage type</p>
            <ArrowUpRight size={12} className="text-brand-500" />
          </div>
          <p className="mt-0.5 text-[12.5px] font-bold text-brand-950 truncate leading-tight">{theme.badge}</p>
          <p className="mt-0.5 text-[10.5px] text-brand-400 truncate leading-snug">Ranked ahead on Google</p>
        </div>

        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand-300 text-center text-[10.5px] font-semibold text-brand-400 transition hover:border-brand-400 hover:text-brand-950"
          >
            <ExternalLink size={14} />
            Their page
          </a>
        ) : (
          <div className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-brand-200/40 text-center text-[10.5px] font-semibold text-brand-500">
            <Globe size={14} />
            Active rank
          </div>
        )}
      </div>

      {item.steps && item.steps.length > 0 && (
        <div className="rounded-lg bg-brand-100 border border-brand-200/40 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">How do I beat them?</p>
          <ol className="mt-1 list-decimal pl-4 space-y-0.5 text-[11.5px] leading-relaxed text-brand-700">
            {item.steps.slice(0, 3).map((s, idx) => (
              <li key={idx}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 border-t border-brand-200/50">
        <p className="text-[11px] text-brand-400 leading-tight">
          We prepare ready-to-use prompts, outline and structure. You decide.
        </p>
        <button
          type="button"
          onClick={onPlan}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-signal-400 px-3.5 py-1.5 text-[11.5px] font-bold text-signal-ink transition hover:bg-signal-500 shadow-sm"
        >
          <span>Get a plan</span>
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
