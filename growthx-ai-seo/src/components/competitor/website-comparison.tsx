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
        [data-cmp] { --cmp-you: ${YOU_LIGHT}; --cmp-you-tint: ${YOU_LIGHT}14; }
        @media (prefers-color-scheme: dark) {
          [data-cmp] { --cmp-you: ${YOU_DARK}; --cmp-you-tint: ${YOU_DARK}24; }
        }
        :root[data-theme="dark"] [data-cmp] { --cmp-you: ${YOU_DARK}; --cmp-you-tint: ${YOU_DARK}24; }
        :root[data-theme="light"] [data-cmp] { --cmp-you: ${YOU_LIGHT}; --cmp-you-tint: ${YOU_LIGHT}14; }
      `}</style>

      <div data-cmp className="space-y-5">
        <StartHere data={data} />

        <Panel
          title="Your site against each competitor"
          subtitle="Counted from pages our crawler fetched. A dash means that site has not been crawled yet — not that it has none."
        >
          <div className="space-y-3 py-1">
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

  // Only the areas and the gaps. The full sentence for each of these is the
  // verdict under its own row a few centimetres below, and printing it twice
  // on one screen made the page read like padding.
  return (
    <Panel title="Where to start" subtitle="The widest gaps first. Details in the table below.">
      <ol className="flex flex-wrap gap-2 py-1">
        {data.priorities.map((priority, index) => (
          <li
            key={priority.area}
            className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] px-2.5 py-1.5"
          >
            <span className="text-[11px] font-bold tabular-nums text-[var(--text-muted)]">{index + 1}</span>
            <span className="text-[12.5px] font-semibold text-[var(--text-primary)]">{priority.area}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              <TrendingUp size={10} />
              behind by {priority.gap}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/**
 * The smallest number the track is allowed to represent.
 *
 * Scaling to the row's own largest value meant a site with one service page
 * drew a full-width bar, and three competitors with one page each looked like
 * a runaway lead over a customer with none. The proportion was right and the
 * impression was wrong. A floor keeps a small count looking small: one page
 * out of a five-wide track is a stub, which is what one page is.
 */
const MIN_SCALE = 5;

function ComparisonRowView({ row, you }: { row: ComparisonRow; you: string }) {
  const values = [row.you, ...row.competitors.map((c) => c.value)].filter(
    (v): v is number => v != null,
  );
  const max = values.length ? Math.max(...values) : 0;
  // Still this row's own scale — a shared one across rows would flatten a row
  // of small counts against one of large ones — but never below the floor.
  const scale = Math.max(max, MIN_SCALE);
  // Nothing measured above zero means there is no shape to draw. Four
  // full-width empty tracks read as bars still loading, not as four zeros.
  const drawBars = max > 0;
  const behind = row.aheadOfYou.length > 0;

  return (
    <div className="border-t border-[var(--border-color)] pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">{row.label}</h4>
          {/* On a count of problems the longest bar is the worst result, and
              the customer's is drawn in their own accent like every other row
              — colour marks whose bar it is, never whether it is good news.
              Without this the reader has to infer the direction from the
              sentence underneath, which is where "6 broken URLs" looked like
              a lead. */}
          {!row.higherIsBetter && (
            <span className="text-[10.5px] font-medium text-[var(--text-muted)]">fewer is better</span>
          )}
        </div>
        {behind ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            <AlertTriangle size={10} />
            {/* The same number and the same meaning as "Where to start" above.
                This badge used to count competitors ahead while that one
                counted pages, so "3 ahead of you" and "behind by 1" described
                one situation two ways on one screen. */}
            behind by {row.gapToBest ?? row.aheadOfYou.length}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
            <CheckCircle2 size={10} />
            no gap
          </span>
        )}
      </div>

      <p className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--text-muted)]">{row.whatItMeans}</p>

      <div className="mt-2">
        <Bar label={you} value={row.you} scale={scale} drawBars={drawBars} isYou />
        {row.competitors.map((competitor) => (
          <Bar
            key={competitor.id}
            label={competitor.name}
            value={competitor.value}
            scale={scale}
            drawBars={drawBars}
          />
        ))}
      </div>

      <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--text-secondary)]">{row.verdict}</p>
    </div>
  );
}

/**
 * One entity's value.
 *
 * A null draws no bar and reads "not crawled": a zero-width bar would be taken
 * for a measured zero, which is the one thing this must never imply.
 *
 * The customer's row carries the one data hue and a dot; every competitor is
 * de-emphasis gray. Identity is never colour alone — the row is named, marked
 * "(you)", and set in bold — so the dot survives a colourblind reader, a
 * screenshot in grayscale, and a row with no bar to colour at all.
 */
function Bar({
  label,
  value,
  scale,
  drawBars,
  isYou,
}: {
  label: string;
  value: number | null;
  scale: number;
  drawBars: boolean;
  isYou?: boolean;
}) {
  const pct = value == null ? 0 : (value / scale) * 100;

  return (
    <div
      className={`flex items-center gap-2 rounded px-1.5 py-[3px] ${
        isYou ? "bg-[var(--cmp-you-tint)]" : ""
      }`}
      title={value == null ? `${label}: not crawled` : `${label}: ${value}`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: isYou ? "var(--cmp-you)" : CONTEXT }}
      />

      <span
        className={`w-32 shrink-0 truncate text-[11.5px] sm:w-44 ${
          isYou ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
        }`}
        title={label}
      >
        {isYou ? `${label} (you)` : label}
      </span>

      {drawBars && (
        <div className="relative hidden h-2 flex-1 rounded-full bg-[var(--surface-2)] sm:block">
          {value != null && value > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              // A nonzero count always leaves a visible mark, but never one so
              // wide it reads as a bigger number than it is.
              style={{
                width: `${Math.min(100, Math.max(pct, 3))}%`,
                background: isYou ? "var(--cmp-you)" : CONTEXT,
              }}
            />
          )}
        </div>
      )}

      <span
        className={`shrink-0 text-right text-[11.5px] tabular-nums ${
          drawBars ? "w-20" : "ml-auto w-24"
        } ${value == null ? "text-[var(--text-muted)]" : "font-semibold text-[var(--text-primary)]"}`}
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
