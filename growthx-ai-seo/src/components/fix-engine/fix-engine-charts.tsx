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
import type { GrowthOpportunity } from "@/lib/api-client";

export function FixEngineCharts({
  findings,
  stagedTasksCount,
  onOpenFixes,
  onOpenResults,
}: {
  findings: GrowthOpportunity[];
  stagedTasksCount: number;
  onOpenFixes?: () => void;
  onOpenResults?: () => void;
}) {
  const { mixSlices, autoPct, totalCount } = useMemo(() => {
    const active = findings.filter((f) => f.status !== "DISMISSED" && f.lifecycle !== "DISMISSED");
    const total = active.length;
    if (total === 0) return { mixSlices: [], autoPct: 0, totalCount: 0 };

    let auto = 0;
    let content = 0;
    let manual = 0;
    for (const f of active) {
      if (f.fixClass === "AUTO") auto += 1;
      else if (f.category === "CONTENT" || f.category === "COMPETITOR" || f.category === "LOCAL") content += 1;
      else manual += 1;
    }
    return {
      totalCount: total,
      autoPct: Math.round((auto / total) * 100),
      mixSlices: [
        { label: "Auto-Fixable", value: auto, color: "var(--color-success-500)" },
        { label: "Content & Growth", value: content, color: "var(--color-accent-500)" },
        { label: "Technical / Dev", value: manual, color: "var(--color-brand-400)" },
      ].filter((s) => s.value > 0),
    };
  }, [findings]);

  const funnelRows = useMemo(() => {
    const active = findings.filter((f) => f.status !== "DISMISSED" && f.lifecycle !== "DISMISSED");
    const detected = active.length;
    const queuedOrStaged =
      active.filter((f) => f.lifecycle === "QUEUED" || f.lifecycle === "APPROVED").length +
      stagedTasksCount;
    const applyingOrShipped = active.filter(
      (f) => f.lifecycle === "APPLYING" || f.lifecycle === "VERIFYING" || f.status === "ACTIONED",
    ).length;
    const verified = active.filter(
      (f) => f.lifecycle === "VERIFIED" || f.status === "RESOLVED",
    ).length;

    return [
      { stage: "Detected", count: detected, color: "var(--color-brand-400)", note: "Active prioritized SEO findings" },
      { stage: "Staged & Queued", count: queuedOrStaged, color: "var(--color-accent-500)", note: "Approved or staged for execution" },
      { stage: "In Flight / PRs", count: applyingOrShipped, color: "var(--color-primary-500)", note: "Applying changes or awaiting HTML check" },
      { stage: "Verified Live", count: verified, color: "var(--color-success-500)", note: "Confirmed resolved on live website" },
    ];
  }, [findings, stagedTasksCount]);

  if (totalCount === 0 && stagedTasksCount === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left: Fix Execution Mix Donut */}
      <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-brand-950">
              Fix Execution Mix
            </h3>
            <p className="mt-0.5 text-[11.5px] text-brand-500">
              {totalCount.toLocaleString()} active findings by automation path
            </p>
          </div>
          {onOpenFixes && (
            <button
              type="button"
              onClick={onOpenFixes}
              className="text-[11.5px] font-semibold text-accent-600 hover:text-accent-700 cursor-pointer shrink-0"
            >
              Fixes &amp; Log →
            </button>
          )}
        </div>
        <div className="my-auto py-1">
          <DonutChart
            data={mixSlices}
            centerValue={`${autoPct}%`}
            centerLabel="Auto-ready"
            size={124}
            thickness={14}
            legendPosition="right"
            emptyText="No findings"
          />
        </div>
      </div>

      {/* Right: Remediation Lifecycle Funnel */}
      <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-brand-950">
              Remediation Pipeline Funnel
            </h3>
            <p className="mt-0.5 text-[11.5px] text-brand-500">
              Live progression from audit discovery to verified production fixes
            </p>
          </div>
          {onOpenResults && (
            <button
              type="button"
              onClick={onOpenResults}
              className="text-[11.5px] font-semibold text-accent-600 hover:text-accent-700 cursor-pointer shrink-0"
            >
              View Proof →
            </button>
          )}
        </div>

        <div className="h-[164px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={funnelRows}
              layout="vertical"
              margin={{ top: 2, right: 18, left: 4, bottom: 2 }}
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
                dataKey="stage"
                width={114}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11.5, fill: "var(--color-brand-700)", fontWeight: 500 }}
              />
              <Tooltip
                cursor={CHART_CURSOR_BAR}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as (typeof funnelRows)[number] | undefined;
                  if (!row) return null;
                  return (
                    <ChartTooltipCard
                      title={row.stage}
                      rows={[
                        {
                          label: "Items",
                          value: row.count.toLocaleString(),
                          color: row.color,
                          shape: "bar",
                        },
                      ]}
                      footer={{ label: "Stage", value: row.note }}
                    />
                  );
                }}
              />
              <Bar
                dataKey="count"
                barSize={14}
                radius={[0, 6, 6, 0]}
                background={{ fill: "var(--color-brand-100)", radius: 6 }}
              >
                {funnelRows.map((r) => (
                  <Cell key={r.stage} fill={r.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
