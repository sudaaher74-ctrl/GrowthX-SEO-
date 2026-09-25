"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, FileSpreadsheet, FileText, Loader2, Printer, Sparkles } from "lucide-react";
import { ActionButton, Panel, Pill, relativeTime } from "@/components/ui/console";
import { api, type CompetitorIntelReport, type IntelReportProblem } from "@/lib/api-client";
import { download, reportFilename, themeColours, toCsv, toMarkdown, toPrintableHtml } from "@/lib/competitor-report";

const SEVERITY_TONE: Record<IntelReportProblem["severity"], "bad" | "warn" | "info" | "default"> = {
  critical: "bad",
  high: "warn",
  medium: "info",
  low: "default",
};

/**
 * The end of the Competitor Intelligence flow: one report, written by Sarvam
 * from the crawl facts, that can be read here and taken away.
 */
export function CompetitorReportTab({ projectId, rivalCount }: { projectId: string; rivalCount: number }) {
  // A query rather than a mutation so the report survives switching tabs.
  // Never fetched on its own: each run spends model tokens.
  const report = useQuery({
    queryKey: ["competitor-intel-report", projectId],
    queryFn: () => api.generateCompetitorIntelReport(projectId),
    enabled: false,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
  const data = report.data;

  const printReport = (r: CompetitorIntelReport) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(toPrintableHtml(r, themeColours()));
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Full competitor report"
        subtitle={`Your site and ${rivalCount} rival${rivalCount === 1 ? "" : "s"}: every problem the crawls found, how to fix it, and a 4-week plan. Written by Sarvam 105B from measured data only.`}
        actions={
          <ActionButton
            variant="primary"
            icon={report.isFetching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            onClick={() => report.refetch()}
            disabled={report.isFetching || !projectId}
          >
            {report.isFetching ? "Writing report…" : data ? "Regenerate" : "Generate report"}
          </ActionButton>
        }
        padded
      >
        {report.isFetching ? (
          <p className="py-6 text-center text-[12px] text-brand-500">
            Sarvam is reading the crawl results for your site and {rivalCount} rival{rivalCount === 1 ? "" : "s"}. This can take up to a minute.
          </p>
        ) : report.error ? (
          <p className="py-4 text-center text-[12px] text-error-600">{(report.error as Error).message}</p>
        ) : !data ? (
          <p className="py-6 text-center text-[12px] text-brand-500">
            Press Generate report. You can then download it as a document, as a spreadsheet, or print it to PDF.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-brand-400">
              Generated {relativeTime(data.generatedAt)}
              {data.model ? ` · ${data.model}` : ""}
            </span>
            <span className="ml-auto flex flex-wrap gap-2">
              <ActionButton icon={<FileText size={13} />} onClick={() => download(reportFilename(data, "md"), toMarkdown(data), "text/markdown")}>
                Report (.md)
              </ActionButton>
              <ActionButton icon={<FileSpreadsheet size={13} />} onClick={() => download(reportFilename(data, "csv"), toCsv(data), "text/csv")}>
                Data (.csv)
              </ActionButton>
              <ActionButton icon={<Printer size={13} />} onClick={() => printReport(data)}>
                Print / PDF
              </ActionButton>
            </span>
          </div>
        )}
      </Panel>

      {data && !data.analysis && (
        <Panel padded>
          <p className="text-[12px] text-warning-600">
            {data.analysisError ?? "The analysis could not be written."} The crawl facts below are complete and can still be
            downloaded.
          </p>
        </Panel>
      )}

      {data?.analysis && (
        <>
          <Panel title="Summary" padded>
            <p className="text-[13px] leading-relaxed text-brand-950">{data.analysis.executiveSummary || "No summary returned."}</p>
          </Panel>

          <Panel title={`Problems and how to fix them (${data.analysis.problems.length})`} subtitle="Worst first" padded>
            <ol className="space-y-3">
              {data.analysis.problems.map((p, i) => (
                <li key={`${p.title}-${i}`} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-brand-400">{i + 1}</span>
                    <p className="text-[13px] font-semibold text-brand-950">{p.title}</p>
                    <Pill tone={SEVERITY_TONE[p.severity]}>{p.severity}</Pill>
                    <Pill>{p.where}</Pill>
                    <span className="ml-auto text-[11px] text-brand-400">Effort: {p.effort}</span>
                  </div>
                  {p.evidence && (
                    <p className="mt-2 text-[12px] text-brand-600">
                      <span className="font-semibold text-brand-950">Evidence: </span>
                      {p.evidence}
                    </p>
                  )}
                  {p.whyItMatters && (
                    <p className="mt-1 text-[12px] text-brand-600">
                      <span className="font-semibold text-brand-950">Why it matters: </span>
                      {p.whyItMatters}
                    </p>
                  )}
                  {p.fix.length > 0 && (
                    <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-950">
                      {p.fix.map((f, n) => (
                        <li key={n}>{f}</li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ol>
          </Panel>

          {data.analysis.competitorInsights.length > 0 && (
            <Panel title="Rival by rival" padded>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.analysis.competitorInsights.map((c) => (
                  <div key={c.competitor} className="rounded-xl border p-4">
                    <p className="text-[13px] font-semibold text-brand-950">{c.competitor}</p>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-400">They lead on</p>
                    <ul className="mt-1 list-disc pl-5 text-[12px] text-brand-600">
                      {c.theyLead.length ? c.theyLead.map((t) => <li key={t}>{t}</li>) : <li>Nothing measured</li>}
                    </ul>
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-400">You lead on</p>
                    <ul className="mt-1 list-disc pl-5 text-[12px] text-brand-600">
                      {c.youLead.length ? c.youLead.map((t) => <li key={t}>{t}</li>) : <li>Nothing measured</li>}
                    </ul>
                    {c.copyThis && (
                      <p className="mt-2 text-[12px] text-brand-950">
                        <span className="font-semibold">Worth copying: </span>
                        {c.copyThis}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {data.analysis.plan.length > 0 && (
            <Panel title="4-week plan" padded>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {data.analysis.plan.map((w) => (
                  <div key={w.week} className="rounded-xl border bg-brand-50 p-3">
                    <p className="text-[12px] font-semibold text-brand-950">{w.week}</p>
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] text-brand-600">
                      {w.actions.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {data.analysis.dataGaps.length > 0 && (
            <Panel title="Not measured yet" padded>
              <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
                {data.analysis.dataGaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      {data && (
        <Panel title="Crawl facts behind this report" subtitle="What the analysis was given. Included in both downloads.">
          <div className="divide-y">
            {[...(data.facts.you ? [{ ...data.facts.you, you: true }] : []), ...data.facts.rivals.map((r) => ({ ...r, you: false }))].map((s) => (
              <details key={s.domain} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                  <span className="text-[12.5px] font-semibold text-brand-950">
                    {s.you ? "You · " : ""}
                    {s.name}
                  </span>
                  <span className="text-[11px] text-brand-400">{s.domain}</span>
                  <span className="ml-auto text-[11px] text-brand-500">
                    {s.pagesCrawled != null ? `${s.pagesCrawled} pages` : "not crawled"} ·{" "}
                    {s.healthScore != null ? `health ${s.healthScore}/100` : "health not measured"} · {s.issues.length} issue types
                  </span>
                  <ChevronDown size={13} className="text-brand-400 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {s.issues.length === 0 && <li className="text-[12px] text-brand-500">No open issues recorded.</li>}
                  {s.issues.map((i) => (
                    <li key={`${i.severity}-${i.issueType}`} className="text-[12px] text-brand-600">
                      <Pill tone={i.severity === "CRITICAL" ? "bad" : i.severity === "HIGH" ? "warn" : "default"}>
                        {i.severity.toLowerCase()}
                      </Pill>{" "}
                      <span className="font-semibold text-brand-950">{i.issueType.replace(/_/g, " ").toLowerCase()}</span> on {i.pages} page
                      {i.pages === 1 ? "" : "s"}: {i.recommendation}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
