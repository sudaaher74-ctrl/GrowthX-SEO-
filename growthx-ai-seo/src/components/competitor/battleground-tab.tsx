"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BarChart3,
  Crown,
  ExternalLink,
  Eye,
  Layers,
  Loader2,
  Plus,
  Radar,
  RotateCw,
  ShieldCheck,
  Swords,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { CompetitorBenchmarkChart } from "@/components/competitor/competitor-benchmark-chart";
import { CompetitorDossierDrawer } from "@/components/competitor/competitor-dossier-drawer";
import { ActionButton, Panel, relativeTime } from "@/components/ui/console";
import { api, type CompetitorWebsite, type IntelReportRival, type TrackedCompetitor } from "@/lib/api-client";
import { buildGapItems } from "@/lib/gaps-plain";
import { useLatestCrawl, useProgrammaticMatrix, useWorkspace } from "@/hooks/use-growthx";
import { useSubscription } from "@/lib/subscription-engine";
import { cn } from "@/lib/utils";

const MAX_RIVALS = 5;
const SERIES_BAR = ["bg-series-1", "bg-series-2", "bg-series-3", "bg-series-4", "bg-series-5"];

interface BattlegroundTabProps {
  projectId: string;
  domain: string;
  brand: string;
  competitors: TrackedCompetitor[];
  onAddCompetitor: () => void;
  onRemoveCompetitor: (competitor: TrackedCompetitor) => void;
  onOpenCounterMoves: () => void;
  onRecrawlCompetitor?: (competitorId: string, domain: string) => void;
}

function EmptyNote({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-6 text-center">
      <p className="text-[13px] font-semibold text-brand-950">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-brand-500">{message}</p>
    </div>
  );
}

