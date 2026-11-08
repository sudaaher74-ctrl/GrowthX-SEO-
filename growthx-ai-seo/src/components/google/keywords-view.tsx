"use client";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, BarChart2, Download, Hash, MousePointerClick, Search, TrendingUp } from "lucide-react";
import { Panel } from "@/components/ui/console";
import { NoDataState } from "@/components/ui/truthful-state";
import { Caveat, Chip, EmptyNote, Gate, SearchRowsTable } from "@/components/google/view-kit";
import { Table, Td, Th, Tr } from "@/components/ui/console";
import { KeywordIdeasView } from "@/components/google/keyword-ideas-view";
import { useGoogleKeywords, useGscCtrOpportunities, useGscDeclining, useGscQueries, useGscStriking } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { count, pathOf, percent, position } from "@/lib/google-format";

type Tab = "ideas" | "top" | "new" | "rising" | "page2" | "ctr" | "declining" | "cannibalization";
const TABS: { id: Tab; label: string; about: string }[] = [
  { id: "ideas", label: "Keyword ideas", about: "Searches your customers are likely to make, written from your site. Track the ones that matter." },
  { id: "top", label: "Top keywords", about: "Your queries with the most clicks in the period." },
  { id: "new", label: "New", about: "Queries that brought impressions this period and had none in the period before." },
  { id: "rising", label: "Rising", about: "Queries that gained clicks or moved up the page against the previous period." },
  { id: "page2", label: "Page-2 opportunities", about: "Queries ranking just off page one, where a small lift can win clicks." },
  { id: "ctr", label: "Low CTR", about: "Queries that get fewer clicks than a page at that position normally would." },
  { id: "declining", label: "Declining", about: "Queries whose position got worse against the previous period." },
  { id: "cannibalization", label: "Cannibalization", about: "Queries where two or more of your pages split the impressions." },
];

