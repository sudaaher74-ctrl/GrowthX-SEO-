"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowRight, ArrowUp, Minus } from "lucide-react";
import { Kpi, Panel, Pill, Sparkline } from "@/components/ui/console";
import type {
  GoogleEvidence,
  GoogleFunnelStage,
  GoogleHeadline,
  GoogleKpi,
  GoogleOverview,
  GoogleSource,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { DASH, count, formatKpi, money, percent, position, shortDay } from "@/lib/google-format";

// ── Sources ─────────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<GoogleSource | "GSC+GA4", string> = {
  GSC: "Search Console",
  GA4: "Google Analytics",
  GrowthX: "GrowthX",
  "GSC+GA4": "Search Console + Analytics",
};

/** Says where a figure comes from, so no metric is presented without its source. */
export function SourceBadge({ source }: { source: GoogleSource | "GSC+GA4" }) {
  return (
    <span title={SOURCE_LABEL[source]}>
      <Pill tone={source === "GSC" ? "info" : source === "GA4" ? "good" : "default"}>{source === "GSC+GA4" ? "GSC + GA4" : source}</Pill>
    </span>
  );
}

// ── KPI cards ───────────────────────────────────────────────────────────────

export function KpiCard({ kpi, days }: { kpi: GoogleKpi; days: number }) {
  const d = kpi.delta;
  const shown = d ? Math.round(d.value * 10) / 10 : null;
  const suffix = d?.kind === "pct" ? "%" : d?.kind === "pts" ? " pts" : " places";
  const sub =
    kpi.value === null
      ? kpi.note
      : d
        ? `vs previous ${days} days`
        : "No earlier period to compare with";
  return (
    <Kpi
      label={kpi.label}
      value={formatKpi(kpi)}
      delta={shown}
      deltaSuffix={suffix}
      deltaGood={kpi.lowerIsBetter ? "down" : "up"}
      trend={kpi.sparkline}
      aside={<SourceBadge source={kpi.source} />}
      sub={sub}
    />
  );
}

// ── Trend chart ─────────────────────────────────────────────────────────────

interface TrendMetric {
  id: string;
  label: string;
  source: GoogleSource;
  read: (o: GoogleOverview) => { date: string; value: number | null }[];
  fmt: (v: number) => string;
  reversed?: boolean;
  missing: string;
}

const TREND_METRICS: TrendMetric[] = [
  { id: "clicks", label: "Clicks", source: "GSC", read: (o) => o.series.search.map((p) => ({ date: p.date, value: p.clicks })), fmt: count, missing: "Search Console has no data for this period." },
  { id: "impressions", label: "Impressions", source: "GSC", read: (o) => o.series.search.map((p) => ({ date: p.date, value: p.impressions })), fmt: count, missing: "Search Console has no data for this period." },
  { id: "ctr", label: "CTR", source: "GSC", read: (o) => o.series.search.map((p) => ({ date: p.date, value: p.ctr })), fmt: (v) => percent(v), missing: "Search Console has no data for this period." },
  { id: "position", label: "Avg position", source: "GSC", read: (o) => o.series.search.map((p) => ({ date: p.date, value: p.position })), fmt: position, reversed: true, missing: "Search Console has no data for this period." },
  { id: "users", label: "Organic users", source: "GA4", read: (o) => o.series.organic.map((p) => ({ date: p.date, value: p.users })), fmt: count, missing: "Google Analytics has no organic data for this period." },
  { id: "sessions", label: "Sessions", source: "GA4", read: (o) => o.series.organic.map((p) => ({ date: p.date, value: p.sessions })), fmt: count, missing: "Google Analytics has no organic data for this period." },
  { id: "keyEvents", label: "Key events", source: "GA4", read: (o) => o.series.organic.map((p) => ({ date: p.date, value: p.keyEvents })), fmt: count, missing: "No key events are set up in this Google Analytics property." },
  { id: "revenue", label: "Revenue", source: "GA4", read: (o) => o.series.organic.map((p) => ({ date: p.date, value: p.revenue })), fmt: money, missing: "No revenue is recorded in this Google Analytics property." },
];

/**
 * One metric at a time — not everything on one unreadable chart. A metric with
 * nothing behind it is shown disabled, with why, rather than as a flat line.
 */
