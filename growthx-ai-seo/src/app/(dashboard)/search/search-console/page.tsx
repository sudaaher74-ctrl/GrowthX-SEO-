"use client";

import { Suspense, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw, ExternalLink, AlertTriangle, Search as SearchIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ActionButton, Kpi, Panel, PageHeader, Table, Td, Th, Tr } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api, type GscPoint } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { PropertyPicker } from "@/components/ui/property-picker";

/**
 * Only the ranges Search Console can actually answer.
 *
 * Google keeps 16 months, so nothing longer is offered — a range that silently
 * returns a short chart teaches the customer to distrust the whole page. What
 * is offered can still exceed what has been *synced*, which the header states
 * separately.
 */
const RANGES = [
  { label: "7 days", days: 7 },
  { label: "28 days", days: 28 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "12 months", days: 365 },
];

const METRICS = [
  { key: "clicks", label: "Clicks", color: "var(--color-accent-600)" },
  { key: "impressions", label: "Impressions", color: "var(--color-series-2)" },
  { key: "ctr", label: "CTR", color: "var(--color-success-500)" },
  { key: "position", label: "Position", color: "var(--color-warning-500)" },
] as const;

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;
const num = (value: number) => value.toLocaleString();
const day = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function SearchConsoleClient() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();
  const [days, setDays] = useState(28);
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("clicks");
  const [openPage, setOpenPage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connections = useQuery({
    queryKey: ["google-connections", projectId],
    queryFn: () => api.googleConnections(projectId!),
    enabled: !!projectId,
  });
  const gsc = connections.data?.providers.find((p) => p.id === "search_console");
  const connected = gsc?.status === "CONNECTED";

  // Every panel below is gated on a live connection, so none of them fire a
  // request that can only 404 while the customer has not connected.
  const enabled = !!projectId && connected;
  const summary = useQuery({
    queryKey: ["gsc-summary", projectId, days],
    queryFn: () => api.gscSummary(projectId!, days),
    enabled,
  });
  const series = useQuery({
    queryKey: ["gsc-series", projectId, days],
    queryFn: () => api.gscTimeseries(projectId!, days),
    enabled,
  });
  const queries = useQuery({
    queryKey: ["gsc-queries", projectId, days],
    queryFn: () => api.gscQueries(projectId!, days),
    enabled,
  });
  const pages = useQuery({
    queryKey: ["gsc-pages", projectId, days],
    queryFn: () => api.gscPages(projectId!, days),
    enabled,
  });
  const striking = useQuery({
    queryKey: ["gsc-striking", projectId, days],
    queryFn: () => api.gscStrikingDistance(projectId!, days),
    enabled,
  });

  const connect = useMutation({
    mutationFn: () => api.googleAuthorizeUrl(projectId!, "search_console", "/search/search-console"),
    onSuccess: ({ authorizationUrl }) => {
      window.location.href = authorizationUrl;
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const sync = useMutation({
    mutationFn: () => api.gscSync(projectId!, days),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["gsc-summary"] });
      qc.invalidateQueries({ queryKey: ["gsc-series"] });
      qc.invalidateQueries({ queryKey: ["gsc-queries"] });
      qc.invalidateQueries({ queryKey: ["gsc-pages"] });
      qc.invalidateQueries({ queryKey: ["gsc-striking"] });
      qc.invalidateQueries({ queryKey: ["google-connections"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  if (!projectId) {
    return <div className="flex h-40 items-center justify-center text-sm text-brand-500">Select a project.</div>;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Google Search Console"
        subtitle="What is actually happening in Google organic search for your site."
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
      ) : gsc?.status === "NEEDS_SELECTION" ? (
        // Authorized, but no property chosen yet. Without this branch the page
        // fell through to the Connect prompt and the flow could never finish —
        // authorize, come back, see "not connected", authorize again.
        <PropertyPicker
          projectId={projectId}
          provider="search_console"
          title="Choose your Search Console property"
          emptyHelp="Your site needs to be verified in Search Console under the Google account you just authorized. If it is verified under a different account, disconnect and connect again with that one."
        />
      ) : !connected ? (
        <ConnectPrompt
          status={gsc?.status ?? "NOT_CONNECTED"}
          statusMessage={gsc?.statusMessage ?? null}
          configured={connections.data?.configuration.configured ?? false}
          missing={connections.data?.configuration.missing ?? []}
          pending={connect.isPending}
          onConnect={() => connect.mutate()}
        />
      ) : (
        <>
          <ConnectionHeader
            property={gsc?.selectedResourceName || gsc?.selectedResourceId || null}
            lastSyncedAt={gsc?.lastSyncedAt ?? null}
            nextSyncAt={gsc?.nextSyncAt ?? null}
          />

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
              {/* Real dates, because "28 days" and the 28 days we actually hold
                  are not always the same thing. */}
              <p className="text-[12px] text-brand-500">
                {day(summary.data.range.start)} – {day(summary.data.range.end)} · {summary.data.daysWithData} days of
                data
                {summary.data.comparisonRange
                  ? ` · compared with ${day(summary.data.comparisonRange.start)} – ${day(summary.data.comparisonRange.end)}`
                  : " · no earlier period to compare against yet"}
              </p>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="Clicks" value={num(summary.data.clicks.current)} delta={summary.data.clicks.changePct} deltaSuffix="%" />
                <Kpi
                  label="Impressions"
                  value={num(summary.data.impressions.current)}
                  delta={summary.data.impressions.changePct}
                  deltaSuffix="%"
                />
                <Kpi label="CTR" value={pct(summary.data.ctr.current)} delta={summary.data.ctr.changePct} deltaSuffix="%" />
                <Kpi
                  label="Average position"
                  value={summary.data.position.current.toFixed(1)}
                  delta={summary.data.position.changePct}
                  deltaSuffix="%"
                  // Position counts down. Without this a fall from 12 to 8 —
                  // an improvement — would be drawn in red as a decline.
                  deltaGood="down"
                />
              </div>

              <Panel
                title="Search performance"
                actions={
                  <div className="flex gap-1">
                    {METRICS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setMetric(m.key)}
                        className={`rounded px-2 py-1 text-[11px] font-medium ${
                          metric === m.key ? "bg-brand-100 text-brand-950" : "text-brand-500 hover:text-brand-950"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                }
              >
                <PerformanceChart points={series.data ?? []} metric={metric} />
              </Panel>

              <Panel
                title="Striking distance"
                subtitle={
                  striking.data?.[0]
                    ? `Ranking between ${striking.data[0].criteria.minPosition} and ${striking.data[0].criteria.maxPosition} with at least ${num(striking.data[0].criteria.minImpressions)} impressions.`
                    : "Queries ranking just outside where clicks happen."
                }
              >
                {striking.isLoading ? (
                  <Loading />
                ) : !striking.data?.length ? (
                  <Empty>No queries in that band yet.</Empty>
                ) : (
                  <Table minWidth={640}>
                    <thead>
                      <tr>
                        <Th>Query</Th>
                        <Th>Impressions</Th>
                        <Th>Clicks</Th>
                        <Th>CTR</Th>
                        <Th>Position</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {striking.data.map((row) => (
                        <Tr key={row.key}>
                          <Td>{row.key}</Td>
                          <Td>{num(row.impressions)}</Td>
                          <Td>{num(row.clicks)}</Td>
                          <Td>{pct(row.ctr)}</Td>
                          <Td>{row.position.toFixed(1)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Panel>

              <Panel title="Top search queries">
                {queries.isLoading ? (
                  <Loading />
                ) : !queries.data?.length ? (
                  <Empty>No queries recorded for this period.</Empty>
                ) : (
                  <Table minWidth={640}>
                    <thead>
                      <tr>
                        <Th>Query</Th>
                        <Th>Clicks</Th>
                        <Th>Impressions</Th>
                        <Th>CTR</Th>
                        <Th>Position</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {queries.data.map((row) => (
                        <Tr key={row.key}>
                          <Td>{row.key}</Td>
                          <Td>{num(row.clicks)}</Td>
                          <Td>{num(row.impressions)}</Td>
                          <Td>{pct(row.ctr)}</Td>
                          <Td>{row.position.toFixed(1)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Panel>

              <Panel title="Top organic pages" subtitle="Select a page to see the searches that bring it traffic.">
                {pages.isLoading ? (
                  <Loading />
                ) : !pages.data?.length ? (
                  <Empty>No pages recorded for this period.</Empty>
                ) : (
                  <Table minWidth={640}>
                    <thead>
                      <tr>
                        <Th>Page</Th>
                        <Th>Clicks</Th>
                        <Th>Impressions</Th>
                        <Th>CTR</Th>
                        <Th>Position</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {pages.data.map((row) => (
                        <Tr
                          key={row.key}
                          className="cursor-pointer"
                          onClick={() => setOpenPage(openPage === row.key ? null : row.key)}
                        >
                          <Td>
                            <span className="block max-w-[26rem] truncate">{row.key}</span>
                          </Td>
                          <Td>{num(row.clicks)}</Td>
                          <Td>{num(row.impressions)}</Td>
                          <Td>{pct(row.ctr)}</Td>
                          <Td>{row.position.toFixed(1)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Panel>

              {openPage && <PageQueries projectId={projectId} page={openPage} days={days} onClose={() => setOpenPage(null)} />}
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * What to show when Search Console is not connected.
 *
 * Never zeroes. A dashboard of zeroes reads as "your site gets no search
 * traffic", which is a claim about their business rather than about our data.
 */
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
        <SearchIcon size={26} className="mx-auto mb-3 text-brand-300" />
      )}
      <p className="text-[14px] font-medium text-brand-950">
        {expired ? "Authorization expired" : "Search Console is not connected"}
      </p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-brand-500">
        {statusMessage ??
          "Connect Google Search Console to see the searches your site already appears for, which pages answer them, and where you rank just outside the clicks."}
      </p>

      {configured ? (
        <button
          onClick={onConnect}
          disabled={pending}
          className="mx-auto mt-5 flex items-center gap-2 rounded-lg bg-brand-950 px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
          {expired ? "Reconnect Google" : "Connect Google Search Console"}
        </button>
      ) : (
        // A Connect button that can only fail at Google's end is worse than
        // saying what is missing — the person who can fix it is the operator.
        <p className="mx-auto mt-4 max-w-md rounded-lg bg-brand-100 px-3 py-2.5 text-[12px] leading-relaxed text-brand-600">
          Google connections are not configured on this deployment yet
          {missing.length > 0 ? `: ${missing.join(", ")} not set.` : "."}
        </p>
      )}
    </div>
  );
}

function ConnectionHeader({
  property,
  lastSyncedAt,
  nextSyncAt,
}: {
  property: string | null;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-white px-5 py-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
      <span className="flex items-center gap-2 text-[13px] font-medium text-brand-950">
        <span className="h-2 w-2 rounded-full bg-success-500" /> Connected
      </span>
      {property && (
        <span className="text-[12px] text-brand-600">
          Property <span className="font-medium text-brand-950">{property}</span>
        </span>
      )}
      <span className="text-[12px] text-brand-500">
        {/* "Never" rather than a blank: a connection that has never synced is
            a real state and the reason the page below is empty. */}
        Last synced {lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : "never"}
      </span>
      {nextSyncAt && (
        <span className="text-[12px] text-brand-500">Next sync {new Date(nextSyncAt).toLocaleString()}</span>
      )}
    </div>
  );
}

function NoDataYet({ syncing, onSync }: { syncing: boolean; onSync: () => void }) {
  return (
    <div className="rounded-xl border border-dashed bg-white px-6 py-12 text-center" style={{ borderColor: "var(--color-brand-200)" }}>
      <p className="text-[14px] font-medium text-brand-950">Nothing synced yet</p>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-brand-500">
        Search Console is connected but no data has been pulled in. A sync runs automatically each morning, or you can
        run one now. Google publishes search data two to three days late, so the most recent days will always be
        missing.
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

function PerformanceChart({ points, metric }: { points: GscPoint[]; metric: string }) {
  if (points.length === 0) return <Empty>No data in this period.</Empty>;

  const config = METRICS.find((m) => m.key === metric)!;
  return (
    <div className="px-2 py-3">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" />
          <XAxis dataKey="date" tickFormatter={day} tick={{ fontSize: 11 }} stroke="var(--color-brand-400)" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="var(--color-brand-400)"
            tickFormatter={(v: number) => (metric === "ctr" ? `${(v * 100).toFixed(1)}%` : String(v))}
            // Position counts down, so the axis is inverted and a line going
            // up means an improvement, as it does for every other metric here.
            reversed={metric === "position"}
          />
          <Tooltip
            labelFormatter={(v) => new Date(String(v)).toLocaleDateString()}
            formatter={(v) => {
              const value = Number(v);
              return [metric === "ctr" ? pct(value) : metric === "position" ? value.toFixed(1) : num(value), config.label];
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--color-brand-100)" }}
          />
          <Line type="monotone" dataKey={metric} stroke={config.color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The searches that land on one page — §19's query-to-page relationship. */
function PageQueries({
  projectId,
  page,
  days,
  onClose,
}: {
  projectId: string;
  page: string;
  days: number;
  onClose: () => void;
}) {
  const queries = useQuery({
    queryKey: ["gsc-page-queries", projectId, page, days],
    queryFn: () => api.gscPageQueries(projectId, page, days),
  });

  return (
    <Panel
      title="Searches landing on this page"
      subtitle={page}
      actions={
        <button onClick={onClose} className="text-[11px] font-medium text-brand-500 hover:text-brand-950">
          Close
        </button>
      }
    >
      {queries.isLoading ? (
        <Loading />
      ) : !queries.data?.length ? (
        <Empty>No queries recorded for this page in this period.</Empty>
      ) : (
        <Table minWidth={560}>
          <thead>
            <tr>
              <Th>Query</Th>
              <Th>Clicks</Th>
              <Th>Impressions</Th>
              <Th>CTR</Th>
              <Th>Position</Th>
            </tr>
          </thead>
          <tbody>
            {queries.data.map((row) => (
              <Tr key={row.key}>
                <Td>{row.key}</Td>
                <Td>{num(row.clicks)}</Td>
                <Td>{num(row.impressions)}</Td>
                <Td>{pct(row.ctr)}</Td>
                <Td>{row.position.toFixed(1)}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
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

export default function SearchConsolePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-32 items-center justify-center text-sm text-brand-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Search Console…
        </div>
      }
    >
      <SearchConsoleClient />
    </Suspense>
  );
}
