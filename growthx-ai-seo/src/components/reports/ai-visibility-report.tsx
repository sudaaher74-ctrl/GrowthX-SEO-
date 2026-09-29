"use client";
import { useQuery } from "@tanstack/react-query";
import { ReportGap, ReportKpis, ReportLoading, ReportPage, ReportSection, ReportTable, ReportText, useReportContext } from "@/components/reports/report-kit";
import { useVisibility } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { assistantLabel, assistantList } from "@/lib/ai-assistants";
import { DASH, count } from "@/lib/google-format";

/** How AI assistants describe and recommend the business, and the plan to improve it. */
export function AiVisibilityReport() {
  const { projectId, clientName, domain } = useReportContext();
  const visibility = useVisibility(projectId);
  const insights = useQuery({
    queryKey: ["visibility-insights", projectId],
    queryFn: () => api.getVisibilityInsights(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  if (!projectId || visibility.isLoading) return <ReportLoading what="the AI Visibility report" />;
  const v = visibility.data;
  const ins = insights.data;
  const asked = assistantList(v?.measurableAssistants);
  const pct = (n: number | null | undefined) => (n == null ? DASH : `${Math.round(n * 10) / 10}%`);

  return (
    <ReportPage
      title="AI Visibility report"
      clientName={clientName}
      domain={domain}
      intro="Whether AI assistants name your business when people ask the questions your customers ask, how you compare with competitors, and what to change. Only assistants that were actually asked are counted; one that could not be asked is not shown as zero."
    >
      {!v || v.summary.checked === 0 ? (
        <ReportSection title="At a glance">
          <ReportGap>No AI assistant has been asked about your business yet, so there is nothing to report. Run a check on the AI Visibility tab first.</ReportGap>
        </ReportSection>
      ) : (
        <>
          <ReportSection title="At a glance" note={`Assistants asked: ${asked}.`}>
            <ReportKpis items={[
              { label: "Answers checked", value: count(v.summary.checked) },
              { label: "Named you", value: count(v.summary.cited) },
              { label: "Share of answers", value: pct(v.summary.citationSharePct), sub: v.summary.deltaPt == null ? undefined : `${v.summary.deltaPt >= 0 ? "+" : "−"}${Math.abs(v.summary.deltaPt)} pts vs before` },
              { label: "Average position", value: v.summary.averagePosition == null ? DASH : v.summary.averagePosition.toFixed(1) },
            ]} />
          </ReportSection>

          <ReportSection title="By assistant">
            <ReportTable
              columns={[{ label: "Assistant" }, { label: "Answers checked", right: true }, { label: "Named you", right: true }, { label: "Share", right: true }]}
              rows={v.byAssistant.map((a) => [assistantLabel(a.assistant), count(a.checked), count(a.cited), pct(a.citationSharePct)])}
              empty="No assistant has been asked."
            />
          </ReportSection>

          <ReportSection title="Compared with competitors" note="Share of the brand mentions in the answers checked.">
            <ReportTable
              columns={[{ label: "Brand" }, { label: "Mentions", right: true }, { label: "Share", right: true }]}
              rows={v.shareOfVoice.map((s) => [s.label, count(s.mentions), pct(s.sharePct)])}
              empty="No competitor was mentioned."
            />
          </ReportSection>
        </>
      )}

      <ReportSection title="What to do about it">
        {!ins || ins.status !== "READY" ? (
          <ReportGap>The improvement analysis has not been generated yet. It is written only from measured answers, so run a check first.</ReportGap>
        ) : (
          <div className="space-y-3">
            {ins.summary && <ReportText>{ins.summary}</ReportText>}
            {ins.findings.length > 0 && (
              <ul className="space-y-1.5">
                {ins.findings.map((f) => (
                  <li key={f.title}><ReportText><strong>{f.title}.</strong> {f.detail} <span className="text-brand-400">({f.evidence})</span></ReportText></li>
                ))}
              </ul>
            )}
            <ReportTable
              columns={[{ label: "Recommendation" }, { label: "Impact" }, { label: "Effort" }, { label: "Why" }]}
              rows={ins.recommendations.map((r) => [r.title, r.priority.toLowerCase(), r.effort.toLowerCase(), r.rationale])}
              empty="No recommendations."
            />
          </div>
        )}
      </ReportSection>
    </ReportPage>
  );
}
