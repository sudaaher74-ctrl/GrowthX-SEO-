"use client";

import { useMemo, useState } from "react";
import {
  Filter,
  Lightbulb,
  MousePointerClick,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Pill } from "@/components/ui/console";
import { NoDataState } from "@/components/ui/truthful-state";
import { Caveat, EmptyNote, Gate, SearchRowsTable } from "@/components/google/view-kit";
import { EvidenceChips } from "@/components/google/parts";
import { useGrowthOpportunities, useGscCtrOpportunities } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { count, percent, pathOf } from "@/lib/google-format";
import { cn } from "@/lib/utils";

const BAND = { HIGH: "good", MEDIUM: "warn", LOW: "default" } as const;

type FilterType = "all" | "high" | "quick-wins" | "search-console" | "analytics" | "ctr";

export function OpportunitiesView() {
  const { projectId } = useWorkspace();
  const opps = useGrowthOpportunities(projectId);
  const ctr = useGscCtrOpportunities(projectId);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const allOpps = useMemo(() => {
    const list = opps.data?.opportunities ?? [];
    return list.filter(
      (o) => o.source === "SEARCH_CONSOLE" || o.source === "ANALYTICS" || o.source === "WEBSITE",
    );
  }, [opps.data]);

  const highPotentialCount = useMemo(
    () => allOpps.filter((o) => o.potential === "HIGH").length,
    [allOpps],
  );

  const quickWinsCount = useMemo(
    () => allOpps.filter((o) => o.effort === "LOW").length,
    [allOpps],
  );

  const ctrRows = useMemo(() => ctr.query.data ?? [], [ctr.query.data]);

  const missedClicksSum = useMemo(() => {
    return ctrRows.reduce((sum, r) => sum + (r.estimatedMissedClicks || 0), 0);
  }, [ctrRows]);

  const filteredOpps = useMemo(() => {
    let list = allOpps;
    if (filter === "high") {
      list = list.filter((o) => o.potential === "HIGH");
    } else if (filter === "quick-wins") {
      list = list.filter((o) => o.effort === "LOW");
    } else if (filter === "search-console") {
      list = list.filter((o) => o.source === "SEARCH_CONSOLE");
    } else if (filter === "analytics") {
      list = list.filter((o) => o.source === "ANALYTICS");
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.summary.toLowerCase().includes(q) ||
          o.recommendedAction.toLowerCase().includes(q) ||
          o.affectedPages.some((p) => p.toLowerCase().includes(q)),
      );
    }

    return [...list].sort((a, b) => b.priority - a.priority);
  }, [allOpps, filter, search]);

  return (
    <div className="space-y-5">
      {/* ── TOP KPI SUMMARY GRID ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400/20 text-signal-ink font-bold">
            <Lightbulb size={20} className="text-brand-950" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Total Opportunities</p>
            <p className="font-mono text-xl font-bold text-brand-950">{allOpps.length}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
            <TrendingUp size={20} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">High Potential</p>
            <p className="font-mono text-xl font-bold text-brand-950">{highPotentialCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/20 text-accent-600 font-bold">
            <Zap size={20} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Quick Wins (Low Effort)</p>
            <p className="font-mono text-xl font-bold text-brand-950">{quickWinsCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-200/60 text-brand-950 font-bold">
            <MousePointerClick size={20} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Missed Clicks (CTR)</p>
            <p className="font-mono text-xl font-bold text-brand-950">{count(missedClicksSum)}</p>
          </div>
        </div>
      </div>

      {/* ── FILTER CHIPS & SEARCH BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-400 mr-1">
            <Filter size={11} />
            <span>Filter:</span>
          </span>

          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-all",
              filter === "all"
                ? "bg-brand-950 text-brand-50 shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            All ({allOpps.length})
          </button>

          <button
            type="button"
            onClick={() => setFilter("high")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-all flex items-center gap-1",
              filter === "high"
                ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-signal-ink" />
            <span>High Potential ({highPotentialCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("quick-wins")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-all flex items-center gap-1",
              filter === "quick-wins"
                ? "bg-accent-500 text-white font-bold shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent-200" />
            <span>Quick Wins ({quickWinsCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilter("search-console")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-all",
              filter === "search-console"
                ? "bg-brand-950 text-brand-50 shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            Search Console
          </button>

          <button
            type="button"
            onClick={() => setFilter("analytics")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-all",
              filter === "analytics"
                ? "bg-brand-950 text-brand-50 shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            Analytics 4
          </button>

          <button
            type="button"
            onClick={() => setFilter("ctr")}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11.5px] font-semibold transition-all",
              filter === "ctr"
                ? "bg-brand-950 text-brand-50 shadow-xs"
                : "bg-brand-100/70 text-brand-600 hover:bg-brand-200/60 hover:text-brand-950",
            )}
          >
            CTR Queries ({ctrRows.length})
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opportunities or pages…"
            className="w-full rounded-xl border border-brand-200/70 bg-brand-100/40 py-1.5 pl-7 pr-3 text-[11.5px] text-brand-950 placeholder:text-brand-400 focus:outline-hidden focus:ring-1 focus:ring-brand-400"
          />
        </div>
      </div>

      {/* ── OPPORTUNITIES LIST (CARD LAYOUT) ── */}
      {filter !== "ctr" && (
        <Gate query={opps} what="opportunities">
          {() => {
            if (filteredOpps.length === 0) {
              return (
                <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-6 shadow-card backdrop-blur-md">
                  <NoDataState
                    compact
                    title="No opportunities match your filter"
                    missing="No open opportunity found with the selected criteria."
                    whyItMatters="Opportunities appear once Search Console and Analytics have data to reason from."
                    actionRequired="Clear search filter or select All Opportunities."
                  />
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {filteredOpps.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md space-y-3 hover:border-brand-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-[260px]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-signal-400 text-signal-ink">
                            <Sparkles size={11} />
                          </span>
                          <h4 className="text-sm font-bold text-brand-950">{o.title}</h4>
                        </div>
                        <p className="text-xs text-brand-400 leading-relaxed">{o.summary}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill tone={BAND[o.potential]}>{o.potential.toLowerCase()} potential</Pill>
                        <Pill>{o.effort.toLowerCase()} effort</Pill>
                        <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700">
                          {o.source === "SEARCH_CONSOLE" ? "GSC" : o.source === "ANALYTICS" ? "GA4" : "Reigel"}
                        </span>
                      </div>
                    </div>

                    {/* Recommended action box */}
                    <div className="rounded-xl border border-brand-200/40 bg-brand-100/40 p-3 text-xs">
                      <div className="flex items-start gap-2">
                        <span className="font-bold text-brand-950 shrink-0">Action:</span>
                        <span className="text-brand-700 leading-relaxed">{o.recommendedAction}</span>
                      </div>
                    </div>

                    {/* Evidence & Affected Pages Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-brand-200/30 text-[11px]">
                      {o.evidence && o.evidence.length > 0 ? (
                        <EvidenceChips
                          items={o.evidence.map((e) => ({
                            label: e.label,
                            value: e.value,
                            source: e.source === "SEARCH_CONSOLE" ? "GSC" : e.source === "ANALYTICS" ? "GA4" : "Reigel",
                          }))}
                        />
                      ) : <span />}

                      {o.affectedPages && o.affectedPages.length > 0 && (
                        <div className="flex items-center gap-1.5 text-brand-400 font-mono text-[10.5px]">
                          <span>Pages:</span>
                          <span className="text-brand-950 truncate max-w-[280px]">
                            {o.affectedPages.slice(0, 2).map(pathOf).join(" · ")}
                            {o.affectedPages.length > 2 ? ` +${o.affectedPages.length - 2}` : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          }}
        </Gate>
      )}

      {/* ── CTR OPPORTUNITIES TABLE ── */}
      {(filter === "all" || filter === "ctr") && (
        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between gap-2 border-b border-brand-200/30 pb-3">
            <div>
              <h3 className="text-sm font-bold text-brand-950 flex items-center gap-2">
                <MousePointerClick size={16} className="text-accent-500" />
                <span>CTR opportunities</span>
              </h3>
              <p className="text-[11.5px] text-brand-400 mt-0.5">
                Search queries that earn fewer clicks than typical for their ranking position.
              </p>
            </div>
            <span className="text-xs font-semibold text-brand-400">
              {ctrRows.length} opportunities detected
            </span>
          </div>

          <Gate query={ctr.query} what="CTR opportunities">
            {(rows) =>
              rows.length === 0 ? (
                <EmptyNote>No query is well below the CTR expected for its position.</EmptyNote>
              ) : (
                <>
                  <SearchRowsTable
                    rows={rows.slice(0, 25)}
                    label="Query"
                    extra={[
                      { header: "Expected CTR", cell: (r) => percent((r as (typeof rows)[number]).expectedCtr) },
                      { header: "Missed clicks", cell: (r) => count((r as (typeof rows)[number]).estimatedMissedClicks) },
                    ]}
                  />
                  <Caveat>
                    Missed clicks are an estimate based on expected CTR for each ranking bracket. Optimizing page title tags and meta descriptions is the fastest way to capture them.
                  </Caveat>
                </>
              )
            }
          </Gate>
        </div>
      )}
    </div>
  );
}
