"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Globe,
  Layers,
  RefreshCw,
  UserCheck,
  Wrench,
} from "lucide-react";
import { PLAN_SOURCES } from "@/lib/plan-sources";
import { ActionButton, Pill, StatusNote } from "@/components/ui/console";
import { FailedState, LoadingState, NoDataState } from "@/components/ui/truthful-state";
import { CmsApplyModal } from "@/components/fix-engine/cms-apply-modal";
import { BatchFixModal } from "@/components/fix-engine/batch-fix-modal";
import { IssueSolutionGuide } from "@/components/fix-engine/issue-solution-guide";
import {
  useFindings,
  useTransitionFinding,
  useVerifyManualFinding,
  useWorkspace,
} from "@/hooks/use-growthx";
import { api, type GrowthOpportunity, type ManualVerificationResult } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { formatSprintPackMarkdown } from "@/lib/implementation-specs";
import { getIssueFixGuide } from "@/lib/issue-fix-guides";
import { cn } from "@/lib/utils";

const GROUPS = PLAN_SOURCES;

const LIFECYCLE_LABEL: Record<string, string> = {
  DETECTED: "Open",
  QUEUED: "In plan",
  APPROVED: "Approved",
  APPLYING: "Applying",
  VERIFYING: "Checking live",
  VERIFIED: "Fixed ✓",
  MEASURED: "Verified lift",
  FAILED: "Needs retry",
  SNOOZED: "Snoozed",
  DISMISSED: "Dismissed",
  RESOLVED: "Resolved",
};

type DifficultyFilter = "ALL" | "NO_CODE" | "DEVELOPER" | "HIGH_IMPACT";

function groupOf(source: string) {
  const norm = (source || "").toUpperCase().trim();
  return GROUPS.find((g) => g.sources.some((s) => s.toUpperCase() === norm)) ?? null;
}

function impactDotClass(potential: string): string {
  if (potential === "HIGH") return "bg-error-500";
  if (potential === "MEDIUM") return "bg-warning-500";
  return "bg-brand-300";
}

/**
 * Plain-English Action Plan: every website finding explained without jargon,
 * showing who can fix it, how long it takes, platform-specific step-by-step
 * instructions, 1-click developer handoff, and optional CMS/GitHub auto-apply.
 */
