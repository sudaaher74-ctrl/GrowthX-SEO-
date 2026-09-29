"use client";
import { ReportGap, ReportKpis, ReportLoading, ReportPage, ReportSection, ReportText, useReportContext } from "@/components/reports/report-kit";
import { useFindings } from "@/hooks/use-growthx";
import type { GrowthOpportunity } from "@/lib/api-client";
import { count } from "@/lib/google-format";

const GROUPS: { label: string; sources: string[] }[] = [
  { label: "Website Audit", sources: ["WEBSITE"] },
  { label: "Google", sources: ["SEARCH_CONSOLE", "ANALYTICS"] },
  { label: "Competitors", sources: ["COMPETITOR"] },
  { label: "AI Visibility & market", sources: ["MARKET"] },
  { label: "Business Profile", sources: ["LOCAL"] },
];

function Finding({ f }: { f: GrowthOpportunity }) {
  return (
    <li className="report-section">
      <ReportText><strong>{f.title}</strong> <span className="text-brand-400">({f.potential.toLowerCase()} impact, {f.effort.toLowerCase()} effort)</span></ReportText>
      <p className="mt-0.5 text-[12px] text-brand-600">{f.summary}</p>
      {f.evidence.length > 0 && (
        <p className="mt-0.5 text-[11px] text-brand-500">Evidence: {f.evidence.map((e) => `${e.label}: ${e.value}`).join("; ")}</p>
      )}
      <p className="mt-0.5 text-[12px] text-brand-950"><strong>What to do:</strong> {f.recommendedAction}</p>
      {(f.affectedPages ?? []).length > 0 && (
        <p className="mt-0.5 truncate font-mono text-[10.5px] text-brand-400">
          {f.affectedCount ?? f.affectedPages.length} pages: {f.affectedPages.slice(0, 3).join(", ")}
        </p>
      )}
    </li>
  );
}

/**
 * Everything found across the workflow, in one document: the complete picture
 * and improvement plan. It is built from the same findings the Fix Engine
 * shows, so it works whether or not any fix is ever applied.
 */
export function PlanReport() {
  const { projectId, clientName, domain } = useReportContext();
  const findings = useFindings(projectId, { limit: 200 });
  if (!projectId || findings.isLoading) return <ReportLoading what="the improvement plan" />;

  const items = (findings.data?.items ?? []).filter((f) => !["DISMISSED", "RESOLVED"].includes(f.lifecycle ?? "DETECTED"));
  const ordered = [...items].sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0));

  return (
    <ReportPage
      title="Complete improvement plan"
      clientName={clientName}
      domain={domain}
      intro="Every problem and opportunity found across your website audit, Google data, competitors, AI visibility and Business Profile, ranked by impact, each with the evidence and what to do."
    >
      <ReportSection title="Summary">
        <ReportKpis items={[
          { label: "Open findings", value: count(items.length) },
          { label: "High impact", value: count(items.filter((i) => i.potential === "HIGH").length) },
          { label: "Low-risk fixes", value: count(items.filter((i) => i.fixClass === "AUTO").length), sub: "can be prepared for approval" },
          { label: "Need a person", value: count(items.filter((i) => i.fixClass === "MANUAL").length), sub: "content, or a developer" },
        ]} />
        <ReportText>
          {items.length === 0
            ? "No open findings. Either everything found has been dealt with, or the tabs do not have data yet."
            : `${items.length} open findings. ${items.filter((i) => i.potential === "HIGH").length} are high impact.`}
        </ReportText>
      </ReportSection>

      {items.length === 0 ? (
        <ReportGap>Nothing to list. Complete the earlier steps and refresh the plan on the Fix Engine page.</ReportGap>
      ) : (
        GROUPS.map((g) => {
          const list = ordered.filter((i) => g.sources.includes(i.source));
          return (
            <ReportSection key={g.label} title={`${g.label} (${list.length})`}>
              {list.length === 0 ? <ReportText>Nothing open here.</ReportText> : <ul className="space-y-3">{list.map((f) => <Finding key={f.id} f={f} />)}</ul>}
            </ReportSection>
          );
        })
      )}
    </ReportPage>
  );
}
