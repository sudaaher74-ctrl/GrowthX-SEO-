"use client";
import { useState } from "react";
import Link from "next/link";
import { PLAN_SOURCES } from "@/lib/plan-sources";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileCode2,
  FileText,
  GitPullRequest,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { ActionButton, Panel, Pill, StatusNote } from "@/components/ui/console";
import { FailedState, LoadingState, NoDataState } from "@/components/ui/truthful-state";
import { CmsApplyModal } from "@/components/fix-engine/cms-apply-modal";
import { BatchFixModal } from "@/components/fix-engine/batch-fix-modal";
import {
  useFindings,
  useTransitionFinding,
  useVerifyManualFinding,
  useWorkspace,
} from "@/hooks/use-growthx";
import { api, type GrowthOpportunity, type ManualVerificationResult } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { formatFindingAsBrief, formatSprintPackMarkdown } from "@/lib/implementation-specs";
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
  onOpenContentStudio,
}: {
  onOpenGitHubFixes?: (findingId?: string) => void;
  onOpenContentStudio?: (finding: GrowthOpportunity) => void;
} = {}) {
  const { projectId, projects } = useWorkspace();
  const domain = projects.find((p) => p.id === projectId)?.name ?? null;
  const [group, setGroup] = useState<string>("ALL");
  const [cmsFinding, setCmsFinding] = useState<GrowthOpportunity | null | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const findings = useFindings(projectId, { limit: 200 });
  const transition = useTransitionFinding(projectId);
  const verifyManual = useVerifyManualFinding(projectId);
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
  const autoFixableItems = active.filter((i) => i.fixClass === "AUTO");
  const autoFixableCount = autoFixableItems.length;
  const queuedCount = active.filter((i) => i.lifecycle === "QUEUED" || i.lifecycle === "APPROVED").length;
  const selectedFindings = active.filter((i) => selectedIds.includes(i.id));

  const toggleSelectFinding = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : prev.length >= 15
          ? prev
          : [...prev, id],
    );
  };

  const selectSafeAutoBatch = () => {
    const safeIds = autoFixableItems.slice(0, 10).map((f) => f.id);
    setSelectedIds(safeIds);
  };

  const handleExportSprintPack = () => {
    const targetList = selectedFindings.length > 0 ? selectedFindings : active.slice(0, 15);
    if (targetList.length === 0) return;
    const md = formatSprintPackMarkdown(targetList, domain);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${domain || "website"}-sprint-handoff-${targetList.length}-fixes.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

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

      {/* ── BATCH SAFE FIX EXECUTION BAR ── */}
      {active.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-200/80 bg-surface-1 px-4 py-2.5 shadow-2xs text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <Layers size={14} className="text-signal-500 shrink-0" />
            <span className="font-semibold text-brand-950">
              {selectedFindings.length > 0
                ? `${selectedFindings.length} finding${selectedFindings.length === 1 ? "" : "s"} selected for batch execution`
                : "Batch Safe Fixes: select up to 15 findings to ship in 1 unified PR or CMS batch"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {autoFixableCount > 0 && (
              <button
                type="button"
                onClick={selectSafeAutoBatch}
                className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-surface-3 cursor-pointer"
              >
                Select Safe AUTO ({Math.min(10, autoFixableCount)})
              </button>
            )}
            {selectedFindings.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-[11px] font-semibold text-brand-500 hover:text-brand-900 cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleExportSprintPack}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-800 hover:bg-surface-3 transition cursor-pointer"
                >
                  <Download size={12} />
                  <span>Export Sprint Pack (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBatchOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1 text-[11px] font-bold text-signal-ink hover:bg-signal-500 transition cursor-pointer"
                >
                  <Layers size={12} />
                  <span>Batch Apply ({selectedFindings.length}) →</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
                domain={domain}
                selected={selectedIds.includes(f.id)}
                onToggleSelect={() => toggleSelectFinding(f.id)}
                busy={transition.isPending}
                onMove={(to, reason) => transition.mutate({ id: f.id, to, reason })}
                onVerifyManual={(url, note) =>
                  verifyManual.mutateAsync({ id: f.id, url, note })
                }
                onOpenGitHubFixes={onOpenGitHubFixes ? () => onOpenGitHubFixes(f.id) : undefined}
                onOpenCmsApply={() => setCmsFinding(f)}
                onOpenContentStudio={onOpenContentStudio ? () => onOpenContentStudio(f) : undefined}
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

      {batchOpen && selectedFindings.length > 0 && (
        <BatchFixModal
          projectId={projectId}
          domain={domain}
          findings={selectedFindings}
          onClose={() => setBatchOpen(false)}
          onSuccessGitHub={() => {
            setSelectedIds([]);
            onOpenGitHubFixes?.();
          }}
        />
      )}
    </div>
  );
}

function FindingRow({
  finding: f,
  domain,
  selected,
  onToggleSelect,
  busy,
  onMove,
  onVerifyManual,
  onOpenGitHubFixes,
  onOpenCmsApply,
  onOpenContentStudio,
}: {
  finding: GrowthOpportunity;
  domain: string | null;
  selected: boolean;
  onToggleSelect: () => void;
  busy: boolean;
  onMove: (to: string, reason?: string) => void;
  onVerifyManual: (url?: string, note?: string) => Promise<ManualVerificationResult>;
  onOpenGitHubFixes?: () => void;
  onOpenCmsApply?: () => void;
  onOpenContentStudio?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [reason, setReason] = useState("");
  const [copiedBrief, setCopiedBrief] = useState(false);
  const [verifyingOpen, setVerifyingOpen] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState(
    f.affectedPages?.[0] || (domain ? `https://${domain.replace(/^https?:\/\//i, "")}/` : ""),
  );
  const [verifyNote, setVerifyNote] = useState("");
  const [verifyingBusy, setVerifyingBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<ManualVerificationResult | null>(null);
  const group = groupOf(f.source);
  const cls = f.fixClass ? FIX_CLASS[f.fixClass] : null;
  const lifecycle = f.lifecycle ?? "DETECTED";
  const pages = f.affectedPages ?? [];
  const regressionEvidence = f.evidence.find((e) => e.label === "Regression detected");
  const roiEvidence = f.evidence.find((e) => e.label === "Site historical ROI");

  const handleCopyBrief = async () => {
    try {
      await navigator.clipboard.writeText(formatFindingAsBrief(f, domain));
      setCopiedBrief(true);
      setTimeout(() => setCopiedBrief(false), 2000);
    } catch {}
  };

  const handleRunManualVerify = async () => {
    setVerifyingBusy(true);
    setVerifyError(null);
    try {
      const res = await onVerifyManual(verifyUrl.trim() || undefined, verifyNote.trim() || undefined);
      setVerifyResult(res);
    } catch (err) {
      setVerifyError(errorMessage(err));
    } finally {
      setVerifyingBusy(false);
    }
  };

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${f.title} for batch execution`}
          className="mt-1 h-3.5 w-3.5 rounded border-brand-300 cursor-pointer shrink-0"
        />
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex flex-1 min-w-0 items-start gap-2 text-left cursor-pointer">
        <span className="mt-0.5 text-brand-400">{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-brand-950">{f.title}</span>
            {regressionEvidence && (
              <span title={regressionEvidence.value}>
                <Pill tone="bad">Regression</Pill>
              </span>
            )}
            {roiEvidence && (
              <span title={roiEvidence.value}>
                <Pill tone="good">Proven ROI</Pill>
              </span>
            )}
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
      </div>

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
            <ActionButton
              variant="secondary"
              icon={copiedBrief ? <Check size={12} className="text-success-600" /> : <Copy size={12} />}
              onClick={handleCopyBrief}
            >
              {copiedBrief ? "Brief copied!" : "Copy Handoff Brief"}
            </ActionButton>
            {!["VERIFIED", "MEASURED"].includes(lifecycle) && (
              <ActionButton
                variant="secondary"
                icon={<CheckCircle2 size={12} className="text-success-600" />}
                onClick={() => {
                  setVerifyingOpen((v) => !v);
                  setVerifyError(null);
                }}
              >
                {verifyingOpen ? "Hide Live Check" : "Mark Applied & Verify Live"}
              </ActionButton>
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
            {onOpenContentStudio && (
              <ActionButton
                variant={f.fixClass === "MANUAL" ? "primary" : "secondary"}
                icon={<FileText size={12} />}
                onClick={onOpenContentStudio}
              >
                Draft in Content Studio →
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
              <button type="button" onClick={() => setDismissing(true)} className={cn("text-[12px] font-semibold text-brand-500 hover:text-error-600 cursor-pointer")}>
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
                  className="h-8 w-56 rounded-lg border border-brand-200 bg-surface-1 px-3 text-[12px] text-brand-950 outline-none focus:border-primary-500"
                />
                <ActionButton disabled={busy || reason.trim() === ""} onClick={() => onMove("DISMISSED", reason.trim())}>Confirm dismiss</ActionButton>
                <button type="button" onClick={() => setDismissing(false)} className="text-[12px] text-brand-500 hover:underline cursor-pointer">Cancel</button>
              </span>
            )}
          </div>

          {/* Closed-Loop Manual Fix Live Verification Drawer */}
          {verifyingOpen && (
            <div className="rounded-xl border border-brand-200 bg-surface-2/60 p-3.5 space-y-2.5">
              <div>
                <p className="text-xs font-bold text-brand-950">
                  Verify Manual Fix on Live URL
                </p>
                <p className="text-[11px] text-brand-500">
                  Shipped this fix yourself or via a developer? We&apos;ll inspect the live HTML right now, confirm the change, and record verified proof in your Results Ledger.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="url"
                  value={verifyUrl}
                  onChange={(e) => setVerifyUrl(e.target.value)}
                  placeholder="https://yourdomain.com/page"
                  aria-label="Live URL to verify"
                  className="h-9 rounded-lg border border-brand-200 bg-surface-1 px-3 font-mono text-[11.5px] text-brand-950 outline-none focus:border-primary-500"
                />
                <input
                  type="text"
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  placeholder="Optional note (e.g. Updated in Shopify / Dev PR)"
                  aria-label="Implementation note"
                  className="h-9 rounded-lg border border-brand-200 bg-surface-1 px-3 text-[11.5px] text-brand-950 outline-none focus:border-primary-500"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                  variant="primary"
                  disabled={verifyingBusy || !verifyUrl.trim()}
                  icon={verifyingBusy ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                  onClick={handleRunManualVerify}
                >
                  {verifyingBusy ? "Inspecting live URL…" : "Verify Live URL now"}
                </ActionButton>
              </div>

              {verifyError && (
                <p role="alert" className="text-[11.5px] font-medium text-error-600">
                  {verifyError}
                </p>
              )}

              {verifyResult && (
                <div
                  role="status"
                  className={cn(
                    "rounded-lg border p-3 text-[11.5px] space-y-1.5",
                    verifyResult.verified
                      ? "border-success-500/40 bg-success-50 text-success-700"
                      : "border-warning-500/40 bg-warning-50 text-warning-700",
                  )}
                >
                  <p className="font-bold flex items-center gap-1.5">
                    {verifyResult.verified ? (
                      <CheckCircle2 size={13} className="shrink-0" />
                    ) : (
                      <AlertTriangle size={13} className="shrink-0" />
                    )}
                    <span>{verifyResult.summary}</span>
                  </p>
                  <ul className="space-y-0.5 pl-4 list-disc text-[11px]">
                    {verifyResult.checks.map((c) => (
                      <li key={c.name}>
                        <strong>{c.name}:</strong> {c.passed ? "Pass" : "Needs attention"} ({c.observed})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
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
