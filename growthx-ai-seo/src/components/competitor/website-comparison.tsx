"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Info, TrendingUp } from "lucide-react";
import { Panel } from "@/components/ui/console";
import { LoadingState, NoDataState, FailedState } from "@/components/ui/truthful-state";
import { api, ComparisonRow, WebsiteComparison } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

/**
 * Your site against each competitor, area by area.
 *
 * The form is emphasis rather than a categorical palette: the customer's bar
 * carries the one data hue and every competitor is de-emphasis gray. The
 * reader's question is "where do I stand", not "which of these six colours is
 * which" — a rainbow of competitors would bury the only bar that matters while
 * pushing six hues through a colourblind-safety gate for no gain.
 *
 * Every bar is direct-labelled with its number, so magnitude is never carried
 * by colour alone, and "ahead of you" ships as an icon plus words rather than
 * a red bar.
 */

/** Slot 1 of the validated palette. Both steps pass all checks on their surface. */
const YOU_LIGHT = "#2a78d6";
const YOU_DARK = "#3987e5";
/** De-emphasis. Deliberately below the chroma floor, because it is not a series. */
const CONTEXT = "#898781";

export function WebsiteComparisonPanel({ projectId }: { projectId: string }) {
  const query = useQuery({
    queryKey: ["website-comparison", projectId],
    queryFn: () => api.actionEngineWebsiteComparison(projectId),
    enabled: Boolean(projectId),
  });

  if (query.isLoading) return <LoadingState title="Reading the crawls" />;
  if (query.isError) {
    return <FailedState title="Comparison unavailable" error={errorMessage(query.error)} />;
  }

  const data = query.data;
  if (!data) return null;

  const nobodyCrawled =
    data.you.totalPages == null && data.competitors.every((c) => c.totalPages == null);
  if (nobodyCrawled) {
    return (
      <NoDataState
        title="Nothing has been crawled yet"
        missing="Neither your site nor any tracked competitor has a completed crawl."
        whyItMatters="Every number here is counted from pages actually fetched, so there is nothing to count yet."
        actionRequired="Competitor crawls start when you add a competitor and refresh nightly. Run a site audit for your own site."
        action={undefined}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* The one data hue, stepped per surface rather than flipped. */}
      <style>{`
        [data-cmp] { --cmp-you: ${YOU_LIGHT}; }
        @media (prefers-color-scheme: dark) { [data-cmp] { --cmp-you: ${YOU_DARK}; } }
        :root[data-theme="dark"] [data-cmp] { --cmp-you: ${YOU_DARK}; }
        :root[data-theme="light"] [data-cmp] { --cmp-you: ${YOU_LIGHT}; }
      `}</style>

      <div data-cmp className="space-y-5">
        <StartHere data={data} />

        <Panel
          title="Your site against each competitor"
          subtitle="Counted from pages our crawler fetched. A dash means that site has not been crawled yet — not that it has none."
        >
          <div className="space-y-6 py-1">
            {data.rows.map((row) => (
              <ComparisonRowView key={row.key} row={row} you={data.you.name} />
            ))}
          </div>
        </Panel>

        <CrawlCoverage data={data} />
      </div>
    </div>
  );
}

