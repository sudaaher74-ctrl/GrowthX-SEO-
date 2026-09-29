"use client";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Panel, Pill } from "@/components/ui/console";
import { NoDataState } from "@/components/ui/truthful-state";
import { Caveat, EmptyNote, Gate } from "@/components/google/view-kit";
import { SourceBadge } from "@/components/google/parts";
import { useChangeLedger, useGoogleAlerts, useGoogleOverview } from "@/hooks/use-google";
import { useWorkspace } from "@/hooks/use-growthx";
import { formatKpi, pathOf } from "@/lib/google-format";

/** A move this large, against the previous period, is called out. It is a plain threshold, shown below. */
const ALERT_PCT = 15;

/** What moved against the previous period, and what your own changes did. */
export function ChangesView() {
  const { projectId } = useWorkspace();
  const overview = useGoogleOverview(projectId);
  const ledger = useChangeLedger(projectId);
  const alerts = useGoogleAlerts(projectId);

  return (
    <div className="space-y-4">
      <Panel title="Alerts" subtitle="Changes worth attention, detected from two stored periods.">
        <Gate query={alerts.query} what="alerts">
          {(a) =>
            !a.comparable ? (
              <EmptyNote>No earlier {a.days}-day period is stored yet, so no change can be detected. Alerts appear as history builds.</EmptyNote>
            ) : a.alerts.length === 0 ? (
              <EmptyNote>Nothing moved enough to flag against the previous {a.days} days.</EmptyNote>
            ) : (
              <>
                <ul className="divide-y">
                  {a.alerts.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={x.direction === "GOOD" ? "good" : x.severity === "HIGH" ? "bad" : "warn"}>{x.direction === "GOOD" ? "gain" : x.severity === "HIGH" ? "high" : "watch"}</Pill>
                          <span className="text-[13px] font-semibold text-brand-950">{x.title}</span>
                          <SourceBadge source={x.source} />
                        </div>
                        <p className="mt-1 text-[12px] text-brand-600">{x.detail}</p>
                      </div>
                      <Link href={x.view === "pages" ? `/google/pages${x.segment ? `?segment=${x.segment}` : ""}` : `/google/${x.view}`} className="shrink-0 text-[12px] font-semibold text-accent-700 hover:underline">
                        Investigate →
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
              <ul className="divide-y">
                {moved.map((k) => {
                  const d = k.delta!;
                  const up = d.value >= 0;
                  const good = k.lowerIsBetter ? !up : up;
                  const flagged = d.kind === "pct" ? Math.abs(d.value) >= ALERT_PCT : false;
                  const Icon = up ? ArrowUp : ArrowDown;
                  return (
                    <li key={k.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full ${good ? "bg-success-50 text-success-700" : "bg-error-50 text-error-700"}`}>
                          <Icon size={13} />
                        </span>
                        <span className="text-[12.5px] font-semibold text-brand-950">{k.label}</span>
                        <SourceBadge source={k.source} />
                        {flagged && <Pill tone={good ? "good" : "bad"}>{good ? "notable gain" : "alert"}</Pill>}
                      </div>
                      <div className="text-right text-[12px] text-brand-600">
                        <span className="font-mono font-semibold text-brand-950">{formatKpi(k)}</span>
                        <span className="ml-2 font-mono text-[11px]">
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
              <EmptyNote>No change has been recorded yet. Fixes and content shipped through GrowthX appear here.</EmptyNote>
            ) : (
              <ul className="divide-y">
                {l.changes.slice(0, 25).map((c) => (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill>{c.kind === "FIX" ? "fix" : "content"}</Pill>
                      <span className="text-[12.5px] text-brand-950">{c.what}</span>
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
