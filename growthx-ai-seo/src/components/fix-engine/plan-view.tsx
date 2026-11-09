"use client";
import { useState } from "react";
import Link from "next/link";
import { PLAN_SOURCES } from "@/lib/plan-sources";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FileCode2, GitPullRequest, Globe, RefreshCw, ShieldCheck, Zap } from "lucide-react";
import { ActionButton, Panel, Pill, StatusNote } from "@/components/ui/console";
import { FailedState, LoadingState, NoDataState } from "@/components/ui/truthful-state";
import { CmsApplyModal } from "@/components/fix-engine/cms-apply-modal";
import { useFindings, useTransitionFinding, useWorkspace } from "@/hooks/use-growthx";
import { api, type GrowthOpportunity } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

/** The workflow's tabs, and which finding sources belong to each. */
const GROUPS = PLAN_SOURCES;

const BAND = { HIGH: "good", MEDIUM: "warn", LOW: "default" } as const;
const EFFORT = { HIGH: "bad", MEDIUM: "warn", LOW: "good" } as const;

/** What happens to a fix after approval, in words that do not promise more than is built. */
const FIX_CLASS: Record<string, { label: string; hint: string }> = {
  AUTO: { label: "Low-risk fix", hint: "A safe change (like a title or description) that can be prepared for your approval." },
  APPROVAL: { label: "Needs your approval", hint: "A change that must be reviewed by you before anything is applied." },
  MANUAL: { label: "Do it yourself", hint: "Needs a person, such as writing content or contacting a developer." },
};

const LIFECYCLE_LABEL: Record<string, string> = {
  DETECTED: "New",
  QUEUED: "In your plan",
  APPROVED: "Approved",
  APPLYING: "Being applied",
  VERIFYING: "Being checked",
  VERIFIED: "Confirmed fixed",
  MEASURED: "Result measured",
  FAILED: "Failed",
  SNOOZED: "Snoozed",
  DISMISSED: "Dismissed",
  RESOLVED: "Resolved",
};

function groupOf(source: string) {
  const norm = (source || '').toUpperCase().trim();
  return GROUPS.find((g) => g.sources.some((s) => s.toUpperCase() === norm)) ?? null;
}

/**
 * The improvement plan: everything the platform found across the workflow, in
 * one ranked list, each with the evidence it stands on and what to do.
 *
 * Fix Engine prepares and you approve. This view only records your decisions
 * (add to plan, dismiss); it does not change your website, and nothing here is
 * shown as fixed unless a later check confirmed it.
 */