/** The queries that bring people from Google, and the ones worth working on. */
export function KeywordsView() {
  const { projectId } = useWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const tab: Tab = tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "ideas";

  function handleTabChange(nextTab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  const [search, setSearch] = useState("");
  const [positionRange, setPositionRange] = useState<"ALL" | "PAGE_1" | "PAGE_2" | "PAGE_3_PLUS">("ALL");
  const [sortBy, setSortBy] = useState<"clicks" | "impressions" | "position" | "ctr">("clicks");
  const top = useGscQueries(projectId, 100);
  const striking = useGscStriking(projectId);
  const ctr = useGscCtrOpportunities(projectId);
  const declining = useGscDeclining(projectId);
  const movement = useGoogleKeywords(projectId);
  const current = TABS.find((t) => t.id === tab)!;

  const allQueries = useMemo(() => top.query.data ?? [], [top.query.data]);
  const totalKeywords = allQueries.length;
  const totalClicks = useMemo(() => allQueries.reduce((acc, r) => acc + (r.clicks || 0), 0), [allQueries]);
  const totalImpressions = useMemo(() => allQueries.reduce((acc, r) => acc + (r.impressions || 0), 0), [allQueries]);
  const avgPosition = useMemo(() => {
    if (totalImpressions === 0) return allQueries[0]?.position ? allQueries[0].position.toFixed(1) : "—";
    const weighted = allQueries.reduce((acc, r) => acc + (r.position * r.impressions), 0);
    return (weighted / totalImpressions).toFixed(1);
  }, [allQueries, totalImpressions]);

  const page1Count = useMemo(() => allQueries.filter((r) => r.position <= 10).length, [allQueries]);
  const page2Count = useMemo(() => allQueries.filter((r) => r.position > 10 && r.position <= 20).length, [allQueries]);
  const page3Count = useMemo(() => allQueries.filter((r) => r.position > 20).length, [allQueries]);

  const filteredTopRows = useMemo(() => {
    let list = [...allQueries];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((r) => r.key.toLowerCase().includes(q));
    }
    if (positionRange === "PAGE_1") {
      list = list.filter((r) => r.position <= 10);
    } else if (positionRange === "PAGE_2") {
      list = list.filter((r) => r.position > 10 && r.position <= 20);
    } else if (positionRange === "PAGE_3_PLUS") {
      list = list.filter((r) => r.position > 20);
    }

    if (sortBy === "clicks") {
      list.sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
    } else if (sortBy === "impressions") {
      list.sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
    } else if (sortBy === "position") {
      list.sort((a, b) => (a.position || 0) - (b.position || 0));
    } else if (sortBy === "ctr") {
      list.sort((a, b) => (b.ctr || 0) - (a.ctr || 0));
    }
    return list;
  }, [allQueries, search, positionRange, sortBy]);

  function handleExportCsv() {
    let rowsToExport: { key: string; clicks?: number; impressions?: number; ctr?: number; position?: number }[] = [];
    if (tab === "top") rowsToExport = filteredTopRows;
    else if (tab === "page2") rowsToExport = (striking.query.data ?? []) as any;
    else if (tab === "ctr") rowsToExport = (ctr.query.data ?? []) as any;
    else if (tab === "declining") {
      rowsToExport = (declining.query.data ?? []).map((r) => ({
        key: r.query,
        clicks: r.currentClicks,
        impressions: r.impressions,
        ctr: r.impressions > 0 ? r.currentClicks / r.impressions : 0,
        position: r.currentPosition,
      }));
    } else if (tab === "new") {
      rowsToExport = (movement.query.data?.new ?? []).map((r) => ({
        key: r.query,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
        position: r.position,
      }));
    } else if (tab === "rising") {
      rowsToExport = (movement.query.data?.rising ?? []).map((r) => ({
        key: r.query,
        clicks: r.clicks,
        impressions: r.clicks ? r.clicks : 0,
        ctr: 0,
        position: r.position,
      }));
    }

    if (!rowsToExport.length) return;

    const headers = ["Query", "Clicks", "Impressions", "CTR", "Position"];
    const csvContent = [
      headers.join(","),
      ...rowsToExport.map((r) =>
        [
          `"${(r.key || "").replace(/"/g, '""')}"`,
          r.clicks ?? 0,
          r.impressions ?? 0,
          `${((r.ctr ?? 0) * 100).toFixed(2)}%`,
          (r.position ?? 0).toFixed(1),
        ].join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `keywords-${tab}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const empty = (
    <NoDataState
      compact
      title="No keywords for this period"
      missing="Search Console has no queries stored for this workspace and range."
      whyItMatters="Keywords come only from Search Console."
      actionRequired="Try a longer range, or use Refresh data above."
    />
  );

  return (
    <div className="space-y-5">
      {/* ── TOP KPI SUMMARY GRID ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
            <Hash size={18} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Tracked Queries</p>
            <p className="font-mono text-xl font-bold text-brand-950">{totalKeywords}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/20 text-accent-600 font-bold">
            <MousePointerClick size={18} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Total Organic Clicks</p>
            <p className="font-mono text-xl font-bold text-brand-950">{count(totalClicks)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-200/60 text-brand-950 font-bold">
            <BarChart2 size={18} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Total Impressions</p>
            <p className="font-mono text-xl font-bold text-brand-950">{count(totalImpressions)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400/20 text-signal-ink font-bold">
            <TrendingUp size={18} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Average Position</p>
            <p className="font-mono text-xl font-bold text-brand-950">#{avgPosition}</p>
          </div>
        </div>
      </div>

      {/* ── FILTER TABS & SEARCH BAR ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Keyword lists">
          {TABS.map((t) => (
            <Chip key={t.id} active={tab === t.id} onClick={() => handleTabChange(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keywords…"
              className="w-full rounded-xl border border-brand-200/70 bg-brand-100/40 py-1.5 pl-7 pr-3 text-[11.5px] text-brand-950 placeholder:text-brand-400 focus:outline-hidden focus:ring-1 focus:ring-brand-400"
            />
          </div>

          {tab !== "ideas" && tab !== "cannibalization" && (
            <button
              type="button"
              onClick={handleExportCsv}
              title="Download CSV export"
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200/70 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-surface-2 hover:text-brand-950 cursor-pointer"
            >
              <Download size={13} className="text-brand-500" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {tab === "top" && allQueries.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-brand-200/60 bg-surface-1/70 px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold text-brand-400">Position:</span>
            {[
              { id: "ALL", label: `All (${totalKeywords})` },
              { id: "PAGE_1", label: `Page 1: #1–#10 (${page1Count})` },
              { id: "PAGE_2", label: `Striking: #11–#20 (${page2Count})` },
              { id: "PAGE_3_PLUS", label: `Page 3+: #21+ (${page3Count})` },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPositionRange(p.id as any)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  positionRange === p.id
                    ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
                    : "border border-brand-200/60 bg-surface-2 text-brand-600 hover:text-brand-950"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-brand-400">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-brand-200/70 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-800 outline-none"
            >
              <option value="clicks">Clicks (Highest first)</option>
              <option value="impressions">Impressions (Highest first)</option>
              <option value="position">Position (Best rank first)</option>
              <option value="ctr">CTR (Highest first)</option>
            </select>
          </div>
        </div>
      )}

      <Panel title={current.label} subtitle={current.about}>
        {tab === "ideas" && <KeywordIdeasView />}
        {tab === "top" && (
          <Gate query={top.query} what="keywords">
            {() => (filteredTopRows.length === 0 ? empty : <SearchRowsTable rows={filteredTopRows} label="Query" />)}
          </Gate>
        )}
        {(tab === "new" || tab === "rising" || tab === "cannibalization") && (
          <Gate query={movement.query} what="keyword movement">
            {(m) => {
              if (m === null) return empty;
              const rules = m.rules;
              if (tab === "new" || tab === "rising") {
                const list = tab === "new" ? m.new : m.rising;
                if (list === null) return <EmptyNote>There is no earlier period stored to compare with, so nothing can be called {tab}. It appears once a second period of Search Console history exists.</EmptyNote>;
                if (list.length === 0) return <EmptyNote>No query qualifies in this period.</EmptyNote>;
                return tab === "new" ? (
                  <>
                    <SearchRowsTable rows={(m.new ?? []).map((r) => ({ key: r.query, clicks: r.clicks, impressions: r.impressions, ctr: r.impressions > 0 ? r.clicks / r.impressions : 0, position: r.position }))} label="Query" />
                    <Caveat>New means at least {count(rules.minImpressions)} impressions this period and none in the previous one.</Caveat>
                  </>
                ) : (
                  <>
                    <Table minWidth={720}>
                      <thead>
                        <tr>
                          <Th>Query</Th>
                          <Th align="right">Clicks before</Th>
                          <Th align="right">Clicks now</Th>
                          <Th align="right">Change</Th>
                          <Th align="right">Position before</Th>
                          <Th align="right">Position now</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {(m.rising ?? []).map((r) => (
                          <Tr key={r.query}>
                            <Td><span className="block max-w-[320px] truncate text-[12px]" title={r.query}>{r.query}</span></Td>
                            <Td align="right">{count(r.previousClicks)}</Td>
                            <Td align="right">{count(r.clicks)}</Td>
                            <Td align="right"><span className="font-mono text-[11px] text-success-600">+{count(r.clicksChange)}{r.clicksChangePct !== null ? ` (${Math.round(r.clicksChangePct)}%)` : ""}</span></Td>
                            <Td align="right">{position(r.previousPosition)}</Td>
                            <Td align="right">{position(r.position)}</Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                    <Caveat>
                      Rising means {rules.risingMinExtraClicks}+ more clicks and {rules.risingMinPct}%+ growth, or a gain of {rules.risingMinPlaces}+ places, on queries with at least {count(rules.minImpressions)} impressions.
                    </Caveat>
                  </>
                );
              }
              if (m.cannibalization === null) return <EmptyNote>The query-by-page data has not been fetched yet. Use Refresh data above.</EmptyNote>;
              if (m.cannibalization.length === 0) return <EmptyNote>No query is split across competing pages.</EmptyNote>;
              return (
                <>
                  <ul className="divide-y">
                    {m.cannibalization.slice(0, 30).map((c) => (
                      <li key={c.query} className="px-4 py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[13px] font-semibold text-brand-950">{c.query}</span>
                          <span className="text-[11px] text-brand-500">{count(c.impressions)} impressions · {count(c.clicks)} clicks</span>
                        </div>
                        <ul className="mt-1.5 space-y-1">
                          {c.pages.map((p) => (
                            <li key={p.page} className="flex items-center gap-3 text-[11.5px]">
                              <span className="w-12 shrink-0 font-mono text-brand-500">{percent(p.share, 0)}</span>
                              <span className="min-w-0 flex-1 truncate font-mono text-brand-950" title={p.page}>{pathOf(p.page)}</span>
                              <span className="shrink-0 text-brand-500">pos {position(p.position)} · {count(p.clicks)} clicks</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  <Caveat>
                    A query is listed when it has {count(rules.cannibalMinQueryImpressions)}+ impressions and two or more pages each hold {percent(rules.cannibalMinPageShare, 0)}+ of them. Splitting is not always a problem; check whether the pages serve the same intent.
                  </Caveat>
                </>
              );
            }}
          </Gate>
        )}
        {tab === "page2" && (
          <Gate query={striking.query} what="page-2 opportunities">
            {(rows) =>
              rows.length === 0 ? (
                <EmptyNote>No queries are currently in striking distance.</EmptyNote>
              ) : (
                <>
                  <SearchRowsTable rows={rows} label="Query" />
                  <Caveat>
                    Selected by position {rows[0].criteria.minPosition}–{rows[0].criteria.maxPosition} with at least {count(rows[0].criteria.minImpressions)} impressions in the last {rows[0].criteria.days} days.
                  </Caveat>
                </>
              )
            }
          </Gate>
        )}
        {tab === "ctr" && (
          <Gate query={ctr.query} what="low CTR queries">
            {(rows) =>
              rows.length === 0 ? (
                <EmptyNote>No query is well below the CTR expected for its position.</EmptyNote>
              ) : (
                <>
                  <SearchRowsTable
                    rows={rows}
                    label="Query"
                    extra={[
                      { header: "Expected CTR", cell: (r) => percent((r as (typeof rows)[number]).expectedCtr) },
                      { header: "Missed clicks", cell: (r) => count((r as (typeof rows)[number]).estimatedMissedClicks) },
                    ]}
                  />
                  <Caveat>Missed clicks are an estimate from typical CTR by position, not a measured figure.</Caveat>
                </>
              )
            }
          </Gate>
        )}
        {tab === "declining" && (
          <Gate query={declining.query} what="declining keywords">
            {(rows) =>
              rows.length === 0 ? (
                <EmptyNote>No query lost ground against the previous period, or there is not enough stored history to compare.</EmptyNote>
              ) : (
                <SearchRowsTable
                  rows={rows.map((r) => ({ key: r.query, clicks: r.currentClicks, impressions: r.impressions, ctr: r.impressions > 0 ? r.currentClicks / r.impressions : 0, position: r.currentPosition }))}
                  label="Query"
                  extra={[{ header: "Position before", cell: (r) => position(rows.find((x) => x.query === r.key)?.previousPosition) }]}
                />
              )
            }
          </Gate>
        )}
      </Panel>
    </div>
  );
}
