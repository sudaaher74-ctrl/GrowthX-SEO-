"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, Info, Minus } from "lucide-react";
import { Panel } from "@/components/ui/console";
import { LoadingState, NoDataState, FailedState } from "@/components/ui/truthful-state";
import { api, CompetitorSeoReport, CompetitorSideBySide } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

/**
 * Everything the crawler found on one competitor's site, beside your own.
 *
 * Reads as an answer to one question — how good is their SEO, and where does
 * that leave us — so the score and its verdict come first, the row-by-row
 * comparison second, and the problems behind the score last.
 *
 * A figure that was not measured renders as an em dash with a reason, never as
 * a zero. On this page a zero would read as a perfect record, which for an
 * un-crawled competitor is the opposite of the truth.
 */

/** Slot 1 of the validated palette: the one data hue, used for the customer. */
const YOU = "#2a78d6";
/** De-emphasis for the competitor. Not a second series — a reference point. */
const THEM = "#898781";

const SEVERITY_STYLE: Record<string, { label: string; className: string }> = {
  CRITICAL: { label: "Critical", className: "bg-rose-50 text-rose-700 border-rose-200" },
  HIGH: { label: "High", className: "bg-amber-50 text-amber-700 border-amber-200" },
  MEDIUM: { label: "Medium", className: "bg-sky-50 text-sky-700 border-sky-200" },
  LOW: { label: "Low", className: "bg-brand-100 text-brand-600 border-brand-200" },
};

