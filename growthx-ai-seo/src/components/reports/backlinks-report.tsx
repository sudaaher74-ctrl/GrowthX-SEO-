"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { download } from "@/lib/competitor-report";
import {
  buildBacklinkImplementationSpecs,
  formatSpecAsMarkdown,
} from "@/lib/implementation-specs";
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
import { ImplementationHandoffPanel } from "@/components/reports/implementation-handoff-panel";
import { Pill } from "@/components/ui/console";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

/**
 * Executive + Implementation-Ready Backlinks & Authority Report:
 * Live-verified referring domains, target URL readiness (detecting broken URLs
 * leaking link equity), lost-link recovery outreach status, and a universal
 * 301 redirect + recovery email handoff pack.
 */
export function BacklinksReport() {
  const { projectId, clientName, domain } = useReportContext();

  const report = useQuery({
    queryKey: ["report-backlinks", projectId],
    queryFn: () => api.backlinks.report(projectId!, 0),
    enabled: Boolean(projectId),
    retry: false,
  });

  const outreach = useQuery({
    queryKey: ["report-backlink-outreach", projectId],
    queryFn: () => api.backlinkOutreach.list(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60_000,
    retry: false,
  });

  const data = report.data;
  const outreachItems = outreach.data?.items ?? [];

  const brokenTargetCount = (data?.sources ?? []).reduce(
    (sum, s) => sum + s.links.filter((l) => l.targetKind === "OWN" && l.readiness?.state === "NEEDS_FIX").length,
    0,
  );
  const recoveredCount = outreachItems.filter((i) => i.status === "RECOVERED").length;

  const specs = buildBacklinkImplementationSpecs({
    report: data,
    outreachItems,
    domain,
    clientName,
  });

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
          ["Broken Target URLs Needing Redirect", brokenTargetCount],
          ["Recovered Links (Outreach)", recoveredCount],
          ["Open Outreach Actions", data.summary.openActions],
        ],
      },
      {
        title: "Referring Sources & Target Health",
        headers: ["Domain", "Source URL", "Status", "Links Found", "Target Readiness", "Discovery"],
        rows: data.sources.map((s) => {
          const needsFix = s.links.some((l) => l.readiness?.state === "NEEDS_FIX");
          return [
            hostOf(s.sourceUrl),
            s.sourceUrl,
            s.status,
            s._count.links,
            needsFix ? "NEEDS_301_OR_FIX" : "OK",
            s.discovery,
          ];
        }),
      },
      ...(outreachItems.length > 0
        ? [
            {
              title: "Lost-Link Recovery Outreach",
              headers: ["Referring Domain", "Source URL", "Target URL", "Kind", "Status", "Contact Email"],
              rows: outreachItems.map((item) => [
                item.sourceDomain,
                item.sourceUrl,
                item.targetUrl ?? "",
                item.kind,
                item.status,
                item.contactEmail ?? "",
              ]),
            },
          ]
        : []),
      ...(data.opportunities.length > 0
        ? [
            {
              title: "Actionable Link Opportunities",
              headers: ["Opportunity", "Recommended Action", "Lifecycle"],
              rows: data.opportunities.map((o) => [o.title, o.recommendedAction, o.lifecycle]),
            },
          ]
        : []),
    ]);
  };

  const handleExportMarkdown = () => {
    if (!data) return;
    const lines: string[] = [
      `# Backlinks & Authority Report${domain ? `: ${domain}` : ""}`,
      "",
      `Client: ${clientName} · Generated ${new Date().toISOString().slice(0, 10)}`,
      "",
      "## Authority Scorecard",
      "",
      `- **Verified Links:** ${data.summary.verifiedLinks}`,
      `- **Referring Domains:** ${data.summary.referringDomains}`,
      `- **Confirmed Lost Links:** ${data.summary.confirmedLostLinks}`,
      `- **Broken Target URLs Needing 301/Fix:** ${brokenTargetCount}`,
      `- **Outreach Recoveries Logged:** ${recoveredCount}`,
      "",
      "## Verified Referring Sources",
      "",
      "| Referring Domain | Source URL | Status | Links |",
      "| --- | --- | --- | --- |",
      ...data.sources.slice(0, 40).map((s) => `| ${hostOf(s.sourceUrl)} | ${s.sourceUrl} | ${s.status} | ${s._count.links} |`),
      "",
    ];
    if (outreachItems.length > 0) {
      lines.push(
        "## Lost-Link Recovery Outreach Tracker",
        "",
        "| Domain | Kind | Status | Source URL |",
        "| --- | --- | --- | --- |",
        ...outreachItems.map((i) => `| ${i.sourceDomain} | ${i.kind} | ${i.status} | ${i.sourceUrl} |`),
        "",
      );
    }
    if (specs.length > 0) {
      lines.push("## Universal Link-Equity & Recovery Handoff Guide", "");
      specs.forEach((s) => lines.push(formatSpecAsMarkdown(s), ""));
    }
    download(
      `backlinks-authority-report-${domain || "website"}-${new Date().toISOString().slice(0, 10)}.md`,
      lines.join("\n"),
      "text/markdown",
    );
  };

  return (
    <ReportPage
      title="Backlinks & Authority Report"
      intro="Live-verified referring domains, target URL readiness (flagging broken URLs leaking link equity), lost-link recovery outreach status, and a universal 301 redirect + outreach email handoff guide."
      clientName={clientName}
      domain={domain}
      onDownloadMarkdown={data && data.summary.totalSources > 0 ? handleExportMarkdown : undefined}
      onDownloadCsv={data && data.summary.totalSources > 0 ? handleExportCsv : undefined}
    >
      {report.isLoading ? (
        <ReportLoading what="backlinks report" />
      ) : !data || data.summary.totalSources === 0 ? (
        <ReportGap>
          No backlinks have been discovered or imported for this project yet. Run Backlink Discovery in the Backlinks tab to populate this report.
        </ReportGap>
      ) : (
        <>
          {/* 1. Authority Scorecard */}
          <ReportSection title="Authority & link-equity overview">
            <ReportKpis
              items={[
                { label: "Verified links", value: String(data.summary.verifiedLinks) },
                { label: "Referring domains", value: String(data.summary.referringDomains) },
                {
                  label: "Confirmed lost",
                  value: String(data.summary.confirmedLostLinks),
                  sub: recoveredCount > 0 ? `${recoveredCount} recovered via outreach` : undefined,
                },
                {
                  label: "Broken targets",
                  value: String(brokenTargetCount),
                  sub: brokenTargetCount > 0 ? "Need 301 redirect or fix" : "All targets healthy",
                },
              ]}
            />
          </ReportSection>

          {/* 2. Universal Link-Equity & Recovery Handoff Guide */}
          <ImplementationHandoffPanel
            reportTitle="Backlinks & Authority"
            domain={domain}
            projectId={projectId}
            specs={specs}
            filenameSlug="backlinks-authority"
            subtitle="Universal 301 redirect maps for broken target URLs receiving external links, plus copy-ready recovery emails for lost referring domains — ready for any developer or outreach teammate."
          />

          {/* 3. Verified Referring Sources with Target Health */}
          <ReportSection
            title="Verified referring sources & target readiness"
            note="Live HTTP verification results across discovered and imported backlink sources."
          >
            <div className="overflow-x-auto">
              <table className="report-table w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    <th className="border-b px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-brand-400">
                      Referring domain
                    </th>
                    <th className="border-b px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-brand-400">
                      Source URL
                    </th>
                    <th className="border-b px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-brand-400">
                      Link status
                    </th>
                    <th className="border-b px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.05em] text-brand-400">
                      Target health
                    </th>
                    <th className="border-b px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-[0.05em] text-brand-400">
                      Links
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.sources.slice(0, 30).map((s) => {
                    const needsFix = s.links.some((l) => l.readiness?.state === "NEEDS_FIX");
                    const statusUpper = s.status.toUpperCase();
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-2 py-1.5 font-semibold text-brand-950">{hostOf(s.sourceUrl)}</td>
                        <td className="px-2 py-1.5 font-mono text-[11px] text-brand-600 max-w-xs truncate">
                          {s.sourceUrl}
                        </td>
                        <td className="px-2 py-1.5">
                          <Pill
                            tone={
                              statusUpper === "VERIFIED" || statusUpper === "LIVE"
                                ? "good"
                                : statusUpper === "LOST"
                                  ? "bad"
                                  : "default"
                            }
                          >
                            {s.status}
                          </Pill>
                        </td>
                        <td className="px-2 py-1.5">
                          {needsFix ? (
                            <Pill tone="warn">Needs 301 / Fix</Pill>
                          ) : (
                            <span className="text-[11px] text-brand-500">Healthy</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-brand-950">{s._count.links}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ReportSection>

          {/* 4. Lost-Link Recovery Outreach Status */}
          {outreachItems.length > 0 && (
            <ReportSection
              title={`Lost-link recovery outreach tracker (${outreachItems.length})`}
              note="Saved recovery and link-building outreach records; recovered links log directly to the Fix Impact Ledger."
            >
              <ReportTable
                columns={[
                  { label: "Domain" },
                  { label: "Type" },
                  { label: "Status" },
                  { label: "Source URL" },
                ]}
                rows={outreachItems.slice(0, 20).map((item) => [
                  item.sourceDomain,
                  item.kind.replace(/_/g, " "),
                  item.status,
                  item.sourceUrl,
                ])}
                empty="No outreach items tracked yet."
              />
            </ReportSection>
          )}

          {/* 5. Actionable Link Opportunities */}
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
