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
import { GaugeScore } from "@/components/website/gauge-score";
import { DonutChart } from "@/components/website/donut-chart";
import {
  CHART_AXIS_TICK,
  CHART_CURSOR_BAR,
  ChartTooltipCard,
} from "@/components/ui/chart-primitives";
import type { MonthlyReportPayload } from "@/lib/api-types";

function fmt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat().format(value);
}

function shortText(text: string, max = 18): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Hero executive scorecard for the zero-login client portal:
 * pairs the 270° circular Site Health gauge with calm tabular KPI readouts.
 */
export function SharedReportScorecard({ payload }: { payload: MonthlyReportPayload }) {
  const kpis = payload.kpis ?? {};
  const health = kpis.healthScore ?? null;
  const verifiedFixes = kpis.verifiedFixes ?? payload.fixes?.length ?? 0;

  const statItems = [
    { label: "Search Clicks", value: fmt(kpis.clicks), sub: kpis.ctrPct ? `${kpis.ctrPct}% CTR` : null },
    { label: "Impressions", value: fmt(kpis.impressions), sub: null },
    { label: "Website Sessions", value: fmt(kpis.sessions), sub: kpis.peakUsers != null ? `Peak ${fmt(kpis.peakUsers)}/day` : null },
    { label: "AI Mention Share", value: kpis.aiCitationSharePct != null ? `${kpis.aiCitationSharePct}%` : "—", sub: null },
    { label: "Referring Domains", value: fmt(kpis.referringDomains), sub: kpis.verifiedBacklinks != null ? `${fmt(kpis.verifiedBacklinks)} links` : null },
    { label: "Verified Fixes", value: fmt(verifiedFixes), sub: (kpis.regressions ?? 0) > 0 ? `${kpis.regressions} caught` : "Live HTML matched" },
  ];

  return (
    <section className="report-section grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left: Site Health Gauge */}
      <div className="lg:col-span-4 flex flex-col items-center justify-center rounded-2xl border border-brand-200/80 bg-surface-1 p-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
          Site Health Score
        </p>
        <div className="mt-2">
          <GaugeScore
            score={health}
            maxScore={100}
            label="Site Health Score"
            size={120}
            statusText={
              health == null
                ? "Unmeasured"
                : health >= 80
                  ? "Healthy"
                  : health >= 50
                    ? "Needs work"
                    : "At risk"
            }
            description={
              kpis.pagesCrawled != null
                ? `${fmt(kpis.pagesCrawled)} pages audited`
                : "Latest crawl snapshot"
            }
          />
        </div>
      </div>

      {/* Right: Clean 6-KPI Executive Grid */}
      <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statItems.map((item) => (
          <div
            key={item.label}
            className="flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-4"
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
              {item.label}
            </p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-brand-950 tabular-nums">
              {item.value}
            </p>
            {item.sub ? (
              <p className="mt-1 text-[11px] text-brand-500 truncate">{item.sub}</p>
            ) : (
              <p className="mt-1 text-[11px] text-brand-400">Measured period</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Multi-engine AI visibility bar chart + keyword ranking tier donut for client reports.
 */
export function SharedReportPerformanceCharts({ payload }: { payload: MonthlyReportPayload }) {
  const aiAssistants = useMemo(() => {
    const list = payload.aiVisibility?.byAssistant ?? [];
    return list
      .filter((a) => a.checked > 0)
      .map((a) => ({
        name: a.assistant,
        shortName: shortText(a.assistant, 14),
        checked: a.checked,
        cited: a.cited,
        pct: Math.round(a.citationSharePct * 10) / 10,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [payload.aiVisibility]);

  const keywordSlices = useMemo(() => {
    const kws = payload.topKeywords ?? [];
    if (kws.length === 0) return { slices: [], top10Pct: 0, total: 0 };
    const top3 = kws.filter((k) => k.position <= 3).length;
    const pos4to10 = kws.filter((k) => k.position > 3 && k.position <= 10).length;
    const pos11to20 = kws.filter((k) => k.position > 10 && k.position <= 20).length;
    const pos21plus = kws.filter((k) => k.position > 20).length;
    const top10Pct = Math.round(((top3 + pos4to10) / kws.length) * 100);
    return {
      total: kws.length,
      top10Pct,
      slices: [
        { label: "Top 3 (#1–3)", value: top3, color: "var(--color-success-500)" },
        { label: "Page 1 (#4–10)", value: pos4to10, color: "var(--color-accent-500)" },
        { label: "Page 2 (#11–20)", value: pos11to20, color: "var(--color-warning-500)" },
        { label: "Page 3+ (#21+)", value: pos21plus, color: "var(--color-brand-300)" },
      ].filter((s) => s.value > 0),
    };
  }, [payload.topKeywords]);

  if (aiAssistants.length === 0 && keywordSlices.total === 0) {
    return null;
  }

  return (
    <section className="report-section grid grid-cols-1 gap-4 lg:grid-cols-12">
      {aiAssistants.length > 0 && (
        <div
          className={
            keywordSlices.total > 0
              ? "lg:col-span-7 rounded-2xl border border-brand-200/80 bg-surface-1 p-5"
              : "lg:col-span-12 rounded-2xl border border-brand-200/80 bg-surface-1 p-5"
          }
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-brand-950">AI Citation Share by Assistant</h2>
              <p className="mt-0.5 text-[11px] text-brand-500">
                Percentage of sampled buyer questions where each AI model cited your brand
              </p>
            </div>
            {payload.aiVisibility?.citationSharePct != null && (
              <span className="font-mono text-lg font-bold text-brand-950 tabular-nums shrink-0">
                {Math.round(payload.aiVisibility.citationSharePct)}%
              </span>
            )}
          </div>
          <div style={{ height: Math.max(144, aiAssistants.length * 34 + 24) }} className="w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={aiAssistants}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 4, bottom: 2 }}
              >
                <CartesianGrid stroke="var(--color-brand-100)" strokeDasharray="2 4" horizontal={false} />
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
                  tick={{ fontSize: 11.5, fill: "var(--color-brand-700)", fontWeight: 500 }}
                />
                <Tooltip
                  cursor={CHART_CURSOR_BAR}
                  content={({ active, payload: tip }) => {
                    if (!active || !tip?.length) return null;
                    const row = tip[0]?.payload as (typeof aiAssistants)[number] | undefined;
                    if (!row) return null;
                    const color =
                      row.pct >= 50
                        ? "var(--color-success-500)"
                        : row.pct > 0
                          ? "var(--color-accent-500)"
                          : "var(--color-brand-400)";
                    return (
                      <ChartTooltipCard
                        title={row.name}
                        rows={[
                          { label: "Citation share", value: `${row.pct}%`, color, shape: "bar" },
                          { label: "Cited / Checked", value: `${row.cited}/${row.checked}`, color: "var(--color-brand-400)", shape: "dot" },
                        ]}
                      />
                    );
                  }}
                />
                <Bar
                  dataKey="pct"
                  barSize={14}
                  radius={[0, 6, 6, 0]}
                  background={{ fill: "var(--color-brand-100)", radius: 6 }}
                >
                  {aiAssistants.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={
                        entry.pct >= 50
                          ? "var(--color-success-500)"
                          : entry.pct > 0
                            ? "var(--color-accent-500)"
                            : "var(--color-brand-300)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {keywordSlices.total > 0 && (
        <div
          className={
            aiAssistants.length > 0
              ? "lg:col-span-5 flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-5"
              : "lg:col-span-12 flex flex-col justify-between rounded-2xl border border-brand-200/80 bg-surface-1 p-5"
          }
        >
          <div className="mb-3">
            <h2 className="text-sm font-bold text-brand-950">Keyword Ranking Tiers</h2>
            <p className="mt-0.5 text-[11px] text-brand-500">
              Position spread across top {keywordSlices.total} tracked Google Search Console queries
            </p>
          </div>
          <div className="my-auto py-1">
            <DonutChart
              data={keywordSlices.slices}
              centerValue={`${keywordSlices.top10Pct}%`}
              centerLabel="Page 1"
              size={122}
              thickness={14}
              legendPosition="right"
            />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * Competitor crawled footprint bar chart for the client portal when rival facts exist.
 */
export function SharedReportCompetitorChart({ payload }: { payload: MonthlyReportPayload }) {
  const rows = useMemo(() => {
    const rivals = payload.competitors?.rivals ?? [];
    if (rivals.length === 0) return [];
    const list: { label: string; shortLabel: string; pages: number; isYou: boolean }[] = [];
    if (payload.kpis?.pagesCrawled != null && payload.kpis.pagesCrawled > 0) {
      list.push({
        label: `${payload.domain} (You)`,
        shortLabel: `${shortText(payload.domain, 14)} (You)`,
        pages: payload.kpis.pagesCrawled,
        isYou: true,
      });
    }
    for (const r of rivals.slice(0, 6)) {
      if (r.pages > 0) {
        list.push({
          label: r.label,
          shortLabel: shortText(r.label, 18),
          pages: r.pages,
          isYou: false,
        });
      }
    }
    return list;
  }, [payload]);

  if (rows.length < 2) return null;

  return (
    <section className="report-section rounded-2xl border border-brand-200/80 bg-surface-1 p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-brand-950">Competitor Crawl Footprint</h2>
          <p className="mt-0.5 text-[11px] text-brand-500">
            Indexed pages crawled across your site vs. tracked competitors
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-brand-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-success-500)" }} />
            You
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--color-accent-500)" }} />
            Rivals
          </span>
        </div>
      </div>

      <div style={{ height: Math.max(148, rows.length * 36 + 22) }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 20, left: 4, bottom: 2 }}>
            <CartesianGrid stroke="var(--color-brand-100)" strokeDasharray="2 4" horizontal={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={CHART_AXIS_TICK}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="shortLabel"
              width={132}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11.5, fill: "var(--color-brand-700)", fontWeight: 500 }}
            />
            <Tooltip
              cursor={CHART_CURSOR_BAR}
              content={({ active, payload: tip }) => {
                if (!active || !tip?.length) return null;
                const row = tip[0]?.payload as (typeof rows)[number] | undefined;
                if (!row) return null;
                return (
                  <ChartTooltipCard
                    title={row.label}
                    rows={[
                      {
                        label: "Pages crawled",
                        value: row.pages.toLocaleString(),
                        color: row.isYou ? "var(--color-success-500)" : "var(--color-accent-500)",
                        shape: "bar",
                      },
                    ]}
                  />
                );
              }}
            />
            <Bar
              dataKey="pages"
              barSize={14}
              radius={[0, 6, 6, 0]}
              background={{ fill: "var(--color-brand-100)", radius: 6 }}
            >
              {rows.map((r) => (
                <Cell
                  key={r.label}
                  fill={r.isYou ? "var(--color-success-500)" : "var(--color-accent-500)"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
