"use client";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw } from "lucide-react";
import { ActionButton, Kpi, Panel, Pill, StatusNote, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import {
  FailedState,
  LoadingState,
  NoDataState,
  NotConfiguredState,
  NotConnectedState,
} from "@/components/ui/truthful-state";
import { useGa4Report } from "@/hooks/use-ga4-report";
import { usePeriodDays } from "@/hooks/use-growthx";
import { api, type Ga4Report, type Ga4ReportData } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

const count = (n: number) => Math.round(n).toLocaleString();
const percent = (rate: number) => `${(rate * 100).toFixed(1)}%`;
const duration = (seconds: number) => {
  const s = Math.round(seconds);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

type Ga4Hook = ReturnType<typeof useGa4Report>;

/**
 * Renders GA4 figures, or says exactly why there are none.
 *
 * Every non-data state names its cause and, where one exists, offers the one
 * action that fixes it. There is deliberately no branch that renders zeros or
 * an empty box.
 */
function Ga4Gate({
  ga4,
  children,
}: {
  ga4: Ga4Hook;
  children: (data: Ga4ReportData, report: Ga4Report) => React.ReactNode;
}) {
  const { report, sync } = ga4;
  const data = report.data;
  const retry = () => sync.mutate();
  const fetching = sync.isPending;

  if (report.isLoading) return <LoadingState compact title="Loading Google Analytics…" message="Reading the saved report for this workspace." />;
  if (report.error || !data) {
    return (
      <FailedState
        compact
        title="Could not load Google Analytics"
        error={errorMessage(report.error)}
        onRetry={() => report.refetch()}
      />
    );
  }
  if (fetching && !data.data) {
    return <LoadingState compact title="Fetching from Google Analytics…" message="This can take up to a minute the first time." />;
  }

  switch (data.state) {
    case "NOT_CONNECTED":
      return (
        <NotConnectedState
          compact
          title="Google Analytics 4 is not connected"
          missing={data.message ?? undefined}
          whyItMatters="Sessions, users and conversions come straight from your own GA4 property."
          action={{ label: "Connect Google Analytics", href: "/integrations" }}
        />
      );
    case "NEEDS_SELECTION":
      return (
        <NotConfiguredState
          compact
          title="Choose a GA4 property"
          missing={data.message ?? undefined}
          whyItMatters="Google Analytics has several properties per account; we only read the one you pick."
          actionRequired="Pick your website's property."
          action={{ label: "Choose property", href: "/integrations" }}
        />
      );
    case "NEEDS_REAUTH":
      return (
        <NotConnectedState
          compact
          title="Google Analytics needs to be reconnected"
          missing={data.message ?? undefined}
          whyItMatters="Google stopped accepting the saved permission, so nothing new can be read until you reconnect."
          actionRequired="Reconnect Google."
          action={{ label: "Reconnect", href: "/integrations" }}
        />
      );
    case "ERROR":
      return <FailedState compact title="Google Analytics could not be read" error={data.message ?? undefined} onRetry={retry} />;
    case "NEVER_SYNCED":
      return sync.error ? (
        <FailedState compact title="Google Analytics could not be read" error={errorMessage(sync.error)} onRetry={retry} />
      ) : (
        <NoDataState
          compact
          title="Nothing fetched from Google Analytics yet"
          missing={data.message ?? undefined}
          whyItMatters="The first fetch reads the last 90 days. After that it refreshes on its own every day."
          actionRequired="Fetch your Google Analytics data now."
          action={{ label: "Fetch now", onClick: retry, variant: "primary" }}
        />
      );
    case "EMPTY":
      return (
        <NoDataState
          compact
          title="Google Analytics has no data for this period"
          missing={data.message ?? undefined}
          whyItMatters="If you expected traffic, the wrong property may be selected, or its data stream is not receiving visits."
          actionRequired="Check the property, then fetch again."
          action={{ label: "Fetch again", onClick: retry, variant: "secondary" }}
          secondaryAction={{ label: "Change property", href: "/integrations" }}
        />
      );
    default: {
      if (!data.data) return null;
      const failure = sync.error ? errorMessage(sync.error) : data.lastError;
      return (
        <div className="space-y-3">
          {failure && (
            <StatusNote tone="bad">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  The latest refresh failed, so this is the data from {relativeTime(data.lastSyncedAt)}. {failure}
                </span>
                <ActionButton onClick={retry} disabled={fetching} icon={<RefreshCw size={12} />}>
                  Retry
                </ActionButton>
              </span>
            </StatusNote>
          )}
          {children(data.data, data)}
        </div>
      );
    }
  }
}

function Freshness({ ga4 }: { ga4: Ga4Hook }) {
  const data = ga4.report.data;
  if (!data?.lastSyncedAt) return null;
  return (
    <span className="flex items-center gap-2 text-[11px] text-brand-400">
      Synced {relativeTime(data.lastSyncedAt)}
      <ActionButton
        onClick={() => ga4.sync.mutate()}
        disabled={ga4.sync.isPending}
        icon={<RefreshCw size={12} className={ga4.sync.isPending ? "animate-spin" : undefined} />}
      >
        {ga4.sync.isPending ? "Refreshing…" : "Refresh"}
      </ActionButton>
    </span>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────

/**
 * GA4 headline figures, sessions over time and Organic Search on the Dashboard.
 * Renders nothing while GA4 is not connected — the setup guide on that page
 * already asks for the connection.
 */
export function Ga4Overview({ projectId }: { projectId: string | null }) {
  const ga4 = useGa4Report(projectId);
  if (!projectId) return null;
  if (ga4.report.data?.state === "NOT_CONNECTED") return null;

  return (
    <Panel
      title="Website traffic"
      subtitle={`From Google Analytics 4 · last ${ga4.days} days${ga4.report.data?.propertyName ? ` · ${ga4.report.data.propertyName}` : ""}`}
      actions={<Freshness ga4={ga4} />}
    >
      <div className="p-4">
        <Ga4Gate ga4={ga4}>
          {(d) => (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Kpi label="Sessions" value={count(d.totals.sessions)} sub={`${count(d.totals.views)} page views`} />
                <Kpi label="Active users" value={count(d.totals.activeUsers)} sub={`${count(d.totals.newUsers)} new`} />
                <Kpi
                  label="Engagement rate"
                  value={percent(d.totals.engagementRate)}
                  sub={`${duration(d.totals.averageEngagementTimeSec)} average engagement time`}
                />
                <Kpi
                  label="Key events"
                  value={d.totals.keyEvents === null ? "—" : count(d.totals.keyEvents)}
                  sub={d.totals.keyEvents === null ? "None set up in this GA4 property" : "Conversions marked in GA4"}
                />
                <Kpi
                  label="Organic Search sessions"
                  value={count(d.organicSearchSessions)}
                  tone={d.organicSearchSessions > 0 ? "good" : "default"}
                  sub={
                    d.totals.sessions > 0
                      ? `${percent(d.organicSearchSessions / d.totals.sessions)} of all sessions`
                      : undefined
                  }
                />
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold text-brand-950">Sessions over time</p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={d.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--text-muted)" }} minTickGap={24} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} allowDecimals={false} width={36} />
                      <Tooltip
                        formatter={(v, name) => [count(Number(v)), name]}
                        labelFormatter={(l) => new Date(`${String(l)}T00:00:00`).toDateString()}
                      />
                      <Line type="monotone" name="Sessions" dataKey="sessions" stroke="var(--color-series-1)" strokeWidth={2} dot={false} />
                      <Line type="monotone" name="Users" dataKey="users" stroke="var(--color-series-2)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </Ga4Gate>
      </div>
    </Panel>
  );
}

// ── Google Search page ──────────────────────────────────────────────────────

/** Organic Search sessions, for the header beside "Google Analytics 4 connected". */
export function Ga4OrganicPill({ projectId }: { projectId: string }) {
  const { report, days } = useGa4Report(projectId);
  const r = report.data;
  if (!r || report.isLoading) return null;
  if (r.state === "READY" && r.data) {
    return (
      <Pill tone="info">
        Organic Search: {count(r.data.organicSearchSessions)} sessions · {days}d
      </Pill>
    );
  }
  if (r.state === "NOT_CONNECTED" || r.state === "NEVER_SYNCED") return null;
  // Connected but unreadable: say so here, and the Rankings tab says why.
  return (
    <span title={r.message ?? undefined}>
      <Pill tone="warn">GA4 data unavailable</Pill>
    </span>
  );
}

/**
 * Landing pages and channels straight from GA4, for the Rankings tab while
 * Search Console has nothing to show. Labelled as GA4 so it is never mistaken
 * for search positions.
 */
export function Ga4Fallback({ projectId }: { projectId: string }) {
  const ga4 = useGa4Report(projectId);
  return (
    <Panel
      title="From Google Analytics 4"
      subtitle={`Where visits land and how they arrive, last ${ga4.days} days. Search Console positions appear here once it has data.`}
      actions={<Freshness ga4={ga4} />}
    >
      <div className="p-4">
        <Ga4Gate ga4={ga4}>
          {(d) => (
            <div className="space-y-6">
              <div>
                <p className="mb-2 text-[12px] font-semibold text-brand-950">Top landing pages</p>
                <Table minWidth={520}>
                  <thead>
                    <tr>
                      <Th>Landing page</Th>
                      <Th align="right">Sessions</Th>
                      <Th align="right">Engagement rate</Th>
                      <Th align="right">Key events</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.landingPages.map((p) => (
                      <Tr key={p.page}>
                        <Td>
                          <span className="font-mono text-[11.5px]">{p.page}</span>
                        </Td>
                        <Td align="right">{count(p.sessions)}</Td>
                        <Td align="right">{percent(p.engagementRate)}</Td>
                        <Td align="right">{p.keyEvents === null ? "—" : count(p.keyEvents)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold text-brand-950">Sessions by channel</p>
                <Table minWidth={420}>
                  <thead>
                    <tr>
                      <Th>Channel</Th>
                      <Th align="right">Sessions</Th>
                      <Th align="right">Users</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.channels.map((c) => (
                      <Tr key={c.channel}>
                        <Td>
                          {c.channel} {c.organic && <Pill tone="good">Google organic</Pill>}
                        </Td>
                        <Td align="right">{count(c.sessions)}</Td>
                        <Td align="right">{count(c.users)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {d.countries.length > 0 && (
                <p className="text-[11.5px] text-brand-500">
                  Top countries: {d.countries.slice(0, 5).map((c) => `${c.country} (${count(c.sessions)})`).join(" · ")}
                </p>
              )}
            </div>
          )}
        </Ga4Gate>
      </div>
    </Panel>
  );
}

/**
 * Search Console clicks beside GA4 sessions and conversions, matched by
 * landing page. Only shown once Search Console has data to match.
 */
export function Ga4SearchJoin({ projectId }: { projectId: string }) {
  const days = usePeriodDays();
  const join = useQuery({
    queryKey: ["ga4-page-value", projectId, days],
    queryFn: () => api.ga4PageValue(projectId, days),
    retry: false,
  });

  return (
    <Panel
      title="Clicks and visits by page"
      subtitle={`Search Console clicks beside Google Analytics 4 sessions and key events, matched by landing page, last ${days} days.`}
    >
      <div className="p-4">
        {join.isLoading ? (
          <LoadingState compact title="Matching pages…" message="Joining Search Console and Google Analytics 4." />
        ) : join.error ? (
          <FailedState compact title="Could not match pages" error={errorMessage(join.error)} onRetry={() => join.refetch()} />
        ) : !join.data?.hasAnalyticsData ? (
          <NoDataState
            compact
            title="No Google Analytics page data yet"
            missing="Search Console has data, but no Google Analytics landing-page rows have been fetched to match it."
            whyItMatters="Without them the two cannot be shown side by side."
            actionRequired="Fetch Google Analytics from the Integrations page."
            action={{ label: "Open Integrations", href: "/integrations", variant: "secondary" }}
          />
        ) : join.data.rows.length === 0 ? (
          <NoDataState compact title="No pages to match" missing="Neither source has pages for this period." />
        ) : (
          <Table minWidth={640}>
            <thead>
              <tr>
                <Th>Page</Th>
                <Th align="right">Search clicks</Th>
                <Th align="right">GA4 sessions</Th>
                <Th align="right">Key events</Th>
              </tr>
            </thead>
            <tbody>
              {join.data.rows.map((row) => (
                <Tr key={row.page}>
                  <Td>
                    <span className="font-mono text-[11.5px]">{row.page}</span>
                  </Td>
                  <Td align="right">{count(row.clicks)}</Td>
                  <Td align="right">{row.sessions === null ? "—" : count(row.sessions)}</Td>
                  <Td align="right">{row.conversions === null ? "—" : count(row.conversions)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </Panel>
  );
}
