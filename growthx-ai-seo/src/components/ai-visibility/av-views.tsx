"use client";
import React, { useState } from "react";
import Link from "next/link";
import type { CrawlJob, GoogleOverview, TrackedCompetitor, VisibilityReport } from "@/lib/api-types";
import { ActionButton, Kpi, Panel, Pill, Table, Td, Th, Tr, Mono, relativeTime } from "@/components/ui/console";
import { cn } from "@/lib/utils";
import { CompetitorBars, ModelBars, OpportunityGrid, PromptTable } from "./av-overview";
import {
  type AvOpportunity,
  type AvPrompt,
  type ConnState,
  ConnectionChip,
  EmptyBlock,
  InfoTip,
  MODEL_DEFS,
  PROMPT_CATEGORIES,
  Skeleton,
  categoryOf,
  cycleInfo,
  modelKeyOf,
  pct,
} from "./av-shared";

/* ── Unified Intelligence ────────────────────────────────────────── */

function googleState(s?: { connected: boolean; state: string; hasData: boolean }): ConnState {
  if (!s) return "unknown";
  if (!s.connected) return "disconnected";
  return s.state === "READY" && s.hasData ? "connected" : "attention";
}

export function UnifiedIntelligenceView(props: {
  businessName: string;
  domain: string;
  crawl: CrawlJob | null | undefined;
  google: GoogleOverview | null | undefined;
  googleLoading: boolean;
  competitors: TrackedCompetitor[];
  opportunities?: AvOpportunity[] | null;
}) {
  const { google } = props;
  const kpi = (needle: string) => google?.kpis.find((k) => k.key.toLowerCase().includes(needle) && k.value != null);
  const clicks = kpi("click");
  const impressions = kpi("impression");
  const ctr = kpi("ctr");
  const position = kpi("position");
  const fmtKpi = (k: typeof clicks, kind: "count" | "pct" | "pos") =>
    !k || k.value == null
      ? "—"
      : kind === "pct"
        ? `${(k.value <= 1 ? k.value * 100 : k.value).toFixed(1)}%`
        : kind === "pos"
          ? k.value.toFixed(1)
          : Math.round(k.value).toLocaleString();

  const scState = googleState(google?.sources.searchConsole);
  const gaState = googleState(google?.sources.analytics);
  const crawled = props.crawl?.pagesCrawled;

  return (
    <div className="space-y-4">
      <Panel padded>
        <div className="flex flex-wrap items-center gap-2" aria-label="Data source status">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.07em] text-brand-400">Sources</span>
          <ConnectionChip
            label="Website audit"
            state={props.crawl ? "connected" : "disconnected"}
            detail={props.crawl ? `${crawled ?? 0} pages` : "No crawl yet"}
          />
          <ConnectionChip
            label="Search Console"
            state={props.googleLoading ? "unknown" : scState}
            detail={google?.sources.searchConsole.propertyName ?? google?.sources.searchConsole.state?.toLowerCase().replace("_", " ")}
          />
          <ConnectionChip
            label="Analytics 4"
            state={props.googleLoading ? "unknown" : gaState}
            detail={google?.sources.analytics.propertyName ?? google?.sources.analytics.state?.toLowerCase().replace("_", " ")}
          />
          <ConnectionChip
            label="Competitors"
            state={props.competitors.length > 0 ? "connected" : "disconnected"}
            detail={`${props.competitors.length} tracked`}
          />
          <Link href="/integrations" className="ml-auto text-[12px] font-medium text-primary-700 hover:underline">
            Manage integrations
          </Link>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Business profile" subtitle="What AI monitoring is built around" padded>
          <dl className="divide-y text-[12.5px]">
            {[
              ["Business", props.businessName],
              ["Website", props.domain || "—"],
              ["Industry", null],
              ["Products & services", null],
              ["Target audience", null],
              ["Service locations", null],
            ].map(([k, v]) => (
              <div key={k as string} className="flex justify-between gap-4 py-2">
                <dt className="text-brand-500">{k}</dt>
                <dd className={cn("text-right", v ? "font-medium text-brand-950" : "text-brand-300")}>
                  {v ?? "Not captured yet"}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel title="Website health" subtitle="From your latest audit" padded>
          {props.crawl ? (
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="Pages crawled" value={String(crawled ?? 0)} />
              <Kpi label="Issues found" value={String(props.crawl.issuesFound ?? 0)} deltaGood="down" />
              <Kpi
                label="Health score"
                value={props.crawl.healthScore == null ? "—" : String(Math.round(props.crawl.healthScore))}
                meter={props.crawl.healthScore ?? null}
              />
              <Kpi label="Last audit" value={relativeTime(props.crawl.finishedAt ?? props.crawl.startedAt)} />
              <div className="col-span-2">
                <Link href="/website" className="text-[12px] font-medium text-primary-700 hover:underline">
                  Open Website Audit for issues and priority pages
                </Link>
              </div>
            </div>
          ) : (
            <EmptyBlock
              title="No website audit yet"
              body="Crawl your site so AI findings can be tied to real pages and issues."
              action={
                <Link href="/website">
                  <ActionButton variant="primary">Run an audit</ActionButton>
                </Link>
              }
            />
          )}
        </Panel>
      </div>

      <Panel title="Google search performance" subtitle={`Search Console and Analytics, last ${google?.days ?? 28} days`} padded>
        {props.googleLoading ? (
          <Skeleton className="h-20" />
        ) : scState === "connected" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Clicks" value={fmtKpi(clicks, "count")} />
            <Kpi label="Impressions" value={fmtKpi(impressions, "count")} />
            <Kpi label="CTR" value={fmtKpi(ctr, "pct")} />
            <Kpi label="Avg. position" value={fmtKpi(position, "pos")} />
          </div>
        ) : (
          <EmptyBlock
            title="Search Console is not providing data"
            body={google?.sources.searchConsole.message ?? "Connect Search Console to bring queries and landing-page performance into AI analysis."}
            action={
              <Link href="/integrations">
                <ActionButton variant="primary">Connect Search Console</ActionButton>
              </Link>
            }
          />
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Competitor intelligence" subtitle="From Competitor Intelligence" padded>
          {props.competitors.length > 0 ? (
            <>
              <Kpi label="Analysed competitors" value={String(props.competitors.length)} />
              <ul className="mt-3 divide-y text-[12.5px]">
                {props.competitors.slice(0, 6).map((c) => (
                  <li key={c.id} className="flex justify-between py-2">
                    <span className="font-medium text-brand-950">{c.label || c.name || c.domain}</span>
                    <Mono tone="soft">{c.domain}</Mono>
                  </li>
                ))}
              </ul>
              <Link href="/competitor-intelligence" className="mt-3 inline-block text-[12px] font-medium text-primary-700 hover:underline">
                View gaps and technical differences
              </Link>
            </>
          ) : (
            <EmptyBlock title="No competitors tracked" body="Add competitors to compare AI visibility and content coverage." />
          )}
        </Panel>

        <Panel title="Unified opportunities" subtitle="Derived from combined evidence" padded>
          <OpportunityGrid opportunities={props.opportunities} onNavigate={() => undefined} />
        </Panel>
      </div>
    </div>
  );
}

/* ── AI Model Visibility ─────────────────────────────────────────── */

export function ModelVisibilityView({ report }: { report?: VisibilityReport | null }) {
  const byKey = new Map<string, VisibilityReport["byAssistant"][number]>();
  for (const r of report?.byAssistant ?? []) {
    const k = modelKeyOf(r.assistant);
    if (k && !byKey.has(k)) byKey.set(k, r);
  }
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Panel className="lg:col-span-3" title="Per-model measurements" subtitle="Mentions, recommendations and citations are separate measures">
        <Table minWidth={560}>
          <thead>
            <tr>
              <Th>Model</Th>
              <Th align="right">Answers checked</Th>
              <Th align="right">
                Mention rate <InfoTip text="Valid answers that name your brand." />
              </Th>
              <Th align="right">
                Recommended <InfoTip text="Answers that actively recommend you. Not yet classified." />
              </Th>
              <Th align="right">
                Cited <InfoTip text="Answers linking to your site, only where the provider returns sources." />
              </Th>
            </tr>
          </thead>
          <tbody>
            {MODEL_DEFS.map((m) => {
              const r = byKey.get(m.key);
              return (
                <Tr key={m.key}>
                  <Td className="text-[12.5px] font-medium text-brand-950">{m.label}</Td>
                  <Td align="right"><Mono>{r ? r.checked : "—"}</Mono></Td>
                  <Td align="right"><Mono>{r ? pct(r.citationSharePct) : "—"}</Mono></Td>
                  <Td align="right"><Mono tone="soft">—</Mono></Td>
                  <Td align="right"><Mono tone="soft">—</Mono></Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>
      <Panel className="lg:col-span-2" title="Mention rate" padded>
        <ModelBars report={report} />
        <p className="mt-4 border-t pt-3 text-[11.5px] leading-relaxed text-brand-500">
          Failed requests are excluded from every rate. Models that do not return source links cannot be scored on
          citations, so those cells stay empty rather than showing 0%.
        </p>
      </Panel>
    </div>
  );
}

/* ── Prompt Intelligence ─────────────────────────────────────────── */

export function PromptIntelligenceView({ prompts, onAddPrompt }: { prompts: AvPrompt[]; onAddPrompt: () => void }) {
  const counts = PROMPT_CATEGORIES.map((c) => ({
    ...c,
    n: prompts.filter((p) => categoryOf(p)?.key === c.key).length,
  }));
  return (
    <div className="space-y-4">
      <section aria-label="Prompt coverage" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {counts.map((c) => (
          <Kpi key={c.key} label={c.label} value={`${c.n} / 4`} meter={Math.min(100, (c.n / 4) * 100)} sub="Target: 4 prompts" />
        ))}
      </section>
      <Panel
        title="Monitored prompts"
        subtitle="Neutral customer questions — they never contain your brand name"
        actions={<ActionButton variant="primary" onClick={onAddPrompt}>Add prompt</ActionButton>}
      >
        <PromptTable prompts={prompts} />
      </Panel>
    </div>
  );
}

/* ── Citation Intelligence ───────────────────────────────────────── */

export function CitationIntelligenceView() {
  return (
    <div className="space-y-4">
      <section aria-label="Citation totals" className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Total citations" value="—" sub="Awaiting verified source data" />
        <Kpi label="Your domain" value="—" sub="Links to your website" />
        <Kpi label="Competitor domains" value="—" sub="Links to tracked rivals" />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          ["Top cited domains", "Websites AI models link to most often."],
          ["Most cited pages", "The exact URLs models used as sources."],
          ["Citation trend", "How cited sources change cycle to cycle."],
          ["Citation opportunities", "Sources cited for competitors but never for you. Appearing there does not guarantee recommendations."],
        ].map(([t, s]) => (
          <Panel key={t} title={t} subtitle={s}>
            <EmptyBlock
              title="No verified citations recorded"
              body="Citations are stored only when a provider returns them in its response. Plain-text mentions are never counted."
            />
          </Panel>
        ))}
      </div>
    </div>
  );
}

/* ── Competitor Comparison ───────────────────────────────────────── */

export function CompetitorComparisonView(props: {
  report?: VisibilityReport | null;
  competitors: TrackedCompetitor[];
  brandLabel: string;
  onAddCompetitor: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Share of answers" subtitle="You versus tracked competitors" padded>
        <CompetitorBars report={props.report} brandLabel={props.brandLabel} />
      </Panel>
      <Panel
        title="Tracked competitors"
        actions={<ActionButton onClick={props.onAddCompetitor}>Add competitor</ActionButton>}
      >
        {props.competitors.length === 0 ? (
          <EmptyBlock title="No competitors tracked" body="Add competitor domains to compare how often each is named." />
        ) : (
          <Table minWidth={420}>
            <thead>
              <tr>
                <Th>Competitor</Th>
                <Th>Domain</Th>
                <Th align="right">Last analysed</Th>
              </tr>
            </thead>
            <tbody>
              {props.competitors.map((c) => (
                <Tr key={c.id}>
                  <Td className="text-[12.5px] font-medium text-brand-950">{c.label || c.name || c.domain}</Td>
                  <Td><Mono tone="soft">{c.domain}</Mono></Td>
                  <Td align="right"><Mono tone="soft">{relativeTime(c.lastAnalyzedAt)}</Mono></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

/* ── Root Cause Analysis ─────────────────────────────────────────── */

export interface AvFinding {
  id: string;
  title: string;
  model: string;
  prompts: string[];
  observed: string[];
  competitors: string[];
  pages: string[];
  seoIssues: string[];
  possibleCauses: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  actions: string[];
}

const STEPS = [
  "Find prompts where you are absent",
  "Read the actual model answers",
  "Identify who was recommended",
  "Check available source citations",
  "Pull related audit findings",
  "Review Search Console and GA4",
  "Compare competitor gaps",
  "Explain with evidence",
  "Prioritise improvements",
];

export function RootCauseView({ findings }: { findings?: AvFinding[] | null }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!findings || findings.length === 0) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Investigations">
          <EmptyBlock
            title="Nothing to investigate yet"
            body="An investigation opens when a monitored prompt shows a competitor named and your brand absent. Each one keeps observed facts apart from possible explanations."
          />
        </Panel>
        <Panel title="How an investigation works" padded>
          <ol className="space-y-2 text-[12px] text-brand-600">
            {STEPS.map((s, i) => (
              <li key={s} className="flex gap-2">
                <span className="font-mono text-brand-400">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    );
  }
  const tone = { HIGH: "good", MEDIUM: "warn", LOW: "default" } as const;
  return (
    <div className="space-y-3">
      {findings.map((f) => {
        const expanded = open === f.id;
        return (
          <Panel key={f.id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : f.id)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-primary-600"
            >
              <span>
                <span className="block text-[13px] font-semibold text-brand-950">{f.title}</span>
                <span className="text-[11.5px] text-brand-500">
                  {f.model} · {f.prompts.length} prompt{f.prompts.length === 1 ? "" : "s"}
                </span>
              </span>
              <Pill tone={tone[f.confidence]}>{f.confidence} confidence</Pill>
            </button>
            {expanded && (
              <div className="grid gap-4 border-t p-4 md:grid-cols-2">
                {(
                  [
                    ["Observed evidence", f.observed],
                    ["Possible causes (not proven)", f.possibleCauses],
                    ["Related competitors", f.competitors],
                    ["Relevant pages", f.pages],
                    ["Related SEO issues", f.seoIssues],
                    ["Recommended actions", f.actions],
                  ] as const
                ).map(([h, items]) => (
                  <section key={h}>
                    <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-brand-400">{h}</h3>
                    <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[12px] text-brand-700">
                      {items.length ? items.map((x) => <li key={x}>{x}</li>) : <li className="list-none text-brand-300">None recorded</li>}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

/* ── Action Center ───────────────────────────────────────────────── */

export const ACTION_STATUSES = [
  "NEW", "REVIEWING", "APPROVED", "IN PROGRESS", "PR CREATED", "MERGED", "DEPLOYED", "VALIDATING", "COMPLETED", "DISMISSED",
] as const;

export interface AvAction {
  id: string;
  title: string;
  category: string;
  priority: number;
  status: (typeof ACTION_STATUSES)[number];
  identifiedAt: string;
}

export function ActionCenterView({ actions }: { actions?: AvAction[] | null }) {
  const [filter, setFilter] = useState<string>("ALL");
  const rows = (actions ?? []).filter((a) => filter === "ALL" || a.status === filter);
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        {["ALL", ...ACTION_STATUSES].map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={filter === s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary-600",
              filter === s ? "border-primary-600 bg-primary-50 text-primary-700" : "bg-white text-brand-600 hover:bg-brand-50",
            )}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <Panel title="AI Action Center" subtitle="Findings from audit, Google, competitors and AI monitoring in one queue">
        {rows.length === 0 ? (
          <EmptyBlock
            title={actions?.length ? "No actions with this status" : "No actions yet"}
            body="Actions appear when analysis finds an evidence-backed problem. Fixes always open as a pull request for you to review — nothing is merged automatically."
          />
        ) : (
          <Table minWidth={760}>
            <thead>
              <tr>
                <Th>Action</Th>
                <Th>Category</Th>
                <Th align="right">
                  Priority <InfoTip text="Combines technical severity, search opportunity, page importance, affected prompts and confidence. No traffic gain is predicted." />
                </Th>
                <Th>Status</Th>
                <Th align="right">Identified</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <Tr key={a.id}>
                  <Td className="text-[12.5px] font-medium text-brand-950">{a.title}</Td>
                  <Td className="text-[12px] text-brand-500">{a.category}</Td>
                  <Td align="right"><Mono>{a.priority}</Mono></Td>
                  <Td><Pill>{a.status}</Pill></Td>
                  <Td align="right"><Mono tone="soft">{relativeTime(a.identifiedAt)}</Mono></Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

/* ── Monitoring History ──────────────────────────────────────────── */

export function MonitoringHistoryView({ report }: { report?: VisibilityReport | null }) {
  const rows = [...(report?.trend ?? [])].filter((t) => t.checked > 0).reverse();
  return (
    <Panel title="Monitoring history" subtitle="Each row is a measured period — earlier answers are never reused">
      {rows.length === 0 ? (
        <EmptyBlock title="No completed scans" body="Completed monitoring cycles are listed here with their measured mention rate." />
      ) : (
        <Table minWidth={460}>
          <thead>
            <tr>
              <Th>Period starting</Th>
              <Th align="right">Answers checked</Th>
              <Th align="right">Mention rate</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Tr key={r.weekStart}>
                <Td className="text-[12.5px] text-brand-950">{new Date(r.weekStart).toLocaleDateString("en", { dateStyle: "medium" })}</Td>
                <Td align="right"><Mono>{r.checked}</Mono></Td>
                <Td align="right"><Mono>{pct(r.citationSharePct)}</Mono></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

/* ── Settings ────────────────────────────────────────────────────── */

export function SettingsView({ report }: { report?: VisibilityReport | null }) {
  const c = cycleInfo();
  const month = new Date().toLocaleDateString("en", { month: "long" });
  const last = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const windows = [
    ["Cycle 1", `${month} 1 – 10`],
    ["Cycle 2", `${month} 11 – 20`],
    ["Cycle 3", `${month} 21 – ${last}`],
  ];
  const active = new Set((report?.measurableAssistants ?? []).map((a) => modelKeyOf(a)));
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Monitoring schedule" subtitle="One scheduled scan in each cycle" padded>
        <ul className="divide-y text-[12.5px]">
          {windows.map(([k, v], i) => (
            <li key={k} className="flex items-center justify-between py-2">
              <span className="font-medium text-brand-950">{k}</span>
              <span className="flex items-center gap-2 text-brand-500">
                {v}
                {i + 1 === c.index && <Pill tone="info">Current</Pill>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11.5px] text-brand-500">Next scan from {c.nextScan}.</p>
      </Panel>
      <Panel title="Models" subtitle="Credentials are held on the server and never shown here" padded>
        <ul className="divide-y text-[12.5px]">
          {MODEL_DEFS.map((m) => (
            <li key={m.key} className="flex items-center justify-between py-2">
              <span className="font-medium text-brand-950">{m.label}</span>
              {active.has(m.key) ? <Pill tone="good">Active</Pill> : <Pill>Not reporting</Pill>}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel className="lg:col-span-2" title="Measurement notes" padded>
        <ul className="list-disc space-y-1.5 pl-4 text-[12px] leading-relaxed text-brand-600">
          <li>Mention rate, recommendation rate and website citations are three different measurements.</li>
          <li>Failed requests are excluded from rates; data completeness is reported separately.</li>
          <li>AI answers vary between requests, so compare cycles rather than single answers.</li>
          <li>Each cycle asks the models fresh; earlier answers are not reused as new measurements.</li>
        </ul>
      </Panel>
    </div>
  );
}
