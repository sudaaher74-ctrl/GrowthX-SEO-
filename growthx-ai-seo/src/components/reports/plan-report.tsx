"use client";

import { useMemo } from "react";
import {
  ReportGap,
  ReportKpis,
  ReportLoading,
  ReportPage,
  ReportSection,
  ReportText,
  useReportContext,
} from "@/components/reports/report-kit";
import { ImplementationHandoffPanel } from "@/components/reports/implementation-handoff-panel";
import { useFindings } from "@/hooks/use-growthx";
import type { GrowthOpportunity } from "@/lib/api-client";
import { count } from "@/lib/google-format";
import { errorMessage } from "@/lib/error-message";
import { PLAN_SOURCES } from "@/lib/plan-sources";
import { downloadCsvFile } from "@/lib/report-csv";
import {
  buildPlanImplementationSpecs,
  formatSpecsDocument,
} from "@/lib/implementation-specs";

const GROUPS = PLAN_SOURCES;

function Finding({ f }: { f: GrowthOpportunity }) {
  return (
    <li className="report-section rounded-xl border border-brand-200/70 bg-surface-1 p-3.5">
      <ReportText>
        <strong>{f.title}</strong>{" "}
        <span className="text-brand-400">
          ({f.potential.toLowerCase()} impact · {f.effort.toLowerCase()} effort)
        </span>
      </ReportText>
      <p className="mt-0.5 text-[12px] text-brand-600">{f.summary}</p>
      {f.evidence.length > 0 && (
        <p className="mt-1 text-[11px] text-brand-500">
          <strong>Evidence:</strong> {f.evidence.map((e) => `${e.label}: ${e.value}`).join("; ")}
        </p>
      )}
      <p className="mt-1 whitespace-pre-line text-[12px] text-brand-950">
        <strong>What to do:</strong> {f.recommendedAction}
      </p>
      <p className="mt-1 text-[11px] text-brand-500">
        Status: {(f.lifecycle ?? "DETECTED").toLowerCase().replaceAll("_", " ")} ·{" "}
        {f.detailType === "REPORT_PLAN"
          ? "Saved recommendation; review before applying."
          : "Detected finding."}
      </p>
      {(f.affectedPages ?? []).length > 0 && (
        <p className="mt-1 truncate font-mono text-[10.5px] text-brand-400">
          {f.affectedCount ?? f.affectedPages.length} pages: {f.affectedPages.slice(0, 3).join(", ")}
        </p>
      )}
    </li>
  );
}

/**
 * Master Cross-Module Execution & Sprint Report.
 * Combines every verified finding across Website Audit, Traffic/Google, Competitors,
 * AI Visibility, and Backlinks into an executive priority matrix plus universal
 * stack-agnostic implementation briefs usable with or without Fix Engine.
 */
