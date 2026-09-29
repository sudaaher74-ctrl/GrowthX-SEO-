"use client";
import Link from "next/link";
import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Kpi, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { FailedState, LoadingState, NoDataState, NotConnectedState } from "@/components/ui/truthful-state";
import { SourceBadge } from "@/components/google/parts";
import { useGa4Report } from "@/hooks/use-ga4-report";
import { useWorkspace } from "@/hooks/use-growthx";
import type { Ga4ReportData } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { DASH, count, duration, percent, shortDay } from "@/lib/google-format";

/** The five groups the view compares; anything else Google Analytics reports lands in "Other". */
type Group = "Organic Search" | "Direct" | "Referral" | "Social" | "Paid" | "Other";
const GROUPS: Group[] = ["Organic Search", "Direct", "Referral", "Social", "Paid", "Other"];

/** Maps a GA4 default channel group onto a comparison group. Unknown names are kept as "Other", never dropped. */
export function groupOf(channel: string, organic: boolean): Group {
  if (organic) return "Organic Search";
  const c = channel.toLowerCase();
  if (c.startsWith("paid") || c === "display" || c === "cross-network" || c === "affiliates") return "Paid";
  if (c === "direct") return "Direct";
  if (c === "referral") return "Referral";
  if (c === "organic social" || c === "organic video") return "Social";
  return "Other";
}

/** A landing page shown as its path, since the host is always the site's own. */
function pathOf(page: string): string {
  try {
    const u = new URL(page);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return page || "/";
  }
}

/**
 * Traffic & Acquisition: where visits come from, with Organic Search set
 * against every other channel, and which landing pages receive them. All
 * figures are the stored Google Analytics report for the chosen window;
 * a figure Analytics did not measure shows "—", never zero.
 */
