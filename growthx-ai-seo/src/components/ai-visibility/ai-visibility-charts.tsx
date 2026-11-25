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
import {
  providerName,
  type VisibilityJourneyResponse,
} from "@/lib/visibility-workflow";

export interface AiAssistantMetric {
  name: string;
  checked: number;
  cited: number;
  citationSharePct: number;
}

export interface ShareOfVoiceEntry {
  label: string;
  mentions: number;
  sharePct?: number;
  isYou?: boolean;
  domain?: string | null;
}

export interface BuyerJourneyFunnelData {
  discovery: { checked: number; cited: number; citationSharePct: number };
  recommendation: { checked: number; cited: number; citationSharePct: number };
}

const RIVAL_SERIES_COLORS = [
  "var(--color-accent-500)",
  "var(--color-primary-500)",
  "var(--color-warning-500)",
  "var(--color-accent-400)",
];

function shortEngineLabel(name: string): string {
  const cleaned = name.replace(/\s*\([^)]*\)\s*/g, "").trim();
  return cleaned.length > 14 ? `${cleaned.slice(0, 13)}…` : cleaned;
}

/**
 * Derive assistant citation metrics and brand Share of Voice strictly from
 * measured AI Visibility Journey answers (zero synthetic data).
 */
export function buildJourneyChartProps(
  data: VisibilityJourneyResponse,
  yourBrandName?: string | null,
): {
  assistants: AiAssistantMetric[];
  shareOfVoice: ShareOfVoiceEntry[];
} {
  const measured = (data.answers ?? []).filter((a) => !a.errorMessage && a.analysis);

  // Group measured answers by display engine name (ChatGPT, Gemini, Perplexity, Claude, Sarvam, etc.)
  const byEngine = new Map<string, { checked: number; cited: number }>();
  for (const a of measured) {
    const engine = providerName(a.provider, a.model);
    const prev = byEngine.get(engine) ?? { checked: 0, cited: 0 };
    prev.checked += 1;
    if (a.analysis?.recommended || a.analysis?.brandMentioned) {
      prev.cited += 1;
    }
    byEngine.set(engine, prev);
  }

  const assistants: AiAssistantMetric[] = Array.from(byEngine.entries())
    .map(([name, stats]) => ({
      name,
      checked: stats.checked,
      cited: stats.cited,
      citationSharePct:
        stats.checked > 0 ? Math.round((stats.cited / stats.checked) * 100) : 0,
    }))
    .sort((a, b) => b.citationSharePct - a.citationSharePct || b.checked - a.checked);

  // Share of Voice: count unique brand mentions per measured answer
  let yourMentions = 0;
  const rivalCounts = new Map<string, number>();

  for (const a of measured) {
    const customerInAnswer =
      Boolean(a.analysis?.recommended || a.analysis?.brandMentioned) ||
      a.mentions.some((m) => m.isCustomer);
    if (customerInAnswer) yourMentions += 1;

    const seenRivals = new Set<string>();
    for (const m of a.mentions) {
      if (m.isCustomer) continue;
      const trimmed = (m.brandName || "").trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (!seenRivals.has(key)) {
        seenRivals.add(key);
        rivalCounts.set(trimmed, (rivalCounts.get(trimmed) ?? 0) + 1);
      }
    }
  }

  const entries: ShareOfVoiceEntry[] = [];
  if (yourMentions > 0) {
    entries.push({
      label: yourBrandName ? `${yourBrandName} (You)` : "Your Business",
      mentions: yourMentions,
      isYou: true,
    });
  }
  const sortedRivals = Array.from(rivalCounts.entries()).sort((a, b) => b[1] - a[1]);
  for (const [label, mentions] of sortedRivals) {
    entries.push({ label, mentions, isYou: false });
  }

  return { assistants, shareOfVoice: entries };
}

