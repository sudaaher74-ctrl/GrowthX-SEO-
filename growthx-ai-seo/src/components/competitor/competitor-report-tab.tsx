"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ExternalLink, FileSpreadsheet, FileText, Loader2, Printer, Sparkles } from "lucide-react";
import { ActionButton, Panel, Pill, relativeTime } from "@/components/ui/console";
import { api, type CompetitorIntelReport, type IntelPriority, type IntelReportRival } from "@/lib/api-client";
import {
  aiMentionText,
  download,
  reportFilename,
  reviewText,
  themeColours,
  toCsv,
  toMarkdown,
  toPrintableHtml,
} from "@/lib/competitor-report";

const PRIORITY_TONE: Record<IntelPriority, "bad" | "warn" | "default"> = { high: "bad", medium: "warn", low: "default" };

/**
 * The end of the Competitor Intelligence flow: why each rival ranks and what
 * they have that you do not, written by Sarvam from everything the other tabs
 * measured, to read here and take away.
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
  // The last report written, by the autopilot or an earlier Generate, so it
  // is here after a reload without spending model tokens again.
  const saved = useQuery({
    queryKey: ["competitor-report-latest", projectId],
    queryFn: () => api.getLatestCompetitorReport(projectId),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
    retry: false,
  });
  const data = report.data ?? saved.data ?? undefined;

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
        subtitle={`Why your ${rivalCount} rival${rivalCount === 1 ? "" : "s"} rank, what they have that you don't (topics, page types, structured data, depth, AI answers, reviews), how to beat them, and a 4-week plan. Written by Sarvam 105B from measured data only.`}
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
            Sarvam is comparing your site with {rivalCount} rival{rivalCount === 1 ? "" : "s"}. This can take up to a minute.
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
            {data.analysisError ?? "The analysis could not be written."} The measured facts below are complete and can still be
            downloaded.
          </p>
        </Panel>
      )}

      {data?.analysis && (
        <>
          <Panel title="Summary" padded>
            <p className="text-[13px] leading-relaxed text-brand-950">{data.analysis.executiveSummary || "No summary returned."}</p>
          </Panel>

          {data.analysis.whyTheyRank.length > 0 && (
            <Panel title="Why they rank" subtitle="Inferred from what each rival's site has; actual positions need Search Console" padded>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.analysis.whyTheyRank.map((c) => (
                  <div key={c.competitor} className="rounded-xl border p-4">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-brand-950">{c.competitor}</p>
                      <span className="ml-auto">
                        <Pill tone={PRIORITY_TONE[c.threat]}>{c.threat} threat</Pill>
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {c.reasons.map((x) => (
                        <li key={x.factor} className="text-[12px] text-brand-600">
                          <span className="font-semibold text-brand-950">{x.factor}</span>
                          {x.evidence ? `: ${x.evidence}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title={`What they have that you don't (${data.analysis.gaps.length})`} subtitle="Highest priority first" padded>
            {data.analysis.gaps.length === 0 && <p className="text-[12px] text-brand-500">No gaps returned.</p>}
            <ol className="space-y-3">
              {data.analysis.gaps.map((g, i) => (
                <li key={`${g.title}-${i}`} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-brand-400">{i + 1}</span>
                    <p className="text-[13px] font-semibold text-brand-950">{g.title}</p>
                    <Pill tone={PRIORITY_TONE[g.priority]}>{g.priority}</Pill>
                    {g.rivals.map((r) => (
                      <Pill key={r}>{r}</Pill>
                    ))}
                    <span className="ml-auto text-[11px] text-brand-400">Effort: {g.effort}</span>
                  </div>
                  {g.evidence && (
                    <p className="mt-2 text-[12px] text-brand-600">
                      <span className="font-semibold text-brand-950">Evidence: </span>
                      {g.evidence}
                    </p>
                  )}
                  {g.whyItHelpsThemRank && (
                    <p className="mt-1 text-[12px] text-brand-600">
                      <span className="font-semibold text-brand-950">Why it helps them rank: </span>
                      {g.whyItHelpsThemRank}
                    </p>
                  )}
                  {g.howToBeatIt.length > 0 && (
                    <>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-brand-400">How to beat it</p>
                      <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-[12px] text-brand-950">
                        {g.howToBeatIt.map((f, n) => (
                          <li key={n}>{f}</li>
                        ))}
                      </ol>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </Panel>

          {data.analysis.whereYouLead.length > 0 && (
            <Panel title="Where you lead" padded>
              <ul className="list-disc space-y-0.5 pl-5 text-[12px] text-brand-600">
                {data.analysis.whereYouLead.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
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
        <Panel
          title="What each rival has, measured"
          subtitle="Counted from both crawls, the AI answer checks and Google listings. Included in both downloads."
        >
          <div className="divide-y">
            {data.facts.rivals.map((r) => (
              <RivalFacts key={r.domain} rival={r} asked={data.facts.aiAnswers.asked} namedYou={data.facts.aiAnswers.namedYou} />
            ))}
            {data.facts.rivals.length === 0 && <p className="px-4 py-3 text-[12px] text-brand-500">No rivals tracked yet.</p>}
          </div>
        </Panel>
      )}
    </div>
  );
}

function Row({ label, you, them }: { label: string; you: React.ReactNode; them: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 border-b py-1 text-[12px] last:border-b-0">
      <span className="text-brand-600">{label}</span>
      <span className="text-brand-950">{you}</span>
      <span className="font-semibold text-brand-950">{them}</span>
    </div>
  );
}

function RivalFacts({ rival: r, asked, namedYou }: { rival: IntelReportRival; asked: number; namedYou: number }) {
  const a = r.advantages;
  return (
    <details className="group px-4 py-3">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
        <span className="text-[12.5px] font-semibold text-brand-950">{r.name}</span>
        <span className="text-[11px] text-brand-400">{r.domain}</span>
        <span className="ml-auto text-[11px] text-brand-500">
          {a ? `${a.missingTopicsTotal} topics you don't cover` : "needs a crawl of both sites"} · AI: {aiMentionText(r, asked)}
        </span>
        <ChevronDown size={13} className="text-brand-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">
            <span>Measure</span>
            <span>You</span>
            <span>Them</span>
          </div>
          <Row label="Named in AI answers" you={asked ? `${namedYou} of ${asked}` : "—"} them={r.aiMentions ?? "—"} />
          <Row label="Google reviews" you="—" them={reviewText(r)} />
          {a && (
            <>
              {a.pageTypes.map((t) => (
                <Row key={t.pageType} label={t.label} you={t.you} them={t.them} />
              ))}
              {a.schema.map((s) => (
                <Row key={s.type} label={`${s.type.toLowerCase()} structured data`} you={s.you} them={s.them} />
              ))}
              <Row label="Median words per page" you={a.depth.yourMedianWords ?? "—"} them={a.depth.theirMedianWords ?? "—"} />
              <Row label="In-depth pages (1,000+ words)" you={a.depth.yourLongPages} them={a.depth.theirLongPages} />
              <Row label="Questions answered in headings" you={a.questions.yourCount} them={a.questions.theirCount} />
              <Row label="Topics only this side covers" you={a.yourUniqueTopicsTotal} them={a.missingTopicsTotal} />
            </>
          )}
          {r.comparison
            .filter((c) => !a?.pageTypes.some((t) => t.label === c.label))
            .map((c) => (
            <Row key={c.label} label={c.label} you={c.you ?? "—"} them={c.them ?? "—"} />
          ))}
        </div>
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">Their pages you have no match for</p>
          {!a ? (
            <p className="mt-1 text-[12px] text-brand-500">Crawl both sites to compare pages.</p>
          ) : a.missingTopics.length === 0 ? (
            <p className="mt-1 text-[12px] text-brand-500">None found. You cover every topic they have a page for.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {a.missingTopics.map((t) => (
                <li key={t.url} className="flex items-start gap-2 text-[12px]">
                  <a href={/^https?:\/\//.test(t.url) ? t.url : undefined} target="_blank" rel="noopener noreferrer" className="text-brand-950 hover:underline">
                    {t.title}
                  </a>
                  <ExternalLink size={11} className="mt-0.5 shrink-0 text-brand-400" />
                  <span className="ml-auto shrink-0 text-[11px] text-brand-400">{t.wordCount} words</span>
                </li>
              ))}
              {a.missingTopicsTotal > a.missingTopics.length && (
                <li className="text-[11px] text-brand-400">…and {a.missingTopicsTotal - a.missingTopics.length} more</li>
              )}
            </ul>
          )}
          {a && a.questions.theirs.length > 0 && (
            <>
              <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-wide text-brand-400">Questions they answer</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12px] text-brand-600">
                {a.questions.theirs.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </>
          )}
          {r.notes.length > 0 && <p className="mt-3 text-[11px] text-brand-400">{r.notes.join(" ")}</p>}
        </div>
      </div>
    </details>
  );
}