export function CompetitorSeoReportPanel({
  projectId,
  competitors,
}: {
  projectId: string;
  competitors: { id: string; label?: string | null; domain: string }[];
}) {
  const [selected, setSelected] = useState<string | null>(competitors[0]?.id ?? null);
  const competitorId = selected && competitors.some((c) => c.id === selected) ? selected : competitors[0]?.id;

  const query = useQuery({
    queryKey: ["competitor-seo-report", projectId, competitorId],
    queryFn: () => api.getCompetitorSeoReport(projectId, competitorId!),
    enabled: Boolean(projectId && competitorId),
  });

  if (competitors.length === 0) {
    return (
      <NoDataState
        title="No competitor is being tracked yet"
        missing="Nothing has been crawled, so there is no SEO quality to report."
        whyItMatters="This report is written entirely from a competitor's own crawl — their health score, the problems behind it, and what they publish."
        actionRequired="Add a competitor. Its first crawl starts within ten minutes."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {competitors.map((competitor) => (
          <button
            key={competitor.id}
            type="button"
            onClick={() => setSelected(competitor.id)}
            className={
              "rounded-lg border px-3 py-1.5 text-[12px] font-medium transition " +
              (competitor.id === competitorId
                ? "border-brand-950 bg-brand-950 text-white"
                : "border-[var(--border-color)] bg-white text-brand-700 hover:border-brand-400")
            }
          >
            {competitor.label || competitor.domain}
          </button>
        ))}
      </div>

      {query.isLoading && <LoadingState title="Reading the crawl" />}
      {query.isError && (
        <FailedState title="Report unavailable" error={errorMessage(query.error)} />
      )}
      {query.data && <Report report={query.data} />}
    </div>
  );
}

function Report({ report }: { report: CompetitorSeoReport }) {
  const { competitor, crawl } = report;

  return (
    <div className="space-y-4">
      <Panel title={`${competitor.name} — SEO quality`} subtitle={competitor.domain}>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <Score label="Their health score" value={crawl.healthScore} color={THEM} />
            <Score
              label="Pages crawled"
              value={crawl.pagesCrawled}
              suffix=""
              color={THEM}
              outOf={null}
            />
            <div className="text-[11.5px] text-brand-500">
              {crawl.crawledAt
                ? `Crawled ${new Date(crawl.crawledAt).toLocaleDateString()}`
                : "Not crawled yet"}
            </div>
          </div>

          <p className="text-[13px] leading-relaxed text-brand-700">{crawl.verdict}</p>

          {report.notes.map((note) => (
            <div
              key={note}
              className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-[12px] text-sky-900"
            >
              <Info size={14} className="mt-0.5 shrink-0" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Them against you"
        subtitle="Counted from pages the crawler actually fetched. A figure that was not measured shows as — , never as zero."
      >
        <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
          {report.comparison.map((row) => (
            <ComparisonRow key={row.label} row={row} />
          ))}
        </div>
      </Panel>

      {report.coverage.length > 0 && (
        <Panel title="What they publish" subtitle="Their pages by kind, largest group first">
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.coverage.map((entry) => (
              <div
                key={entry.pageType}
                className="rounded-lg border p-3"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-brand-600">{entry.label}</span>
                  <span className="font-mono text-[15px] font-bold text-brand-950">{entry.count}</span>
                </div>
                {entry.exampleUrl && (
                  <a
                    href={entry.exampleUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-700"
                  >
                    See one <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        title="What is wrong with their site"
        subtitle="Grouped by kind, worst first. One fix usually clears many pages at once — which is as true of your site as of theirs."
      >
        {report.issues.length === 0 ? (
          <div className="p-4 text-[12.5px] text-brand-500">
            {crawl.crawledAt
              ? "The crawl found no open problems on this site."
              : "This site has not been crawled, so nothing has been checked."}
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
            {report.issues.map((issue) => {
              const style = SEVERITY_STYLE[issue.severity] ?? SEVERITY_STYLE.LOW;
              return (
                <div key={`${issue.severity}-${issue.issueType}`} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.className}`}
                    >
                      {style.label}
                    </span>
                    <span className="font-mono text-[12px] font-medium text-brand-950">
                      {issue.issueType}
                    </span>
                    <span className="text-[11.5px] text-brand-500">
                      {issue.pages} page{issue.pages === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-brand-700">{issue.description}</p>
                  {issue.exampleUrls.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                      {issue.exampleUrls.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-brand-400 hover:text-brand-700"
                        >
                          {url.replace(/^https?:\/\//, "").slice(0, 60)}
                          <ExternalLink size={10} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Score({
  label,
  value,
  color,
  suffix = " / 100",
  outOf = 100,
}: {
  label: string;
  value: number | null;
  color: string;
  suffix?: string;
  outOf?: number | null;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-brand-400">{label}</div>
      <div className="font-mono text-[24px] font-bold" style={{ color: value == null ? THEM : color }}>
        {value == null ? "—" : value.toLocaleString()}
        {value != null && outOf != null && (
          <span className="text-[13px] font-medium text-brand-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function ComparisonRow({ row }: { row: CompetitorSideBySide }) {
  const max = Math.max(row.them ?? 0, row.you ?? 0, 1);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium text-brand-950">{row.label}</span>
        <LeaderTag leader={row.leader} />
      </div>
      <p className="mt-0.5 text-[11.5px] text-brand-500">{row.whatItMeans}</p>

      <div className="mt-2.5 space-y-1.5">
        <Bar name="You" value={row.you} max={max} color={YOU} />
        <Bar name="Them" value={row.them} max={max} color={THEM} />
      </div>
    </div>
  );
}

/**
 * One bar, always direct-labelled.
 *
 * The number is next to the bar rather than only encoded in its length, so a
 * reader who cannot separate the two hues still gets every value.
 */
function Bar({
  name,
  value,
  max,
  color,
}: {
  name: string;
  value: number | null;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[11px] text-brand-400">{name}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-brand-100">
        {value != null && (
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, (value / max) * 100)}%`, backgroundColor: color }}
          />
        )}
      </div>
      <span className="w-14 shrink-0 text-right font-mono text-[12px] font-semibold text-brand-950">
        {value == null ? "—" : value.toLocaleString()}
      </span>
    </div>
  );
}

function LeaderTag({ leader }: { leader: CompetitorSideBySide["leader"] }) {
  if (leader === "unknown") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-brand-400">
        <Info size={11} /> Not measured on both sides
      </span>
    );
  }
  if (leader === "level") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-brand-500">
        <Minus size={11} /> Level
      </span>
    );
  }
  if (leader === "you") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 size={11} /> You lead
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
      <AlertTriangle size={11} /> They lead
    </span>
  );
}
