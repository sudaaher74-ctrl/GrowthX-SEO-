"use client";

import React, { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_AXIS_TICK,
  CHART_CURSOR_BAR,
  ChartTooltipCard,
} from "@/components/ui/chart-primitives";
import type { CompetitorWebsite, TrackedCompetitor } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type MetricId = "health" | "pages" | "pageTypes" | "reviews" | "aiCitations";

interface MetricConfig {
  id: MetricId;
  label: string;
  unit: string;
  domain?: [number, number];
  format: (v: number) => string;
}

const METRICS: MetricConfig[] = [
  { id: "health", label: "Health", unit: "/100", domain: [0, 100], format: (v) => `${Math.round(v)}/100` },
  { id: "pages", label: "Pages", unit: "pages", format: (v) => v.toLocaleString() },
  { id: "pageTypes", label: "Page Types", unit: "types", format: (v) => `${v} types` },
  { id: "reviews", label: "Google Reviews", unit: "reviews", format: (v) => v.toLocaleString() },
  { id: "aiCitations", label: "AI Share", unit: "%", domain: [0, 100], format: (v) => `${Math.round(v)}%` },
];

function shortLabel(name: string, isYou: boolean): string {
  const base = name.replace(/^www\./i, "").trim();
  const suffix = isYou ? " (You)" : "";
  const max = isYou ? 15 : 20;
  return `${base.length > max ? `${base.slice(0, max - 1)}…` : base}${suffix}`;
}

