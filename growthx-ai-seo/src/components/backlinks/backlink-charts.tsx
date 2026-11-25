"use client";

import React, { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DonutChart } from "@/components/website/donut-chart";
import {
  CHART_AXIS_TICK,
  CHART_CURSOR_BAR,
  ChartTooltipCard,
} from "@/components/ui/chart-primitives";
import type { BacklinkReport } from "@/lib/backlinks";
import type { BacklinkOverviewResponse } from "@/lib/backlink-intelligence";

function trimHost(domain: string): string {
  const clean = domain.replace(/^www\./i, "").trim();
  return clean.length > 18 ? `${clean.slice(0, 17)}…` : clean;
}

function extractHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function BacklinkVisualHeader({
  snapshot,
  report,
}: {
  snapshot?: BacklinkOverviewResponse | null;
  report?: BacklinkReport;
}) {
  const hasSnapshot = Boolean(snapshot && (snapshot.metrics.backlinks > 0 || snapshot.topReferringDomains.length > 0));
  const hasReport = Boolean(report && (report.summary.totalSources > 0 || report.sources.length > 0));

  // 1. Link Health Donut (strictly same-unit real metrics)
  const linkHealth = useMemo(() => {
    if (snapshot && snapshot.metrics.backlinks > 0) {
      const broken = Math.max(0, snapshot.metrics.brokenBacklinks || 0);
      const healthy = Math.max(0, snapshot.metrics.backlinks - broken);
      const healthyPct = Math.round((healthy / snapshot.metrics.backlinks) * 100);
      return {
        title: "Indexed Link Health",
        subtitle: `${snapshot.metrics.backlinks.toLocaleString()} backlinks in provider index`,
        centerValue: `${healthyPct}%`,
        centerLabel: "Active",
        slices: [
          { label: "Active", value: healthy, color: "var(--color-success-500)" },
          { label: "Broken", value: broken, color: "var(--color-error-500)" },
        ],
      };
    }

    if (report && report.sources.length > 0) {
      const allLinks = report.sources.flatMap((s) => s.links);
      if (allLinks.length > 0) {
        const fresh = allLinks.filter((l) => l.status === "VERIFIED" && l.fresh).length;
        const stale = allLinks.filter((l) => l.status === "VERIFIED" && !l.fresh).length;
        const lost = allLinks.filter((l) => l.status === "LOST").length;
        const other = Math.max(0, allLinks.length - fresh - stale - lost);
        const healthyPct = Math.round(((fresh + stale) / allLinks.length) * 100);
        return {
          title: "Verified Link Health",
          subtitle: `${allLinks.length.toLocaleString()} observed links on checked pages`,
          centerValue: `${healthyPct}%`,
          centerLabel: "Verified",
          slices: [
            { label: "Verified (fresh)", value: fresh, color: "var(--color-success-500)" },
            ...(stale > 0 ? [{ label: "Verified (stale)", value: stale, color: "var(--color-warning-500)" }] : []),
            { label: "Confirmed lost", value: lost, color: "var(--color-error-500)" },
            ...(other > 0 ? [{ label: "Unverified", value: other, color: "var(--color-brand-300)" }] : []),
          ],
        };
      }

      const readCount = report.sources.filter((s) => s.status === "READ").length;
      const blockedCount = report.sources.filter((s) => s.status === "BLOCKED" || s.status === "FAILED").length;
      const pendingCount = Math.max(0, report.sources.length - readCount - blockedCount);
      return {
        title: "Source Check Status",
        subtitle: `${report.sources.length.toLocaleString()} monitored referring pages`,
        centerValue: `${readCount}`,
        centerLabel: "Checked",
        slices: [
          { label: "Checked", value: readCount, color: "var(--color-success-500)" },
          { label: "Pending", value: pendingCount, color: "var(--color-brand-300)" },
          { label: "Blocked / Error", value: blockedCount, color: "var(--color-error-500)" },
        ],
      };
    }

    return null;
  }, [snapshot, report]);

  // 2. Follow vs Nofollow Donut
  const followSplit = useMemo(() => {
    if (snapshot && (snapshot.metrics.dofollow > 0 || snapshot.metrics.nofollow > 0)) {
      const df = Math.max(0, snapshot.metrics.dofollow || 0);
      const nf = Math.max(0, snapshot.metrics.nofollow || 0);
      const total = df + nf;
      const dfPct = total > 0 ? Math.round((df / total) * 100) : 0;
      return {
        subtitle: `${total.toLocaleString()} indexed links with rel attributes`,
        centerValue: `${dfPct}%`,
        centerLabel: "Dofollow",
        slices: [
          { label: "Dofollow", value: df, color: "var(--color-success-500)" },
          { label: "Nofollow", value: nf, color: "var(--color-brand-300)" },
        ],
      };
    }

    if (report && report.sources.length > 0) {
      const ownLinks = report.sources
        .flatMap((s) => s.links)
        .filter((l) => l.targetKind === "OWN" && l.status !== "LOST");
      if (ownLinks.length > 0) {
        const nofollow = ownLinks.filter((l) =>
          l.rel.some((r) => r.toLowerCase() === "nofollow" || r.toLowerCase() === "sponsored" || r.toLowerCase() === "ugc"),
        ).length;
        const dofollow = ownLinks.length - nofollow;
        const dfPct = Math.round((dofollow / ownLinks.length) * 100);
        return {
          subtitle: `${ownLinks.length.toLocaleString()} verified links inspected by Reigel`,
          centerValue: `${dfPct}%`,
          centerLabel: "Dofollow",
          slices: [
            { label: "Dofollow", value: dofollow, color: "var(--color-success-500)" },
            { label: "Nofollow / UGC", value: nofollow, color: "var(--color-brand-300)" },
          ],
        };
      }
    }

    return null;
  }, [snapshot, report]);

  // 3. Top Referring Domains Bar Chart
  const topDomains = useMemo(() => {
    if (snapshot && snapshot.topReferringDomains.length > 0) {
      return [...snapshot.topReferringDomains]
        .sort((a, b) => b.backlinks - a.backlinks)
        .slice(0, 6)
        .map((d) => ({
          domain: d.domain,
          shortDomain: trimHost(d.domain),
          backlinks: d.backlinks,
          rank: d.rank ?? null,
          spamScore: d.spamScore ?? null,
        }));
    }

    if (report && report.sources.length > 0) {
      const hostMap = new Map<string, number>();
      for (const s of report.sources) {
        const host = extractHost(s.sourceUrl);
        if (!host) continue;
        const count = Math.max(1, s._count.links || s.links.length);
        hostMap.set(host, (hostMap.get(host) ?? 0) + count);
      }
      return Array.from(hostMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([domain, backlinks]) => ({
          domain,
          shortDomain: trimHost(domain),
          backlinks,
          rank: null as number | null,
          spamScore: null as number | null,
        }));
    }

    return [];
  }, [snapshot, report]);

  if (!hasSnapshot && !hasReport) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Widget 1: Link Health Donut */}
      <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
        <div className="mb-3">
          <h3 className="text-[13.5px] font-semibold tracking-tight text-brand-950">
            {linkHealth?.title ?? "Link Health"}
          </h3>
          <p className="mt-0.5 text-[11px] text-brand-500">
            {linkHealth?.subtitle ?? "No link status measured yet"}
          </p>
        </div>
        <div className="my-auto py-1">
          <DonutChart
            data={linkHealth?.slices ?? []}
            centerValue={linkHealth?.centerValue}
            centerLabel={linkHealth?.centerLabel}
            size={112}
            thickness={14}
            legendPosition="right"
            emptyText="No links yet"
          />
        </div>
      </div>

      {/* Widget 2: Follow vs Nofollow Donut */}
      <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
        <div className="mb-3">
          <h3 className="text-[13.5px] font-semibold tracking-tight text-brand-950">
            Follow vs. Nofollow
          </h3>
          <p className="mt-0.5 text-[11px] text-brand-500">
            {followSplit?.subtitle ?? "Link equity distribution across inbound links"}
          </p>
        </div>
        <div className="my-auto py-1">
          <DonutChart
            data={followSplit?.slices ?? []}
            centerValue={followSplit?.centerValue}
            centerLabel={followSplit?.centerLabel}
            size={112}
            thickness={14}
            legendPosition="right"
            emptyText="No rel data"
          />
        </div>
      </div>

      {/* Widget 3: Top Referring Domains Bar Chart */}
      <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[13.5px] font-semibold tracking-tight text-brand-950">
              Top Referring Domains
            </h3>
            <p className="mt-0.5 text-[11px] text-brand-500">
              {topDomains.length > 0
                ? "Highest-volume linking hosts in your profile"
                : "No referring domains indexed yet"}
            </p>
          </div>
          {topDomains.length > 0 && (
            <span className="font-mono text-[10.5px] font-medium text-brand-400 tabular-nums shrink-0">
              Top {topDomains.length}
            </span>
          )}
        </div>

        {topDomains.length > 0 ? (
          <div className="h-[156px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topDomains}
                layout="vertical"
                margin={{ top: 2, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="var(--color-brand-100)"
                  strokeDasharray="2 4"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={CHART_AXIS_TICK}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="shortDomain"
                  width={108}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-brand-700)" }}
                />
                <Tooltip
                  cursor={CHART_CURSOR_BAR}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as (typeof topDomains)[number] | undefined;
                    if (!row) return null;
                    const isToxic = (row.spamScore ?? 0) > 30;
                    const color = isToxic
                      ? "var(--color-error-500)"
                      : (row.rank ?? 0) >= 70
                        ? "var(--color-success-500)"
                        : "var(--color-accent-500)";
                    return (
                      <ChartTooltipCard
                        title={row.domain}
                        rows={[
                          {
                            label: "Backlinks",
                            value: row.backlinks.toLocaleString(),
                            color,
                            shape: "bar",
                          },
                          ...(row.rank != null
                            ? [
                                {
                                  label: "Domain Rank",
                                  value: `#${row.rank}`,
                                  color: "var(--color-brand-400)",
                                  shape: "dot" as const,
                                },
                              ]
                            : []),
                          ...(row.spamScore != null
                            ? [
                                {
                                  label: "Spam Score",
                                  value: `${row.spamScore}%`,
                                  color: isToxic ? "var(--color-error-500)" : "var(--color-success-500)",
                                  shape: "dot" as const,
                                },
                              ]
                            : []),
                        ]}
                      />
                    );
                  }}
                />
                <Bar dataKey="backlinks" barSize={11} radius={[0, 5, 5, 0]}>
                  {topDomains.map((row) => (
                    <Cell
                      key={row.domain}
                      fill={
                        (row.spamScore ?? 0) > 30
                          ? "var(--color-error-500)"
                          : (row.rank ?? 0) >= 70
                            ? "var(--color-success-500)"
                            : "var(--color-accent-500)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-brand-400">
            Sync DataForSEO or import referring URLs to chart top hosts.
          </p>
        )}
      </div>
    </div>
  );
}
