"use client";

import { Download, FileText, AlertCircle } from "lucide-react";
import { Panel, Pill, Table, Th } from "@/components/ui/console";
import type { FixImpactReportData } from "@/lib/api-types";

export function FixEngineReportsView({
  report,
}: {
  report: FixImpactReportData | null;
}) {
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (!report) {
    return (
      <Panel title="Impact Reports" subtitle="Generate auditable stakeholder impact deliverables" padded>
        <div className="p-8 text-center text-xs text-brand-500">
          Loading impact report data...
        </div>
      </Panel>
    );
  }

  const { summary, fixes, evidenceLimitations, project } = report;

  return (
    <div className="space-y-6">
      <Panel
        title="Audit-Ready Proof of Impact Report"
        subtitle={`Generated for ${project.name} · Report ID: ${report.reportId}`}
        actions={
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 shadow-2xs"
          >
            <Download size={13} /> Export PDF / Print
          </button>
        }
        padded
      >
        <div className="space-y-6 text-xs">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3 bg-brand-50/50">
              <span className="text-[11px] text-brand-500">Total Fixes Applied</span>
              <div className="text-lg font-bold font-mono text-brand-950 mt-1">{summary.totalFixes}</div>
            </div>
            <div className="rounded-lg border p-3 bg-brand-50/50">
              <span className="text-[11px] text-brand-500">Verified on Live Site</span>
              <div className="text-lg font-bold font-mono text-success-700 mt-1">{summary.verifiedFixes}</div>
            </div>
            <div className="rounded-lg border p-3 bg-brand-50/50">
              <span className="text-[11px] text-brand-500">Active Regressions</span>
              <div className="text-lg font-bold font-mono text-brand-950 mt-1">{summary.openRegressions}</div>
            </div>
            <div className="rounded-lg border p-3 bg-brand-50/50">
              <span className="text-[11px] text-brand-500">Observed Clicks Delta</span>
              <div className="text-lg font-bold font-mono text-brand-950 mt-1">
                {summary.organicClicksDelta > 0 ? `+${summary.organicClicksDelta}` : summary.organicClicksDelta}
              </div>
            </div>
          </div>

          {/* Fixes Included */}
          <div className="space-y-2">
            <h4 className="font-bold text-brand-900 flex items-center gap-1.5">
              <FileText size={14} /> Included Technical Improvements
            </h4>
            <Table minWidth={600}>
              <thead>
                <tr>
                  <Th>Fix Title</Th>
                  <Th>Target URL</Th>
                  <Th>Verification</Th>
                  <Th align="right">Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs">
                {fixes.map((f) => (
                  <tr key={f.id} className="hover:bg-brand-50/50">
                    <td className="px-4 py-3 font-semibold text-brand-900">{f.title}</td>
                    <td className="px-4 py-3 font-mono text-brand-600 max-w-xs truncate">{f.url}</td>
                    <td className="px-4 py-3">
                      <Pill tone={f.verified ? "good" : "warn"}>{f.verified ? "VERIFIED LIVE" : "PENDING"}</Pill>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-brand-700">{f.status}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* Evidence Limitations & Disclaimers */}
          <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-4 space-y-2">
            <h4 className="font-bold text-brand-900 flex items-center gap-1.5">
              <AlertCircle size={14} className="text-brand-600" /> Evidence Integrity &amp; Methodological Boundaries
            </h4>
            <ul className="list-disc pl-5 space-y-1 text-brand-700 text-[11px]">
              {evidenceLimitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>
    </div>
  );
}
