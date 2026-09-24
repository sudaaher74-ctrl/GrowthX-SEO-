"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
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
  Copy,
  Download,
  FileText,
  AlertTriangle,
  Code2,
  MapPin,
  Flame,
  ArrowRight,
  ListTodo,
  Layers,
  Globe,
  Bot,
  Swords,
  ShieldCheck,
} from "lucide-react";
import {
  useWorkspace,
  useIssueCounts,
  useIssueGroups,
  useIssueGroupPages,
  useAiVisibilityRoadmapTasks,
} from "@/hooks/use-growthx";
import type { IssueGroup, FixClass } from "@/lib/api-client";

type RoadmapTab = "TO_DO" | "IN_PROGRESS" | "DONE";
type SourceFilter = "ALL" | "WEBSITE" | "AIVIS" | "GBP" | "COMPETITOR";
type SeverityFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export default function ActionRoadmapPage() {
  const { projectId } = useWorkspace();
  const [tab, setTab] = useState<RoadmapTab>("TO_DO");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("ALL");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [technicalOpenId, setTechnicalOpenId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedBriefId, setCopiedBriefId] = useState<string | null>(null);
  const [copiedRoadmap, setCopiedRoadmap] = useState(false);

  // Local state tracking for roadmap task completion
  const [taskStatusMap, setTaskStatusMap] = useState<Record<string, "TO_DO" | "IN_PROGRESS" | "DONE">>({});

  const countsQuery = useIssueCounts(projectId);
  const groupsQuery = useIssueGroups(projectId, {});
  // AI Visibility findings, one task per buyer question the latest answer did
  // not cite you for, tied to the page that should answer it. Same shape and
  // same list as the audit's issues, ranked together by impact.
  const aiTasksQuery = useAiVisibilityRoadmapTasks(projectId);

  const allGroups = useMemo(
    () =>
      [...(groupsQuery.data?.groups ?? []), ...(aiTasksQuery.data?.groups ?? [])].sort(
        (a, b) => b.impact - a.impact,
      ),
    [groupsQuery.data?.groups, aiTasksQuery.data?.groups],
  );

  // Filter groups according to tab and filters
  const visibleGroups = useMemo(() => {
    return allGroups.filter((group) => {
      const currentStatus = taskStatusMap[group.groupKey] || "TO_DO";
      if (tab !== currentStatus) return false;

      if (sourceFilter !== "ALL") {
        const match =
          (sourceFilter === "WEBSITE" && (!group.category || group.category === "SEO" || group.category === "TECHNICAL")) ||
          (sourceFilter === "AIVIS" && group.category === "AI_VISIBILITY") ||
          (sourceFilter === "GBP" && group.category === "LOCAL") ||
          (sourceFilter === "COMPETITOR" && group.category === "COMPETITOR");
        if (!match) return false;
      }

      if (severityFilter !== "ALL" && group.severity !== severityFilter) {
        return false;
      }

      return true;
    });
  }, [allGroups, taskStatusMap, tab, sourceFilter, severityFilter]);

  // Counts for tabs
  const todoCount = allGroups.filter((g) => (taskStatusMap[g.groupKey] || "TO_DO") === "TO_DO").length;
  const inProgressCount = allGroups.filter((g) => taskStatusMap[g.groupKey] === "IN_PROGRESS").length;
  const doneCount = allGroups.filter((g) => taskStatusMap[g.groupKey] === "DONE").length;

  const tabs = [
    { id: "TO_DO" as const, label: `To Do (${todoCount})` },
    { id: "IN_PROGRESS" as const, label: `In Progress (${inProgressCount})` },
    { id: "DONE" as const, label: `Completed (${doneCount})` },
  ];

  const handleSetStatus = (groupKey: string, newStatus: "TO_DO" | "IN_PROGRESS" | "DONE") => {
    setTaskStatusMap((prev) => ({ ...prev, [groupKey]: newStatus }));
    const label = newStatus === "DONE" ? "Completed" : newStatus === "IN_PROGRESS" ? "In Progress" : "To Do";
    setStatusMessage(`Task marked as ${label}.`);
  };

  const generateTaskBrief = (group: IssueGroup) => {
    return `### [SEO Fix Brief] ${group.title}
**Severity**: ${group.severity} | **Impact Score**: ${group.impact}/100
**Category**: ${group.category || "Website Audit"} | **Pages Affected**: ${group.affectedCount}

#### 1. What's Wrong
${group.title}
Confidence: ${group.confidence}

#### 2. Why It Matters
${group.summary || "This issue reduces organic search performance and negatively impacts user experience."}

#### 3. How to Fix (Step-by-Step)
- ${group.action || "Inspect affected URLs and deploy the recommended markup/code correction."}
- Check Core Web Vitals and ensure status 200 responses.
- Re-crawl or request re-indexing via Google Search Console once deployed.

#### 4. Sample Affected URLs
${(group.sampleUrls || []).map((u) => `- ${u}`).join("\n") || "- Site-wide"}
`;
  };

  const handleCopyTaskBrief = (group: IssueGroup) => {
    const brief = generateTaskBrief(group);
    navigator.clipboard.writeText(brief);
    setCopiedBriefId(group.groupKey);
    setTimeout(() => setCopiedBriefId(null), 2000);
  };

  const handleExportRoadmapMarkdown = () => {
    let md = `# SEO Implementation Roadmap\nGenerated on ${new Date().toLocaleDateString()}\n\n`;
    md += `## 1. High Priority & Critical Fixes\n`;
    allGroups.forEach((g, idx) => {
      const status = taskStatusMap[g.groupKey] || "TO_DO";
      md += `\n### ${idx + 1}. [${status}] ${g.title}\n`;
      md += `- **Severity**: ${g.severity} (Impact: ${g.impact}/100)\n`;
      md += `- **Pages Affected**: ${g.affectedCount}\n`;
      md += `- **Remediation Action**: ${g.action}\n`;
      md += `- **Sample URLs**:\n${(g.sampleUrls || []).slice(0, 3).map((u) => `  * ${u}`).join("\n")}\n`;
    });

    navigator.clipboard.writeText(md);
    setCopiedRoadmap(true);
    setStatusMessage("Roadmap copied to clipboard in Markdown format!");
    setTimeout(() => setCopiedRoadmap(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER BANNER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <PageHeader
            title="SEO Action Roadmap"
            subtitle="Prioritized, step-by-step implementation guide for your engineering and content teams. Follow the verified instructions to drive measurable organic rankings."
          />
        </div>

        {projectId && allGroups.length > 0 && (
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              onClick={handleExportRoadmapMarkdown}
              variant="outline"
              className="flex items-center gap-2 border text-brand-700 hover:bg-brand-50 font-bold text-xs px-3.5 py-2 rounded-xl transition"
            >
              {copiedRoadmap ? <Check size={14} className="text-success-600" /> : <Copy size={14} />}
              <span>{copiedRoadmap ? "Roadmap Copied!" : "Export Roadmap (Markdown)"}</span>
            </Button>
          </div>
        )}
      </div>

      {!projectId ? (
        <NotConnected
          title="No client selected"
          what="The Action Roadmap is scoped to one client so roadmap directives never cross projects."
          needs={["An active organization", "A selected client project"]}
        />
      ) : (
        <>
          {/* ── ROADMAP SCOREBOARD ── */}
          <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-brand-950 p-6 text-white shadow-md sm:grid-cols-4">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-brand-400">Total Roadmap Directives</div>
              <div className="text-2xl font-black text-white">{allGroups.length}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-brand-400">Critical & High Priority</div>
              <div className="text-2xl font-black text-error-400">
                {allGroups.filter((g) => g.severity === "CRITICAL" || g.severity === "HIGH").length}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-brand-400">In Progress</div>
              <div className="text-2xl font-black text-warning-400">{inProgressCount}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-brand-400">Completed Directives</div>
              <div className="text-2xl font-black text-success-400">{doneCount}</div>
            </div>
          </div>

          {/* ── TABS AND FILTERS ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-3">
            <Tabs tabs={tabs} active={tab} onChange={setTab} />

            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-brand-500 font-medium text-[11px] uppercase tracking-wider">
                Filter:
              </span>
              <div className="flex items-center gap-1 bg-brand-50 p-1 rounded-lg border">
                {(["ALL", "WEBSITE", "AIVIS", "GBP", "COMPETITOR"] as SourceFilter[]).map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setSourceFilter(src)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                      sourceFilter === src
                        ? "bg-brand-950 text-white shadow-2xs"
                        : "text-brand-600 hover:text-brand-950"
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

              <div className="flex items-center gap-1 bg-brand-50 p-1 rounded-lg border">
                {(["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"] as SeverityFilter[]).map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                      severityFilter === sev
                        ? "bg-brand-950 text-white shadow-2xs"
                        : "text-brand-600 hover:text-brand-950"
                    }`}
                  >
                    {sev === "ALL" ? "All Severities" : sev}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {statusMessage && (
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-brand-950 border text-white text-xs font-medium shadow-2xs animate-in fade-in duration-200">
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
            <Panel title="Loading SEO Action Roadmap">
              <div className="flex items-center justify-center py-16">
                <Loader2 size={28} className="animate-spin text-brand-950" />
              </div>
            </Panel>
          ) : visibleGroups.length === 0 ? (
            <Panel title="All clear">
              <div className="p-12 text-center text-xs text-brand-500 space-y-2">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success-500/10 text-success-500 mb-2">
                  <CheckCircle size={24} />
                </div>
                <p className="font-semibold text-sm text-brand-950">
                  {tab === "TO_DO"
                    ? "No pending directives in your roadmap."
                    : tab === "IN_PROGRESS"
                      ? "No directives currently in flight."
                      : "No completed directives yet."}
                </p>
                <p className="text-[12px] max-w-md mx-auto text-brand-500">
                  {tab === "TO_DO"
                    ? "Auditing and competitor crawls continuously add newly detected gaps and blueprints here."
                    : "Track directives here as your engineering and content teams complete them."}
                </p>
              </div>
            </Panel>
          ) : (
            <div className="space-y-4">
              {visibleGroups.map((group) => {
                const isExpanded = expandedId === group.groupKey;
                const isBriefCopied = copiedBriefId === group.groupKey;
                const currentStatus = taskStatusMap[group.groupKey] || "TO_DO";

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
                    className={`rounded-2xl border bg-white transition-all shadow-xs overflow-hidden ${severityStripe}`}
                  >
                    {/* Collapsed Card Header */}
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                              group.severity === "CRITICAL"
                                ? "bg-error-50 text-error-700"
                                : group.severity === "HIGH"
                                  ? "bg-warning-50 text-warning-700"
                                  : "bg-brand-100 text-brand-700"
                            }`}
                          >
                            {group.severity}
                          </span>
                          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                            {group.category ? group.category.replace(/_/g, " ") : "Website Audit"}
                          </span>
                          <span className="text-[11.5px] font-semibold text-brand-500">
                            {group.affectedCount === 0 && group.category === "AI_VISIBILITY"
                              ? "New page needed"
                              : group.affectedCount === 1
                                ? "1 page affected"
                                : `${group.affectedCount} pages affected`}
                          </span>
                          <span className="text-[11.5px] font-black text-brand-900">
                            Impact: {group.impact}/100
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-brand-950 leading-snug">
                          {group.title}
                        </h3>
                      </div>

                      {/* Workflow Controls: Mark as Done / In Progress / Copy Brief / How To Fix */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {currentStatus !== "DONE" ? (
                          <Button
                            onClick={() => handleSetStatus(group.groupKey, "DONE")}
                            className="bg-brand-950 hover:bg-brand-800 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-2xs transition flex items-center gap-1.5"
                          >
                            <Check size={13} />
                            <span>Mark as Done</span>
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleSetStatus(group.groupKey, "TO_DO")}
                            variant="outline"
                            className="text-xs font-semibold px-3 py-2 rounded-xl text-brand-600 hover:bg-brand-50"
                          >
                            <span>Reopen Task</span>
                          </Button>
                        )}

                        {currentStatus === "TO_DO" && (
                          <Button
                            variant="outline"
                            onClick={() => handleSetStatus(group.groupKey, "IN_PROGRESS")}
                            className="text-xs font-semibold px-3 py-2 rounded-xl text-brand-700 hover:bg-brand-50"
                          >
                            <span>Start Work</span>
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          onClick={() => handleCopyTaskBrief(group)}
                          className="text-xs font-semibold px-3 py-2 rounded-xl text-brand-600 hover:bg-brand-50 flex items-center gap-1"
                        >
                          {isBriefCopied ? <Check size={13} className="text-success-600" /> : <Copy size={13} />}
                          <span>{isBriefCopied ? "Copied Brief" : "Copy Brief"}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={() => setExpandedId(isExpanded ? null : group.groupKey)}
                          className="text-xs font-bold px-3 py-2 rounded-xl text-brand-950 hover:bg-brand-100 transition flex items-center gap-1"
                        >
                          <span>{isExpanded ? "Hide Steps" : "How to Fix"}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </Button>
                      </div>
                    </div>

                    {/* Step-by-Step Implementation Guide Expander */}
                    {isExpanded && (
                      <div className="border-t bg-brand-50 p-6 space-y-5 animate-in fade-in duration-150">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                          {/* Block 1: What's wrong */}
                          <div className="space-y-2 rounded-2xl border bg-white p-5 shadow-2xs">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-error-600">
                              1 · What&apos;s Wrong
                            </span>
                            <p className="text-[13px] font-semibold text-brand-950 leading-relaxed">
                              {group.title}
                            </p>
                            <p className="text-[11.5px] text-brand-500">
                              Confidence: {group.confidence} &bull; {group.regressionCount > 0 ? `Regressed ${group.regressionCount}x` : "Fresh detection"}
                            </p>
                          </div>

                          {/* Block 2: Why it matters */}
                          <div className="space-y-2 rounded-2xl border bg-white p-5 shadow-2xs">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-warning-600">
                              2 · Why It Matters
                            </span>
                            <p className="text-[13px] font-medium text-brand-800 leading-relaxed">
                              {group.summary || "This issue depresses crawl equity, hurts search click-through rate, and diminishes conversion trust on affected pages."}
                            </p>
                          </div>

                          {/* Block 3: How to fix */}
                          <div className="space-y-2 rounded-2xl border bg-white p-5 shadow-2xs">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-success-600">
                              3 · The Fix Directive
                            </span>
                            <p className="text-[13px] font-medium text-brand-800 leading-relaxed">
                              {group.action || "Deploy recommended code or metadata correction to restore compliance."}
                            </p>
                          </div>
                        </div>

                        {/* Step-by-Step Guidance Box */}
                        <div className="rounded-2xl border bg-white p-5 space-y-3 shadow-2xs">
                          <div className="flex items-center gap-2 text-xs font-bold text-brand-950">
                            <Code2 size={15} className="text-brand-950" />
                            <span>Developer Implementation Instructions</span>
                          </div>

                          <ol className="list-decimal list-inside space-y-2 text-xs text-brand-700 leading-relaxed">
                            <li>
                              Open the code repository or CMS editor for the affected URLs listed below.
                            </li>
                            <li>
                              Implement the required change: <span className="font-semibold text-brand-950">{group.action}</span>.
                            </li>
                            <li>
                              Validate locally using browser developer tools, Lighthouse, or Schema Markup Validator.
                            </li>
                            <li>
                              Deploy changes to production and trigger a crawl re-check to confirm resolution.
                            </li>
                          </ol>

                          {/* Sample URLs */}
                          {group.sampleUrls && group.sampleUrls.length > 0 && (
                            <div className="mt-4 pt-4 border-t space-y-2">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
                                Example Affected URLs:
                              </span>
                              <div className="space-y-1">
                                {group.sampleUrls.slice(0, 5).map((url, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs">
                                    <ExternalLink size={12} className="text-brand-400 shrink-0" />
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-mono text-brand-800 hover:underline truncate"
                                    >
                                      {url}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            </div>
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
    </div>
  );
}
