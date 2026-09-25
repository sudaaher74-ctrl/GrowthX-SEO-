"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, FileSpreadsheet, FileText, Loader2, Printer, Sparkles, X } from "lucide-react";
import { ActionButton, Panel, Pill, relativeTime } from "@/components/ui/console";
import { api, type WebsiteAuditReport } from "@/lib/api-client";
import { auditReportFilename, auditToCsv, auditToMarkdown, pageRows, severityWord } from "@/lib/audit-report";
import { download, markdownToPrintableHtml, themeColours } from "@/lib/competitor-report";

const PRIORITY_TONE = { high: "bad", medium: "warn", low: "default" } as const;

/**
 * The whole Website Audit as one report a business owner can read: what is
 * wrong, why it matters, how to fix it and who can, written by Sarvam from
 * the crawl, and downloadable.
 */
export function AuditReportTab({ projectId }: { projectId: string }) {
  // A query rather than a mutation so the report survives switching tabs.
  // Never fetched on its own: each run spends model tokens.
  const report = useQuery({
    queryKey: ["audit-report", projectId],
    queryFn: () => api.generateAuditReport(projectId),
    enabled: false,
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: false,
  });
  const saved = useQuery({
    queryKey: ["audit-report-latest", projectId],
    queryFn: () => api.getLatestAuditReport(projectId),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
    retry: false,
  });
  const data: WebsiteAuditReport | undefined = report.data ?? saved.data ?? undefined;

  const printReport = (r: WebsiteAuditReport) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(markdownToPrintableHtml(auditToMarkdown(r), auditReportFilename(r, "pdf"), themeColours()));
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Full website report"
        subtitle="Everything the audit found, in plain words: what's wrong, why it matters, how to fix it and whether you can do it yourself. Written by Sarvam 105B from your website's real data."
        actions={
          <ActionButton
            variant="primary"
            icon={report.isFetching ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            onClick={() => report.refetch()}
            disabled={report.isFetching || !projectId}
          >
            {report.isFetching ? "Writing report…" : data ? "Write a new report" : "Write my report"}
          </ActionButton>
        }
        padded
      >
        {report.isFetching ? (
          <p className="py-6 text-center text-[12px] text-brand-500">Sarvam is reading your audit. This can take up to a minute.</p>
        ) : report.error ? (
          <p className="py-4 text-center text-[12px] text-error-600">{(report.error as Error).message}</p>
        ) : !data ? (
          <p className="py-6 text-center text-[12px] text-brand-500">
            Press &quot;Write my report&quot;. You can then download it as a document or a spreadsheet, or print it to PDF.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-brand-400">
              Written {relativeTime(data.generatedAt)}
              {data.model ? ` · ${data.model}` : ""}
            </span>
            <span className="ml-auto flex flex-wrap gap-2">
              <ActionButton icon={<FileText size={13} />} onClick={() => download(auditReportFilename(data, "md"), auditToMarkdown(data), "text/markdown")}>
                Report (.md)
              </ActionButton>
              <ActionButton icon={<FileSpreadsheet size={13} />} onClick={() => download(auditReportFilename(data, "csv"), auditToCsv(data), "text/csv")}>
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
            {data.analysisError ?? "The written report could not be made."} The measured facts below are complete and can still be downloaded.
          </p>
        </Panel>
      )}

      {data?.analysis && (
        <>
          <Panel title="Summary" padded>
            <p className="text-[13px] leading-relaxed text-brand-950">{data.analysis.summary || "No summary returned."}</p>
            {data.analysis.scoreExplained && (
              <p className="mt-2 text-[12px] text-brand-600">
                <span className="font-semibold text-brand-950">Your health score{data.facts.site?.healthScore != null ? ` (${data.facts.site.healthScore}/100)` : ""}: </span>
                {data.analysis.scoreExplained}
              </p>
            )}
          </Panel>

          {data.analysis.quickWins.length > 0 && (
            <Panel title="Quick wins" subtitle="Things you can do today, in under an hour" padded>
              <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-brand-950">
                {data.analysis.quickWins.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title={`What to fix (${data.analysis.fixes.length})`} subtitle="Most important first" padded>
            <ol className="space-y-3">
              {data.analysis.fixes.map((f, i) => (
                <li key={`${f.title}-${i}`} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-brand-400">{i + 1}</span>
                    <p className="text-[13px] font-semibold text-brand-950">{f.title}</p>
                    <Pill tone={PRIORITY_TONE[f.priority]}>{f.priority}</Pill>
                    <Pill tone={f.whoCanFix === "you" ? "good" : "info"}>{f.whoCanFix === "you" ? "You can fix this" : "Needs your web developer"}</Pill>
                    <span className="ml-auto text-[11px] text-brand-400">
                      {f.pages ? `${f.pages} page${f.pages === 1 ? "" : "s"} · ` : ""}Effort: {f.effort}
                    </span>
                  </div>
                  {f.whatIsWrong && (
                    <p className="mt-2 text-[12px] text-brand-600">
                      <span className="font-semibold text-brand-950">What&apos;s wrong: </span>
                      {f.whatIsWrong}
                    </p>
                  )}
                  {f.whyItMatters && (
                    <p className="mt-1 text-[12px] text-brand-600">
                      <span className="font-semibold text-brand-950">Why it matters: </span>
                      {f.whyItMatters}
                    </p>
                  )}
                  {f.steps.length > 0 && (
                    <>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-400">How to fix it</p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-950">
                        {f.steps.map((s, n) => (
                          <li key={n}>{s}</li>
                        ))}
                      </ol>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {data.analysis.whatIsGood.length > 0 && (
              <Panel title="What's already good" padded>
                <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
                  {data.analysis.whatIsGood.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
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
          </div>

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
        </>
      )}

      {data && (
        <Panel title="Your pages, measured" subtitle="Counted from the latest read of your website. Included in both downloads.">
          <div className="divide-y">
            {pageRows(data).map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-4 py-2 text-[12px]">
                <span className="w-4">
                  {r.ok == null ? null : r.ok ? <Check size={13} className="text-success-600" /> : <X size={13} className="text-error-600" />}
                </span>
                <span className="flex-1 text-brand-600">{r.label}</span>
                <span className="font-semibold text-brand-950">{r.value}</span>
              </div>
            ))}
            {pageRows(data).length === 0 && <p className="px-4 py-3 text-[12px] text-brand-500">Your website hasn&apos;t been read yet.</p>}
          </div>
        </Panel>
      )}

      {data && data.facts.problems.length > 0 && (
        <Panel title={`Every problem found (${data.facts.problems.length + data.facts.moreProblems})`} subtitle="Open one to see why it matters, what to do and example pages">
          <div className="divide-y">
            {data.facts.problems.map((p) => (
              <details key={p.issueType + p.title} className="group px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <Pill tone={p.severity === "CRITICAL" ? "bad" : p.severity === "HIGH" ? "warn" : "default"}>{severityWord(p.severity)}</Pill>
                  <span className="flex-1 text-[12.5px] font-semibold text-brand-950">{p.title}</span>
                  <ChevronDown size={13} className="text-brand-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-2 space-y-1 text-[12px] text-brand-600">
                  <p>
                    <span className="font-semibold text-brand-950">Why it matters: </span>
                    {p.why}
                  </p>
                  <p>
                    <span className="font-semibold text-brand-950">What to do: </span>
                    {p.action}
                  </p>
                  {p.exampleUrls.length > 0 && (
                    <ul className="list-disc pl-5 text-[11.5px] text-brand-500">
                      {p.exampleUrls.map((u) => (
                        <li key={u}>
                          {/^https?:\/\//.test(u) ? (
                            <a href={u} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              {u}
                            </a>
                          ) : (
                            u
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            ))}
            {data.facts.moreProblems > 0 && (
              <p className="px-4 py-3 text-[11.5px] text-brand-400">…and {data.facts.moreProblems} smaller problems, listed in the Problems to fix tab.</p>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}
