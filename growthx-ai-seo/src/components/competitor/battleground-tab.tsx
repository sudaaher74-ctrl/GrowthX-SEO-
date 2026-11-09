"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BarChart3,
  ExternalLink,
  Layers,
  Loader2,
  Plus,
  RotateCw,
  ShieldCheck,
  Swords,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { CompetitorWebsitesPanel } from "@/components/competitor/competitor-websites-panel";
import { ActionButton, Panel, relativeTime } from "@/components/ui/console";
import { api, type CompetitorWebsite, type TrackedCompetitor } from "@/lib/api-client";
import { useLatestCrawl } from "@/hooks/use-growthx";
import { cn } from "@/lib/utils";

const MAX_RIVALS = 5;

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
  const ourCrawl = useLatestCrawl(domain || null);
  // While a recrawl of your site runs, compare with the last completed one;
  // the running crawl has read only part of the site.
  const ourFigures = ourCrawl.data?.lastCompleted ?? ourCrawl.data ?? null;

  const websitesQuery = useQuery({
    queryKey: ["competitor-websites", projectId],
    queryFn: () => api.competitorWebsites(projectId),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  });
  const sites = websitesQuery.data?.sites ?? [];
  const youSite = sites.find((s) => s.role === "you");
  const yourHealth = youSite?.healthScore ?? (ourFigures?.healthScore != null ? Math.round(ourFigures.healthScore) : null);
  const yourPages = youSite?.pagesRead ?? ourFigures?.pagesCrawled ?? null;

  const [selected, setSelected] = useState<string[] | null>(null);
  const selectedIds = selected ?? competitors.slice(0, MAX_RIVALS).map((c) => c.id);
  const rivals = competitors.filter((c) => selectedIds.includes(c.id));

  const toggleRival = (id: string) => {
    const current = selectedIds;
    if (current.includes(id)) setSelected(current.filter((x) => x !== id));
    else if (current.length < MAX_RIVALS) setSelected([...current, id]);
  };

  if (competitors.length === 0) {
    return (
      <Panel padded>
        <EmptyNote
          title="No competitors added yet"
          message="Add a competitor to see who you are winning and losing against, and what to do about it."
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
      {/* ── BATTLEGROUND EXECUTIVE STRIP ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
              <Swords size={18} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-brand-400">Tracked Rivals</p>
              <p className="font-mono text-xl font-bold text-brand-950">
                {competitors.length} <span className="text-xs font-normal text-brand-500 font-sans">competitors</span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[10.5px] font-mono text-brand-600 font-medium">
            {selectedIds.length}/{MAX_RIVALS} active
          </span>
        </div>

        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brand-700 border border-brand-200 font-bold">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-brand-400">Your Technical Health</p>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-xl font-bold text-brand-950">
                  {ourFigures?.healthScore != null ? Math.round(ourFigures.healthScore) : "—"}
                </span>
                {ourFigures?.healthScore != null && (
                  <span className="text-xs text-brand-400 font-sans">/100</span>
                )}
              </div>
            </div>
          </div>
          <span className="rounded-full bg-success-500/10 text-success-700 border border-success-500/20 px-2 py-0.5 text-[10.5px] font-medium">
            Your Baseline
          </span>
        </div>

        <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brand-700 border border-brand-200 font-bold">
              <Layers size={18} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-brand-400">Competitive Gaps</p>
              <p className="text-xs font-bold text-brand-950">Actionable Opportunities</p>
            </div>
          </div>
          <Link
            href="/competitor-intelligence?tab=gaps"
            className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-surface-3 transition"
          >
            <span>View Gaps</span>
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      {/* Competitor pick-list: toggle tracked competitors on or off */}
      <div className="flex flex-wrap items-center gap-2">
        {competitors.map((c) => {
          const on = selectedIds.includes(c.id);
          const full = !on && selectedIds.length >= MAX_RIVALS;
          const name = c.name || c.label || c.domain;
          const reading = c.crawlStatus === "RUNNING" || c.crawlStatus === "PENDING";
          return (
            <span
              key={c.id}
              className={`inline-flex items-center rounded-lg border text-[12px] font-medium transition-colors ${
                on ? "bg-white text-brand-950" : "bg-brand-50 text-brand-400"
              }`}
            >
              <button
                type="button"
                onClick={() => toggleRival(c.id)}
                disabled={full}
                title={full ? `Compare up to ${MAX_RIVALS} competitors at once` : undefined}
                className={`inline-flex items-center gap-1.5 py-1.5 pl-3 pr-1.5 disabled:opacity-40 ${on ? "" : "line-through"}`}
              >
                {name}
                {reading ? (
                  <Loader2 size={11} className="animate-spin text-primary-600" aria-label="Reading their website" />
                ) : c.crawlError ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-error-600" title={`Couldn't read their website: ${c.crawlError}`} />
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => onRecrawlCompetitor?.(c.id, c.domain)}
                disabled={reading}
                aria-label={`Re-crawl ${name}`}
                title={reading ? "Currently reading their website" : `Re-crawl ${name}'s website`}
                className="rounded-md p-1 text-brand-400 hover:bg-brand-100 hover:text-brand-950 disabled:opacity-40 transition-colors"
              >
                <RotateCw size={11} className={reading ? "animate-spin text-signal-400" : ""} />
              </button>
              <button
                type="button"
                onClick={() => onRemoveCompetitor(c)}
                aria-label={`Remove ${name}`}
                title={`Stop tracking ${name}`}
                className="mr-1 rounded-md p-1 text-brand-400 hover:bg-error-50 hover:text-error-600"
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
          We last read your website: {ourFigures?.finishedAt ? relativeTime(ourFigures.finishedAt) : "not yet"}
        </span>
      </div>

      {rivals.length > 0 && (
        <BenchmarkMatrix
          projectId={projectId}
          youSite={youSite}
          yourDomain={domain}
          yourBrand={brand}
          yourHealth={yourHealth}
          yourPages={yourPages}
          rivals={rivals}
          sites={sites}
          onRecrawlCompetitor={onRecrawlCompetitor}
        />
      )}

      <CompetitorWebsitesPanel projectId={projectId} onRecrawl={onRecrawlCompetitor} />
    </div>
  );
}

function BenchmarkMatrix({
  youSite,
  yourDomain,
  yourBrand,
  yourHealth,
  yourPages,
  rivals,
  sites,
  onRecrawlCompetitor,
}: {
  projectId: string;
  youSite?: CompetitorWebsite | null;
  yourDomain: string;
  yourBrand: string;
  yourHealth: number | null;
  yourPages: number | null;
  rivals: TrackedCompetitor[];
  sites: CompetitorWebsite[];
  onRecrawlCompetitor?: (competitorId: string, domain: string) => void;
}) {
  const yourPageTypes = youSite?.pageTypes?.length ?? 0;

  return (
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
              <h2 className="text-[14px] font-bold text-brand-950">Side-by-Side Competitive Benchmark</h2>
              <span className="rounded-full bg-brand-100 border border-brand-200/60 px-2 py-0.5 text-[10.5px] font-mono font-medium text-brand-600">
                {rivals.length} active comparison{rivals.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-[11.5px] text-brand-400">
              Technical health, crawl footprint, and page architecture diversity compared against your site baseline.
            </p>
          </div>
        </div>

        <Link
          href="/competitor-intelligence?tab=gaps"
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-200/70 bg-surface-1 px-3 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs"
        >
          <span>View All Gap Opportunities</span>
          <ArrowUpRight size={12} />
        </Link>
      </div>

      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full text-left text-[12px]">
          <thead
            className="border-b bg-brand-50/60 text-[10px] font-bold uppercase tracking-wider text-brand-400"
            style={{ borderColor: "var(--border-color)" }}
          >
            <tr>
              <th className="py-3 pl-4 pr-3 font-semibold">Entity & Website</th>
              <th className="px-3 py-3 font-semibold">Health Score</th>
              <th className="px-3 py-3 font-semibold">Pages Crawled</th>
              <th className="px-3 py-3 font-semibold">Page Types</th>
              <th className="px-3 py-3 font-semibold">Freshness</th>
              <th className="py-3 pl-3 pr-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/40">
            {/* YOUR SITE BASELINE ROW */}
            <tr className="bg-signal-400/5 transition-colors hover:bg-signal-400/10">
              <td className="py-3.5 pl-4 pr-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal-400 text-[10px] font-bold text-signal-ink">
                    YOU
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-brand-950 truncate max-w-[140px] sm:max-w-[200px]">
                        {yourBrand || yourDomain}
                      </span>
                      <span className="rounded-full bg-signal-400/15 border border-signal-400/30 px-1.5 py-0.2 font-mono text-[9px] font-bold text-signal-400">
                        Baseline
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] text-brand-400 truncate block">
                      {yourDomain}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[14px] font-bold text-brand-950">
                    {yourHealth != null ? `${yourHealth}/100` : "—"}
                  </span>
                  <span className="rounded-md bg-brand-100 border border-brand-200/50 px-1.5 py-0.5 text-[9.5px] font-mono text-brand-500">
                    Your Score
                  </span>
                </div>
              </td>
              <td className="px-3 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold text-brand-950">
                    {yourPages != null ? yourPages.toLocaleString() : "—"}
                  </span>
                  <span className="text-[10px] text-brand-400">pages</span>
                </div>
              </td>
              <td className="px-3 py-3.5">
                <span className="rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[10.5px] font-medium text-brand-700">
                  {yourPageTypes > 0 ? `${yourPageTypes} types` : "Auditing…"}
                </span>
              </td>
              <td className="px-3 py-3.5 text-[11px] text-brand-400">
                {youSite?.lastReadAt ? relativeTime(youSite.lastReadAt) : "Current"}
              </td>
              <td className="py-3.5 pl-3 pr-4 text-right">
                <Link
                  href="/website"
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200/60 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs"
                >
                  <span>Audit Detail</span>
                  <ArrowUpRight size={11} />
                </Link>
              </td>
            </tr>

            {/* COMPETITOR ROWS */}
            {rivals.map((c) => {
              const name = c.name || c.label || c.domain;
              const site = sites.find((s) => s.competitorId === c.id || s.domain === c.domain);
              const health = site?.healthScore ?? null;
              const pages = site?.pagesRead ?? c.pagesCrawled ?? null;
              const typesCount = site?.pageTypes?.length ?? 0;
              const reading = c.crawlStatus === "RUNNING" || c.crawlStatus === "PENDING";

              const healthDelta = health != null && yourHealth != null ? health - yourHealth : null;
              const pagesDelta = pages != null && yourPages != null ? pages - yourPages : null;

              return (
                <tr key={c.id} className="transition-colors hover:bg-brand-50/40">
                  <td className="py-3.5 pl-4 pr-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-[10px] font-bold text-brand-950 border border-brand-200/50">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-brand-950 truncate max-w-[140px] sm:max-w-[200px]">
                            {name}
                          </span>
                          <span className="rounded-full bg-brand-100 px-1.5 py-0.2 font-mono text-[9px] text-brand-500 uppercase">
                            Rival
                          </span>
                        </div>
                        <a
                          href={`https://${c.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10.5px] text-brand-400 hover:text-signal-400 truncate flex items-center gap-1"
                        >
                          <span>{c.domain}</span>
                          <ExternalLink size={9} />
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    {health != null ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13.5px] font-bold text-brand-950">
                          {health}/100
                        </span>
                        {healthDelta != null && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-bold",
                              healthDelta > 0
                                ? "bg-error-50 text-error-700 border border-error-200/50"
                                : healthDelta < 0
                                  ? "bg-success-50 text-success-700 border border-success-200/50"
                                  : "bg-brand-100 text-brand-600",
                            )}
                          >
                            {healthDelta > 0 ? (
                              <>
                                <TrendingUp size={9} />
                                <span>+{healthDelta} (Rival Lead)</span>
                              </>
                            ) : healthDelta < 0 ? (
                              <>
                                <TrendingDown size={9} />
                                <span>{healthDelta} (Your Lead)</span>
                              </>
                            ) : (
                              <span>Equal</span>
                            )}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-brand-400">
                        {reading ? "Auditing…" : "No score"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    {pages != null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[13px] font-semibold text-brand-950">
                          {pages.toLocaleString()}
                        </span>
                        {pagesDelta != null && pagesDelta !== 0 && (
                          <span
                            className={cn(
                              "rounded-md px-1.5 py-0.5 font-mono text-[9.5px]",
                              pagesDelta > 0
                                ? "bg-warning-50 text-warning-700 border border-warning-200/50 font-medium"
                                : "bg-brand-100 text-brand-600",
                            )}
                          >
                            {pagesDelta > 0 ? `+${pagesDelta.toLocaleString()} gap` : `${pagesDelta.toLocaleString()}`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-brand-400">
                        {reading ? "Reading pages…" : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3.5">
                    <span className="rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[10.5px] font-medium text-brand-700">
                      {typesCount > 0 ? `${typesCount} types` : "—"}
                    </span>
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
                      <Link
                        href={`/competitor-intelligence?tab=gaps&rival=${encodeURIComponent(c.domain)}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200/70 bg-surface-1 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs"
                      >
                        <span>Audit Gaps</span>
                        <ArrowUpRight size={11} />
                      </Link>
                      {onRecrawlCompetitor && (
                        <button
                          type="button"
                          onClick={() => onRecrawlCompetitor(c.id, c.domain)}
                          disabled={reading}
                          aria-label={`Re-crawl ${name}`}
                          title={`Re-crawl ${name}`}
                          className="rounded-lg border border-brand-200/60 bg-surface-1 p-1 text-brand-400 hover:text-brand-950 hover:bg-brand-50 disabled:opacity-40 transition-colors shadow-2xs"
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
  );
}
