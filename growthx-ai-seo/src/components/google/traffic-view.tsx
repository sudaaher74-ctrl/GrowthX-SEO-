"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, Globe, Percent, Search, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { SourceBadge } from "@/components/google/parts";
import { Ga4Gate } from "@/components/google/ga4-gate";
import type { Ga4Report, Ga4ReportData } from "@/lib/api-client";
import { DASH, count, duration, formatDayLabel, percent, shortDay } from "@/lib/google-format";

/** The five groups the view compares; anything else Google Analytics reports lands in "Other". */
type Group = "Organic Search" | "Direct" | "Referral" | "Social" | "Paid" | "Other";
const GROUPS: Group[] = ["Organic Search", "Direct", "Referral", "Social", "Paid", "Other"];

/** Maps a GA4 default channel group onto a comparison group. Unknown names are kept as "Other", never dropped. */
function groupOf(channel: string, organic: boolean): Group {
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
  return <Ga4Gate>{({ report, data }) => <TrafficBody report={report} data={data} />}</Ga4Gate>;
}

function TrafficBody({ report: r, data: reportData }: { report: Ga4Report; data: Ga4ReportData }) {
  const [pageSearch, setPageSearch] = useState("");
  const view = useMemo(() => buildTraffic(reportData), [reportData]);
  const { data, groups, total, organic, organicShare, pages } = view;
  const totals = data.totals;

  const filteredPages = useMemo(() => {
    if (!pageSearch.trim()) return pages;
    const q = pageSearch.toLowerCase().trim();
    return pages.filter((p) => p.page.toLowerCase().includes(q) || pathOf(p.page).toLowerCase().includes(q));
  }, [pages, pageSearch]);

  return (
    <div className="space-y-5">
      {r.lastError && <p className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-[12px] text-warning-700">Latest refresh failed, showing the last good data: {r.lastError}</p>}

      {/* ── TOP KPI SUMMARY GRID ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
            <Activity size={18} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold text-brand-400">Total Sessions</p>
              <SourceBadge source="GA4" />
            </div>
            <p className="font-mono text-xl font-bold text-brand-950">{count(total)}</p>
            <p className="text-[10px] text-brand-400">{shortDay(data.startDate)} – {shortDay(data.endDate)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-500/20 text-success-600 font-bold">
            <Globe size={18} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold text-brand-400">Organic Sessions</p>
              <SourceBadge source="GA4" />
            </div>
            <p className="font-mono text-xl font-bold text-brand-950">{count(organic)}</p>
            <p className="text-[10px] text-brand-400">{organicShare === null ? "—" : `${percent(organicShare)} of all sessions`}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-200/60 text-brand-950 font-bold">
            <Users size={18} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold text-brand-400">Active Users</p>
              <SourceBadge source="GA4" />
            </div>
            <p className="font-mono text-xl font-bold text-brand-950">{count(totals.activeUsers)}</p>
            <p className="text-[10px] text-brand-400">{count(totals.newUsers)} new users</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400/20 text-signal-ink font-bold">
            <Percent size={18} />
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-semibold text-brand-400">Engagement Rate</p>
              <SourceBadge source="GA4" />
            </div>
            <p className="font-mono text-xl font-bold text-brand-950">{percent(totals.engagementRate)}</p>
            <p className="text-[10px] text-brand-400">{duration(totals.averageEngagementTimeSec)} avg time</p>
          </div>
        </div>
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
              <Tr key={g.group} className="hover:bg-brand-100/40 transition">
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
                  <div className="h-2 w-36 rounded-full bg-brand-100 overflow-hidden">
                    <div
                      className={g.group === "Organic Search" ? "h-2 rounded-full bg-signal-400" : "h-2 rounded-full bg-brand-400"}
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
                  labelFormatter={(l) => formatDayLabel(l)}
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
          <div className="flex items-center gap-3">
            <div className="relative min-w-[200px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
              <input
                type="text"
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                placeholder="Search landing pages…"
                className="w-full rounded-xl border border-brand-200/70 bg-brand-100/40 py-1 pl-7 pr-3 text-[11px] text-brand-950 placeholder:text-brand-400 focus:outline-hidden focus:ring-1 focus:ring-brand-400"
              />
            </div>
            <Link href="/google/pages" className="text-[12px] font-semibold text-accent-700 hover:underline">
              Organic page performance →
            </Link>
          </div>
        }
      >
        {filteredPages.length === 0 ? (
          <p className="p-4 text-[12px] text-brand-500">
            {pageSearch ? `No landing pages match "${pageSearch}".` : "Google Analytics returned no landing pages for this period."}
          </p>
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
              {filteredPages.map((p) => (
                <Tr key={p.page} className="hover:bg-brand-100/40 transition">
                  <Td>
                    <span className="block max-w-[360px] truncate font-mono text-[11.5px] font-medium text-brand-950" title={p.page}>{pathOf(p.page)}</span>
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

export function buildTraffic(data: Ga4ReportData) {
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
