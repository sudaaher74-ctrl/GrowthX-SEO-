"use client";
import { Download } from "lucide-react";
import { ActionButton, Kpi, Mono, NotConnected, PageHeader, Panel, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import type { PortfolioClient } from "@/lib/api-client";

/**
 * Reports — agency scope. Scheduled white-label delivery is not built, so this
 * ships the one thing that is real today: an export of live portfolio numbers.
 */
export default function ReportsPage() {
  const { orgId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const clients = portfolio.data?.clients ?? [];
  const summary = portfolio.data?.summary;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle="Client-ready numbers, exported from live data"
        actions={
          <ActionButton variant="primary" icon={<Download size={12} />} onClick={() => exportReport(clients)} disabled={!clients.length}>
            Export portfolio report
          </ActionButton>
        }
      />

      <QueryState
        isLoading={portfolio.isLoading}
        error={portfolio.error}
        isEmpty={!clients.length}
        emptyTitle="No clients to report on"
        emptyBody="Add a client and run an audit first."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Clients" value={String(summary?.clientCount ?? 0)} sub="in this portfolio" />
          <Kpi
            label="Portfolio AI share"
            value={summary?.portfolioAiSharePct != null ? `${summary.portfolioAiSharePct}%` : "—"}
            delta={summary?.portfolioAiDeltaPt}
            deltaSuffix="pt"
          />
          <Kpi label="Open criticals" value={String(summary?.openCriticals ?? 0)} tone={summary?.openCriticals ? "danger" : "good"} />
          <Kpi label="Prompts tracked" value={(summary?.promptsTracked ?? 0).toLocaleString()} />
        </div>

        <Panel title="Per-client snapshot" subtitle="what a client report would contain today">
          <Table minWidth={820}>
            <thead>
              <tr>
                <Th>Client</Th><Th align="right">AI share</Th><Th align="right">Health</Th>
                <Th align="right">Criticals</Th><Th align="right">Prompts</Th><Th>Last crawl</Th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <Tr key={c.projectId}>
                  <Td>
                    <span className="text-[12.5px] font-semibold text-[#09090b]">{c.name}</span>
                    <span className="block font-mono text-[10.5px] text-[#a1a1aa]">{c.domain ?? "no website"}</span>
                  </Td>
                  <Td align="right"><Mono>{c.aiCitationSharePct != null ? `${c.aiCitationSharePct}%` : "—"}</Mono></Td>
                  <Td align="right"><Mono>{c.health ?? "—"}</Mono></Td>
                  <Td align="right"><Mono tone={c.criticalIssues ? "bad" : "good"}>{c.criticalIssues}</Mono></Td>
                  <Td align="right"><Mono>{c.trackedPrompts}</Mono></Td>
                  <Td><span className="text-[11.5px] text-[#71717a]">{relativeTime(c.lastCrawledAt)}</span></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Panel>

        <NotConnected
          title="Scheduled white-label delivery is not built"
          what="The design specifies recurring PDF reports emailed to client contacts on a cadence. Export above produces the same figures today."
          needs={["A PDF renderer", "An email provider (e.g. Resend, SES)", "A schedule + recipients model", "White-label branding per client"]}
        />
      </QueryState>
    </div>
  );
}

function exportReport(clients: PortfolioClient[]) {
  const header = ["Client", "Domain", "AI share %", "Delta pt", "Health", "Criticals", "Prompts", "Avg position", "Last crawl"];
  const rows = clients.map((c) => [
    c.name, c.domain ?? "", c.aiCitationSharePct ?? "", c.aiDeltaPt ?? "",
    c.health ?? "", c.criticalIssues, c.trackedPrompts, c.averagePosition ?? "", c.lastCrawledAt ?? "",
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `portfolio-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