export function TrafficView() {
  const { projectId } = useWorkspace();
  const { report, sync, days } = useGa4Report(projectId);
  const r = report.data;

  const reportData = report.data?.data ?? null;
  const view = useMemo(() => (reportData ? build(reportData) : null), [reportData]);

  if (!projectId || report.isLoading) {
    return <LoadingState compact title="Loading traffic…" message="Reading the stored Google Analytics report for this workspace." />;
  }
  if (report.error || !r) {
    return <FailedState title="Could not load traffic" error={errorMessage(report.error)} onRetry={() => report.refetch()} />;
  }

  if (r.state === "NOT_CONNECTED") {
    return (
      <NotConnectedState
        title="Connect Google Analytics to see your traffic"
        missing="Google Analytics is not connected for this workspace."
        whyItMatters="Analytics is the only source that knows which channel each visit came from. Nothing is estimated."
        actionRequired="Connect Google Analytics, and choose your website's property."
        action={{ label: "Open Integrations", href: "/integrations" }}
      />
    );
  }
  if (r.state === "NEEDS_SELECTION" || r.state === "NEEDS_REAUTH" || r.state === "ERROR") {
    return (
      <FailedState
        title={r.state === "NEEDS_SELECTION" ? "Choose a Google Analytics property" : r.state === "NEEDS_REAUTH" ? "Reconnect Google Analytics" : "Google Analytics returned an error"}
        error={r.message ?? "Open Integrations to fix the Google Analytics connection."}
      />
    );
  }
  if (r.state === "NEVER_SYNCED" && !r.data) {
    return (
      <LoadingState
        compact
        title={sync.isPending ? "Fetching from Google Analytics…" : "Nothing fetched yet"}
        message={sync.error ? errorMessage(sync.error) : "The first fetch reads channels, landing pages and daily visits. Use Refresh data above if it does not start."}
      />
    );
  }
  if (!view || r.data?.empty) {
    return (
      <NoDataState
        compact
        title="No traffic recorded for this period"
        missing={`Google Analytics reported no sessions in the last ${days} days.`}
        whyItMatters="Channels and landing pages are built from sessions, so there is nothing to compare yet."
        actionRequired="Try a longer range, or press Refresh data above."
      />
    );
  }

  const { data, groups, total, organic, organicShare, pages } = view;
  const totals = data.totals;

  return (
    <div className="space-y-4">
      {r.lastError && <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-[12px] text-warning-700">Latest refresh failed, showing the last good data: {r.lastError}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Sessions" value={count(total)} aside={<SourceBadge source="GA4" />} sub={`${shortDay(data.startDate)} – ${shortDay(data.endDate)}`} />
        <Kpi
          label="Organic Search sessions"
          value={count(organic)}
          aside={<SourceBadge source="GA4" />}
          sub={organicShare === null ? undefined : `${percent(organicShare)} of all sessions`}
        />
        <Kpi label="Active users" value={count(totals.activeUsers)} aside={<SourceBadge source="GA4" />} sub={`${count(totals.newUsers)} new`} />
        <Kpi
          label="Engagement rate"
          value={percent(totals.engagementRate)}
          aside={<SourceBadge source="GA4" />}
          sub={`${duration(totals.averageEngagementTimeSec)} average engagement per user`}
        />
      </div>

      <Panel
        title="Organic Search against other channels"
        subtitle="Sessions by Google Analytics default channel group, combined into the groups people compare."
      >
        <Table minWidth={820}>
          <thead>
            <tr>
              <Th>Channel</Th>
              <Th align="right">Sessions</Th>
              <Th align="right">Share</Th>
              <Th align="right">Users</Th>
              <Th align="right">Engagement</Th>
              <Th align="right">Key events</Th>
              <Th>Volume</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Tr key={g.group}>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-semibold text-brand-950">{g.group}</span>
                    {g.group === "Organic Search" && <Pill tone="good">Google</Pill>}
                  </div>
                  {g.channels.length > 0 && g.channels.some((c) => c !== g.group) && (
                    <p className="mt-0.5 text-[10.5px] text-brand-400">{g.channels.join(", ")}</p>
                  )}
                </Td>
                <Td align="right">{count(g.sessions)}</Td>
                <Td align="right">{percent(g.share)}</Td>
                <Td align="right">{count(g.users)}</Td>
                <Td align="right">{percent(g.engagementRate)}</Td>
                <Td align="right">{count(g.keyEvents)}</Td>
                <Td>
                  <div className="h-1.5 w-40 rounded-full bg-brand-100">
                    <div
                      className={g.group === "Organic Search" ? "h-1.5 rounded-full bg-primary-600" : "h-1.5 rounded-full bg-brand-400"}
                      style={{ width: `${Math.max((g.share ?? 0) * 100, g.sessions > 0 ? 1.5 : 0)}%` }}
                    />
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <p className="border-t px-4 py-2.5 text-[11px] text-brand-500">
          Users are counted per channel, so they add up to more than the {count(totals.activeUsers)} distinct active users: one person can arrive from two channels.
          Engagement is weighted by sessions. “—” means the figure was not measured (no key events set up), or this report was stored before it was fetched per channel: use Refresh data above.
        </p>
      </Panel>

      <Panel title="Daily sessions" subtitle="All channels, by day. Analytics figures end yesterday.">
        <div className="h-64 w-full p-4">
          {data.daily.length >= 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--text-muted)" }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickFormatter={(v) => count(Number(v))} width={48} />
                <Tooltip
                  formatter={(v, name) => [count(Number(v)), name === "sessions" ? "Sessions" : "Users"]}
                  labelFormatter={(l) => new Date(`${String(l)}T00:00:00`).toDateString()}
                />
                <Line type="monotone" dataKey="sessions" stroke="var(--color-series-1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="users" stroke="var(--color-series-2)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-[12px] text-brand-500">Not enough daily data in this period to draw a trend.</p>
          )}
        </div>
      </Panel>

      <Panel
        title="Landing pages"
        subtitle="Where sessions from every channel begin, top pages by sessions."
        actions={
          <Link href="/google/pages" className="text-[12px] font-semibold text-accent-700 hover:underline">
            Organic page performance →
          </Link>
        }
      >
        {pages.length === 0 ? (
          <p className="p-4 text-[12px] text-brand-500">Google Analytics returned no landing pages for this period.</p>
        ) : (
          <Table minWidth={640}>
            <thead>
              <tr>
                <Th>Landing page</Th>
                <Th align="right">Sessions</Th>
                <Th align="right">Share of sessions</Th>
                <Th align="right">Engagement</Th>
                <Th align="right">Key events</Th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <Tr key={p.page}>
                  <Td>
                    <span className="block max-w-[360px] truncate font-mono text-[11.5px] text-brand-950" title={p.page}>{pathOf(p.page)}</span>
                  </Td>
                  <Td align="right">{count(p.sessions)}</Td>
                  <Td align="right">{total > 0 ? percent(p.sessions / total) : DASH}</Td>
                  <Td align="right">{percent(p.engagementRate)}</Td>
                  <Td align="right">{count(p.keyEvents)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className="border-t px-4 py-2.5 text-[11px] text-brand-500">
          “—” means Google Analytics did not measure it — for key events, the property has none set up. It is never a zero.
        </p>
      </Panel>
    </div>
  );
}

function build(data: Ga4ReportData) {
  const total = data.channels.reduce((s, c) => s + c.sessions, 0) || data.totals.sessions;
  const byGroup = new Map<Group, { sessions: number; users: number; channels: string[]; engaged: number; engagedSessions: number; keyEvents: number | null; hasKeyEvents: boolean }>();
  for (const c of data.channels) {
    const g = groupOf(c.channel, c.organic);
    const entry = byGroup.get(g) ?? { sessions: 0, users: 0, channels: [], engaged: 0, engagedSessions: 0, keyEvents: null, hasKeyEvents: false };
    if (c.engagementRate !== undefined) {
      entry.engaged += c.engagementRate * c.sessions;
      entry.engagedSessions += c.sessions;
    }
    if (c.keyEvents != null) {
      entry.keyEvents = (entry.keyEvents ?? 0) + c.keyEvents;
      entry.hasKeyEvents = true;
    }
    entry.sessions += c.sessions;
    entry.users += c.users;
    entry.channels.push(c.channel);
    byGroup.set(g, entry);
  }
  const groups = GROUPS.flatMap((group) => {
    const e = byGroup.get(group);
    // Organic Search is always listed, so a site with none sees that plainly. Other empty groups are left out.
    if (!e && group !== "Organic Search") return [];
    const sessions = e?.sessions ?? 0;
    return [
      {
        group,
        sessions,
        users: e?.users ?? 0,
        channels: e?.channels ?? [],
        share: total > 0 ? sessions / total : null,
        // Null, not zero, when this report predates per-channel engagement or the property has no key events.
        engagementRate: e && e.engagedSessions > 0 ? e.engaged / e.engagedSessions : null,
        keyEvents: e?.hasKeyEvents ? e.keyEvents : null,
      },
    ];
  }).sort((a, b) => b.sessions - a.sessions);
  const organic = byGroup.get("Organic Search")?.sessions ?? 0;
  const pages = [...data.landingPages].sort((a, b) => b.sessions - a.sessions).slice(0, 25);
  return { data, groups, total, organic, organicShare: total > 0 ? organic / total : null, pages };
}