export function AiVisibilityCharts({
  assistants,
  shareOfVoice,
  funnel,
  yourBrandLabel,
}: {
  assistants: AiAssistantMetric[];
  shareOfVoice: ShareOfVoiceEntry[];
  funnel?: BuyerJourneyFunnelData | null;
  yourBrandLabel?: string | null;
}) {
  const activeAssistants = useMemo(
    () =>
      assistants
        .filter((a) => a.checked > 0)
        .map((a) => ({
          ...a,
          shortName: shortEngineLabel(a.name),
          roundedPct: Math.round(a.citationSharePct * 10) / 10,
        })),
    [assistants],
  );

  const { donutSlices, totalMentions, yourSharePct, hasYourSlice } = useMemo(() => {
    const positive = shareOfVoice.filter((s) => s.mentions > 0);
    const total = positive.reduce((sum, s) => sum + s.mentions, 0);
    if (total === 0) {
      return { donutSlices: [], totalMentions: 0, yourSharePct: 0, hasYourSlice: false };
    }

    const normBrand = (yourBrandLabel || "").trim().toLowerCase();
    const isRowYou = (row: ShareOfVoiceEntry) =>
      Boolean(row.isYou) ||
      (normBrand.length > 1 &&
        (row.label.toLowerCase().includes(normBrand) ||
          (row.domain ? row.domain.toLowerCase().includes(normBrand) : false)));

    const youRow = positive.find(isRowYou);
    const rivalRows = positive
      .filter((r) => r !== youRow)
      .sort((a, b) => b.mentions - a.mentions);

    const slices: { label: string; value: number; color: string }[] = [];
    if (youRow) {
      slices.push({
        label: youRow.label.includes("(You)") ? youRow.label : `${youRow.label} (You)`,
        value: youRow.mentions,
        color: "var(--color-success-500)",
      });
    }

    const maxRivals = youRow ? 4 : 5;
    const topRivals = rivalRows.slice(0, maxRivals);
    topRivals.forEach((r, idx) => {
      slices.push({
        label: r.label,
        value: r.mentions,
        color: RIVAL_SERIES_COLORS[idx % RIVAL_SERIES_COLORS.length],
      });
    });

    const otherMentions = rivalRows
      .slice(maxRivals)
      .reduce((sum, r) => sum + r.mentions, 0);
    if (otherMentions > 0) {
      slices.push({
        label: "Other rivals",
        value: otherMentions,
        color: "var(--color-brand-300)",
      });
    }

    const yourPct = youRow ? Math.round((youRow.mentions / total) * 100) : 0;
    return {
      donutSlices: slices,
      totalMentions: total,
      yourSharePct: yourPct,
      hasYourSlice: Boolean(youRow),
    };
  }, [shareOfVoice, yourBrandLabel]);

  const totalChecked = activeAssistants.reduce((s, a) => s + a.checked, 0);
  const totalCited = activeAssistants.reduce((s, a) => s + a.cited, 0);
  const overallRate = totalChecked > 0 ? Math.round((totalCited / totalChecked) * 100) : 0;

  const hasFunnel = Boolean(
    funnel && (funnel.discovery.checked > 0 || funnel.recommendation.checked > 0),
  );

  if (activeAssistants.length === 0 && totalMentions === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left: Share of Voice Segmented Donut */}
      <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-brand-950">
              AI Share of Voice
            </h3>
            <p className="mt-0.5 text-[11.5px] text-brand-500">
              {totalMentions > 0
                ? `${totalMentions.toLocaleString()} brand mentions across measured AI answers`
                : "Your brand vs. competitors named by AI assistants"}
            </p>
          </div>
          {totalMentions > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 font-mono text-[10.5px] font-semibold text-brand-700 tabular-nums shrink-0">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor: hasYourSlice
                    ? "var(--color-success-500)"
                    : "var(--color-brand-400)",
                }}
              />
              {hasYourSlice ? `${yourSharePct}% you` : "0% you"}
            </span>
          )}
        </div>

        <div className="my-auto py-1">
          <DonutChart
            data={donutSlices}
            centerValue={hasYourSlice ? `${yourSharePct}%` : `${totalMentions}`}
            centerLabel={hasYourSlice ? "Your share" : "Mentions"}
            size={134}
            thickness={15}
            legendPosition="right"
            emptyText="No brand mentions"
          />
        </div>
      </div>

      {/* Right: Multi-Engine Horizontal Citation Bar Chart + Optional Buyer Journey Funnel */}
      <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-brand-200 bg-surface-1 p-5 shadow-2xs">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-brand-950">
              Citation Rate by AI Engine
            </h3>
            <p className="mt-0.5 text-[11.5px] text-brand-500">
              Share of measured buyer prompts where each model cited or recommended you
            </p>
          </div>
          {totalChecked > 0 && (
            <div className="text-right">
              <p className="font-mono text-xl font-bold leading-none text-brand-950 tabular-nums">
                {overallRate}%
              </p>
              <p className="mt-0.5 font-mono text-[10.5px] text-brand-400 tabular-nums">
                {totalCited}/{totalChecked} cited
              </p>
            </div>
          )}
        </div>

        {activeAssistants.length > 0 ? (
          <div style={{ height: Math.max(152, activeAssistants.length * 36 + 26) }} className="w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeAssistants}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 2 }}
              >
                <CartesianGrid
                  stroke="var(--color-brand-100)"
                  strokeDasharray="2 4"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={CHART_AXIS_TICK}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  width={92}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: "var(--color-brand-700)", fontWeight: 500 }}
                />
                <Tooltip
                  cursor={CHART_CURSOR_BAR}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as (AiAssistantMetric & { roundedPct: number }) | undefined;
                    if (!row) return null;
                    const barColor =
                      row.roundedPct >= 50
                        ? "var(--color-success-500)"
                        : row.roundedPct > 0
                          ? "var(--color-accent-500)"
                          : "var(--color-brand-400)";
                    return (
                      <ChartTooltipCard
                        title={row.name}
                        rows={[
                          {
                            label: "Citation share",
                            value: `${row.roundedPct}%`,
                            color: barColor,
                            shape: "bar",
                          },
                          {
                            label: "Cited answers",
                            value: `${row.cited} / ${row.checked}`,
                            color: "var(--color-brand-400)",
                            shape: "dot",
                          },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="roundedPct"
                  barSize={14}
                  radius={[0, 6, 6, 0]}
                  background={{ fill: "var(--color-brand-100)", radius: 6 }}
                >
                  {activeAssistants.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.roundedPct >= 50
                          ? "var(--color-success-500)"
                          : entry.roundedPct > 0
                            ? "var(--color-accent-500)"
                            : "var(--color-brand-300)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-8 text-center text-xs text-brand-400">
            No engine citation rates recorded yet.
          </p>
        )}

        {/* Buyer Journey Funnel (Discovery -> Recommendation) when available */}
        {hasFunnel && funnel && (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-brand-100 pt-3.5 sm:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                  1. Discovery prompts
                </span>
                <span className="font-mono text-xs font-bold text-brand-950 tabular-nums">
                  {Math.round(funnel.discovery.citationSharePct)}%
                  <span className="ml-1 font-normal text-brand-400">
                    ({funnel.discovery.cited}/{funnel.discovery.checked})
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, funnel.discovery.citationSharePct))}%`,
                    backgroundColor: "var(--color-accent-500)",
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">
                  2. Recommendation prompts
                </span>
                <span className="font-mono text-xs font-bold text-brand-950 tabular-nums">
                  {Math.round(funnel.recommendation.citationSharePct)}%
                  <span className="ml-1 font-normal text-brand-400">
                    ({funnel.recommendation.cited}/{funnel.recommendation.checked})
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.max(0, funnel.recommendation.citationSharePct))}%`,
                    backgroundColor: "var(--color-success-500)",
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