/** The three widest gaps, which is where a week of work should go. */
function StartHere({ data }: { data: WebsiteComparison }) {
  if (data.priorities.length === 0) {
    return (
      <Panel title="Where to start">
        <p className="px-1 py-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
          On every area measured so far, no tracked competitor is ahead of you. That reflects what has been
          crawled rather than a verdict on the whole market.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Where to start" subtitle="The widest gaps first.">
      <ol className="space-y-3 py-1">
        {data.priorities.map((priority, index) => (
          <li key={priority.area} className="rounded-lg border border-[var(--border-color)] px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-bold text-[var(--text-muted)]">{index + 1}</span>
              <span className="text-[13px] font-semibold text-[var(--text-primary)]">{priority.area}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                <TrendingUp size={10} />
                behind by {priority.gap}
              </span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">{priority.verdict}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function ComparisonRowView({ row, you }: { row: ComparisonRow; you: string }) {
  const values = [row.you, ...row.competitors.map((c) => c.value)].filter(
    (v): v is number => v != null,
  );
  // The scale is this row's own largest value: a shared scale across rows would
  // flatten a row of small counts against one of large ones.
  const max = values.length ? Math.max(...values, 1) : 1;
  const behind = row.aheadOfYou.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{row.label}</h4>
        {behind ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            <AlertTriangle size={10} />
            {row.aheadOfYou.length} ahead of you
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            <CheckCircle2 size={10} />
            no gap
          </span>
        )}
      </div>

      <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-muted)]">{row.whatItMeans}</p>

      <div className="mt-2.5 space-y-1.5">
        <Bar label={you} value={row.you} max={max} isYou />
        {row.competitors.map((competitor) => (
          <Bar key={competitor.id} label={competitor.name} value={competitor.value} max={max} />
        ))}
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">{row.verdict}</p>
    </div>
  );
}

/**
 * One entity's value.
 *
 * A null draws no bar and reads "not crawled": a zero-width bar would be taken
 * for a measured zero, which is the one thing this must never imply.
 */
function Bar({
  label,
  value,
  max,
  isYou,
}: {
  label: string;
  value: number | null;
  max: number;
  isYou?: boolean;
}) {
  const pct = value == null ? 0 : Math.round((value / max) * 100);

  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-44 shrink-0 truncate text-[11.5px] ${
          isYou ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        }`}
        title={label}
      >
        {isYou ? `${label} (you)` : label}
      </span>

      <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-[var(--surface-2)]">
        {value != null && value > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-r-[4px]"
            style={{
              width: `${Math.max(pct, 2)}%`,
              background: isYou ? "var(--cmp-you)" : CONTEXT,
            }}
            title={`${label}: ${value}`}
          />
        )}
      </div>

      <span
        className={`w-20 shrink-0 text-right text-[11.5px] tabular-nums ${
          value == null ? "text-[var(--text-muted)]" : "font-semibold text-[var(--text-primary)]"
        }`}
      >
        {value == null ? "not crawled" : value}
      </span>
    </div>
  );
}

/** What was actually crawled, so a thin comparison explains itself. */
function CrawlCoverage({ data }: { data: WebsiteComparison }) {
  return (
    <Panel title="What this comparison is built from">
      <div className="space-y-1.5 py-1">
        <CoverageLine name={`${data.you.name} (you)`} site={data.you} />
        {data.competitors.map((competitor) => (
          <CoverageLine key={competitor.id ?? competitor.domain} name={competitor.name} site={competitor} />
        ))}
      </div>

      {data.awaitingCrawl.length > 0 && (
        <p className="mt-3 flex items-start gap-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">
          <Info size={13} className="mt-0.5 shrink-0 text-amber-500" />
          {data.awaitingCrawl.join(", ")} {data.awaitingCrawl.length === 1 ? "has" : "have"} not been crawled
          yet, so {data.awaitingCrawl.length === 1 ? "it is" : "they are"} left out of the counts above rather
          than counted as zero. Crawls run nightly.
        </p>
      )}
    </Panel>
  );
}

function CoverageLine({ name, site }: { name: string; site: WebsiteComparison["you"] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
      <span className="text-[var(--text-primary)]">
        {name} <span className="font-mono text-[11px] text-[var(--text-muted)]">{site.domain}</span>
      </span>
      <span className="text-[var(--text-muted)]">
        {site.totalPages == null
          ? "not crawled yet"
          : `${site.totalPages} pages · crawled ${
              site.crawledAt ? new Date(site.crawledAt).toISOString().slice(0, 10) : "date unknown"
            }`}
      </span>
    </div>
  );
}