export function CompetitorBenchmarkChart({
  yourBrand,
  yourDomain,
  yourHealth,
  yourPages,
  yourAiSharePct,
  youSite,
  rivals,
  sites,
}: {
  yourBrand: string;
  yourDomain: string;
  yourHealth: number | null;
  yourPages: number | null;
  yourAiSharePct?: number | null;
  youSite?: CompetitorWebsite | null;
  rivals: TrackedCompetitor[];
  sites: CompetitorWebsite[];
}) {
  const entities = useMemo(() => {
    const youRow = {
      id: "you",
      name: yourBrand || yourDomain || "Your Site",
      domain: yourDomain,
      isYou: true,
      health: yourHealth,
      pages: yourPages,
      pageTypes: youSite?.pageTypes?.length ? youSite.pageTypes.length : null,
      reviews: youSite?.reviewCount ?? null,
      aiCitations: yourAiSharePct != null ? Math.round(yourAiSharePct) : null,
    };

    const rivalRows = rivals.map((c) => {
      const site = sites.find((s) => s.competitorId === c.id || s.domain === c.domain);
      const aiPct =
        c.aiCitationSharePct != null
          ? Math.round(c.aiCitationSharePct)
          : c.aiMentions && c.aiMentions.answers > 0
            ? Math.round((c.aiMentions.named / c.aiMentions.answers) * 100)
            : null;
      return {
        id: c.id,
        name: c.name || c.label || c.domain,
        domain: c.domain,
        isYou: false,
        health: site?.healthScore ?? c.healthScore ?? null,
        pages: site?.pagesRead ?? c.pagesCrawled ?? null,
        pageTypes: site?.pageTypes?.length ? site.pageTypes.length : null,
        reviews: site?.reviewCount ?? c.reviewCount ?? null,
        aiCitations: aiPct,
      };
    });

    return [youRow, ...rivalRows];
  }, [yourBrand, yourDomain, yourHealth, yourPages, yourAiSharePct, youSite, rivals, sites]);

  const availableMetrics = useMemo(() => {
    return METRICS.filter((m) =>
      entities.some((e) => {
        const val = e[m.id];
        return val != null && Number.isFinite(val);
      }),
    );
  }, [entities]);

  const [selectedMetric, setSelectedMetric] = useState<MetricId>("health");
  const activeMetric =
    availableMetrics.find((m) => m.id === selectedMetric) ?? availableMetrics[0] ?? null;

  const chartData = useMemo(() => {
    if (!activeMetric) return [];
    const rows = entities
      .filter((e) => e[activeMetric.id] != null)
      .map((e) => ({
        id: e.id,
        name: e.name,
        shortName: shortLabel(e.name, e.isYou),
        domain: e.domain,
        isYou: e.isYou,
        value: Number(e[activeMetric.id]),
      }));
    // Keep "You" pinned at top, rivals sorted descending by metric value
    const you = rows.filter((r) => r.isYou);
    const others = rows.filter((r) => !r.isYou).sort((a, b) => b.value - a.value);
    return [...you, ...others];
  }, [entities, activeMetric]);

  if (!activeMetric || chartData.length < 2) {
    return null;
  }

  const yourValue = chartData.find((r) => r.isYou)?.value ?? null;

  return (
    <div className="rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[14px] font-semibold tracking-tight text-brand-950">
              Head-to-Head Comparison
            </h2>
            <div className="flex items-center gap-3 text-[11px] text-brand-500">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: "var(--color-success-500)" }}
                />
                You
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: "var(--color-accent-500)" }}
                />
                Tracked rivals
              </span>
            </div>
          </div>
          <p className="mt-0.5 text-[11.5px] text-brand-500">
            Measured directly from completed site crawls and public listings — dashed line marks your baseline.
          </p>
        </div>

        {/* Clean Segmented Metric Switcher */}
        <div
          role="tablist"
          aria-label="Comparison metric"
          className="inline-flex max-w-full shrink-0 flex-nowrap items-center gap-0.5 overflow-x-auto rounded-lg border border-brand-200/80 bg-brand-50 p-0.5 self-start sm:self-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {availableMetrics.map((m) => {
            const active = m.id === activeMetric.id;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedMetric(m.id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                  active
                    ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                    : "text-brand-500 hover:text-brand-900",
                )}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ height: Math.max(168, chartData.length * 40 + 28) }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 6, bottom: 2 }}
          >
            <CartesianGrid
              stroke="var(--color-brand-100)"
              strokeDasharray="2 4"
              horizontal={false}
            />
            <XAxis
              type="number"
              domain={activeMetric.domain ?? [0, "auto"]}
              axisLine={false}
              tickLine={false}
              tick={CHART_AXIS_TICK}
              allowDecimals={false}
              tickFormatter={(v) =>
                activeMetric.id === "aiCitations" ? `${v}%` : Number(v).toLocaleString()
              }
            />
            <YAxis
              type="category"
              dataKey="shortName"
              width={136}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "var(--color-brand-700)", fontWeight: 500 }}
            />
            {yourValue != null && (
              <ReferenceLine
                x={yourValue}
                stroke="var(--color-success-500)"
                strokeDasharray="3 3"
                strokeOpacity={0.55}
              />
            )}
            <Tooltip
              cursor={CHART_CURSOR_BAR}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload as (typeof chartData)[number] | undefined;
                if (!row) return null;
                const delta =
                  !row.isYou && yourValue != null ? row.value - yourValue : null;
                const footer =
                  row.isYou
                    ? { label: "Position", value: "Your baseline" }
                    : delta != null
                      ? {
                          label: "vs. You",
                          value:
                            delta > 0
                              ? `+${delta.toLocaleString()} ahead`
                              : delta < 0
                                ? `${delta.toLocaleString()} behind`
                                : "Tied",
                        }
                      : null;

                return (
                  <ChartTooltipCard
                    title={`${row.name}${row.isYou ? " (You)" : ""}`}
                    rows={[
                      {
                        label: activeMetric.label,
                        value: activeMetric.format(row.value),
                        color: row.isYou
                          ? "var(--color-success-500)"
                          : "var(--color-accent-500)",
                        shape: "bar",
                      },
                    ]}
                    footer={footer}
                  />
                );
              }}
            />
            <Bar
              dataKey="value"
              barSize={16}
              radius={[0, 6, 6, 0]}
              background={{ fill: "var(--color-brand-100)", radius: 6 }}
            >
              {chartData.map((row) => (
                <Cell
                  key={row.id}
                  fill={
                    row.isYou
                      ? "var(--color-success-500)"
                      : "var(--color-accent-500)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
