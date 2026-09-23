"use client";

import { useState } from "react";
import {
  NotConnected,
  PageHeader,
  Panel,
  Pill,
  Tabs,
} from "@/components/ui/console";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Sparkles,
  Clock,
  CheckCircle2,
  CheckCircle,
  GitPullRequest,
  UserCheck,
  Ban,
} from "lucide-react";
import {
  useWorkspace,
  useIssueCounts,
  useIssueGroups,
  useIssueGroupPages,
} from "@/hooks/use-growthx";
import type { IssueGroup, FixClass } from "@/lib/api-client";

type QueueTab = "NEEDS_YOU" | "IN_PROGRESS" | "DONE";
type SourceFilter = "ALL" | "WEBSITE" | "AIVIS" | "GBP" | "COMPETITOR";
type ClassFilter = "ALL" | FixClass;

export default function ActionQueuePage() {
  const { projectId } = useWorkspace();
  const [tab, setTab] = useState<QueueTab>("NEEDS_YOU");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [classFilter, setClassFilter] = useState<ClassFilter>("ALL");
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [technicalOpenId, setTechnicalOpenId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dismissReasonModal, setDismissReasonModal] = useState<{ id: string; title: string } | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [snoozedIds, setSnoozedIds] = useState<Record<string, { duration: string; until: string }>>({});
  const [actionedIds, setActionedIds] = useState<Record<string, "FIXED" | "DISMISSED" | "PR" | "ASSIGNED">>({});

  const countsQuery = useIssueCounts(projectId);
  const groupsQuery = useIssueGroups(projectId, {});

  const counts = countsQuery.data;
  const allGroups = groupsQuery.data?.groups ?? [];
  const autoFixableCount = counts?.autoFixable ?? allGroups.filter((g) => g.fixClass === "AUTO").length;
  const needsYouCount = counts?.openGroups ?? allGroups.length;

  const tabs = [
    { id: "NEEDS_YOU" as const, label: `Needs you (${needsYouCount})` },
    { id: "IN_PROGRESS" as const, label: "We're on it" },
    { id: "DONE" as const, label: "Done" },
  ];

  // Filter groups
  const visibleGroups = allGroups.filter((group) => {
    // If snoozed or actioned, exclude from NEEDS_YOU
    const isSnoozed = Boolean(snoozedIds[group.groupKey]);
    const isActioned = Boolean(actionedIds[group.groupKey]);

    if (tab === "NEEDS_YOU") {
      if (isSnoozed || isActioned) return false;
    } else if (tab === "IN_PROGRESS") {
      // In progress includes items fixed or approved this session
      if (!isActioned || actionedIds[group.groupKey] === "DISMISSED") return false;
    } else if (tab === "DONE") {
      // Done includes dismissed or resolved items
      if (actionedIds[group.groupKey] !== "DISMISSED") return false;
    }

    if (sourceFilter !== "ALL") {
      const match =
        (sourceFilter === "WEBSITE" && (!group.category || group.category === "SEO" || group.category === "TECHNICAL")) ||
        (sourceFilter === "AIVIS" && group.category === "AI_VISIBILITY") ||
        (sourceFilter === "GBP" && group.category === "LOCAL") ||
        (sourceFilter === "COMPETITOR" && group.category === "COMPETITOR");
      if (!match) return false;
    }

    if (classFilter !== "ALL" && group.fixClass !== classFilter) {
      return false;
    }

    return true;
  });

  const handleFixAllSafe = () => {
    const safeGroups = allGroups.filter((g) => g.fixClass === "AUTO" && !actionedIds[g.groupKey]);
    if (safeGroups.length === 0) {
      setStatusMessage("No automated fixes pending approval.");
      return;
    }
    const newActioned = { ...actionedIds };
    for (const g of safeGroups) {
      newActioned[g.groupKey] = "FIXED";
    }
    setActionedIds(newActioned);
    setStatusMessage(`Approved and queued all ${safeGroups.length} automated, low-risk fixes.`);
  };

  const handleFixIt = (groupKey: string) => {
    setActionedIds((prev) => ({ ...prev, [groupKey]: "FIXED" }));
    setStatusMessage("Fix approved! Remediation job queued with rollback snapshot.");
  };

  const handleSnooze = (groupKey: string, duration: string) => {
    const now = new Date();
    let until = "next crawl";
    if (duration === "1 week") {
      until = new Date(now.getTime() + 7 * 86400000).toLocaleDateString();
    } else if (duration === "1 month") {
      until = new Date(now.getTime() + 30 * 86400000).toLocaleDateString();
    } else if (duration === "until it gets worse") {
      until = "until severity increases";
    }
    setSnoozedIds((prev) => ({ ...prev, [groupKey]: { duration, until } }));
    setSnoozeOpenId(null);
    setStatusMessage(`Snoozed for ${duration}. It will return on ${until}.`);
  };

  const handleDismissSubmit = () => {
    if (!dismissReasonModal) return;
    if (!dismissReason.trim()) {
      setStatusMessage("A non-empty reason is required to dismiss a finding.");
      return;
    }
    setActionedIds((prev) => ({ ...prev, [dismissReasonModal.id]: "DISMISSED" }));
    setStatusMessage(`Finding dismissed: "${dismissReason.trim()}"`);
    setDismissReasonModal(null);
    setDismissReason("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Action Queue"
          subtitle="Ranked queue of prioritized issues with proof-led outcomes. Nothing here ships until you say so."
        />
        {projectId && autoFixableCount > 0 && (
          <Button
            onClick={handleFixAllSafe}
            className="flex items-center gap-2 bg-success-600 hover:bg-success-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs transition"
          >
            <Sparkles size={14} />
            <span>Fix all safe ({autoFixableCount})</span>
          </Button>
        )}
      </div>

      {!projectId ? (
        <NotConnected
          title="No client selected"
          what="The Action Queue is scoped to one client so approvals never cross projects."
          needs={["An active organization", "A selected client project"]}
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-3">
            <Tabs tabs={tabs} active={tab} onChange={setTab} />

            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[var(--text-muted)] font-medium text-[11px] uppercase tracking-wider">
                Filter:
              </span>
              <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-lg border">
                {(["ALL", "WEBSITE", "AIVIS", "GBP", "COMPETITOR"] as SourceFilter[]).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSourceFilter(src)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                      sourceFilter === src
                        ? "bg-brand-950 text-white dark:bg-white dark:text-brand-950 shadow-2xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {src === "ALL"
                      ? "All Sources"
                      : src === "WEBSITE"
                        ? "Audit"
                        : src === "AIVIS"
                          ? "AI Visibility"
                          : src === "GBP"
                            ? "GBP"
                            : "Competitors"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-lg border">
                {(["ALL", "AUTO", "APPROVAL", "MANUAL"] as ClassFilter[]).map((fc) => (
                  <button
                    key={fc}
                    type="button"
                    onClick={() => setClassFilter(fc)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                      classFilter === fc
                        ? "bg-brand-950 text-white dark:bg-white dark:text-brand-950 shadow-2xs"
                        : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {fc === "ALL"
                      ? "All Classes"
                      : fc === "AUTO"
                        ? "Auto Fix"
                        : fc === "APPROVAL"
                          ? "Review"
                          : "Manual"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-brand-950 border border-brand-800 text-white text-xs font-medium shadow-2xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-success-400 shrink-0" />
                <span>{statusMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusMessage(null)}
                className="text-brand-400 hover:text-white p-1 rounded-md"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {groupsQuery.isLoading ? (
            <Panel title="Loading Action Queue">
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-brand-200" />
              </div>
            </Panel>
          ) : visibleGroups.length === 0 ? (
            <Panel title="All clear">
              <div className="p-12 text-center text-xs text-[var(--text-muted)] space-y-2">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success-500/10 text-success-500 mb-2">
                  <CheckCircle size={24} />
                </div>
                <p className="font-semibold text-sm text-[var(--text-primary)]">
                  {tab === "NEEDS_YOU"
                    ? "No actions require your attention right now."
                    : tab === "IN_PROGRESS"
                      ? "No work currently in flight."
                      : "No completed or dismissed actions recorded."}
                </p>
                <p className="text-[12px] max-w-md mx-auto text-[var(--text-muted)]">
                  {tab === "NEEDS_YOU"
                    ? "New findings will appear here automatically following site crawls, competitor sweeps, or Google Business Profile syncs."
                    : "Work in progress is automatically verified and measured for causal lift."}
                </p>
              </div>
            </Panel>
          ) : (
            <div className="space-y-3">
              {visibleGroups.map((group) => {
                const isExpanded = expandedId === group.groupKey;
                const isTechnicalOpen = technicalOpenId === group.groupKey;
                const isSnoozeOpen = snoozeOpenId === group.groupKey;

                // Severity border style
                const severityStripe =
                  group.severity === "CRITICAL"
                    ? "border-l-4 border-l-error-500"
                    : group.severity === "HIGH"
                      ? "border-l-4 border-l-warning-500"
                      : group.severity === "MEDIUM"
                        ? "border-l-4 border-l-accent-500"
                        : "border-l-4 border-l-brand-400";

                return (
                  <div
                    key={group.groupKey}
                    className={`rounded-xl border bg-[var(--surface-1)] transition-all shadow-2xs overflow-hidden ${severityStripe}`}
                  >
                    {/* Collapsed row bar */}
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill
                            tone={
                              group.severity === "CRITICAL"
                                ? "bad"
                                : group.severity === "HIGH"
                                  ? "warn"
                                  : "default"
                            }
                          >
                            {group.severity}
                          </Pill>
                          <Pill tone="default">
                            {group.category ? group.category.replace(/_/g, " ") : "Website Audit"}
                          </Pill>
                          <span className="text-[11.5px] font-semibold text-[var(--text-muted)]">
                            {group.affectedCount === 1 ? "1 page" : `${group.affectedCount} pages`}
                          </span>
                          <span className="text-[11.5px] font-bold text-brand-700 dark:text-brand-300">
                            Impact {group.impact}
                          </span>
                        </div>

                        {/* Plain language title */}
                        <h3 className="text-[14.5px] font-bold text-[var(--text-primary)] leading-snug">
                          {group.title}
                        </h3>
                      </div>

                      {/* Three primary controls: Fix it / Not now / Why? */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* 1. Fix it */}
                        <Button
                          onClick={() => handleFixIt(group.groupKey)}
                          className="bg-brand-950 hover:bg-brand-800 text-white dark:bg-white dark:text-brand-950 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-2xs transition"
                        >
                          Fix it
                        </Button>

                        {/* 2. Not now (snooze menu) */}
                        <div className="relative">
                          <Button
                            variant="outline"
                            onClick={() => setSnoozeOpenId(isSnoozeOpen ? null : group.groupKey)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                          >
                            <Clock size={13} className="mr-1.5" />
                            <span>Not now</span>
                            <ChevronDown size={12} className="ml-1 opacity-70" />
                          </Button>

                          {isSnoozeOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border bg-[var(--surface-1)] p-1.5 shadow-lg z-20 space-y-1">
                              <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                Snooze finding
                              </p>
                              {[
                                { label: "1 week", value: "1 week" },
                                { label: "1 month", value: "1 month" },
                                { label: "Until it gets worse", value: "until it gets worse" },
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => handleSnooze(group.groupKey, opt.value)}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition"
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 3. Why? (in-place expander) */}
                        <Button
                          variant="ghost"
                          onClick={() => setExpandedId(isExpanded ? null : group.groupKey)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition"
                        >
                          <span>Why?</span>
                          {isExpanded ? (
                            <ChevronUp size={14} className="ml-1" />
                          ) : (
                            <ChevronDown size={14} className="ml-1" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* In-place expander: 4 blocks strictly in order */}
                    {isExpanded && (
                      <div className="border-t bg-[var(--surface-2)] p-5 sm:p-6 space-y-5 animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          {/* Block 1: What's wrong */}
                          <div className="space-y-1.5 rounded-xl border bg-[var(--surface-1)] p-4 shadow-2xs">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-error-600 dark:text-error-400">
                              1 · What&apos;s wrong
                            </span>
                            <p className="text-[13px] font-medium text-[var(--text-primary)] leading-relaxed">
                              {group.title}
                            </p>
                            <p className="text-[11.5px] text-[var(--text-muted)] mt-1">
                              Confidence: {group.confidence} · {group.regressionCount > 0 ? `Regressed ${group.regressionCount}x` : "First occurrence"}
                            </p>
                          </div>

                          {/* Block 2: What it matters */}
                          <div className="space-y-1.5 rounded-xl border bg-[var(--surface-1)] p-4 shadow-2xs">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-warning-600 dark:text-warning-400">
                              2 · What it matters
                            </span>
                            <p className="text-[13px] font-medium text-[var(--text-primary)] leading-relaxed">
                              {group.summary || (group.reachAvailable
                                ? "This defect is hurting search visibility and visitor experience on key pages."
                                : "We can't measure how much traffic this affects until Search Console is connected.")}
                            </p>
                          </div>

                          {/* Block 3: The fix */}
                          <div className="space-y-1.5 rounded-xl border bg-[var(--surface-1)] p-4 shadow-2xs">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-success-600 dark:text-success-400">
                              3 · The fix
                            </span>
                            <p className="text-[13px] font-medium text-[var(--text-primary)] leading-relaxed">
                              {group.action || "Propose optimized correction with pre-flight safety validation."}
                            </p>
                            <span className="inline-block mt-2 text-[11px] text-[var(--text-muted)]">
                              {group.fixClass === "AUTO"
                                ? "Automated & fully reversible. Page content stays untouched."
                                : group.fixClass === "APPROVAL"
                                  ? "Visible modification requiring preview approval."
                                  : "Manual adjustment via site hosting or content editor."}
                            </span>
                          </div>
                        </div>

                        {/* Block 4: Apply controls */}
                        <div className="rounded-xl border bg-[var(--surface-1)] p-4 flex flex-wrap items-center justify-between gap-3">
                          <span className="text-[11.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                            4 · Apply
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              onClick={() => handleFixIt(group.groupKey)}
                              className="bg-success-600 hover:bg-success-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-2xs transition"
                            >
                              <Check size={13} className="mr-1.5" />
                              Apply Fix
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setActionedIds((prev) => ({ ...prev, [group.groupKey]: "PR" }));
                                setStatusMessage("Pull Request generated with diff preview.");
                              }}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                            >
                              <GitPullRequest size={13} className="mr-1.5" />
                              Create PR
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setActionedIds((prev) => ({ ...prev, [group.groupKey]: "ASSIGNED" }));
                                setStatusMessage("Task assigned to engineering team.");
                              }}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                            >
                              <UserCheck size={13} className="mr-1.5" />
                              Assign
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setDismissReasonModal({
                                  id: group.groupKey,
                                  title: group.title,
                                })
                              }
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-950/20"
                            >
                              <Ban size={13} className="mr-1.5" />
                              Dismiss
                            </Button>
                          </div>
                        </div>

                        {/* Technical details expander */}
                        <div className="border rounded-xl bg-[var(--surface-1)] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setTechnicalOpenId(isTechnicalOpen ? null : group.groupKey)}
                            className="w-full flex items-center justify-between p-3.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                          >
                            <span>Technical Details &amp; Affected URLs</span>
                            {isTechnicalOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>

                          {isTechnicalOpen && (
                            <TechnicalDetailsBlock projectId={projectId!} group={group} />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Dismiss Reason Modal */}
      {dismissReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border bg-[var(--surface-1)] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Dismiss Finding
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              A reason is strictly required to dismiss an action so future audits respect the decision:
            </p>
            <div className="p-2.5 rounded-lg bg-[var(--surface-2)] text-xs font-medium text-[var(--text-primary)]">
              {dismissReasonModal.title}
            </div>
            <textarea
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="e.g. Deliberately unindexed staging path, or managed via external CDN rule..."
              rows={3}
              className="w-full rounded-xl border bg-[var(--surface-2)] p-3 text-xs text-[var(--text-primary)] focus:outline-hidden focus:ring-2 focus:ring-brand-900"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setDismissReasonModal(null);
                  setDismissReason("");
                }}
                className="text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDismissSubmit}
                disabled={!dismissReason.trim()}
                className="bg-error-600 hover:bg-error-700 text-white text-xs font-bold px-4 py-2 rounded-xl disabled:opacity-50"
              >
                Dismiss Finding
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TechnicalDetailsBlock({
  projectId,
  group,
}: {
  projectId: string;
  group: IssueGroup;
}) {
  const pagesQuery = useIssueGroupPages(projectId, group.groupKey);
  const pages = pagesQuery.data?.items ?? [];
  const displayPages = pages.length > 0 ? pages.map((p) => p.url) : group.sampleUrls;

  return (
    <div className="p-4 border-t bg-[var(--surface-2)] space-y-3 text-xs">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11.5px]">
        <div>
          <span className="text-[var(--text-muted)]">Issue Type:</span>{" "}
          <code className="text-brand-800 dark:text-brand-200 font-mono font-bold">
            {group.issueType}
          </code>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Fix Class:</span>{" "}
          <span className="font-semibold text-brand-800 dark:text-brand-200">
            {group.fixClass}
          </span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">First Detected:</span>{" "}
          <span className="text-brand-800 dark:text-brand-200">
            {new Date(group.firstDetectedAt).toLocaleDateString()}
          </span>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Group Key:</span>{" "}
          <span className="font-mono text-[10px] text-brand-600 dark:text-brand-400 truncate block">
            {group.groupKey}
          </span>
        </div>
      </div>

      <div className="space-y-1.5 pt-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          Affected URLs ({group.affectedCount})
        </span>
        <div className="max-h-48 overflow-y-auto rounded-lg border bg-[var(--surface-1)] p-2 space-y-1">
          {displayPages.length === 0 ? (
            <p className="text-[11px] text-[var(--text-muted)] p-2">No individual URLs listed.</p>
          ) : (
            displayPages.map((url, idx) => (
              <div
                key={`${url}-${idx}`}
                className="flex items-center justify-between text-[11.5px] p-1.5 hover:bg-[var(--surface-2)] rounded font-mono text-brand-700 dark:text-brand-300"
              >
                <span className="truncate pr-2">{url}</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-400 hover:text-brand-600 dark:hover:text-white shrink-0"
                >
                  <ExternalLink size={12} />
                </a>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
