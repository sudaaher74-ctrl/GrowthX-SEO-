"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { downloadCsvFile } from "@/lib/report-csv";
import {
  ReportGap,
  ReportKpis,
  ReportLoading,
  ReportPage,
  ReportSection,
  ReportTable,
  useReportContext,
} from "@/components/reports/report-kit";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

export function BacklinksReport() {
  const { projectId, clientName, domain } = useReportContext();
  const report = useQuery({
    queryKey: ["report-backlinks", projectId],
    queryFn: () => api.backlinks.report(projectId!, 0),
    enabled: Boolean(projectId),
    retry: false,
  });

  const data = report.data;

  const handleExportCsv = () => {
    if (!data) return;
    downloadCsvFile(`${domain ?? clientName}-backlinks-report.csv`, [
      {
        title: "Backlink Summary",
        headers: ["Metric", "Value"],
        rows: [
          ["Verified Links", data.summary.verifiedLinks],
          ["Referring Domains", data.summary.referringDomains],
          ["Total Checked Sources", data.summary.totalSources],
          ["Confirmed Lost Links", data.summary.confirmedLostLinks],
          ["Open Outreach Actions", data.summary.openActions],
        ],
      },
      {
        title: "Referring Sources",
        headers: ["Domain", "Source URL", "Status", "Links Found", "Discovery"],
        rows: data.sources.map((s) => [
          hostOf(s.sourceUrl),
          s.sourceUrl,
          s.status,
          s._count.links,
          s.discovery,
        ]),
      },
    ]);
  };

  return (
    <ReportPage
      title="Backlinks & Authority Report"
      intro="Live-verified referring domains, link sources, lost links, and link-building opportunities checked directly by our crawler."
      clientName={clientName}
      domain={domain}
      onDownloadCsv={data ? handleExportCsv : undefined}
    >
      {report.isLoading ? (
        <ReportLoading what="backlinks report" />
      ) : !data || data.summary.totalSources === 0 ? (
        <ReportGap>
          No backlinks have been discovered or imported for this project yet. Run Backlink Discovery in the Backlinks tab to populate this report.
        </ReportGap>
      ) : (
        <>
          <ReportSection title="Authority overview">
            <ReportKpis
              items={[
                { label: "Verified links", value: String(data.summary.verifiedLinks) },
                { label: "Referring domains", value: String(data.summary.referringDomains) },
                { label: "Lost links", value: String(data.summary.confirmedLostLinks) },
                { label: "Open actions", value: String(data.summary.openActions) },
              ]}
            />
          </ReportSection>

          <ReportSection
            title="Verified referring sources"
            note="Live HTTP verification results across discovered and imported backlink sources."
          >
            <ReportTable
              columns={[
                { label: "Referring domain" },
                { label: "Source URL" },
                { label: "Status" },
                { label: "Links", right: true },
              ]}
              rows={data.sources.slice(0, 30).map((s) => [
                hostOf(s.sourceUrl),
                s.sourceUrl,
                s.status,
                s._count.links,
              ])}
              empty="No verified referring sources recorded yet."
            />
          </ReportSection>

          {data.opportunities.length > 0 && (
            <ReportSection title="Actionable link opportunities">
              <ReportTable
                columns={[
                  { label: "Opportunity" },
                  { label: "Recommended action" },
                  { label: "Status" },
                ]}
                rows={data.opportunities.slice(0, 15).map((o) => [
                  o.title,
                  o.recommendedAction,
                  o.lifecycle,
                ])}
                empty="No open backlink actions."
              />
            </ReportSection>
          )}
        </>
      )}
    </ReportPage>
  );
}
