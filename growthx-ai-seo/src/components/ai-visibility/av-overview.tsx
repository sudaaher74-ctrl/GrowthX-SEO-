"use client";
import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { VisibilityReport } from "@/lib/api-types";
import { ActionButton, Kpi, MeterBar, Panel, Pill, Table, Td, Th, Tr } from "@/components/ui/console";
import { assistantLabel } from "@/lib/ai-assistants";
import { cn } from "@/lib/utils";
import {
  type AvOpportunity,
  type AvPrompt,
  EmptyBlock,
  InfoTip,
  MODEL_DEFS,
  type ModelKey,
  Skeleton,
  categoryOf,
  modelKeyOf,
  pct,
} from "./av-shared";

interface OverviewProps {
  report?: VisibilityReport | null;
  prompts: AvPrompt[];
  loading: boolean;
  brandLabel: string;
  opportunities?: AvOpportunity[] | null;
  onNavigate: (tab: string) => void;
}

/** Derived once, from the report only. Every figure is null when it was not measured. */
export function overviewFigures(report?: VisibilityReport | null) {
  const measured = (report?.summary?.checked ?? 0) > 0;
  const rows = report?.shareOfVoice ?? [];
  const own = rows.find((r) => r.domain === null)?.mentions ?? 0;
  const all = rows.reduce((s, r) => s + r.mentions, 0);
  const trend = (report?.trend ?? []).filter((t) => t.checked > 0);
  const hasDelta = measured && report?.summary.previousCitationSharePct != null && report?.summary.deltaPt != null;
  return {
    measured,
    visibility: measured ? report!.summary.citationSharePct : null,
    mentions: report?.summary.cited ?? 0,
    checked: report?.summary.checked ?? 0,
    failed: report?.summary.failedChecks ?? 0,
    shareOfVoice: measured && all > 0 ? Math.round((own / all) * 100) : null,
    delta: hasDelta ? Math.round(report!.summary.deltaPt! * 10) / 10 : null,
    trend,
  };
}

