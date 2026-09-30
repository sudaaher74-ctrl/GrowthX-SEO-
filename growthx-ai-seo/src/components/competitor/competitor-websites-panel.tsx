"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Star,
} from "lucide-react";
import { Panel, relativeTime } from "@/components/ui/console";
import { api, type CompetitorWebsite, type SiteReadStatus } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const ACTIVE: SiteReadStatus[] = ["READING", "QUEUED"];
/**
 * One colour per kind of page, as classes rather than var(--color-series-n):
 * Tailwind only emits a theme colour a class uses, so a series colour named
 * only inside a style prop is not on the page at all.
 */
const SERIES = ["bg-series-1", "bg-series-2", "bg-series-3", "bg-series-4", "bg-series-5"];
/** Kinds of page named in the legend; the rest are summed as "Other kinds". */
const TYPES_SHOWN = SERIES.length;

/**
 * Competitor intelligence panel displaying monitored websites with high-fidelity
 * visual hierarchy, crawl status badges, performance metrics, and content breakdown.
 */
export function CompetitorWebsitesPanel({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: ["competitor-websites", projectId],
    queryFn: () => api.competitorWebsites(projectId),
    enabled: Boolean(projectId),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: (q) => (q.state.data?.sites.some((s) => ACTIVE.includes(s.status)) ? 10_000 : false),
  });
  const sites = query.data?.sites ?? [];
  const reading = sites.filter((s) => ACTIVE.includes(s.status)).length;
  const yourSite = sites.find((s) => s.role === "you");
  const yourPages = yourSite?.pagesRead ?? null;
  const yourHealth = yourSite?.healthScore ?? null;

  return (
    <Panel
      title="Websites we read"
      subtitle={
        reading
          ? `Reading ${reading} website${reading === 1 ? "" : "s"} now. This updates automatically.`
          : "Your website and each competitor's: how much we've read, what kinds of pages they have, and their Google rating."
      }
      actions={
        sites.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-100 border border-brand-200/50 px-2.5 py-0.5 text-[11px] font-mono font-medium text-brand-600">
              {sites.length} monitored {sites.length === 1 ? "site" : "sites"}
            </span>
          </div>
        ) : undefined
      }
    >
      {query.isLoading ? (
        <p className="flex items-center justify-center gap-2 p-8 text-[12px] text-brand-500">
          <Loader2 size={14} className="animate-spin text-signal-400" /> Loading websites…
        </p>
      ) : query.error ? (
        <p className="p-6 text-[12px] text-error-600">
          Couldn&apos;t load the websites: {(query.error as Error).message}
        </p>
      ) : sites.length === 0 ? (
        <p className="p-8 text-center text-[12px] text-brand-500">Add your website and a competitor to see them here.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <SiteCard
              key={site.competitorId ?? `you-${site.domain}`}
              site={site}
              yourPages={yourPages}
              yourHealth={yourHealth}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function SiteCard({
  site,
  yourPages,
  yourHealth,
}: {
  site: CompetitorWebsite;
  yourPages: number | null;
  yourHealth: number | null;
}) {
  const you = site.role === "you";
  const initials =
    site.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || (you ? "YOU" : "VS");

  const diffPages =
    !you && site.pagesRead != null && yourPages != null ? site.pagesRead - yourPages : null;

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border transition-all duration-300 overflow-hidden",
        you
          ? "border-signal-400/40 bg-surface-1 shadow-card ring-1 ring-signal-400/20"
          : "border-line/70 bg-surface-1 hover:border-brand-300/60 shadow-card hover:shadow-lg",
      )}
      style={{ borderColor: you ? undefined : "var(--border-color)" }}
    >
      {/* Top accent line */}
      {you && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-signal-400/40 via-signal-400 to-signal-400/40" />
      )}

      <div className="p-5 flex flex-col gap-4">
        {/* Header: Avatar, Name, Domain, Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-mono text-[12px] font-bold shadow-xs border",
                you
                  ? "bg-signal-400 text-signal-ink border-signal-400/50"
                  : "bg-brand-100 text-brand-950 border-brand-200/60",
              )}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[14.5px] font-bold text-brand-950 tracking-tight">
                  {site.name}
                </h3>
                {you ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-signal-400/15 border border-signal-400/30 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-signal-400 shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-signal-400 animate-pulse" />
                    You
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-brand-100 border border-brand-200/50 px-2 py-0.5 text-[9.5px] font-medium uppercase tracking-wider text-brand-400 shrink-0">
                    Competitor
                  </span>
                )}
              </div>
              <a
                href={`https://${site.domain}`}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-brand-400 hover:text-signal-400 transition-colors group/link truncate"
              >
                <span>{site.domain}</span>
                <ExternalLink size={10} className="shrink-0 opacity-50 group-hover/link:opacity-100 transition-opacity" />
              </a>
            </div>
          </div>

          <StatusBadge site={site} />
        </div>

        {/* Core Metrics Strip */}
        <div
          className="grid grid-cols-3 rounded-xl border bg-brand-50/50 p-1 divide-x divide-line/60"
          style={{ borderColor: "var(--border-color)" }}
        >
          {/* Pages Crawled */}
          <div className="px-2.5 py-2 flex flex-col justify-between">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-brand-400">
              Pages Read
            </span>
            <div className="my-0.5">
              <span className="text-[17px] font-bold font-mono text-brand-950 leading-tight">
                {site.pagesRead != null ? site.pagesRead.toLocaleString() : "—"}
              </span>
            </div>
            <div className="text-[10px] text-brand-400 truncate">
              {you ? (
                <span className="text-brand-500 font-medium">Benchmark</span>
              ) : diffPages != null ? (
                diffPages > 0 ? (
                  <span className="text-brand-400 font-mono">+{diffPages.toLocaleString()} vs you</span>
                ) : diffPages < 0 ? (
                  <span className="text-brand-400 font-mono">{diffPages.toLocaleString()} vs you</span>
                ) : (
                  <span className="text-brand-400 font-mono">Same as you</span>
                )
              ) : (
                <span>Indexed pages</span>
              )}
            </div>
          </div>

          {/* Health Score */}
          <div className="px-2.5 py-2 flex flex-col justify-between">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-brand-400">
              Site Health
            </span>
            <div className="my-0.5 flex items-baseline gap-1">
              <span className="text-[17px] font-bold font-mono text-brand-950 leading-tight">
                {site.healthScore != null ? site.healthScore : "—"}
              </span>
              {site.healthScore != null && (
                <span className="text-[10.5px] font-normal text-brand-400">/100</span>
              )}
            </div>
            <div className="text-[10px]">
              {site.healthScore == null ? (
                <span className="text-brand-400">No score</span>
              ) : site.healthScore >= 90 ? (
                <span className="text-signal-400 font-semibold">Optimal</span>
              ) : site.healthScore >= 75 ? (
                <span className="text-primary-700 font-semibold">Good</span>
              ) : (
                <span className="text-warning-700 font-semibold">Issues</span>
              )}
            </div>
          </div>

          {/* Google Rating */}
          <div className="px-2.5 py-2 flex flex-col justify-between">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-brand-400">
              Google Rating
            </span>
            <div className="my-0.5 flex items-center gap-1">
              {site.rating != null ? (
                <>
                  <span className="text-[17px] font-bold font-mono text-brand-950 leading-tight">
                    {site.rating.toFixed(1)}
                  </span>
                  <Star size={12} className="fill-warning-400 text-warning-400 -mt-0.5" />
                </>
              ) : (
                <span className="text-[17px] font-bold font-mono text-brand-400 leading-tight">—</span>
              )}
            </div>
            <div className="text-[10px] text-brand-400 truncate">
              {site.rating != null && site.reviewCount ? (
                `${site.reviewCount.toLocaleString()} reviews`
              ) : site.role === "you" ? (
                "Not connected"
              ) : (
                "Not on Google"
              )}
            </div>
          </div>
        </div>

        {/* Page Architecture */}
        <PageKinds site={site} />

        {/* Not Opened Note if any */}
        <NotOpenedNote site={site} />
      </div>

      {/* Footer Comparison / Action */}
      <div
        className="flex items-center justify-between border-t px-5 py-3 text-[11.5px] bg-brand-50/20"
        style={{ borderColor: "var(--border-color)" }}
      >
        {you ? (
          <>
            <span className="text-brand-400 font-medium text-[11px] flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-400" />
              Your baseline site
            </span>
            <Link
              href="/website"
              className="text-signal-400 font-bold hover:underline text-[11px] flex items-center gap-1 group/btn"
            >
              <span>Full Audit</span>
              <ArrowUpRight size={11} className="transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
            </Link>
          </>
        ) : (
          <>
            <span className="text-brand-400 font-medium text-[11px] truncate pr-2">
              {diffPages != null && diffPages > 0 ? (
                `Has +${diffPages.toLocaleString()} more pages`
              ) : diffPages != null && diffPages < 0 ? (
                `Has ${Math.abs(diffPages).toLocaleString()} fewer pages`
              ) : (
                "Direct rival in market"
              )}
            </span>
            <Link
              href="/competitor-intelligence?tab=gaps"
              className="text-brand-500 hover:text-signal-400 font-semibold text-[11px] flex items-center gap-1 shrink-0 transition-colors group/btn"
            >
              <span>Compare Gaps</span>
              <ArrowUpRight size={11} className="transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ site }: { site: CompetitorWebsite }) {
  switch (site.status) {
    case "READING":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-300 bg-primary-100 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-primary-700 shrink-0 shadow-2xs">
          <Loader2 size={11} className="animate-spin text-primary-600" />
          <span>Reading {site.pagesSoFar ?? 0} pgs</span>
        </span>
      );
    case "QUEUED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-100 px-2.5 py-1 font-mono text-[10.5px] font-medium text-brand-500 shrink-0">
          <Clock size={11} className="text-brand-400" />
          <span>Queued</span>
        </span>
      );
    case "READ":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-2.5 py-1 font-mono text-[10.5px] font-medium text-success-700 shrink-0 shadow-2xs">
          <CheckCircle2 size={11} className="text-success-600" />
          <span>{site.lastReadAt ? `Read ${relativeTime(site.lastReadAt)}` : "Read"}</span>
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-error-200 bg-error-50 px-2.5 py-1 font-mono text-[10.5px] font-semibold text-error-700 shrink-0 shadow-2xs">
          <AlertTriangle size={11} className="text-error-600" />
          <span>Crawl failed</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-100 px-2.5 py-1 font-mono text-[10.5px] font-medium text-brand-400 shrink-0">
          <Clock size={11} className="text-brand-400" />
          <span>Not read</span>
        </span>
      );
  }
}

