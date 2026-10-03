"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight, Bell, History, TrendingDown, TrendingUp } from "lucide-react";
import { Panel, Pill } from "@/components/ui/console";
import { NoDataState } from "@/components/ui/truthful-state";
import { Caveat, EmptyNote, Gate } from "@/components/google/view-kit";
import { SourceBadge } from "@/components/google/parts";
import { useChangeLedger, useGoogleAlerts, useGoogleOverview } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { formatKpi, pathOf } from "@/lib/google-format";
import { cn } from "@/lib/utils";

/** A move this large, against the previous period, is called out. It is a plain threshold, shown below. */
const ALERT_PCT = 15;

type AlertFilter = "all" | "good" | "bad";

/** What moved against the previous period, and what your own changes did. */
export function ChangesView() {
  const { projectId } = useWorkspace();
  const overview = useGoogleOverview(projectId);
  const ledger = useChangeLedger(projectId);
  const alerts = useGoogleAlerts(projectId);
  const [filter, setFilter] = useState<AlertFilter>("all");

  const alertsData = useMemo(() => alerts.query.data?.alerts ?? [], [alerts.query.data?.alerts]);
  const totalAlerts = alertsData.length;
  const gainsCount = useMemo(() => alertsData.filter((a) => a.direction === "GOOD").length, [alertsData]);
  const dropsCount = useMemo(() => alertsData.filter((a) => a.direction !== "GOOD").length, [alertsData]);
  const changesCount = ledger.data?.changes.length ?? 0;

  const filteredAlerts = useMemo(() => {
    if (filter === "good") return alertsData.filter((a) => a.direction === "GOOD");
    if (filter === "bad") return alertsData.filter((a) => a.direction !== "GOOD");
    return alertsData;
  }, [alertsData, filter]);

  return (
    <div className="space-y-5">
      {/* ── TOP KPI SUMMARY GRID ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
            <Bell size={18} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Total Alerts</p>
            <p className="font-mono text-xl font-bold text-brand-950">{totalAlerts}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-500/20 text-success-600 font-bold">
            <TrendingUp size={18} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Positive Gains</p>
            <p className="font-mono text-xl font-bold text-brand-950">{gainsCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error-500/20 text-error-600 font-bold">
            <TrendingDown size={18} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Drops & Warnings</p>
            <p className="font-mono text-xl font-bold text-brand-950">{dropsCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-brand-200/50 bg-brand-50/50 p-4 shadow-card backdrop-blur-md flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-200/60 text-brand-950 font-bold">
            <History size={18} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-brand-400">Recorded Changes</p>
            <p className="font-mono text-xl font-bold text-brand-950">{changesCount}</p>
          </div>
        </div>
      </div>

      {/* ── FILTER PILLS ── */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter alerts">
        <button
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-xl border px-3 py-1.5 text-[11.5px] font-medium transition",
            filter === "all"
              ? "border-signal-400 bg-signal-400/15 text-brand-950 font-semibold shadow-xs"
              : "border-brand-200/60 bg-brand-50/50 text-brand-500 hover:border-brand-300 hover:text-brand-950 hover:bg-brand-100/50"
          )}
        >
          All alerts <span className="ml-1 font-mono text-[10px] opacity-70">{totalAlerts}</span>
        </button>
        <button
          type="button"
          aria-pressed={filter === "good"}
          onClick={() => setFilter("good")}
          className={cn(
            "rounded-xl border px-3 py-1.5 text-[11.5px] font-medium transition",
            filter === "good"
              ? "border-signal-400 bg-signal-400/15 text-brand-950 font-semibold shadow-xs"
              : "border-brand-200/60 bg-brand-50/50 text-brand-500 hover:border-brand-300 hover:text-brand-950 hover:bg-brand-100/50"
          )}
        >
          Gains (↑) <span className="ml-1 font-mono text-[10px] opacity-70">{gainsCount}</span>
        </button>
        <button
          type="button"
          aria-pressed={filter === "bad"}
          onClick={() => setFilter("bad")}
          className={cn(
            "rounded-xl border px-3 py-1.5 text-[11.5px] font-medium transition",
            filter === "bad"
              ? "border-signal-400 bg-signal-400/15 text-brand-950 font-semibold shadow-xs"
              : "border-brand-200/60 bg-brand-50/50 text-brand-500 hover:border-brand-300 hover:text-brand-950 hover:bg-brand-100/50"
          )}
        >
          Drops & Warnings (↓) <span className="ml-1 font-mono text-[10px] opacity-70">{dropsCount}</span>
        </button>
      </div>

      <Panel title="Alerts" subtitle="Changes worth attention, detected from two stored periods.">
        <Gate query={alerts.query} what="alerts">
          {(a) =>
            !a.comparable ? (
              <EmptyNote>No earlier {a.days}-day period is stored yet, so no change can be detected. Alerts appear as history builds.</EmptyNote>
            ) : filteredAlerts.length === 0 ? (
              <EmptyNote>
                {filter === "all"
                  ? `Nothing moved enough to flag against the previous ${a.days} days.`
                  : `No ${filter === "good" ? "positive gains" : "drops or warnings"} detected in this period.`}
              </EmptyNote>
            ) : (
              <>
                <ul className="divide-y divide-brand-200/40">
                  {filteredAlerts.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 hover:bg-brand-100/40 transition">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold",
                              x.direction === "GOOD"
                                ? "bg-success-500/15 text-success-600"
                                : x.severity === "HIGH"
                                  ? "bg-error-500/15 text-error-600"
                                  : "bg-warning-500/15 text-warning-600"
                            )}
                          >
                            {x.direction === "GOOD" ? "↑ gain" : x.severity === "HIGH" ? "↓ alert" : "watch"}
                          </span>
                          <span className="text-[13px] font-semibold text-brand-950">{x.title}</span>
                          <SourceBadge source={x.source} />
                        </div>
                        <p className="mt-1 text-[12px] text-brand-600 leading-relaxed">{x.detail}</p>
                      </div>
                      <Link
                        href={x.view === "pages" ? `/google/pages${x.segment ? `?segment=${x.segment}` : ""}` : `/google/${x.view}`}
                        className="inline-flex items-center gap-1 shrink-0 rounded-xl border border-brand-200/70 bg-brand-50 px-3 py-1.5 text-[11.5px] font-semibold text-accent-700 hover:bg-brand-100 transition shadow-2xs"
                      >
                        <span>Investigate</span>
                        <ArrowUpRight size={13} />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Caveat>
                  Flagged when a count moves {a.rules.alertPct}%+ (with {a.rules.minPrevious}+ before), CTR moves {a.rules.ctrPoints}+ point, position moves {a.rules.positionPlaces}+ place, or a page loses {a.rules.pageDropPct}%+ of {a.rules.pageDropMinClicks}+ clicks. Alerts are worked out when you open this tab from stored data, not sent as notifications.
                </Caveat>
              </>
            )
          }
        </Gate>
      </Panel>

      <Panel title="Movement against the previous period" subtitle={`Every measured figure that moved by ${ALERT_PCT}% or more is flagged.`}>
        <Gate query={overview.query} what="changes">
          {(o) => {
            const moved = o.kpis.filter((k) => k.delta && k.value !== null);
            if (moved.length === 0) {
              return (
                <div className="p-4">
                  <NoDataState
                    compact
                    title="Nothing to compare yet"
                    missing={`There is no earlier ${o.days}-day period stored, so no change can be measured.`}
                    whyItMatters="A change is only real when it is measured against an earlier period; none is guessed."
                    actionRequired="Keep Search Console and Analytics connected. Comparisons appear as history builds."
                  />
                </div>
              );
            }
            return (
              <ul className="divide-y divide-brand-200/40">
                {moved.map((k) => {
                  const d = k.delta!;
                  const up = d.value >= 0;
                  const good = k.lowerIsBetter ? !up : up;
                  const flagged = d.kind === "pct" ? Math.abs(d.value) >= ALERT_PCT : false;
                  const Icon = up ? ArrowUp : ArrowDown;
                  return (
                    <li key={k.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-brand-100/40 transition">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${good ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>
                          <Icon size={13} />
                        </span>
                        <span className="text-[12.5px] font-semibold text-brand-950">{k.label}</span>
                        <SourceBadge source={k.source} />
                        {flagged && (
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold",
                            good ? "bg-success-500/15 text-success-600" : "bg-error-500/15 text-error-600"
                          )}>
                            {good ? "notable gain" : "alert"}
                          </span>
                        )}
                      </div>
                      <div className="text-right text-[12px] text-brand-600">
                        <span className="font-mono font-semibold text-brand-950">{formatKpi(k)}</span>
                        <span className="ml-2 font-mono text-[11px] font-bold">
                          {up ? "+" : "−"}{Math.abs(Math.round(d.value * 10) / 10)}{d.kind === "pct" ? "%" : d.kind === "pts" ? " pts" : " places"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          }}
        </Gate>
        <Caveat>
          Search and visit figures use different date ranges, so each is compared with its own previous period. Indexing changes are on{" "}
          <Link href="/google/index" className="font-semibold text-accent-700 hover:underline">Google Index</Link>; lost queries are on{" "}
          <Link href="/google/keywords" className="font-semibold text-accent-700 hover:underline">Keywords</Link>.
        </Caveat>
      </Panel>

      <Panel title="Your changes and what followed" subtitle="Fixes and content you shipped, and how the page performed afterwards.">
        <Gate query={ledger} what="change history">
          {(l) =>
            l.changes.length === 0 ? (
              <EmptyNote>No change has been recorded yet. Fixes and content shipped through Reigel appear here.</EmptyNote>
            ) : (
              <ul className="divide-y divide-brand-200/40">
                {l.changes.slice(0, 25).map((c) => (
                  <li key={c.id} className="px-4 py-3 hover:bg-brand-100/40 transition">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill>{c.kind === "FIX" ? "fix" : "content"}</Pill>
                      <span className="text-[12.5px] font-medium text-brand-950">{c.what}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10.5px] text-brand-400">{pathOf(c.url)} · {c.liveSince ? `live since ${new Date(c.liveSince).toLocaleDateString()}` : "not live yet"}</p>
                    <p className="mt-1 text-[12px] text-brand-600">{c.impact.verdictText ?? c.impact.message ?? "Not measurable yet."}</p>
                  </li>
                ))}
              </ul>
            )
          }
        </Gate>
      </Panel>
    </div>
  );
}