export function AiVisibilityOverview({ report, prompts, loading, brandLabel, opportunities, onNavigate }: OverviewProps) {
  const f = overviewFigures(report);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading AI Visibility">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-5">
          <Skeleton className="h-72 rounded-xl lg:col-span-3" />
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const trendKpi = f.trend.length >= 2 ? f.trend.map((t) => t.citationSharePct) : null;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Kpi
          label="Overall visibility"
          value={pct(f.visibility)}
          trend={trendKpi}
          meter={f.visibility}
          sub={f.measured ? `${f.mentions} of ${f.checked} answers mention you` : "Not measured yet"}
          aside={<InfoTip text="Share of valid AI answers that mention your brand. Failed requests are excluded." />}
        />
        <Kpi
          label="Recommendation rate"
          value="—"
          sub="Needs recommendation classification"
          aside={<InfoTip text="Answers that actively recommend your brand, not just name it. Reported separately from mentions." />}
        />
        <Kpi
          label="AI share of voice"
          value={pct(f.shareOfVoice)}
          sub={f.shareOfVoice != null ? "Your mentions vs. tracked rivals" : "Needs brand mentions"}
          aside={<InfoTip text="Your mentions as a share of all brand mentions, yours plus tracked competitors." />}
        />
        <Kpi
          label="Domain citations"
          value="—"
          sub="Verified source links not collected"
          aside={<InfoTip text="Answers that link to your website as a source. A brand name in plain text is not a citation." />}
        />
        <Kpi
          label="Visibility change"
          value={f.delta == null ? "—" : `${f.delta >= 0 ? "+" : ""}${f.delta}`}
          tone={f.delta == null ? "default" : f.delta >= 0 ? "good" : "danger"}
          sub={f.delta == null ? "Needs two monitoring cycles" : "Points vs. previous cycle"}
        />
        <Kpi
          label="Opportunities"
          value={opportunities ? String(opportunities.length) : "—"}
          sub={opportunities ? "Evidence-backed actions" : "Appear after analysis"}
        />
      </section>

      {f.failed > 0 && (
        <p className="rounded-xl border bg-warning-50 px-4 py-2.5 text-[12px] text-warning-700">
          {f.failed} request{f.failed === 1 ? "" : "s"} failed in this period and {f.failed === 1 ? "is" : "are"} excluded
          from every rate shown.
        </p>
      )}

      {/* Trend + model comparison */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Visibility trend"
          subtitle="Share of answers that mention your brand, by period"
          padded
        >
          {f.trend.length >= 2 ? (
            <div className="h-60" role="img" aria-label="Line chart of brand mention rate over time">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={f.trend} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis
                    dataKey="weekStart"
                    tickFormatter={(d: string) => new Date(d).toLocaleDateString("en", { month: "short", day: "numeric" })}
                    tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tick={{ fontSize: 11, fill: "var(--color-brand-400)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "Mention rate"]}
                    labelFormatter={(d) => new Date(String(d)).toLocaleDateString("en", { dateStyle: "medium" })}
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--color-line)", fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="citationSharePct"
                    stroke="var(--color-series-1)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyBlock
              title="Not enough history for a trend"
              body="A trend needs at least two monitoring cycles with measured answers. The first point appears after the next scan."
            />
          )}
        </Panel>

        <Panel className="lg:col-span-2" title="Model performance" subtitle="Mention rate per AI model" padded>
          <ModelBars report={report} />
        </Panel>
      </div>

      {/* Competitors + citation sources */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Competitor visibility" subtitle="Share of answers naming each brand" padded>
          <CompetitorBars report={report} brandLabel={brandLabel} />
        </Panel>
        <Panel title="Citation sources" subtitle="Which websites AI models link to" padded>
          <EmptyBlock
            title="No verified citations yet"
            body="Only source links returned by the model's API are counted. Providers that return none are shown as unmeasured, never as zero."
            action={
              <ActionButton onClick={() => onNavigate("citations")}>Open Citation Intelligence</ActionButton>
            }
          />
        </Panel>
      </div>

      {/* Prompt table */}
      <Panel
        title="Prompt performance"
        subtitle="Each monitored question and how every model answered"
        actions={<ActionButton onClick={() => onNavigate("prompts")}>Manage prompts</ActionButton>}
      >
        <PromptTable prompts={prompts} />
      </Panel>

      {/* Opportunities */}
      <Panel
        title="Opportunity center"
        subtitle="Prioritised from the evidence above — nothing is predicted"
        actions={<ActionButton onClick={() => onNavigate("actions")}>Open Action Center</ActionButton>}
        padded
      >
        <OpportunityGrid opportunities={opportunities} onNavigate={onNavigate} />
      </Panel>
    </div>
  );
}

/* ── pieces ──────────────────────────────────────────────────────── */

export function ModelBars({ report }: { report?: VisibilityReport | null }) {
  const byKey = new Map<ModelKey, VisibilityReport["byAssistant"][number]>();
  for (const row of report?.byAssistant ?? []) {
    const key = modelKeyOf(row.assistant);
    if (key && !byKey.has(key)) byKey.set(key, row);
  }
  return (
    <ul className="space-y-3">
      {MODEL_DEFS.map((m) => {
        const row = byKey.get(m.key);
        return (
          <li key={m.key}>
            <div className="mb-1 flex items-baseline justify-between text-[12px]">
              <span className="font-medium text-brand-950">{m.label}</span>
              {row ? (
                <span className="font-mono text-brand-700">
                  {pct(row.citationSharePct)} <span className="text-brand-400">· {row.checked} checked</span>
                </span>
              ) : (
                <span className="text-brand-400">Not monitored</span>
              )}
            </div>
            <MeterBar value={row?.citationSharePct ?? 0} width="100%" />
          </li>
        );
      })}
    </ul>
  );
}

export function CompetitorBars({ report, brandLabel }: { report?: VisibilityReport | null; brandLabel: string }) {
  const rows = [...(report?.shareOfVoice ?? [])].sort((a, b) => b.sharePct - a.sharePct).slice(0, 8);
  if (rows.length === 0) {
    return (
      <EmptyBlock
        title="No competitor mentions recorded"
        body="Add competitors and run a scan to see how often each is named next to your brand."
      />
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const own = r.domain === null;
        return (
          <li key={r.domain ?? "own"}>
            <div className="mb-1 flex items-baseline justify-between text-[12px]">
              <span className={cn("truncate", own ? "font-semibold text-primary-700" : "text-brand-950")}>
                {own ? `${brandLabel} (you)` : r.label || r.domain}
              </span>
              <span className="font-mono text-brand-700">
                {pct(r.sharePct)} <span className="text-brand-400">· {r.mentions} mentions</span>
              </span>
            </div>
            <MeterBar value={r.sharePct} tone={own ? "good" : "accent"} width="100%" />
          </li>
        );
      })}
    </ul>
  );
}

function checkCell(p: AvPrompt, key: ModelKey) {
  const hit = p.latestChecks?.find((c) => modelKeyOf(c.assistant) === key);
  if (!hit) return <span className="text-brand-300" title="Not monitored for this prompt">—</span>;
  if (hit.error) return <Pill tone="warn">Failed</Pill>;
  return hit.cited ? <Pill tone="good">Mentioned</Pill> : <Pill>Absent</Pill>;
}

