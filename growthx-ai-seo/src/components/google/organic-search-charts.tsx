"use client";

import React, { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";

export interface SearchQueryRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface CtrOpportunityRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  estimatedMissedClicks?: number;
}

type ViewMode = "top" | "striking" | "ctr";

function shortQuery(q: string): string {
  const clean = q.trim();
  return clean.length > 24 ? `${clean.slice(0, 23)}…` : clean;
}

export function OrganicSearchCharts({
  allQueries,
  strikingQueries,
  ctrOpportunities,
  onSelectTab,
}: {
  allQueries: SearchQueryRow[];
  strikingQueries: SearchQueryRow[];
  ctrOpportunities: CtrOpportunityRow[];
  onSelectTab?: (tab: "top" | "page2" | "ctr") => void;
}) {
  const [mode, setMode] = useState<ViewMode>("top");

  const { slices, page1Share } = useMemo(() => {
    const total = allQueries.length;
    if (total === 0) return { slices: [], page1Share: 0 };
    const top3 = allQueries.filter((q) => q.position <= 3).length;
    const pos4to10 = allQueries.filter((q) => q.position > 3 && q.position <= 10).length;
    const pos11to20 = allQueries.filter((q) => q.position > 10 && q.position <= 20).length;
    const pos21plus = allQueries.filter((q) => q.position > 20).length;
    return {
      page1Share: Math.round(((top3 + pos4to10) / total) * 100),
      slices: [
        { label: "Top 3 (#1–3)", value: top3, color: "var(--color-success-500)" },
        { label: "Page 1 (#4–10)", value: pos4to10, color: "var(--color-accent-500)" },
        { label: "Striking (#11–20)", value: pos11to20, color: "var(--color-warning-500)" },
        { label: "Page 3+ (#21+)", value: pos21plus, color: "var(--color-brand-300)" },
      ].filter((s) => s.value > 0),
    };
  }, [allQueries]);

  const modes = useMemo(() => {
    const list: { id: ViewMode; label: string; tabTarget: "top" | "page2" | "ctr" }[] = [
      { id: "top", label: "Top Clicks", tabTarget: "top" },
    ];
    if (strikingQueries.length > 0) {
      list.push({ id: "striking", label: "Striking #11–20", tabTarget: "page2" });
    }
    if (ctrOpportunities.some((c) => (c.estimatedMissedClicks ?? 0) > 0)) {
      list.push({ id: "ctr", label: "Missed Clicks", tabTarget: "ctr" });
    }
    return list;
  }, [strikingQueries, ctrOpportunities]);

  const activeMode = modes.find((m) => m.id === mode) ?? modes[0];

  const barRows = useMemo(() => {
    if (activeMode.id === "striking") {
      return [...strikingQueries]
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 6)
        .map((q) => ({
          query: q.key,
          shortQuery: shortQuery(q.key),
          metricValue: q.impressions,
          metricLabel: "Impressions",
          clicks: q.clicks,
          impressions: q.impressions,
          position: q.position,
          ctrPct: Math.round((q.ctr || 0) * 1000) / 10,
          color: "var(--color-warning-500)",
        }));
    }
    if (activeMode.id === "ctr") {
      return [...ctrOpportunities]
        .filter((q) => (q.estimatedMissedClicks ?? 0) > 0)
        .sort((a, b) => (b.estimatedMissedClicks ?? 0) - (a.estimatedMissedClicks ?? 0))
        .slice(0, 6)
        .map((q) => ({
          query: q.key,
          shortQuery: shortQuery(q.key),
          metricValue: Math.round(q.estimatedMissedClicks ?? 0),
          metricLabel: "Est. missed clicks",
          clicks: q.clicks,
          impressions: q.impressions,
          position: q.position,
          ctrPct: Math.round((q.ctr || 0) * 1000) / 10,
          color: "var(--color-accent-500)",
        }));
    }
    const sortedByClicks = [...allQueries].sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
    const hasClicks = sortedByClicks.some((q) => q.clicks > 0);
    return sortedByClicks.slice(0, 6).map((q) => ({
      query: q.key,
      shortQuery: shortQuery(q.key),
      metricValue: hasClicks ? q.clicks : q.impressions,
      metricLabel: hasClicks ? "Clicks" : "Impressions",
      clicks: q.clicks,
      impressions: q.impressions,
      position: q.position,
      ctrPct: Math.round((q.ctr || 0) * 1000) / 10,
      color: hasClicks ? "var(--color-success-500)" : "var(--color-accent-500)",
    }));
  }, [activeMode.id, allQueries, strikingQueries, ctrOpportunities]);

  if (allQueries.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left: SERP Position Buckets Donut */}
      <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-brand-950">
              SERP Rank Distribution
            </h3>
            <p className="mt-0.5 text-[11.5px] text-brand-500">
              Position spread across {allQueries.length.toLocaleString()} Search Console queries
            </p>
          </div>
          {onSelectTab && (
            <button
              type="button"
              onClick={() => onSelectTab("page2")}
              className="text-[11.5px] font-semibold text-accent-600 hover:text-accent-700 cursor-pointer shrink-0"
            >
              Page 2 →
            </button>
          )}
        </div>
        <div className="my-auto py-1">
          <DonutChart
            data={slices}
            centerValue={`${page1Share}%`}
            centerLabel="Page 1"
            size={130}
            thickness={15}
            legendPosition="right"
            emptyText="No queries"
          />
        </div>
      </div>

      {/* Right: Top Clicks / Striking / Missed Clicks Horizontal BarChart */}
      <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
        <div className="mb-3 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-brand-950">
              {activeMode.id === "striking"
                ? "Page-2 Striking Distance Queries"
                : activeMode.id === "ctr"
                  ? "Highest Missed-Click Opportunities"
                  : "Top Performing Search Queries"}
            </h3>
            <p className="mt-0.5 text-[11.5px] text-brand-500">
              {activeMode.id === "striking"
                ? "Highest-impression queries sitting at #11–#20 ready to break into Page 1"
                : activeMode.id === "ctr"
                  ? "Queries getting fewer clicks than expected for their Google rank"
                  : "Highest-volume search queries driving organic visibility in Google"}
            </p>
          </div>

          {modes.length > 1 && (
            <div
              role="tablist"
              aria-label="Keyword chart view"
              className="inline-flex items-center gap-0.5 rounded-lg border border-brand-200/80 bg-brand-50 p-0.5 self-start sm:self-auto shrink-0"
            >
              {modes.map((m) => {
                const active = m.id === activeMode.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMode(m.id)}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                      active
                        ? "bg-surface-1 text-brand-950 shadow-2xs"
                        : "text-brand-500 hover:text-brand-900",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {barRows.length > 0 ? (
          <div style={{ height: Math.max(164, barRows.length * 34 + 22) }} className="w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barRows}
                layout="vertical"
                margin={{ top: 2, right: 16, left: 4, bottom: 2 }}
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
                  dataKey="shortQuery"
                  width={148}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11.5, fill: "var(--color-brand-700)", fontWeight: 500 }}
                />
                <Tooltip
                  cursor={CHART_CURSOR_BAR}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as (typeof barRows)[number] | undefined;
                    if (!row) return null;
                    return (
                      <ChartTooltipCard
                        title={row.query}
                        rows={[
                          {
                            label: row.metricLabel,
                            value: row.metricValue.toLocaleString(),
                            color: row.color,
                            shape: "bar",
                          },
                          {
                            label: "Clicks / Impr.",
                            value: `${row.clicks.toLocaleString()} / ${row.impressions.toLocaleString()}`,
                            color: "var(--color-brand-400)",
                            shape: "dot",
                          },
                        ]}
                        footer={{
                          label: "Avg Position · CTR",
                          value: `#${row.position.toFixed(1)} · ${row.ctrPct}%`,
                        }}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="metricValue"
                  barSize={13}
                  radius={[0, 6, 6, 0]}
                  background={{ fill: "var(--color-brand-100)", radius: 6 }}
                  onClick={() => onSelectTab?.(activeMode.tabTarget)}
                  className={onSelectTab ? "cursor-pointer" : undefined}
                >
                  {barRows.map((row) => (
                    <Cell key={row.query} fill={row.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-brand-400">
            No matching opportunities in this period.
          </p>
        )}
      </div>
    </div>
  );
}
