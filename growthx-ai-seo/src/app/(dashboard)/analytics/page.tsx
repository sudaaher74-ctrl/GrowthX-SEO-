"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, BarChart3, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ActionButton, Kpi, Panel, PageHeader, Table, Td, Th, Tr } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api, type Ga4Point } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "28 days", days: 28 },
  { label: "3 months", days: 90 },
  { label: "12 months", days: 365 },
];

const num = (v: number) => v.toLocaleString();
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const day = (v: string) => new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function AnalyticsClient() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [days, setDays] = useState(28);
  const [error, setError] = useState<string | null>(null);

  const connections = useQuery({
    queryKey: ["google-connections", projectId],
    queryFn: () => api.googleConnections(projectId!),
    enabled: !!projectId,
  });
  const ga4 = connections.data?.providers.find((p) => p.id === "analytics");
  const connected = ga4?.status === "CONNECTED";
  const enabled = !!projectId && connected;

  const summary = useQuery({
    queryKey: ["ga4-summary", projectId, days],
    queryFn: () => api.ga4Summary(projectId!, days),
    enabled,
  });
  const series = useQuery({
    queryKey: ["ga4-series", projectId, days],
    queryFn: () => api.ga4Timeseries(projectId!, days),
    enabled,
  });
  const pageValue = useQuery({
    queryKey: ["ga4-page-value", projectId, days],
    queryFn: () => api.ga4PageValue(projectId!, days),
    enabled,
  });

  const connect = useMutation({
    mutationFn: () => api.googleAuthorizeUrl(projectId!, "analytics", "/analytics"),
    onSuccess: ({ authorizationUrl }) => {
      window.location.href = authorizationUrl;
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const sync = useMutation({
    mutationFn: () => api.ga4Sync(projectId!, days),
    onSuccess: () => {
      setError(null);
      ["ga4-summary", "ga4-series", "ga4-page-value", "google-connections"].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (!projectId) {
    return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Website Analytics"
        subtitle="What people do after they arrive — and which searches brought the ones who convert."
        actions={
          connected ? (
            <ActionButton
              variant="secondary"
              icon={sync.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
            >
              {sync.isPending ? "Syncing…" : "Sync now"}
            </ActionButton>
          ) : undefined
        }
      />

      {error && <p className="text-[12px] text-error-500">{error}</p>}

      {connections.isLoading ? (
        <div className="flex items-center gap-2 py-10 text-[13px] text-brand-500">
          <Loader2 size={14} className="animate-spin" /> Checking your Google connection…
        </div>
      ) : !connected ? (
        <ConnectPrompt
          status={ga4?.status ?? "NOT_CONNECTED"}
          statusMessage={ga4?.statusMessage ?? null}
          configured={connections.data?.configuration.configured ?? false}
          missing={connections.data?.configuration.missing ?? []}
          pending={connect.isPending}
          onConnect={() => connect.mutate()}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-white px-5 py-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
            <span className="flex items-center gap-2 text-[13px] font-medium text-brand-950">
              <span className="h-2 w-2 rounded-full bg-success-500" /> Connected
            </span>
            {ga4?.selectedResourceName && (
              <span className="text-[12px] text-brand-600">
                Property <span className="font-medium text-brand-950">{ga4.selectedResourceName}</span>
              </span>
            )}
            <span className="text-[12px] text-brand-500">
              Last synced {ga4?.lastSyncedAt ? new Date(ga4.lastSyncedAt).toLocaleString() : "never"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => setDays(range.days)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                  days === range.days ? "bg-brand-950 text-white" : "border border-brand-200 text-brand-600 hover:bg-brand-100"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>

          {summary.isLoading ? (
            <div className="py-8 text-center text-[13px] text-brand-500">Loading…</div>
          ) : !summary.data ? (
            <NoDataYet syncing={sync.isPending} onSync={() => sync.mutate()} />
          ) : (
            <>
              <p className="text-[12px] text-brand-500">
                {day(summary.data.range.start)} – {day(summary.data.range.end)} · {summary.data.daysWithData} days of
                data
                {summary.data.comparisonRange
                  ? ` · compared with ${day(summary.data.comparisonRange.start)} – ${day(summary.data.comparisonRange.end)}`
                  : " · no earlier period to compare against yet"}
              </p>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="Users" value={num(summary.data.users.current)} delta={summary.data.users.changePct} deltaSuffix="%" />
                <Kpi label="Sessions" value={num(summary.data.sessions.current)} delta={summary.data.sessions.changePct} deltaSuffix="%" />
                <Kpi
                  label="Engagement"
                  value={pct(summary.data.engagementRate.current)}
                  delta={summary.data.engagementRate.changePct}
                  deltaSuffix="%"
                />
                {/* Not a zero. A property with no key events configured is a
                    setup gap, and rendering it as "0 conversions" reports a
                    working business as failing. */}
                {summary.data.conversions ? (
                  <Kpi
                    label="Conversions"
                    value={num(summary.data.conversions.current)}
                    delta={summary.data.conversions.changePct}
                    deltaSuffix="%"
                  />
                ) : (
                  <div className="rounded-xl border bg-white px-4 py-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
                    <div className="text-[11px] font-medium text-brand-500">Conversions</div>
                    <div className="mt-1 flex items-start gap-1.5 text-[12px] leading-relaxed text-brand-600">
                      <Info size={12} className="mt-0.5 shrink-0 text-brand-400" />
                      Not tracked. Mark an event as a key event in GA4 to measure this.
                    </div>
                  </div>
                )}
              </div>

              <Panel title="Users and sessions">
                <AnalyticsChart points={series.data ?? []} />
              </Panel>

              <Panel
                title="What your search traffic is worth"
                subtitle="Organic performance and business outcome for the same pages."
              >
                {pageValue.isLoading ? (
                  <Loading />
                ) : !pageValue.data?.hasSearchData ? (
                  <Empty>
                    Connect Google Search Console to see which searches bring the visitors who convert.
                  </Empty>
                ) : pageValue.data.rows.length === 0 ? (
                  <Empty>No pages with both search and analytics data in this period.</Empty>
                ) : (
                  <Table minWidth={760}>
                    <thead>
                      <tr>
                        <Th>Page</Th>
                        <Th>Organic clicks</Th>
                        <Th>Position</Th>
                        <Th>Sessions</Th>
                        <Th>Conversions</Th>
                        <Th>Rate</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageValue.data.rows.map((row) => (
                        <Tr key={row.page}>
                          <Td>
                            <span className="block max-w-[22rem] truncate">{shortPath(row.page)}</span>
                          </Td>
                          <Td>{num(row.clicks)}</Td>
                          <Td>{row.position.toFixed(1)}</Td>
                          {/* An em dash where nothing was measured. A zero here
                              would claim the page had no visitors, when the
                              truth is it was never a landing page. */}
                          <Td>{row.sessions === null ? <Unknown /> : num(row.sessions)}</Td>
                          <Td>{row.conversions === null ? <Unknown /> : num(row.conversions)}</Td>
                          <Td>{row.conversionRate === null ? <Unknown /> : pct(row.conversionRate)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Panel>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Distinguishes "not measured" from a measured zero, everywhere it appears. */
const Unknown = () => (
  <span className="text-brand-300" title="Not measured">
    —
  </span>
);

function AnalyticsChart({ points }: { points: Ga4Point[] }) {
  if (points.length === 0) return <Empty>No data in this period.</Empty>;
  return (
    <div className="px-2 py-3">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" />
          <XAxis dataKey="date" tickFormatter={day} tick={{ fontSize: 11 }} stroke="var(--color-brand-400)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--color-brand-400)" />
          <Tooltip
            labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--color-brand-100)" }}
          />
          <Line type="monotone" dataKey="users" name="Users" stroke="var(--color-accent-600)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="sessions" name="Sessions" stroke="var(--color-series-2)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConnectPrompt({
  status,
  statusMessage,
  configured,
  missing,
  pending,
  onConnect,
}: {
  status: string;
  statusMessage: string | null;
  configured: boolean;
  missing: string[];
  pending: boolean;
  onConnect: () => void;
}) {
  const expired = status === "NEEDS_REAUTH";
  return (
    <div className="rounded-xl border border-dashed bg-white px-6 py-12 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
      {expired ? (
        <AlertTriangle size={26} className="mx-auto mb-3 text-warning-500" />
      ) : (
        <BarChart3 size={26} className="mx-auto mb-3 text-brand-300" />
      )}
      <p className="text-[14px] font-medium text-brand-950">
        {expired ? "Authorization expired" : "Google Analytics is not connected"}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-brand-500">
        {statusMessage ??
          "Connect GA4 to see what happens after someone arrives — and which of your search rankings actually bring visitors who convert."}
      </p>
      {configured ? (
        <button
          onClick={onConnect}
          disabled={pending}
          className="mx-auto mt-5 flex items-center gap-2 rounded-lg bg-brand-950 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
          {expired ? "Reconnect Google" : "Connect Google Analytics"}
        </button>
      ) : (
        <p className="mx-auto mt-4 max-w-md rounded-lg bg-brand-100 px-3 py-2.5 text-[12px] leading-relaxed text-brand-600">
          Google connections are not configured on this deployment yet
          {missing.length > 0 ? `: ${missing.join(", ")} not set.` : "."}
        </p>
      )}
    </div>
  );
}

function NoDataYet({ syncing, onSync }: { syncing: boolean; onSync: () => void }) {
  return (
    <div className="rounded-xl border border-dashed bg-white px-6 py-12 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
      <p className="text-[14px] font-medium text-brand-950">Nothing synced yet</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-brand-500">
        Analytics is connected but no data has been pulled in. A sync runs automatically each morning, or you can run
        one now.
      </p>
      <button
        onClick={onSync}
        disabled={syncing}
        className="mx-auto mt-5 flex items-center gap-2 rounded-lg bg-brand-950 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
      >
        {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        {syncing ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}

const Loading = () => (
  <div className="flex items-center gap-2 px-5 py-6 text-[12px] text-brand-500">
    <Loader2 size={13} className="animate-spin" /> Loading…
  </div>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="px-5 py-6 text-[12px] text-brand-500">{children}</div>
);

function shortPath(url: string): string {
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-32 items-center justify-center text-sm text-brand-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading analytics…
        </div>
      }
    >
      <AnalyticsClient />
    </Suspense>
  );
}
