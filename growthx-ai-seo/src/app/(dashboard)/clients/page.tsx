"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { usePortfolio, useWorkspace } from "@/hooks/use-growthx";
import type { PortfolioClient } from "@/lib/api-client";
import { QueryState } from "@/components/ui/query-state";

type Filter = "All" | "Needs attention" | "Top tier" | "AI gap";
const FILTERS: Filter[] = ["All", "Needs attention", "Top tier", "AI gap"];

type SortKey = "name" | "aiCitationSharePct" | "health" | "trackedPrompts" | "averagePosition" | "criticalIssues";

export default function ClientsPage() {
  const { orgId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const [filter, setFilter] = useState<Filter>("All");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "aiCitationSharePct", dir: -1 });

  const clients = portfolio.data?.clients ?? [];
  const summary = portfolio.data?.summary;
  const alerts = portfolio.data?.alerts ?? [];

  const rows = useMemo(() => {
    let out = [...clients];
    if (filter === "Needs attention") {
      out = out.filter((c) => c.criticalIssues >= 5 || (c.aiDeltaPt ?? 0) < 0);
    } else if (filter === "Top tier") {
      out = out.filter((c) => c.retainerMonthlyMinor !== null)
        .sort((a, b) => (b.retainerMonthlyMinor ?? 0) - (a.retainerMonthlyMinor ?? 0));
    } else if (filter === "AI gap") {
      out = out.filter((c) => c.aiCitationSharePct !== null && c.aiCitationSharePct < 35);
    }

    if (filter !== "Top tier") {
      out.sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        // Unmeasured clients sink to the bottom instead of reading as zero.
        if (av === null) return 1;
        if (bv === null) return -1;
        return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
      });
    }
    return out;
  }, [clients, filter, sort]);

  const trendData = useMemo(() => {
    // Blend every client's weekly series into one portfolio line.
    const weeks = Math.max(0, ...clients.map((c) => c.trend.length));
    return Array.from({ length: weeks }, (_, i) => {
      const values = clients.map((c) => c.trend[c.trend.length - weeks + i]).filter((v): v is number => v != null);
      return {
        week: `W${i + 1}`,
        share: values.length ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)) : 0,
      };
    });
  }, [clients]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-brand-950">Projects portfolio</h1>
          <p className="mt-0.5 text-[13px] text-brand-500">
            {summary ? `${summary.clientCount} project${summary.clientCount === 1 ? "" : "s"}` : "—"}
            {summary?.clientsWithoutRetainer
              ? ` · ${summary.clientsWithoutRetainer} without a recorded retainer`
              : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv(clients)}
            disabled={!clients.length}
            className="flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-[12px] font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-50"
            style={{ borderColor: "var(--border-color)" }}
          >
            <Download size={13} /> Export CSV
          </button>
          <Link
            href="/projects"
            className="flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus size={13} /> Add project
          </Link>
        </div>
      </div>

      <QueryState
        isLoading={portfolio.isLoading}
        error={portfolio.error}
        isEmpty={!clients.length}
        emptyTitle="No projects yet"
        emptyBody="Add a project and register its website to start tracking AI citation share, site health and retainer value."
      >
        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Kpi
            label="Portfolio AI share"
            value={summary?.portfolioAiSharePct != null ? `${summary.portfolioAiSharePct}%` : "—"}
            delta={summary?.portfolioAiDeltaPt}
            deltaSuffix="pt"
            sub={`${(summary?.promptsTracked ?? 0).toLocaleString()} prompts tracked`}
          />
          <Kpi
            label="Projects improving"
            value={summary ? `${summary.clientsImproving} / ${summary.clientCount}` : "—"}
            sub={summary ? `${summary.clientsDeclining} declining this period` : ""}
          />
          <Kpi
            label="Prompts tracked"
            value={(summary?.promptsTracked ?? 0).toLocaleString()}
            sub="across all projects"
          />
          <Kpi
            label="Open criticals"
            value={String(summary?.openCriticals ?? 0)}
            sub={`across ${summary?.clientCount ?? 0} properties`}
            tone={summary?.openCriticals ? "danger" : "default"}
          />
          <Kpi
            label="MRR under management"
            value={summary?.mrrMinor ? formatMoney(summary.mrrMinor, summary.mrrCurrency) : "—"}
            sub={
              summary?.clientsWithoutRetainer
                ? `${summary.clientsWithoutRetainer} project(s) not counted`
                : `${summary?.clientCount ?? 0} active retainers`
            }
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11.5px] font-medium transition-colors",
                  filter === f
                    ? "border-brand-950 bg-brand-950 text-white"
                    : "bg-white text-brand-600 hover:bg-brand-50",
                )}
                style={filter === f ? undefined : { borderColor: "var(--border-color)" }}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto font-mono text-[11px] text-brand-400">{rows.length} shown</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px]">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border-color)" }}>
                  <Th>Project</Th>
                  <Th>Retainer</Th>
                  <Th sortKey="aiCitationSharePct" sort={sort} setSort={setSort}>AI citation share</Th>
                  <Th align="right" sortKey="health" sort={sort} setSort={setSort}>Health</Th>
                  <Th align="right" sortKey="trackedPrompts" sort={sort} setSort={setSort}>Prompts</Th>
                  <Th align="right" sortKey="averagePosition" sort={sort} setSort={setSort}>Avg pos</Th>
                  <Th align="right" sortKey="criticalIssues" sort={sort} setSort={setSort}>Critical</Th>
                  <Th>Trend</Th>
                  <Th>Last crawl</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((client) => (
                  <tr key={client.projectId} className="border-b transition-colors hover:bg-brand-50" style={{ borderColor: "var(--color-brand-100)" }}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-100 font-mono text-[10px] font-semibold text-brand-700">
                          {client.initials}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-brand-950">{client.name}</span>
                          <span className="block truncate font-mono text-[10.5px] text-brand-400">
                            {client.domain ?? "no website"}
                          </span>
                        </span>
                      </div>
                    </Td>

                    <Td>
                      {client.retainerMonthlyMinor != null ? (
                        <span className="text-[12px] text-brand-600">
                          {client.tier ? `${client.tier} · ` : ""}
                          {formatMoney(client.retainerMonthlyMinor, client.retainerCurrency)}/mo
                        </span>
                      ) : (
                        <span className="text-[12px] text-brand-400">—</span>
                      )}
                    </Td>

                    <Td>
                      {client.aiCitationSharePct === null ? (
                        <span className="text-[11.5px] text-brand-400">not tracked</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-brand-100">
                            <div
                              className="h-full rounded-full bg-success-700"
                              style={{ width: `${Math.min(100, client.aiCitationSharePct)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[12px] font-semibold text-brand-950">
                            {client.aiCitationSharePct}%
                          </span>
                          {client.aiDeltaPt != null && (
                            <span
                              className={cn(
                                "font-mono text-[11px]",
                                client.aiDeltaPt >= 0 ? "text-success-700" : "text-error-500",
                              )}
                            >
                              {client.aiDeltaPt >= 0 ? "+" : ""}
                              {client.aiDeltaPt}
                            </span>
                          )}
                        </div>
                      )}
                    </Td>

                    <Td align="right">
                      <span
                        className={cn(
                          "font-mono text-[12px] font-semibold",
                          client.health === null
                            ? "text-brand-400"
                            : client.health >= 80
                              ? "text-success-700"
                              : client.health >= 60
                                ? "text-warning-500"
                                : "text-error-500",
                        )}
                      >
                        {client.health ?? "—"}
                      </span>
                    </Td>

                    <Td align="right"><Mono>{client.trackedPrompts.toLocaleString()}</Mono></Td>
                    <Td align="right"><Mono>{client.averagePosition ?? "—"}</Mono></Td>

                    <Td align="right">
                      <span
                        className={cn(
                          "inline-block rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold",
                          client.criticalIssues === 0
                            ? "bg-success-50 text-success-700"
                            : client.criticalIssues >= 5
                              ? "bg-error-50 text-error-700"
                              : "bg-brand-100 text-brand-700",
                        )}
                      >
                        {client.criticalIssues}
                      </span>
                    </Td>

                    <Td><Sparkline values={client.trend} /></Td>
                    <Td><span className="text-[11.5px] text-brand-500">{relativeTime(client.lastCrawledAt)}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Needs your attention" subtitle={`across ${summary?.clientCount ?? 0} projects`}>
            {alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-brand-400">Nothing needs attention right now.</p>
            ) : (
              <ul>
                {alerts.slice(0, 6).map((alert, i) => (
                  <li key={i} className="flex items-start gap-2.5 border-b px-4 py-3 last:border-0" style={{ borderColor: "var(--color-brand-100)" }}>
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        background:
                          alert.severity === "critical" ? "var(--color-error-500)" : alert.severity === "warning" ? "var(--color-warning-500)" : "var(--color-brand-400)",
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-medium text-brand-950">{alert.title}</span>
                      <span className="block text-[11.5px] text-brand-500">{alert.detail}</span>
                    </span>
                    <span className="shrink-0 rounded bg-brand-100 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-brand-600">
                      {alert.tag}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Portfolio AI citation share" subtitle="Share of tracked prompts where a project is cited">
            <div className="h-[210px] px-3 pb-3 pt-4">
              {trendData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-[12px] text-brand-400">
                  No citation history yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="share" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-accent-600)" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="var(--color-accent-600)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: "var(--color-brand-400)" }} axisLine={false} tickLine={false} />
                    <YAxis unit="%" tick={{ fontSize: 10, fill: "var(--color-brand-400)" }} axisLine={false} tickLine={false} width={34} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Area type="monotone" dataKey="share" stroke="var(--color-accent-600)" strokeWidth={2} fill="url(#share)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>
        </div>
      </QueryState>
    </div>
  );
}

/* ─────────────────────────────────────────────── building blocks */

function Kpi({
  label,
  value,
  delta,
  deltaSuffix = "",
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaSuffix?: string;
  sub?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--border-color)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono text-[24px] font-bold tracking-[-0.02em]",
            tone === "danger" ? "text-error-500" : "text-brand-950",
          )}
        >
          {value}
        </span>
        {delta != null && (
          <span className={cn("font-mono text-[12px] font-medium", delta >= 0 ? "text-success-700" : "text-error-500")}>
            {delta >= 0 ? "+" : ""}
            {delta}
            {deltaSuffix}
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-[11px] text-brand-500">{sub}</p>}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: "var(--border-color)" }}>
      <div className="flex items-baseline justify-between border-b px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
        <h2 className="text-[13px] font-semibold text-brand-950">{title}</h2>
        {subtitle && <span className="text-[11px] text-brand-400">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function Th({
  children,
  align = "left",
  sortKey,
  sort,
  setSort,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  sortKey?: SortKey;
  sort?: { key: SortKey; dir: 1 | -1 };
  setSort?: (s: { key: SortKey; dir: 1 | -1 }) => void;
}) {
  const active = sortKey && sort?.key === sortKey;
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-400",
        align === "right" ? "text-right" : "text-left",
        sortKey && "cursor-pointer select-none hover:text-brand-600",
      )}
      onClick={() =>
        sortKey && setSort?.({ key: sortKey, dir: active && sort!.dir === -1 ? 1 : -1 })
      }
    >
      {children}
      {active && <span className="ml-1">{sort!.dir === -1 ? "↓" : "↑"}</span>}
    </th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={cn("px-4 py-3", align === "right" ? "text-right" : "text-left")}>{children}</td>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[12px] text-brand-700">{children}</span>;
}

/** Inline SVG sparkline — no chart library needed for 12 points. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-[11px] text-brand-300">—</span>;

  const w = 68;
  const h = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / span) * h}`)
    .join(" ");

  const rising = values[values.length - 1] >= values[0];

  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={rising ? "var(--color-success-700)" : "var(--color-error-500)"}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─────────────────────────────────────────────── helpers */

function formatMoney(minor: number, currency: string): string {
  const major = minor / 100;
  const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : "";
  if (major >= 100_000) return `${symbol}${(major / 100_000).toFixed(1)}L`;
  if (major >= 1_000) return `${symbol}${(major / 1000).toFixed(1)}k`;
  return `${symbol}${major.toLocaleString()}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function exportCsv(clients: PortfolioClient[]) {
  const header = ["Project", "Domain", "Tier", "Retainer", "AI share %", "Delta pt", "Health", "Prompts", "Avg pos", "Criticals", "Last crawl"];
  const rows = clients.map((c) => [
    c.name,
    c.domain ?? "",
    c.tier ?? "",
    c.retainerMonthlyMinor != null ? (c.retainerMonthlyMinor / 100).toString() : "",
    c.aiCitationSharePct ?? "",
    c.aiDeltaPt ?? "",
    c.health ?? "",
    c.trackedPrompts,
    c.averagePosition ?? "",
    c.criticalIssues,
    c.lastCrawledAt ?? "",
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `projects-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
