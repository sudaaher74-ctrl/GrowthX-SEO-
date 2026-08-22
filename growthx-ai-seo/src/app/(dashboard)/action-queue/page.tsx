"use client";
import { useState } from "react";
import { PageHeader, Panel, Pill, NotConnected, relativeTime } from "@/components/ui/console";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X, ArrowRight, ExternalLink, Target } from "lucide-react";
import {
  useWorkspace,
  useMarketActions,
  useMarketOpportunities,
  useMarketActionDecision,
  useMarketOutcomes,
} from "@/hooks/use-growthx";
import type { MarketActionRow, MarketActionStatus } from "@/lib/api-client";

const TABS: { id: MarketActionStatus | "ALL"; label: string }[] = [
  { id: "PROPOSED", label: "Awaiting decision" },
  { id: "APPROVED", label: "Approved" },
  { id: "CONVERTED", label: "Converted" },
  { id: "REJECTED", label: "Rejected" },
  { id: "ALL", label: "All" },
];

export default function ActionQueuePage() {
  const { projectId } = useWorkspace();
  const [tab, setTab] = useState<MarketActionStatus | "ALL">("PROPOSED");

  const actions = useMarketActions(projectId, tab === "ALL" ? undefined : tab);
  const opportunities = useMarketOpportunities(projectId);
  const outcomes = useMarketOutcomes(projectId);
  const decide = useMarketActionDecision(projectId);
  const [error, setError] = useState<string | null>(null);

  async function act(actionId: string, decision: "approve" | "reject" | "convert") {
    setError(null);
    try {
      await decide.mutateAsync({ actionId, decision });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    }
  }

  const rows = actions.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Action Queue"
        subtitle="Evidence-backed recommendations from market research. Nothing here happens until you approve it."
      />

      {!projectId ? (
        <NotConnected
          title="No client selected"
          what="The action queue is scoped to one client so approvals never cross projects."
          needs={["An active organization", "A selected client project"]}
        />
      ) : (
        <>
          <div className="flex space-x-1 border-b border-brand-200 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-accent-600 text-accent-600"
                    : "border-transparent text-brand-500 hover:text-brand-950 hover:border-brand-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {actions.isLoading ? (
            <Panel title="Loading">
              <div className="flex items-center justify-center py-12">
                <Loader2 size={26} className="animate-spin text-brand-200" />
              </div>
            </Panel>
          ) : rows.length === 0 ? (
            <Panel title="Nothing here yet">
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                {tab === "PROPOSED"
                  ? "No recommendations are waiting. Ask a question in Market Research to generate some."
                  : "No actions with this status."}
              </div>
            </Panel>
          ) : (
            <div className="space-y-3">
              {rows.map((action) => (
                <ActionCard key={action.id} action={action} busy={decide.isPending} onAct={act} />
              ))}
            </div>
          )}

          <Panel
            title="Measured results"
            subtitle="AI citation share before and after work that was created"
          >
            {(outcomes.data ?? []).length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                Nothing measured yet. A baseline is recorded when an approved action becomes real work.
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {(outcomes.data ?? []).map((o) => (
                  <div key={o.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-[var(--text-primary)]">{o.action.title}</p>
                      {o.status === "MEASURED" && o.deltaPt !== null ? (
                        <span
                          className={`text-[13px] font-bold ${
                            o.deltaPt > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : o.deltaPt < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-[var(--text-muted)]"
                          }`}
                        >
                          {o.deltaPt > 0 ? "+" : ""}
                          {o.deltaPt} pt
                        </span>
                      ) : (
                        <Pill>{o.status.toLowerCase()}</Pill>
                      )}
                    </div>
                    <p className="text-[11.5px] text-[var(--text-muted)] mt-1">
                      Baseline {o.baselineCitationSharePct ?? "—"}% on {new Date(o.baselineAt).toLocaleDateString()}
                      {o.measuredAt
                        ? ` · now ${o.citationSharePct ?? "—"}% on ${new Date(o.measuredAt).toLocaleDateString()}`
                        : " · not re-measured yet"}
                    </p>
                    {/* Movement, not attribution — stated on every row so the
                        number is never read as proof the action caused it. */}
                    {o.note && <p className="text-[11px] text-[var(--text-muted)] mt-1 italic">{o.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Citation gaps"
            subtitle="Where competitors are winning AI citations for topics this client should own"
          >
            {(opportunities.data ?? []).length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--text-muted)]">
                No gaps identified yet.
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {(opportunities.data ?? []).map((o) => (
                  <div key={o.id} className="rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                        <Target size={13} className="text-blue-500" />
                        {o.topic}
                      </p>
                      <div className="flex gap-1.5">
                        <Pill>impact {o.impact.toLowerCase()}</Pill>
                        <Pill>effort {o.effort.toLowerCase()}</Pill>
                      </div>
                    </div>
                    <p className="text-[12.5px] text-[var(--text-secondary)] mt-1">{o.gap}</p>
                    {o.competitorsWinning.length > 0 && (
                      <p className="text-[11.5px] text-[var(--text-muted)] mt-1">
                        Winning: {o.competitorsWinning.join(", ")}
                      </p>
                    )}
                    <p className="text-[12.5px] text-blue-600 dark:text-blue-400 mt-1.5">{o.recommendedResponse}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function ActionCard({
  action,
  busy,
  onAct,
}: {
  action: MarketActionRow;
  busy: boolean;
  onAct: (id: string, decision: "approve" | "reject" | "convert") => void;
}) {
  const [showEvidence, setShowEvidence] = useState(false);
  const sources = action.run?.sources ?? [];

  return (
    <Panel
      title={action.title}
      subtitle={`${action.type.replace(/_/g, " ").toLowerCase()} · proposed ${relativeTime(action.createdAt)}`}
    >
      <div className="p-4 space-y-3">
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">{action.description}</p>

        <div className="flex flex-wrap gap-2">
          <Pill tone={action.status === "CONVERTED" ? "good" : action.status === "REJECTED" ? "bad" : "info"}>
            {action.status.toLowerCase()}
          </Pill>
          <Pill>confidence {action.confidence.toLowerCase()}</Pill>
          {action.expectedImpact && <Pill>{action.expectedImpact.slice(0, 60)}</Pill>}
        </div>

        {/* Every action reaching this queue survived citation validation, so the
            evidence behind it can always be shown. */}
        <button
          onClick={() => setShowEvidence((v) => !v)}
          className="text-[12px] font-medium text-blue-600 hover:underline"
        >
          {showEvidence ? "Hide" : "Show"} supporting evidence ({sources.length})
        </button>

        {showEvidence && (
          <div className="space-y-1.5 rounded-lg bg-[var(--surface-2)] p-3">
            {action.run?.question && (
              <p className="text-[11.5px] text-[var(--text-muted)]">
                From research: “{action.run.question}”
              </p>
            )}
            {sources.length === 0 ? (
              <p className="text-[11.5px] text-[var(--text-muted)]">No sources recorded on this run.</p>
            ) : (
              sources.map((s, i) => (
                <div key={s.id} className="text-[11.5px] text-[var(--text-secondary)]">
                  <span className="mr-1 font-semibold text-blue-600">[{i + 1}]</span>
                  {s.title}
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1.5 inline-flex items-center text-blue-600 hover:underline"
                    >
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {action.status === "PROPOSED" && (
            <>
              <Button variant="primary" size="sm" disabled={busy} onClick={() => onAct(action.id, "approve")}>
                <Check size={13} className="mr-1.5" /> Approve
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => onAct(action.id, "reject")}>
                <X size={13} className="mr-1.5" /> Reject
              </Button>
            </>
          )}

          {action.status === "APPROVED" && (
            <Button variant="primary" size="sm" disabled={busy} onClick={() => onAct(action.id, "convert")}>
              <ArrowRight size={13} className="mr-1.5" /> Create the work
            </Button>
          )}

          {action.status === "CONVERTED" && (
            <p className="text-[12px] text-emerald-600 dark:text-emerald-400">
              Created in GrowthX{action.convertedToId ? ` (${action.convertedToId.slice(0, 8)}…)` : ""}.
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