export function PlanReport() {
  const { projectId, clientName, domain } = useReportContext();
  const findings = useFindings(projectId, { limit: 200 });

  const openItems = useMemo(
    () =>
      (findings.data?.items ?? []).filter(
        (f) => !["DISMISSED", "RESOLVED"].includes(f.lifecycle ?? "DETECTED"),
      ),
    [findings.data?.items],
  );

  const ordered = useMemo(
    () => [...openItems].sort((a, b) => (b.impact ?? 0) - (a.impact ?? 0)),
    [openItems],
  );

  const specs = useMemo(
    () => buildPlanImplementationSpecs(ordered, domain),
    [ordered, domain],
  );

  if (!projectId || findings.isLoading) return <ReportLoading what="the improvement plan" />;
  if (findings.error || !findings.data) {
    return (
      <ReportPage
        title="Complete Improvement Plan"
        clientName={clientName}
        domain={domain}
        intro="Every problem and opportunity found across the workspace, ranked by impact."
      >
        <ReportGap>
          The plan is unavailable because its findings could not be loaded. {errorMessage(findings.error)}
        </ReportGap>
      </ReportPage>
    );
  }

  const quickWins = ordered.filter((i) => i.potential === "HIGH" && i.effort === "LOW");
  const strategic = ordered.filter((i) => i.potential === "HIGH" && i.effort !== "LOW");
  const verifiedCount = (findings.data.items ?? []).filter((i) =>
    ["VERIFIED", "MEASURED"].includes(i.lifecycle ?? ""),
  ).length;

  const handleDownloadCsv = () => {
    downloadCsvFile(`${domain || "website"}-improvement-plan.csv`, [
      {
        title: "Open SEO Improvement Plan",
        headers: [
          "Title",
          "Source",
          "Impact",
          "Effort",
          "Fix Class",
          "Lifecycle",
          "Recommended Action",
          "Affected Pages",
        ],
        rows: ordered.map((f) => [
          f.title,
          f.source,
          f.potential,
          f.effort,
          f.fixClass ?? "",
          f.lifecycle ?? "DETECTED",
          f.recommendedAction,
          (f.affectedPages ?? []).slice(0, 5).join(" | "),
        ]),
      },
    ]);
  };

  const handleDownloadMarkdown = () => {
    const md = formatSpecsDocument("Complete Improvement Plan", domain, specs);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${domain || "website"}-improvement-plan-handoff.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <ReportPage
      title="Complete Improvement Plan"
      clientName={clientName}
      domain={domain}
      intro="Master cross-module execution report combining Website Audit, Search Console & GA4, Competitors, AI Visibility, and Backlinks — ranked by impact with universal developer and content handoff briefs."
      onDownloadCsv={handleDownloadCsv}
      onDownloadMarkdown={specs.length > 0 ? handleDownloadMarkdown : undefined}
    >
      <ReportSection title="Executive Priority Scorecard">
        {findings.data.warnings?.map((warning) => (
          <ReportGap key={warning}>{warning}</ReportGap>
        ))}
        <ReportKpis
          items={[
            { label: "Open findings", value: count(openItems.length) },
            {
              label: "Quick wins",
              value: count(quickWins.length),
              sub: "high impact · low effort",
            },
            {
              label: "Strategic lifts",
              value: count(strategic.length),
              sub: "high impact · deeper build",
            },
            {
              label: "Auto-ready fixes",
              value: count(openItems.filter((i) => i.fixClass === "AUTO").length),
              sub: "can stage via Fix Engine",
            },
            {
              label: "Manual / Content",
              value: count(openItems.filter((i) => i.fixClass === "MANUAL").length),
              sub: "developer or editorial brief",
            },
            {
              label: "Verified live",
              value: count(verifiedCount),
              sub: "confirmed in ledger",
            },
          ]}
        />
        <ReportText>
          {openItems.length === 0
            ? "No open findings. Either everything found has been verified or resolved, or the individual modules do not have data yet."
            : `${openItems.length} open findings prioritized across your workspace — including ${quickWins.length} immediate quick win(s) and ${strategic.length} strategic high-impact project(s).`}
        </ReportText>
      </ReportSection>

      {/* Universal Implementation & Developer Handoff Pack */}
      {specs.length > 0 && (
        <ReportSection title="Universal Implementation & Sprint Handoff Briefs">
          <ImplementationHandoffPanel
            projectId={projectId}
            reportTitle="Complete Improvement Plan"
            domain={domain}
            filenameSlug="complete-improvement-plan"
            specs={specs}
          />
        </ReportSection>
      )}

      {openItems.length === 0 && (
        <ReportGap>
          Nothing to list. Complete the earlier audit steps and press Refresh plan on the Fix Engine page.
        </ReportGap>
      )}

      {GROUPS.map((g) => {
        const list = ordered.filter((i) => {
          const norm = (i.source || "").toUpperCase().trim();
          return g.sources.some((s) => s.toUpperCase() === norm);
        });
        return (
          <ReportSection key={g.label} title={`${g.label} (${list.length})`}>
            {list.length === 0 ? (
              <ReportGap>
                No open findings imported. Review this module for missing audits, connections or saved
                reports; this does not confirm that no improvements are needed.
              </ReportGap>
            ) : (
              <ul className="space-y-3">
                {list.map((f) => (
                  <Finding key={f.id} f={f} />
                ))}
              </ul>
            )}
          </ReportSection>
        );
      })}
    </ReportPage>
  );
}