export function BattlegroundTab({
  projectId,
  domain,
  brand,
  competitors,
  onAddCompetitor,
  onRemoveCompetitor,
  onRecrawlCompetitor,
}: BattlegroundTabProps) {
  const qc = useQueryClient();
  const { orgId } = useWorkspace();
  const { canUseFixEngine } = useSubscription(orgId);
  const ourCrawl = useLatestCrawl(domain || null);
  const ourFigures = ourCrawl.data?.lastCompleted ?? ourCrawl.data ?? null;

  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [recrawlingAll, setRecrawlingAll] = useState(false);

  const websitesQuery = useQuery({
    queryKey: ["competitor-websites", projectId],
    queryFn: () => api.competitorWebsites(projectId),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
    refetchInterval: (q) =>
      q.state.data?.sites.some((s) => s.status === "READING" || s.status === "QUEUED") ? 10_000 : false,
  });

  const advantagesQuery = useQuery({
    queryKey: ["rival-advantages", projectId],
    queryFn: () => api.getRivalAdvantages(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const movesQuery = useQuery({
    queryKey: ["rival-moves", projectId],
    queryFn: () => api.getRivalMoves(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  });

  const programmaticQuery = useProgrammaticMatrix(projectId);

  const sites = useMemo(() => websitesQuery.data?.sites ?? [], [websitesQuery.data]);
  const youSite = sites.find((s) => s.role === "you");
  const yourHealth = youSite?.healthScore ?? (ourFigures?.healthScore != null ? Math.round(ourFigures.healthScore) : null);
  const yourPages = youSite?.pagesRead ?? ourFigures?.pagesCrawled ?? null;

  const aiAnswers = advantagesQuery.data?.aiAnswers;
  const yourAiSharePct =
    aiAnswers && aiAnswers.asked > 0 ? Math.round((aiAnswers.namedYou / aiAnswers.asked) * 100) : null;

  const [selected, setSelected] = useState<string[] | null>(null);
  const selectedIds = selected ?? competitors.slice(0, MAX_RIVALS).map((c) => c.id);
  const rivals = competitors.filter((c) => selectedIds.includes(c.id));

  const rivalFactsByDomain = useMemo(() => {
    const map = new Map<string, IntelReportRival>();
    for (const r of advantagesQuery.data?.rivals ?? []) {
      map.set(r.domain.toLowerCase(), r);
    }
    return map;
  }, [advantagesQuery.data]);

  const allGapItems = useMemo(
    () => buildGapItems(advantagesQuery.data?.rivals ?? [], programmaticQuery.data?.clusters ?? []),
    [advantagesQuery.data, programmaticQuery.data],
  );

  const gapsByDomain = useMemo(() => {
    const map = new Map<string, { total: number; topics: number }>();
    for (const g of allGapItems) {
      const k = g.rivalDomain.toLowerCase();
      const prev = map.get(k) ?? { total: 0, topics: 0 };
      prev.total += 1;
      if (g.kind === "topic") prev.topics += 1;
      map.set(k, prev);
    }
    return map;
  }, [allGapItems]);

  const movesList = useMemo(() => movesQuery.data?.moves ?? [], [movesQuery.data]);
  const movesByDomain = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of movesList) {
      const k = m.rivalDomain.toLowerCase();
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [movesList]);

  // Compute standing rank & strongest rival from measured health/pages
  const { yourRank, totalScored, strongestRival } = useMemo(() => {
    const scored: Array<{ id: string; score: number }> = [];
    if (yourHealth != null) scored.push({ id: "you", score: yourHealth });
    let topRival: TrackedCompetitor | null = null;
    let topScore = -1;
    for (const c of rivals) {
      const s = sites.find((x) => x.competitorId === c.id || x.domain === c.domain);
      const h = s?.healthScore ?? c.healthScore ?? null;
      if (h != null) scored.push({ id: c.id, score: h });
      const gapCount = gapsByDomain.get(c.domain.toLowerCase())?.total ?? 0;
      const threatWeight = (h ?? 0) + gapCount * 2;
      if (threatWeight > topScore) {
        topScore = threatWeight;
        topRival = c;
      }
    }
    scored.sort((a, b) => b.score - a.score);
    const rankIdx = scored.findIndex((x) => x.id === "you");
    return {
      yourRank: rankIdx >= 0 ? rankIdx + 1 : null,
      totalScored: scored.length,
      strongestRival: topRival,
    };
  }, [yourHealth, rivals, sites, gapsByDomain]);

  const toggleRival = (id: string) => {
    const current = selectedIds;
    if (current.includes(id)) setSelected(current.filter((x) => x !== id));
    else if (current.length < MAX_RIVALS) setSelected([...current, id]);
  };

  const handleRecrawlAll = async () => {
    const toCrawl = competitors.filter((c) => c.crawlStatus !== "RUNNING" && c.crawlStatus !== "PENDING");
    if (toCrawl.length === 0) return;
    setRecrawlingAll(true);
    try {
      await Promise.allSettled(toCrawl.map((c) => api.crawlCompetitorSite(projectId, c.id)));
      qc.invalidateQueries({ queryKey: ["competitors", projectId] });
      qc.invalidateQueries({ queryKey: ["competitor-websites", projectId] });
    } finally {
      setRecrawlingAll(false);
    }
  };

  const inspectingCompetitor = inspectingId ? competitors.find((c) => c.id === inspectingId) ?? null : null;
  const inspectingSite = inspectingCompetitor
    ? sites.find((s) => s.competitorId === inspectingCompetitor.id || s.domain === inspectingCompetitor.domain) ?? null
    : null;
  const inspectingFacts = inspectingCompetitor
    ? rivalFactsByDomain.get(inspectingCompetitor.domain.toLowerCase()) ?? null
    : null;

  if (competitors.length === 0) {
    return (
      <Panel padded>
        <EmptyNote
          title="No competitors added yet"
          message="Add a competitor to see who you are winning and losing against, inspect their full content strategy, and uncover actionable gaps."
        />
        <div className="mt-3 flex justify-center">
          <ActionButton variant="primary" icon={<Plus size={13} />} onClick={onAddCompetitor}>
            Add competitor
          </ActionButton>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── EXECUTIVE 4-CARD SUMMARY STRIP (Real Live Numbers, Zero Fluff) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. Your Standing */}
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-400">Your Standing</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal-400 text-signal-ink">
              <ShieldCheck size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-brand-950">
              {yourHealth != null ? yourHealth : "—"}
            </span>
            {yourHealth != null && <span className="text-xs text-brand-400">/100</span>}
            {yourRank != null && totalScored > 1 && (
              <span className="ml-auto rounded-full bg-success-50 border border-success-200/70 px-2 py-0.5 font-mono text-[10px] font-bold text-success-700">
                #{yourRank} of {totalScored}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-brand-500 truncate">
            {yourPages != null ? `${yourPages.toLocaleString()} pages audited` : "Run Website Audit for baseline"}
          </p>
        </div>

        {/* 2. Actionable Gaps (Real Count) */}
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-400">Content & SEO Gaps</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 border border-brand-200 text-brand-700">
              <Layers size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-brand-950">
              {advantagesQuery.isLoading ? "…" : allGapItems.length}
            </span>
            <Link
              href="/competitor-intelligence?tab=gaps"
              className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-700 hover:text-brand-950 hover:underline"
            >
              <span>View Gaps</span>
              <ArrowUpRight size={11} />
            </Link>
          </div>
          <p className="mt-1 text-[11px] text-brand-500 truncate">
            Topics, questions &amp; schema rivals cover
          </p>
        </div>

        {/* 3. Strongest Rival (1-Click Inspect) */}
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-400">Top Rival to Watch</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 border border-brand-200 text-brand-700">
              <Crown size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-base font-extrabold text-brand-950">
              {strongestRival ? strongestRival.name || strongestRival.domain : "—"}
            </span>
            {strongestRival && (
              <button
                type="button"
                onClick={() => setInspectingId(strongestRival.id)}
                className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-signal-400 px-2 py-1 text-[10.5px] font-bold text-signal-ink hover:bg-signal-500 transition-colors cursor-pointer"
              >
                <Eye size={11} />
                <span>Inspect</span>
              </button>
            )}
          </div>
          <p className="mt-1 text-[11px] text-brand-500 truncate">
            {strongestRival
              ? `${gapsByDomain.get(strongestRival.domain.toLowerCase())?.total ?? 0} gaps vs you · click to explore pages`
              : `${competitors.length} tracked rivals`}
          </p>
        </div>

        {/* 4. Recent Rival Moves */}
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-400">Recent Rival Moves</p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-2 border border-brand-200 text-brand-700">
              <Radar size={15} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-brand-950">
              {movesQuery.isLoading ? "…" : movesList.length}
            </span>
            <Link
              href="/competitor-intelligence?tab=radar"
              className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-700 hover:text-brand-950 hover:underline"
            >
              <span>Rival Radar</span>
              <ArrowUpRight size={11} />
            </Link>
          </div>
          <p className="mt-1 text-[11px] text-brand-500 truncate">
            {movesQuery.data?.windowDays
              ? `New pages & updates in last ${movesQuery.data.windowDays} days`
              : "Recent competitor website updates"}
          </p>
        </div>
      </div>

      {/* ── COMPETITOR FILTER CHIPS ── */}
      <div className="flex flex-wrap items-center gap-2">
        {competitors.map((c) => {
          const on = selectedIds.includes(c.id);
          const full = !on && selectedIds.length >= MAX_RIVALS;
          const name = c.name || c.label || c.domain;
          const reading = c.crawlStatus === "RUNNING" || c.crawlStatus === "PENDING";
          return (
            <span
              key={c.id}
              className={cn(
                "inline-flex items-center rounded-lg border text-[12px] font-medium transition-colors",
                on ? "border-brand-200 bg-surface-1 text-brand-950" : "border-brand-200/60 bg-brand-50 text-brand-400",
              )}
            >
              <button
                type="button"
                onClick={() => toggleRival(c.id)}
                disabled={full}
                title={full ? `Compare up to ${MAX_RIVALS} competitors at once` : `Toggle ${name}`}
                className={cn(
                  "inline-flex items-center gap-1.5 py-1.5 pl-3 pr-1.5 disabled:opacity-40 cursor-pointer",
                  !on && "line-through",
                )}
              >
                {name}
                {reading ? (
                  <Loader2 size={11} className="animate-spin text-signal-400" aria-label="Reading website" />
                ) : c.crawlError ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-error-600" title={`Crawl failed: ${c.crawlError}`} />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setInspectingId(c.id)}
                aria-label={`Inspect ${name}`}
                title={`Open complete competitor dossier for ${name}`}
                className="rounded-md p-1 text-brand-400 hover:bg-brand-100 hover:text-brand-950 transition-colors cursor-pointer"
              >
                <Eye size={11} />
              </button>
              <button
                type="button"
                onClick={() => onRemoveCompetitor(c)}
                aria-label={`Remove ${name}`}
                title={`Stop tracking ${name}`}
                className="mr-1 rounded-md p-1 text-brand-400 hover:bg-error-50 hover:text-error-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            </span>
          );
        })}
        <ActionButton variant="secondary" icon={<Plus size={13} />} onClick={onAddCompetitor}>
          Add competitor
        </ActionButton>
        <span className="ml-auto text-[11px] text-brand-400">
          Your site audited: {ourFigures?.finishedAt ? relativeTime(ourFigures.finishedAt) : "not yet"}
        </span>
      </div>

      {/* ── UNIFIED COMPETITIVE INTELLIGENCE MATRIX (Replaces 2 Duplicate Sections) ── */}
      {rivals.length > 0 && (
        <>
          <div
            className="overflow-hidden rounded-2xl border bg-surface-1 shadow-card"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div
              className="flex flex-col gap-2 border-b bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold shadow-2xs">
                  <BarChart3 size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-[14px] font-bold text-brand-950">Complete Competitor Matrix</h2>
                    <span className="rounded-full bg-brand-100 border border-brand-200/60 px-2 py-0.5 text-[10.5px] font-mono font-medium text-brand-600">
                      {rivals.length} active
                    </span>
                  </div>
                  <p className="text-[11.5px] text-brand-400">
                    Click <strong className="text-brand-700">Inspect</strong> on any rival to browse all their crawled pages, content strategy, gaps, and recent changes.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRecrawlAll}
                  disabled={recrawlingAll || competitors.some((c) => c.crawlStatus === "RUNNING" || c.crawlStatus === "PENDING")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-surface-1 px-3 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-950 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
                >
                  <RotateCw size={11} className={recrawlingAll ? "animate-spin text-signal-400" : "text-brand-400"} />
                  <span>{recrawlingAll ? "Queueing…" : "Re-crawl all"}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <table className="w-full text-left text-[12px]">
                <thead
                  className="border-b bg-brand-50/60 text-[10px] font-bold uppercase tracking-wider text-brand-400"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <tr>
                    <th className="py-3 pl-4 pr-3 font-semibold">Website</th>
                    <th className="px-3 py-3 font-semibold">Health Score</th>
                    <th className="px-3 py-3 font-semibold">Pages &amp; Content Mix</th>
                    <th className="px-3 py-3 font-semibold">Gaps &amp; Activity</th>
                    <th className="px-3 py-3 font-semibold">Freshness</th>
                    <th className="py-3 pl-3 pr-4 text-right font-semibold">Deep Dive</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/40">
                  {/* YOUR SITE BASELINE ROW */}
                  <tr className="bg-signal-400/5 transition-colors hover:bg-signal-400/10">
                    <td className="py-3.5 pl-4 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal-400 text-[10px] font-black text-signal-ink">
                          YOU
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-brand-950 truncate max-w-[160px]">
                              {brand || domain}
                            </span>
                            <span className="rounded-full bg-success-50 border border-success-200/80 px-1.5 py-0.2 font-mono text-[9px] font-bold text-success-700">
                              Baseline
                            </span>
                          </div>
                          <span className="font-mono text-[10.5px] text-brand-400 truncate block">{domain}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="space-y-1">
                        <span className="font-mono text-[13.5px] font-bold text-brand-950">
                          {yourHealth != null ? `${yourHealth}/100` : "—"}
                        </span>
                        {yourHealth != null && (
                          <div className="h-1.5 w-24 rounded-full bg-brand-100 overflow-hidden">
                            <div className="h-full rounded-full bg-success-500" style={{ width: `${yourHealth}%` }} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <div className="space-y-1">
                        <span className="font-mono text-[12.5px] font-semibold text-brand-950">
                          {yourPages != null ? `${yourPages.toLocaleString()} pages` : "—"}
                        </span>
                        <InlineArchitectureBar pageTypes={youSite?.pageTypes ?? []} />
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="text-[11px] text-brand-500">Your benchmark</span>
                    </td>
                    <td className="px-3 py-3.5 text-[11px] text-brand-400">
                      {youSite?.lastReadAt ? relativeTime(youSite.lastReadAt) : "Current"}
                    </td>
                    <td className="py-3.5 pl-3 pr-4 text-right">
                      <Link
                        href="/website"
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200/70 bg-surface-1 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs"
                      >
                        <span>Your Audit</span>
                        <ArrowUpRight size={11} />
                      </Link>
                    </td>
                  </tr>

                  {/* COMPETITOR ROWS */}
                  {rivals.map((c) => {
                    const name = c.name || c.label || c.domain;
                    const site = sites.find((s) => s.competitorId === c.id || s.domain === c.domain);
                    const health = site?.healthScore ?? c.healthScore ?? null;
                    const pages = site?.pagesRead ?? c.pagesCrawled ?? null;
                    const reading = c.crawlStatus === "RUNNING" || c.crawlStatus === "PENDING";
                    const healthDelta = health != null && yourHealth != null ? health - yourHealth : null;
                    const pagesDelta = pages != null && yourPages != null ? pages - yourPages : null;
                    const gapInfo = gapsByDomain.get(c.domain.toLowerCase());
                    const moveCount = movesByDomain.get(c.domain.toLowerCase()) ?? 0;

                    return (
                      <tr
                        key={c.id}
                        className="group transition-colors hover:bg-brand-50/50"
                      >
                        <td className="py-3.5 pl-4 pr-3">
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => setInspectingId(c.id)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-[11px] font-bold text-brand-950 border border-brand-200/60 group-hover:bg-signal-400 group-hover:text-signal-ink transition-colors cursor-pointer"
                            >
                              {name.charAt(0).toUpperCase()}
                            </button>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => setInspectingId(c.id)}
                                className="block truncate max-w-[170px] font-bold text-brand-950 hover:underline text-left cursor-pointer"
                              >
                                {name}
                              </button>
                              <a
                                href={`https://${c.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-[10.5px] text-brand-400 hover:text-brand-700 truncate inline-flex items-center gap-1"
                              >
                                <span>{c.domain}</span>
                                <ExternalLink size={9} />
                              </a>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3.5">
                          {health != null ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[13.5px] font-bold text-brand-950">
                                  {health}/100
                                </span>
                                {healthDelta != null && healthDelta !== 0 && (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.2 font-mono text-[9.5px] font-bold",
                                      healthDelta > 0
                                        ? "bg-error-50 text-error-700 border border-error-200/50"
                                        : "bg-success-50 text-success-700 border border-success-200/50",
                                    )}
                                  >
                                    {healthDelta > 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                    {healthDelta > 0 ? `+${healthDelta}` : healthDelta}
                                  </span>
                                )}
                              </div>
                              <div className="h-1.5 w-24 rounded-full bg-brand-100 overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    healthDelta != null && healthDelta > 0 ? "bg-error-500" : "bg-series-2",
                                  )}
                                  style={{ width: `${health}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-brand-400">
                              {reading ? "Auditing…" : "No score"}
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3.5">
                          {pages != null ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[12.5px] font-semibold text-brand-950">
                                  {pages.toLocaleString()} pages
                                </span>
                                {pagesDelta != null && pagesDelta > 0 && (
                                  <span className="rounded-md bg-warning-50 border border-warning-200/60 px-1.5 py-0.2 font-mono text-[9.5px] font-semibold text-warning-700">
                                    +{pagesDelta.toLocaleString()}
                                  </span>
                                )}
                              </div>
                              <InlineArchitectureBar pageTypes={site?.pageTypes ?? []} />
                            </div>
                          ) : (
                            <span className="text-[11px] text-brand-400">
                              {reading ? "Reading pages…" : "—"}
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {gapInfo && gapInfo.total > 0 ? (
                              <span className="rounded-md bg-error-50 border border-error-200/60 px-2 py-0.5 font-mono text-[10px] font-bold text-error-700">
                                {gapInfo.total} gaps
                              </span>
                            ) : (
                              <span className="text-[11px] text-brand-400">No gaps</span>
                            )}
                            {moveCount > 0 && (
                              <span className="rounded-md bg-signal-400/15 border border-signal-400/30 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-950">
                                {moveCount} moves
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3.5 text-[11px] text-brand-400">
                          {reading ? (
                            <span className="inline-flex items-center gap-1 text-signal-400 font-medium">
                              <Loader2 size={11} className="animate-spin" />
                              Reading…
                            </span>
                          ) : site?.lastReadAt ? (
                            relativeTime(site.lastReadAt)
                          ) : (
                            "Pending"
                          )}
                        </td>

                        <td className="py-3.5 pl-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectingId(c.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1.5 text-[11px] font-bold text-signal-ink hover:bg-signal-500 transition-colors shadow-2xs cursor-pointer"
                            >
                              <Eye size={12} />
                              <span>Inspect</span>
                            </button>
                            {onRecrawlCompetitor && (
                              <button
                                type="button"
                                onClick={() => onRecrawlCompetitor(c.id, c.domain)}
                                disabled={reading}
                                aria-label={`Re-crawl ${name}`}
                                title={`Re-crawl ${name}`}
                                className="rounded-lg border border-brand-200/60 bg-surface-1 p-1.5 text-brand-400 hover:text-brand-950 hover:bg-brand-50 disabled:opacity-40 transition-colors shadow-2xs cursor-pointer"
                              >
                                <RotateCw size={11} className={reading ? "animate-spin text-signal-400" : ""} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── COMPACT HEAD-TO-HEAD VISUAL CHART ── */}
          <CompetitorBenchmarkChart
            yourBrand={brand}
            yourDomain={domain}
            yourHealth={yourHealth}
            yourPages={yourPages}
            yourAiSharePct={yourAiSharePct}
            youSite={youSite}
            rivals={rivals}
            sites={sites}
          />
        </>
      )}

      {/* ── COMPLETE COMPETITOR DOSSIER SLIDE-OVER DRAWER ── */}
      <CompetitorDossierDrawer
        projectId={projectId}
        yourDomain={domain}
        yourHealth={yourHealth}
        yourPages={yourPages}
        competitor={inspectingCompetitor}
        site={inspectingSite}
        rivalFacts={inspectingFacts}
        clusters={programmaticQuery.data?.clusters ?? []}
        moves={movesList}
        canUseFixEngine={canUseFixEngine}
        onClose={() => setInspectingId(null)}
        onRecrawl={onRecrawlCompetitor}
      />
    </div>
  );
}

function InlineArchitectureBar({
  pageTypes,
}: {
  pageTypes: Array<{ type: string; label: string; count: number }>;
}) {
  if (!pageTypes.length) {
    return <span className="text-[10.5px] text-brand-400">Analyzing structure…</span>;
  }
  const total = pageTypes.reduce((sum, pt) => sum + pt.count, 0) || 1;
  const topTwo = pageTypes
    .slice(0, 2)
    .map((pt) => `${pt.label} (${pt.count})`)
    .join(" · ");

  return (
    <div className="space-y-1 max-w-[200px]">
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
        {pageTypes.slice(0, 5).map((pt, idx) => (
          <div
            key={pt.type}
            className={cn(SERIES_BAR[idx % SERIES_BAR.length], "h-full")}
            style={{ width: `${Math.max(4, Math.round((pt.count / total) * 100))}%` }}
            title={`${pt.label}: ${pt.count}`}
          />
        ))}
      </div>
      <p className="truncate text-[10px] text-brand-500" title={pageTypes.map((p) => `${p.label}: ${p.count}`).join(", ")}>
        {topTwo}
      </p>
    </div>
  );
}