export function PromptTable({ prompts }: { prompts: AvPrompt[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (prompts.length === 0) {
    return (
      <EmptyBlock
        title="No monitored prompts yet"
        body="Prompts are the neutral customer questions asked of each AI model. Add prompts to start monitoring."
      />
    );
  }
  return (
    <Table minWidth={1040}>
      <thead>
        <tr>
          <Th>Question</Th>
          <Th>Category</Th>
          {MODEL_DEFS.map((m) => (
            <Th key={m.key}>{m.label}</Th>
          ))}
          <Th>Details</Th>
        </tr>
      </thead>
      <tbody>
        {prompts.map((p) => {
          const expanded = open === p.id;
          const detail = (p.latestChecks ?? []).filter((c) => c.answerExcerpt || c.error);
          return (
            <React.Fragment key={p.id}>
              <Tr>
                <Td className="max-w-[320px] text-[12.5px] font-medium text-brand-950">{p.text}</Td>
                <Td className="text-[12px] text-brand-500">{categoryOf(p)?.label ?? p.category ?? p.cluster ?? "—"}</Td>
                {MODEL_DEFS.map((m) => (
                  <Td key={m.key}>{checkCell(p, m.key)}</Td>
                ))}
                <Td>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`prompt-detail-${p.id}`}
                    onClick={() => setOpen(expanded ? null : p.id)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-primary-700 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-600"
                  >
                    {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    Responses
                  </button>
                </Td>
              </Tr>
              {expanded && (
                <tr id={`prompt-detail-${p.id}`} className="border-b bg-brand-50">
                  <Td colSpan={MODEL_DEFS.length + 3} className="px-4 py-3">
                    {detail.length === 0 ? (
                      <p className="text-[12px] text-brand-500">No stored responses for this prompt in the period.</p>
                    ) : (
                      <ul className="space-y-2">
                        {detail.map((c, i) => (
                          <li key={i} className="rounded-lg border bg-white p-3">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-brand-500">
                              <span className="font-semibold text-brand-950">{assistantLabel(c.assistant)}</span>
                              {c.model && <span className="font-mono">{c.model}</span>}
                              <span>{new Date(c.checkedAt).toLocaleDateString("en", { dateStyle: "medium" })}</span>
                            </div>
                            <p className="mt-1.5 text-[12px] leading-relaxed text-brand-700">
                              {c.error ? `Request failed: ${c.error}` : c.answerExcerpt}
                            </p>
                            {(c.competitorsCited?.length ?? 0) > 0 && (
                              <p className="mt-1.5 text-[11px] text-brand-500">
                                Competitors named: {c.competitorsCited.join(", ")}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </Table>
  );
}

export function OpportunityGrid({
  opportunities,
  onNavigate,
}: {
  opportunities?: AvOpportunity[] | null;
  onNavigate: (tab: string) => void;
}) {
  if (!opportunities || opportunities.length === 0) {
    return (
      <EmptyBlock
        title="No opportunities identified yet"
        body="Opportunities are created when a scan shows a competitor named where you are absent, linked to the page and issue that may explain it."
      />
    );
  }
  const tone = { HIGH: "bad", MEDIUM: "warn", LOW: "default" } as const;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {opportunities.map((o) => (
        <article key={o.id} className="flex flex-col rounded-xl border bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[13px] font-semibold leading-snug text-brand-950">{o.title}</h3>
            <Pill tone={tone[o.priority]}>{o.priority}</Pill>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-brand-600">{o.evidence}</p>
          <dl className="mt-3 space-y-1 text-[11.5px]">
            {o.model && (
              <div className="flex gap-2">
                <dt className="w-16 text-brand-400">Model</dt>
                <dd className="text-brand-700">{o.model}</dd>
              </div>
            )}
            {o.page && (
              <div className="flex gap-2">
                <dt className="w-16 text-brand-400">Page</dt>
                <dd className="truncate font-mono text-brand-700">{o.page}</dd>
              </div>
            )}
          </dl>
          <p className="mt-3 border-t pt-3 text-[12px] text-brand-700">{o.recommendation}</p>
          <div className="mt-3 flex gap-2">
            <ActionButton onClick={() => onNavigate("root-cause")}>View investigation</ActionButton>
            {o.fixable && (
              <ActionButton variant="primary" onClick={() => onNavigate("actions")}>
                Generate fix
              </ActionButton>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