/** What the site is made of, as a sleek segmented bar and balanced category grid. */
function PageKinds({ site }: { site: CompetitorWebsite }) {
  const total = site.pageTypes.reduce((sum, t) => sum + t.count, 0);
  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-center" style={{ borderColor: "var(--border-color)" }}>
        <p className="text-[11px] text-brand-400">
          {ACTIVE.includes(site.status)
            ? "Kinds of pages appear here when crawl completes."
            : site.status === "READ"
              ? "Page details return with the next crawl."
              : "No page architecture data yet."}
        </p>
      </div>
    );
  }

  const shown = site.pageTypes.slice(0, TYPES_SHOWN);
  const rest = site.pageTypes.slice(TYPES_SHOWN).reduce((sum, t) => sum + t.count, 0);
  const segments = [
    ...shown.map((t, i) => ({
      key: t.type,
      label: t.label,
      count: t.count,
      pct: total > 0 ? Math.round((t.count / total) * 100) : 0,
      color: SERIES[i] ?? "bg-brand-400",
    })),
    ...(rest > 0
      ? [
          {
            key: "rest",
            label: "Other kinds",
            count: rest,
            pct: total > 0 ? Math.round((rest / total) * 100) : 0,
            color: "bg-brand-300",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-brand-400">
          Kinds of Pages
        </span>
        <span className="text-[10px] font-mono text-brand-400">
          {total.toLocaleString()} pages total
        </span>
      </div>

      {/* Segmented Bar */}
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-brand-100/70 p-[1px]" aria-hidden>
        {segments.map((s) => (
          <div
            key={s.key}
            className={cn("h-full rounded-full transition-all", s.color)}
            style={{ width: `${Math.max((s.count / total) * 100, 2)}%` }}
            title={`${s.label}: ${s.count.toLocaleString()} (${s.pct}%)`}
          />
        ))}
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 pt-0.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center justify-between text-[11px] min-w-0 pr-1">
            <span className="flex items-center gap-1.5 min-w-0 truncate text-brand-600">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", s.color)} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-mono text-[10.5px] text-brand-400 shrink-0 ml-1.5 font-medium">
              <span className="text-brand-950 font-bold">{s.count}</span>{" "}
              <span className="text-[9px] opacity-70">({s.pct}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Warning drawer for pages that did not open in crawl. */
function NotOpenedNote({ site }: { site: CompetitorWebsite }) {
  const n = site.notOpened;
  if (!n) return null;
  const reasons = [
    { key: "refused", count: n.refused, text: "blocked or refused crawl" },
    { key: "errored", count: n.errored, text: "returned an error (e.g. 404)" },
    { key: "noAnswer", count: n.noAnswer, text: "timed out without answering" },
  ].filter((r) => r.count > 0);
  const total = reasons.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-xl border border-warning-200/50 bg-warning-50/40 p-2.5 text-[11px] text-warning-700">
      <div className="flex items-center gap-1.5 font-semibold">
        <AlertTriangle size={12} className="shrink-0 text-warning-600" />
        <span>
          {total.toLocaleString()} {total === 1 ? "page" : "pages"} could not be crawled
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10.5px] opacity-90 pl-4">
        {reasons.map((r) => (
          <span key={r.key}>
            <span className="font-bold">{r.count}</span> {r.text}
          </span>
        ))}
      </div>
    </div>
  );
}