export function TrendChart({ overview }: { overview: GoogleOverview }) {
  const available = useMemo(
    () =>
      TREND_METRICS.map((m) => {
        const data = m.read(overview);
        return { metric: m, data, ok: data.length > 0 && data.some((p) => p.value !== null) };
      }),
    [overview],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const active = available.find((a) => a.metric.id === picked && a.ok) ?? available.find((a) => a.ok) ?? null;

  return (
    <Panel
      title="Google performance trend"
      subtitle="One metric at a time. Search Console figures end a few days before today; Analytics figures end yesterday."
      actions={
        <div className="flex flex-wrap gap-1" role="group" aria-label="Metric shown">
          {available.map(({ metric, ok }) => (
            <button
              key={metric.id}
              type="button"
              disabled={!ok}
              aria-pressed={active?.metric.id === metric.id}
              title={ok ? SOURCE_LABEL[metric.source] : metric.missing}
              onClick={() => setPicked(metric.id)}
              className={cn(
                "rounded-lg border px-2 py-0.5 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
                active?.metric.id === metric.id ? "border-primary-500 bg-primary-50 text-primary-700" : "bg-white text-brand-600 hover:bg-brand-50",
              )}
            >
              {metric.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="p-4">
        {active ? (
          <>
            <div className="mb-2 flex items-center gap-2 text-[12px] text-brand-500">
              <SourceBadge source={active.metric.source} />
              <span>{active.metric.label}, by day</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={active.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-brand-100)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: "var(--text-muted)" }} minTickGap={24} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                    reversed={active.metric.reversed}
                    tickFormatter={(v) => active.metric.fmt(Number(v))}
                    width={48}
                  />
                  <Tooltip
                    formatter={(v) => [active.metric.fmt(Number(v)), active.metric.label]}
                    labelFormatter={(l) => new Date(`${String(l)}T00:00:00`).toDateString()}
                  />
                  <Line type="monotone" dataKey="value" stroke="var(--color-series-1)" strokeWidth={2} dot={false} connectNulls={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="py-10 text-center text-[12px] text-brand-500">No data available for this period.</p>
        )}
      </div>
    </Panel>
  );
}

// ── Funnel ──────────────────────────────────────────────────────────────────

function stageRate(stage: GoogleFunnelStage): string | null {
  if (stage.rate === null || !stage.rateLabel) return null;
  // Sessions per click is a ratio of two systems' counts, not a drop-off, and can pass 1.
  return stage.key === "sessions" ? `${stage.rate.toFixed(2)} ${stage.rateLabel}` : `${percent(stage.rate)} ${stage.rateLabel}`;
}

export function Funnel({ stages }: { stages: GoogleFunnelStage[] }) {
  return (
    <Panel
      title="From Google search to business result"
      subtitle="Impressions and clicks come from Search Console; sessions onward come from Google Analytics. The two count differently, so the step between clicks and sessions is a ratio, not a loss."
    >
      <ol className="divide-y">
        {stages.map((stage, i) => {
          const rate = stageRate(stage);
          const width = stage.rate === null ? (i === 0 && stage.value !== null ? 100 : 0) : Math.min(100, stage.rate * 100);
          return (
            <li key={stage.key} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-semibold text-brand-950">{stage.label}</span>
                  <SourceBadge source={stage.source} />
                </div>
                <div className="flex items-baseline gap-3">
                  {rate && <span className="text-[11px] text-brand-500">{rate}</span>}
                  <span className="font-mono text-[15px] font-bold text-brand-950">
                    {stage.key === "revenue" ? money(stage.value) : count(stage.value)}
                  </span>
                </div>
              </div>
              {stage.value === null ? (
                <p className="mt-1 text-[11px] text-brand-400">{stage.note ?? "Not measured."}</p>
              ) : (
                <div className="mt-2 h-1.5 w-full rounded-full bg-brand-100">
                  <div className="h-1.5 rounded-full bg-primary-600" style={{ width: `${Math.max(width, 1.5)}%` }} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

// ── Headlines ───────────────────────────────────────────────────────────────

const TONE_ICON = { good: ArrowUp, bad: ArrowDown, warn: ArrowRight, neutral: Minus } as const;
const TONE_STYLE = {
  good: "bg-success-50 text-success-700",
  bad: "bg-error-50 text-error-700",
  warn: "bg-warning-50 text-warning-700",
  neutral: "bg-brand-100 text-brand-600",
} as const;

export function EvidenceChips({ items }: { items: GoogleEvidence[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((e) => (
        <span key={`${e.label}-${e.value}`} className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-0.5 text-[11px] text-brand-600">
          <SourceBadge source={e.source} />
          <span className="text-brand-400">{e.label}</span>
          <span className="font-mono font-semibold text-brand-950">{e.value}</span>
        </span>
      ))}
    </div>
  );
}

export function Headlines({ headlines }: { headlines: GoogleHeadline[] }) {
  if (headlines.length === 0) {
    return (
      <Panel title="What is happening">
        <p className="p-4 text-[12.5px] text-brand-500">No data available for this period, so there is nothing to explain yet.</p>
      </Panel>
    );
  }
  return (
    <Panel title="What is happening" subtitle="Each line is built from the figures under it. Nothing here is estimated.">
      <ul className="divide-y">
        {headlines.map((h) => {
          const Icon = TONE_ICON[h.tone];
          return (
            <li key={h.id} className="flex gap-3 px-4 py-3">
              <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", TONE_STYLE[h.tone])}>
                <Icon size={13} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] leading-snug text-brand-950">{h.text}</p>
                <EvidenceChips items={h.evidence} />
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  {h.links.map((l) => (
                    <Link
                      key={l.label}
                      href={l.view === "pages" ? `/google/pages${l.segment ? `?segment=${l.segment}` : ""}` : `/google/${l.view}`}
                      className="text-[12px] font-semibold text-accent-700 hover:underline"
                    >
                      {l.label} →
                    </Link>
                  ))}
                  <span className="text-[10.5px] text-brand-400">
                    Confidence {h.confidence.toLowerCase()} · <SourceBadge source={h.source} />
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ── Small pieces reused by the pages view ───────────────────────────────────

export function ChangeText({ pct, lowerIsBetter = false }: { pct: number | null; lowerIsBetter?: boolean }) {
  if (pct === null) return <span className="text-brand-300">{DASH}</span>;
  const good = lowerIsBetter ? pct <= 0 : pct >= 0;
  return (
    <span className={cn("font-mono text-[11px]", good ? "text-success-600" : "text-error-600")}>
      {pct >= 0 ? "+" : "−"}
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

export function TrendCell({ values }: { values: number[] }) {
  return values.length >= 2 && values.some((v) => v > 0) ? <Sparkline values={values} width={72} height={20} /> : <span className="text-brand-300">{DASH}</span>;
}