export function PlanView({
  canAutoApply = false,
  onOpenGitHubFixes,
  onOpenContentStudio,
}: {
  canAutoApply?: boolean;
  onOpenGitHubFixes?: (findingId?: string) => void;
  onOpenContentStudio?: (finding: GrowthOpportunity) => void;
} = {}) {
  const { projectId, projects } = useWorkspace();
  const domain = projects.find((p) => p.id === projectId)?.name ?? null;
  const [group, setGroup] = useState<string>("ALL");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("ALL");
  const [cmsFinding, setCmsFinding] = useState<GrowthOpportunity | null | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);

  const findings = useFindings(projectId, { limit: 200 });
  const transition = useTransitionFinding(projectId);
  const verifyManual = useVerifyManualFinding(projectId);
  const queryClient = useQueryClient();

  const refresh = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled([
        api.syncFindings(projectId!),
        api.detectOpportunities(projectId!),
      ]);
      const failed = results.flatMap((r) => (r.status === "rejected" ? [errorMessage(r.reason)] : []));
      if (failed.length) {
        throw new Error(
          `Some sources could not refresh: ${failed.join(" ")} Available findings are retained.`,
        );
      }
      const detection = results[1];
      if (
        detection.status === "fulfilled" &&
        "failedDetectors" in detection.value &&
        (detection.value.failedDetectors as string[]).length
      ) {
        throw new Error(
          "Some checks could not finish. Available findings are kept — check your connected sources.",
        );
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["findings", projectId] }),
  });

  const enrichedItems = useMemo(() => {
    const raw = findings.data?.items ?? [];
    return raw.map((f) => ({
      finding: f,
      guide: getIssueFixGuide({
        title: f.title,
        summary: f.summary,
        recommendedAction: f.recommendedAction,
        domain,
        affectedPages: f.affectedPages,
        fixClass: f.fixClass,
        source: f.source,
      }),
    }));
  }, [findings.data?.items, domain]);

  if (!projectId || findings.isLoading) {
    return (
      <LoadingState
        compact
        title="Loading your action plan…"
        message="Gathering issues and preparing plain-English fix guides."
      />
    );
  }
  if (findings.error || !findings.data) {
    return (
      <FailedState
        title="Could not load your action plan"
        error={errorMessage(findings.error)}
        onRetry={() => findings.refetch()}
      />
    );
  }

  const counts = new Map<string, number>();
  for (const g of GROUPS) {
    counts.set(
      g.id,
      enrichedItems.filter(({ finding: i }) => {
        const norm = (i.source || "").toUpperCase().trim();
        return g.sources.some((s) => s.toUpperCase() === norm);
      }).length,
    );
  }

  const byGroup =
    group === "ALL"
      ? enrichedItems
      : enrichedItems.filter(({ finding: i }) => groupOf(i.source)?.id === group);

  const activeAll = byGroup.filter(
    ({ finding: i }) => !["DISMISSED", "RESOLVED"].includes(i.lifecycle ?? "DETECTED"),
  );

  const visibleItems = activeAll.filter(({ finding: f, guide }) => {
    if (difficultyFilter === "NO_CODE") return guide.difficulty === "no_code";
    if (difficultyFilter === "DEVELOPER") return guide.difficulty !== "no_code";
    if (difficultyFilter === "HIGH_IMPACT") return f.potential === "HIGH";
    return true;
  });

  const selectedFindings = activeAll
    .map((x) => x.finding)
    .filter((f) => selectedIds.includes(f.id));
  const batchFindings = selectedFindings.filter((finding) => finding.fixClass !== "MANUAL");
  const manualCount = selectedFindings.length - batchFindings.length;

  const toggleSelectFinding = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : prev.length >= 15
          ? prev
          : [...prev, id],
    );
  };

  const handleDownloadDeveloperPack = () => {
    const targetList =
      selectedFindings.length > 0
        ? selectedFindings
        : visibleItems.slice(0, 15).map((x) => x.finding);
    if (targetList.length === 0) return;
    const md = formatSprintPackMarkdown(targetList, domain);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${domain || "website"}-fix-instructions-${targetList.length}-items.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-4">
      {findings.data.warnings?.map((warning) => (
        <StatusNote key={warning} tone="bad">
          {warning}
        </StatusNote>
      ))}

      {/* Clean Filter & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div
          role="group"
          aria-label="Filter by source module"
          className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-brand-200/70 bg-surface-1 p-1 text-[11.5px] font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Chip active={group === "ALL"} onClick={() => setGroup("ALL")}>
            All <span className="ml-0.5 font-mono text-[10px] opacity-75">{enrichedItems.length}</span>
          </Chip>
          {GROUPS.map((g) => (
            <Chip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)}>
              {g.label} <span className="ml-0.5 font-mono text-[10px] opacity-75">{counts.get(g.id) ?? 0}</span>
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {visibleItems.length > 0 && (
            <ActionButton
              variant="secondary"
              icon={<Download size={12} />}
              onClick={handleDownloadDeveloperPack}
            >
              Download Fix Guide (.md)
            </ActionButton>
          )}
          {canAutoApply && (
            <ActionButton
              variant="secondary"
              icon={<Globe size={12} />}
              onClick={() => setCmsFinding(null)}
            >
              Auto-Apply (CMS)
            </ActionButton>
          )}
          <ActionButton
            disabled={refresh.isPending}
            icon={<RefreshCw size={12} className={refresh.isPending ? "animate-spin" : undefined} />}
            onClick={() => refresh.mutate()}
          >
            {refresh.isPending ? "Refreshing…" : "Refresh plan"}
          </ActionButton>
        </div>
      </div>

      {refresh.error && <StatusNote tone="bad">{errorMessage(refresh.error)}</StatusNote>}

      {/* Contextual Batch Bar — ONLY appears when the user selects 1+ items */}
      {selectedFindings.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-signal-400/50 bg-surface-1 px-4 py-2.5 shadow-xs text-xs">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-signal-500 shrink-0" />
            <span className="font-semibold text-brand-950">
              {selectedFindings.length} {selectedFindings.length === 1 ? "issue" : "issues"} selected
            </span>
            {manualCount > 0 && (
              <span className="text-brand-600">
                {manualCount === 1 ? "1 issue requires" : `${manualCount} issues require`} manual work. Open each issue for instructions.
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[11.5px] font-semibold text-brand-500 hover:text-brand-950 cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleDownloadDeveloperPack}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11.5px] font-semibold text-brand-800 hover:bg-surface-3 transition cursor-pointer"
            >
              <Download size={12} />
              <span>Export for Developer</span>
            </button>
            {canAutoApply && batchFindings.length > 0 && (
              <button
                type="button"
                onClick={() => setBatchOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal-400 px-3 py-1 text-[11.5px] font-bold text-signal-ink hover:bg-signal-500 transition cursor-pointer"
              >
                <Layers size={12} />
                <span>Batch Auto-Apply ({batchFindings.length}) →</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Action Plan Container */}
      <section className="overflow-hidden rounded-2xl border border-brand-200/80 bg-surface-1 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-brand-950">
              Step-by-step action plan ({visibleItems.length})
            </h2>
            <p className="mt-0.5 text-xs text-brand-500">
              Click any issue to read what’s wrong in plain English and see exact fix steps for your website platform.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Filter by fix type"
            className="inline-flex flex-wrap items-center gap-1 text-[11.5px]"
          >
            {(
              [
                { id: "ALL", label: "All" },
                { id: "NO_CODE", label: "No coding needed" },
                { id: "DEVELOPER", label: "For developer" },
                { id: "HIGH_IMPACT", label: "High impact" },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={difficultyFilter === f.id}
                onClick={() => setDifficultyFilter(f.id)}
                className={cn(
                  "rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer",
                  difficultyFilter === f.id
                    ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                    : "text-brand-500 hover:bg-brand-100 hover:text-brand-950",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="p-6">
            <NoDataState
              compact
              title={enrichedItems.length === 0 ? "No issues detected yet" : "No issues match this filter"}
              missing={
                enrichedItems.length === 0
                  ? "Run a Website Audit or connect Google Search Console to populate your action plan."
                  : "Every issue in this category has been resolved or filtered out."
              }
              whyItMatters="Issues from Audit, Traffic, Competitors, and AI Visibility automatically appear here with plain-English guides."
              actionRequired={
                enrichedItems.length === 0
                  ? "Run an audit on the Dashboard, then click Refresh plan."
                  : "Switch to 'All' above to view your remaining issues."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-brand-100">
            {visibleItems.map(({ finding: f, guide }) => (
              <FindingRow
                key={f.id}
                finding={f}
                guideDifficulty={guide.difficulty}
                guideDifficultyLabel={guide.difficultyLabel}
                guideTime={guide.estimatedTime}
                domain={domain}
                selected={selectedIds.includes(f.id)}
                onToggleSelect={() => toggleSelectFinding(f.id)}
                busy={transition.isPending}
                onMove={(to, reason) => transition.mutate({ id: f.id, to, reason })}
                onVerifyManual={(url, note) => verifyManual.mutateAsync({ id: f.id, url, note })}
                onOpenGitHubFixes={
                  canAutoApply && f.fixClass !== "MANUAL" && onOpenGitHubFixes
                    ? () => onOpenGitHubFixes(f.id)
                    : undefined
                }
                onOpenCmsApply={canAutoApply && f.fixClass !== "MANUAL" ? () => setCmsFinding(f) : undefined}
                onOpenContentStudio={onOpenContentStudio ? () => onOpenContentStudio(f) : undefined}
              />
            ))}
          </ul>
        )}

        {transition.error && (
          <p className="border-t border-brand-100 px-5 py-2.5 text-xs text-error-700">
            {errorMessage(transition.error)}
          </p>
        )}
      </section>

      {cmsFinding !== undefined && (
        <CmsApplyModal
          projectId={projectId}
          domain={domain}
          finding={cmsFinding}
          onClose={() => setCmsFinding(undefined)}
        />
      )}

      {batchOpen && canAutoApply && batchFindings.length > 0 && (
        <BatchFixModal
          projectId={projectId}
          domain={domain}
          findings={batchFindings}
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
  guideDifficulty,
  guideDifficultyLabel,
  guideTime,
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
  guideDifficulty: "no_code" | "cms_or_dev" | "developer";
  guideDifficultyLabel: string;
  guideTime: string;
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
  const group = groupOf(f.source);
  const lifecycle = f.lifecycle ?? "DETECTED";
  const pageCount = f.affectedCount ?? f.affectedPages?.length ?? 0;

  return (
    <li className="px-5 py-3.5 transition hover:bg-surface-2/40">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          aria-label={`Select ${f.title}`}
          className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-brand-300 cursor-pointer"
        />

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start justify-between gap-4 text-left cursor-pointer"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <span
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", impactDotClass(f.potential))}
              title={`${f.potential.toLowerCase()} impact`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13.5px] font-semibold text-brand-950">{f.title}</span>
                {f.potential === "HIGH" && <Pill tone="warn">High impact</Pill>}
                {lifecycle !== "DETECTED" && (
                  <Pill tone={lifecycle === "VERIFIED" || lifecycle === "MEASURED" ? "good" : "default"}>
                    {LIFECYCLE_LABEL[lifecycle] ?? lifecycle}
                  </Pill>
                )}
              </div>
              <p className="mt-0.5 line-clamp-1 text-xs text-brand-500">{f.summary}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5 text-[11.5px]">
            <span
              className={cn(
                "hidden sm:inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium",
                guideDifficulty === "no_code"
                  ? "bg-success-50 text-success-700"
                  : "bg-brand-100 text-brand-600",
              )}
            >
              {guideDifficulty === "no_code" ? <UserCheck size={11} /> : <Wrench size={11} />}
              <span>{guideDifficulty === "no_code" ? "No coding" : guideDifficultyLabel === "Best sent to developer" ? "Developer" : "CMS / Dev"}</span>
            </span>

            <span className="hidden md:inline-flex items-center gap-1 font-mono text-[11px] text-brand-400 tabular-nums">
              <Clock size={11} />
              {guideTime}
            </span>

            {pageCount > 0 && (
              <span className="hidden lg:inline font-mono text-[11px] text-brand-400 tabular-nums">
                {pageCount} {pageCount === 1 ? "page" : "pages"}
              </span>
            )}

            <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
              <span className="hidden sm:inline">{open ? "Hide" : "Solution"}</span>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </div>
        </button>
      </div>

      {open && (
        <div className="pl-6">
          <IssueSolutionGuide
            finding={f}
            domain={domain}
            sourceLink={
              group
                ? {
                    href: f.detailType === "REPORT_PLAN" ? group.report : group.href,
                    label:
                      f.detailType === "REPORT_PLAN"
                        ? "Open source report →"
                        : `Open ${group.label} →`,
                  }
                : null
            }
            busy={busy}
            onMove={onMove}
            onVerifyManual={onVerifyManual}
            onOpenCmsApply={onOpenCmsApply}
            onOpenContentStudio={onOpenContentStudio}
            onOpenGitHubFixes={onOpenGitHubFixes}
          />
        </div>
      )}
    </li>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors cursor-pointer",
        active
          ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
          : "text-brand-500 hover:text-brand-950",
      )}
    >
      {children}
    </button>
  );
}