export function PlanView({
  onOpenGitHubFixes,
}: {
  onOpenGitHubFixes?: (findingId?: string) => void;
} = {}) {
  const { projectId, projects } = useWorkspace();
  const domain = projects.find((p) => p.id === projectId)?.name ?? null;
  const [group, setGroup] = useState<string>("ALL");
  const [cmsFinding, setCmsFinding] = useState<GrowthOpportunity | null | undefined>(undefined);
  const findings = useFindings(projectId, { limit: 200 });
  const transition = useTransitionFinding(projectId);
  const queryClient = useQueryClient();

  const refresh = useMutation({
    mutationFn: async () => {
      // Collect from audit, competitor, AI visibility, backlinks, and traffic adapters, then run detectors.
      const results = await Promise.allSettled([api.syncFindings(projectId!), api.detectOpportunities(projectId!)]);
      const failed = results.flatMap((r) => (r.status === "rejected" ? [errorMessage(r.reason)] : []));
      if (failed.length) throw new Error(`Some sources could not refresh: ${failed.join(" ")} Available findings are retained.`);
      const detection = results[1];
      if (detection.status === 'fulfilled' && 'failedDetectors' in detection.value && (detection.value.failedDetectors as string[]).length) throw new Error('Some detectors could not finish. Available findings are retained; review the source modules for missing data.');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["findings", projectId] }),
  });

  if (!projectId || findings.isLoading) return <LoadingState compact title="Loading your improvement plan…" message="Reading the findings from every tab." />;
  if (findings.error || !findings.data) return <FailedState title="Could not load the plan" error={errorMessage(findings.error)} onRetry={() => findings.refetch()} />;

  const items = findings.data.items;
  const counts = new Map<string, number>();
  for (const g of GROUPS) {
    counts.set(
      g.id,
      items.filter((i) => {
        const norm = (i.source || '').toUpperCase().trim();
        return g.sources.some((s) => s.toUpperCase() === norm);
      }).length,
    );
  }
  const shown = group === "ALL" ? items : items.filter((i) => groupOf(i.source)?.id === group);
  const active = shown.filter((i) => !["DISMISSED", "RESOLVED"].includes(i.lifecycle ?? "DETECTED"));

  const highImpactCount = active.filter((i) => i.potential === "HIGH").length;
  const autoFixableCount = active.filter((i) => i.fixClass === "AUTO").length;
  const queuedCount = active.filter((i) => i.lifecycle === "QUEUED" || i.lifecycle === "APPROVED").length;

  return (
    <div className="space-y-4">
      {findings.data.warnings?.map((warning) => <StatusNote key={warning} tone="bad">{warning}</StatusNote>)}

      {/* ── PLAN READINESS SUMMARY STRIP ── */}
      {active.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex items-center justify-between rounded-2xl border border-brand-200 bg-surface-1 p-3.5 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-500/15 text-success-700">
                <Zap size={16} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-brand-400">High Impact Opportunities</p>
                <p className="font-mono text-lg font-bold text-brand-950">
                  {highImpactCount} <span className="text-xs font-normal text-brand-500 font-sans">fixes</span>
                </p>
              </div>
            </div>
            <span className="rounded-md border border-success-500/20 bg-success-500/10 px-2 py-0.5 text-[10.5px] font-semibold text-success-700">
              Top Priority
            </span>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-brand-200 bg-surface-1 p-3.5 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-signal-400 text-signal-ink font-bold">
                <ShieldCheck size={16} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-brand-400">Safe Auto-Fixable</p>
                <p className="font-mono text-lg font-bold text-brand-950">
                  {autoFixableCount} <span className="text-xs font-normal text-brand-500 font-sans">low-risk</span>
                </p>
              </div>
            </div>
            <span className="rounded-md border border-brand-200/70 bg-surface-2 px-2 py-0.5 text-[10.5px] font-medium text-brand-500">
              Autonomous
            </span>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-brand-200 bg-surface-1 p-3.5 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brand-700 border border-brand-200 font-bold">
                <GitPullRequest size={16} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-brand-400">Ready for Pull Request</p>
                <p className="font-mono text-lg font-bold text-brand-950">
                  {queuedCount} <span className="text-xs font-normal text-brand-500 font-sans">staged</span>
                </p>
              </div>
            </div>
            {onOpenGitHubFixes && (
              <button
                type="button"
                onClick={() => onOpenGitHubFixes()}
                className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs font-semibold text-brand-800 hover:bg-surface-3 transition cursor-pointer"
              >
                <span>Stage PR</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Show findings from"
          className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-brand-50 border border-brand-200/60 p-1 text-[11.5px] font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Chip active={group === "ALL"} onClick={() => setGroup("ALL")}>All <span className="ml-1 font-mono text-[10px] opacity-70">{items.length}</span></Chip>
          {GROUPS.map((g) => (
            <Chip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)}>
              {g.label} <span className="ml-1 font-mono text-[10px] opacity-70">{counts.get(g.id) ?? 0}</span>
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenGitHubFixes && (
            <ActionButton
              variant="primary"
              icon={<GitPullRequest size={12} />}
              onClick={() => onOpenGitHubFixes()}
            >
              Improvements &amp; Log →
            </ActionButton>
          )}
          <ActionButton
            variant="secondary"
            icon={<Globe size={12} />}
            onClick={() => setCmsFinding(null)}
          >
            Apply via CMS / Platform
          </ActionButton>
          <ActionButton disabled={refresh.isPending} icon={<RefreshCw size={12} className={refresh.isPending ? "animate-spin" : undefined} />} onClick={() => refresh.mutate()}>
            {refresh.isPending ? "Analysing…" : "Refresh plan"}
          </ActionButton>
        </div>
      </div>
      {refresh.error && <StatusNote tone="bad">{errorMessage(refresh.error)}</StatusNote>}

      <Panel title="Improvement plan" subtitle="Highest impact first. Open a finding for its evidence, the pages it affects and what to do.">
        {active.length === 0 ? (
          <div className="p-4">
            <NoDataState
              compact
              title={items.length === 0 ? "No findings yet" : "Nothing open here"}
              missing={items.length === 0 ? "The plan is built from your website audit, Google data, competitors and AI Visibility." : "Every finding in this group is dismissed or resolved."}
              whyItMatters="Each tab feeds this plan once it has data."
              actionRequired={items.length === 0 ? "Complete the earlier steps, then press Refresh plan." : "Choose another group, or press Refresh plan."}
            />
          </div>
        ) : (
          <ul className="divide-y">
            {active.map((f) => (
              <FindingRow
                key={f.id}
                finding={f}
                busy={transition.isPending}
                onMove={(to, reason) => transition.mutate({ id: f.id, to, reason })}
                onOpenGitHubFixes={onOpenGitHubFixes ? () => onOpenGitHubFixes(f.id) : undefined}
                onOpenCmsApply={() => setCmsFinding(f)}
              />
            ))}
          </ul>
        )}
        {transition.error && <p className="border-t px-4 py-2.5 text-[11.5px] text-error-700">{errorMessage(transition.error)}</p>}
      </Panel>

      {cmsFinding !== undefined && (
        <CmsApplyModal
          projectId={projectId}
          domain={domain}
          finding={cmsFinding}
          onClose={() => setCmsFinding(undefined)}
        />
      )}
    </div>
  );
}

function FindingRow({
  finding: f,
  busy,
  onMove,
  onOpenGitHubFixes,
  onOpenCmsApply,
}: {
  finding: GrowthOpportunity;
  busy: boolean;
  onMove: (to: string, reason?: string) => void;
  onOpenGitHubFixes?: () => void;
  onOpenCmsApply?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const group = groupOf(f.source);
  const cls = f.fixClass ? FIX_CLASS[f.fixClass] : null;
  const lifecycle = f.lifecycle ?? "DETECTED";
  const pages = f.affectedPages ?? [];

  return (
    <li className="px-4 py-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-2 text-left">
        <span className="mt-0.5 text-brand-400">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-brand-950">{f.title}</span>
            {group && <Pill tone="info">{group.label}</Pill>}
            <Pill tone={BAND[f.potential]}>{f.potential.toLowerCase()} impact</Pill>
            {f.potential === "HIGH" && (
              <span className="inline-flex items-center gap-1 rounded border border-success-500/25 bg-success-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-success-700">
                High CTR Lift
              </span>
            )}
            <Pill tone={EFFORT[f.effort]}>{f.effort.toLowerCase()} effort</Pill>
            {cls && <span title={cls.hint}><Pill>{cls.label}</Pill></span>}
            <Pill tone={lifecycle === "QUEUED" || lifecycle === "APPROVED" ? "good" : "default"}>{LIFECYCLE_LABEL[lifecycle] ?? lifecycle}</Pill>
          </span>
          <span className="mt-1 block text-[12px] text-brand-600">{f.summary}</span>
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 pl-6">
          {f.evidence.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">Evidence</p>
              <ul className="mt-1 space-y-1">
                {f.evidence.map((e) => (
                  <li key={`${e.label}-${e.value}`} className="text-[12px] text-brand-600">
                    <span className="text-brand-400">{e.label}: </span>
                    <span className="text-brand-950">{e.value}</span>
                    <span className="ml-1.5 text-[10.5px] text-brand-400">({e.source})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-brand-950 flex items-center gap-1.5">
                <FileCode2 size={13} className="text-primary-700" /> Actionable Fix
              </p>
              {cls && <span className="text-[10px] text-brand-400">{cls.label}</span>}
            </div>
            <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-brand-950 font-sans">{f.recommendedAction}</p>
          </div>
          {pages.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-brand-400">
                Pages affected ({f.affectedCount ?? pages.length})
              </p>
              <ul className="mt-1 space-y-0.5">
                {pages.slice(0, 5).map((p) => (
                  <li key={p} className="truncate font-mono text-[11px] text-brand-600" title={p}>{p}</li>
                ))}
                {pages.length > 5 && <li className="text-[11px] text-brand-400">and {pages.length - 5} more</li>}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-brand-400">{f.detailType === 'REPORT_PLAN' ? 'Saved recommendation · review before applying' : `Confidence ${f.confidence}%`} · found {new Date(f.detectedAt).toLocaleDateString()}</p>
          {group && <Link href={f.detailType === 'REPORT_PLAN' ? group.report : group.href} className="inline-block text-[12px] font-semibold text-accent-700 hover:underline">Open source {f.detailType === 'REPORT_PLAN' ? 'report' : 'module'} →</Link>}

          <div className="flex flex-wrap items-center gap-2">
            {lifecycle === "DETECTED" && (
              <ActionButton disabled={busy} onClick={() => onMove("QUEUED")}>Add to plan</ActionButton>
            )}
            {onOpenCmsApply && (
              <ActionButton
                variant="primary"
                icon={<Globe size={12} />}
                onClick={onOpenCmsApply}
              >
                Apply via CMS / Platform →
              </ActionButton>
            )}
            {onOpenGitHubFixes && (
              <ActionButton
                variant="secondary"
                icon={<GitPullRequest size={12} />}
                onClick={onOpenGitHubFixes}
              >
                Open in Improvements &amp; PRs →
              </ActionButton>
            )}
            {["DETECTED", "QUEUED"].includes(lifecycle) && !dismissing && (
              <button type="button" onClick={() => setDismissing(true)} className={cn("text-[12px] font-semibold text-brand-500 hover:text-error-600")}>
                Dismiss
              </button>
            )}
            {dismissing && (
              <span className="flex flex-wrap items-center gap-2">
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why? (required)"
                  aria-label="Reason for dismissing"
                  className="h-8 w-56 rounded-lg border bg-white px-3 text-[12px] outline-none focus:border-primary-500"
                />
                <ActionButton disabled={busy || reason.trim() === ""} onClick={() => onMove("DISMISSED", reason.trim())}>Confirm dismiss</ActionButton>
                <button type="button" onClick={() => setDismissing(false)} className="text-[12px] text-brand-500 hover:underline">Cancel</button>
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
        active
          ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
          : "text-brand-400 hover:text-brand-950"
      )}
    >
      {children}
    </button>
  );
}
