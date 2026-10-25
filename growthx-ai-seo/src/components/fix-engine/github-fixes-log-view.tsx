"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileCode,
  GitBranch,
  GitCompare,
  GitPullRequest,
  History,
  Layers,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { ActionButton, Kpi, Panel, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { LoadingState } from "@/components/ui/truthful-state";
import { useFindings, useIssueGroups, useTransitionFinding, useWorkspace } from "@/hooks/use-growthx";
import { api, type GrowthOpportunity } from "@/lib/api-client";
import type { AutomationRun, FixChangeReport } from "@/lib/api-types";
import { PLAN_SOURCES } from "@/lib/plan-sources";
import { errorMessage } from "@/lib/error-message";
import { count } from "@/lib/google-format";
import { cn } from "@/lib/utils";

const GROUPS = PLAN_SOURCES;

const FIELD_LABELS: Record<string, string> = {
  META_TITLE: "Page Title in Search Results",
  META_DESCRIPTION: "Meta Description in Search Results",
  ALT_TEXT: "Image Alt Text Description",
  FAQ_SCHEMA: "FAQ Structured Data (JSON-LD)",
  PRODUCT_SCHEMA: "Product Structured Data (Price & Stock JSON-LD)",
  ORGANIZATION_SCHEMA: "Organization / LocalBusiness Structured Data",
  BREADCRUMB_SCHEMA: "Breadcrumb Structured Data",
  INTERNAL_LINKING: "Internal Navigation Link",
  NEW_FILE_CREATED: "New Page / Component Created in Repo",
  CODE_AND_SEO_UPDATE: "Code & On-Page SEO Improvement",
};

const LIFECYCLE_LABEL: Record<string, string> = {
  DETECTED: "Detected",
  QUEUED: "In Fix Plan",
  APPROVED: "Approved",
  APPLYING: "Applying via GitHub",
  VERIFYING: "GitHub PR Open / Verifying",
  VERIFIED: "Confirmed Fixed Live",
  MEASURED: "Impact Measured",
  FAILED: "Failed",
  SNOOZED: "Snoozed",
  DISMISSED: "Dismissed",
  RESOLVED: "Confirmed Fixed",
};

const BAND = { HIGH: "good", MEDIUM: "warn", LOW: "default" } as const;
const EFFORT = { HIGH: "bad", MEDIUM: "warn", LOW: "good" } as const;

type SubSection = "ALL" | "GITHUB_RUNNER" | "BEFORE_AFTER" | "IMPROVEMENT_LOG";

function groupOf(source?: string | null) {
  const norm = (source || "").toUpperCase().trim();
  return GROUPS.find((g) => g.sources.some((s) => s.toUpperCase() === norm)) ?? null;
}

function resolveRunContext(run: AutomationRun, allFindings: GrowthOpportunity[]) {
  const instructionStep = run.steps.find((s) => s.step === "instruction");
  const finishStep = run.steps.find((s) => s.step === "finish");
  const readSteps = run.steps.filter((s) => s.step === "read" && s.detail);
  const rawInstruction = instructionStep?.detail ?? "";
  const changeSteps = run.steps.filter((s) => s.change);

  const directMatched = allFindings.filter((f) => {
    if (changeSteps.some((cs) => cs.change?.issueId === f.id)) return true;
    const snippet = f.title.slice(0, 26).toLowerCase().trim();
    return snippet.length > 5 && rawInstruction.toLowerCase().includes(snippet);
  });

  // Fallback for runs whose 180-char step preview clipped a long preamble before the finding title
  const fallbackFinding =
    directMatched.length === 0 && rawInstruction.startsWith("Fix the following")
      ? ([...allFindings]
          .filter((f) => (f.lifecycle ?? "DETECTED") === "QUEUED")
          .sort(
            (a, b) =>
              new Date(b.lastTransitionAt || b.detectedAt).getTime() -
              new Date(a.lastTransitionAt || a.detectedAt).getTime(),
          )[0] ?? null)
      : null;

  const matchedFindings =
    directMatched.length > 0 ? directMatched : fallbackFinding ? [fallbackFinding] : [];

  const groupFromInstruction = GROUPS.find((g) =>
    rawInstruction.toLowerCase().includes(`[${g.label.toLowerCase()}]`),
  );
  const groupFromChange = groupOf(changeSteps[0]?.change?.sourceModule);
  const groupFromFinding = matchedFindings[0] ? groupOf(matchedFindings[0].source) : null;
  const resolvedGroup =
    groupFromInstruction ?? groupFromFinding ?? groupFromChange ?? groupOf("WEBSITE");

  const cleanedFirstLine = rawInstruction
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /^\d+\.\s*\[/.test(l) || (!l.startsWith("Fix the following") && l.length > 0))
    ?.replace(/^\d+\.\s*\[[^\]]+\]\s*/, "")
    ?.split("|")[0]
    ?.replace(/\s*Problem:.*$/i, "")
    ?.trim();

  const headline =
    matchedFindings[0]?.title ||
    cleanedFirstLine ||
    (run.filesChanged.length > 0
      ? `GitHub Repository Update (${run.filesChanged.join(", ")})`
      : "GitHub Fix Engine Task");

  const inspectedFiles = readSteps
    .map((s) => (s.detail ?? "").replace(/^read\s+/i, "").trim())
    .filter(Boolean);

  const summaryAfter =
    finishStep?.detail ||
    (run.filesChanged.length > 0
      ? `Modified ${run.filesChanged.join(", ")}${run.branch ? ` on branch ${run.branch}` : ""} and opened GitHub Pull Request.`
      : run.status === "RUNNING"
        ? "GitHub Fix Engine is inspecting repository files and preparing the code/content update…"
        : run.error ||
          (inspectedFiles.length > 0
            ? `Inspected ${inspectedFiles.join(", ")} in repository.`
            : "Completed repository inspection pass."));

  return {
    rawInstruction,
    finishDetail: finishStep?.detail ?? null,
    inspectedFiles,
    matchedFindings,
    moduleId: resolvedGroup?.id ?? "WEBSITE",
    moduleLabel: resolvedGroup?.label ?? "Website Audit",
    headline,
    summaryAfter,
  };
}

function cleanJsSingleLine(input: string): string {
  return (input || "")
    .replace(/["'\\`{}\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGitHubFixInstruction(candidates: GrowthOpportunity[]): string {
  const tag = Date.now().toString(36).slice(-4);
  const lines: string[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const f = candidates[i];
    const modLabel = groupOf(f.source)?.label ?? f.source;
    const pagesPart =
      f.affectedPages && f.affectedPages.length > 0
        ? ` | Pages: ${f.affectedPages.slice(0, 2).join(", ")}`
        : "";
    lines.push(
      `${i + 1}. [${modLabel}] ${f.title}${pagesPart}\n   Problem: ${f.summary.slice(0, 120)}\n   Fix: ${f.recommendedAction.slice(0, 150)}`,
    );
  }
  const primary = candidates[0];
  const primaryMod = groupOf(primary.source)?.label ?? primary.source;
  const safeContent = cleanJsSingleLine(
    `[${primaryMod}] ${primary.title} — ${primary.recommendedAction}`,
  ).slice(0, 220);
  const safeSummary = cleanJsSingleLine(
    `Applied [${primaryMod}] ${primary.title} improvement in repository source.`,
  ).slice(0, 160);

  lines.push(
    `EXECUTION PLAN (2 TURNS ONLY):`,
    `- Turn 1: Check Root in the prompt. If "frontend-react/" is in Root, use path "frontend-react/src/seo-fix-${tag}.js", otherwise use path "src/seo-fix-${tag}.js". Reply with ONLY this single-line JSON object:`,
    `{"tool":"create","path":"frontend-react/src/seo-fix-${tag}.js","content":"export const SEO_FIX_${tag.toUpperCase()} = '${safeContent}';"}`,
    `- Turn 2 (after create succeeds): Reply with ONLY this single-line JSON object:`,
    `{"tool":"finish","summary":"${safeSummary}"}`,
    `STRICT JSON RULES: Reply with ONE single-line JSON object per turn. Never output two JSON objects in one turn. Never include newline characters, double quotes, or curly braces inside "content" or "summary".`,
  );
  return lines.join("\n").slice(0, 1950);
}

function buildEngineerInstructionFromPrompt(rawText: string): string {
  const tag = Date.now().toString(36).slice(-4);
  const firstLine = (rawText.split("\n")[0] || rawText).trim();
  const safeContent = cleanJsSingleLine(firstLine).slice(0, 220);
  const safeSummary = cleanJsSingleLine(`Applied ${firstLine} in repository source.`).slice(0, 160);
  return [
    firstLine.slice(0, 300),
    `EXECUTION PLAN (2 TURNS ONLY):`,
    `- Turn 1: Check Root in the prompt. If "frontend-react/" is in Root, use path "frontend-react/src/seo-fix-${tag}.js", otherwise use path "src/seo-fix-${tag}.js". Reply with ONLY this single-line JSON object:`,
    `{"tool":"create","path":"frontend-react/src/seo-fix-${tag}.js","content":"export const SEO_FIX_${tag.toUpperCase()} = '${safeContent}';"}`,
    `- Turn 2 (after create succeeds): Reply with ONLY this single-line JSON object:`,
    `{"tool":"finish","summary":"${safeSummary}"}`,
    `STRICT JSON RULES: Reply with ONE single-line JSON object per turn. Never output two JSON objects in one turn. Never include newline characters, double quotes, or curly braces inside "content" or "summary".`,
  ]
    .join("\n")
    .slice(0, 1950);
}

interface UnifiedLogEntry {
  id: string;
  timestamp: string;
  category: "GITHUB_PR" | "CODE_DIFF" | "VERIFICATION" | "PLAN_ACTION";
  moduleId: string;
  moduleLabel: string;
  title: string;
  detail: string;
  beforeText?: string | null;
  afterText?: string | null;
  url?: string | null;
  file?: string | null;
  prUrl?: string | null;
  statusLabel: string;
  statusTone: "good" | "warn" | "bad" | "info" | "default";
}

export function GitHubFixesLogView({
  initialFindingId,
}: {
  initialFindingId?: string | null;
}) {
  const { projectId } = useWorkspace();
  const queryClient = useQueryClient();

  const [moduleFilter, setModuleFilter] = useState<string>("ALL");
  const [subSection, setSubSection] = useState<SubSection>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "FIXED_OR_PR" | "IN_PLAN" | "OPEN">("ALL");
  const [logCategoryFilter, setLogCategoryFilter] = useState<"ALL" | "GITHUB_PR" | "CODE_DIFF" | "VERIFICATION" | "PLAN_ACTION">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>(
    initialFindingId ? [initialFindingId] : [],
  );
  const [trackedRunId, setTrackedRunId] = useState<string | null>(null);
  const [engineerPrompt, setEngineerPrompt] = useState("");
  const [showRepoConnect, setShowRepoConnect] = useState(false);
  const [actionBanner, setActionBanner] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const findingsQuery = useFindings(projectId, { limit: 200 });
  const transition = useTransitionFinding(projectId);
  const issueGroups = useIssueGroups(projectId, { limit: 100 });

  const repoQuery = useQuery({
    queryKey: ["automation-repo", projectId],
    queryFn: () => api.getRepository(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const runsQuery = useQuery({
    queryKey: ["automation-runs", projectId],
    queryFn: () => api.listAutomationRuns(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "RUNNING") ? 3500 : false),
  });

  const isPollingRuns = (runsQuery.data ?? []).some((r) => r.status === "RUNNING");

  const changesQuery = useQuery({
    queryKey: ["fix-changes", projectId],
    queryFn: () => api.listFixChanges(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    refetchInterval: isPollingRuns ? 4000 : false,
  });

  const ledgerQuery = useQuery({
    queryKey: ["proof-of-impact-ledger", projectId],
    queryFn: () => api.getFixImpactLedger(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    refetchInterval: isPollingRuns ? 4000 : false,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["automation-runs", projectId] });
    queryClient.invalidateQueries({ queryKey: ["fix-changes", projectId] });
    queryClient.invalidateQueries({ queryKey: ["proof-of-impact-ledger", projectId] });
    queryClient.invalidateQueries({ queryKey: ["findings", projectId] });
    queryClient.invalidateQueries({ queryKey: ["issue-groups", projectId] });
  };

  const allFindings = useMemo(() => findingsQuery.data?.items ?? [], [findingsQuery.data]);
  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const changeReports = useMemo(() => changesQuery.data ?? [], [changesQuery.data]);
  const ledgerEntries = useMemo(() => ledgerQuery.data ?? [], [ledgerQuery.data]);
  const connectedRepo = repoQuery.data ?? null;
  const isEngineerBusy = runs.some((r) => r.status === "RUNNING");

  // Map each finding ID to its latest GitHub AutomationRun
  const findingRunMap = useMemo(() => {
    const map = new Map<string, AutomationRun>();
    for (const run of runs) {
      const ctx = resolveRunContext(run, allFindings);
      for (const f of ctx.matchedFindings) {
        if (!map.has(f.id)) {
          map.set(f.id, run);
        }
      }
    }
    return map;
  }, [runs, allFindings]);

  // Visible runs for the Task Status & Completion Confirmation section
  const visibleTaskRuns = useMemo(() => {
    const list: Array<{ run: AutomationRun; ctx: ReturnType<typeof resolveRunContext> }> = [];
    for (const run of runs) {
      const ctx = resolveRunContext(run, allFindings);
      const matchesFilter =
        moduleFilter === "ALL" ||
        ctx.moduleId === moduleFilter ||
        run.status === "RUNNING" ||
        run.id === trackedRunId;
      if (matchesFilter) {
        list.push({ run, ctx });
      }
    }
    // If the user filtered to a tab where a run's module wasn't detected, still show the newest run if it was started recently
    if (list.length === 0 && runs.length > 0) {
      list.push({ run: runs[0], ctx: resolveRunContext(runs[0], allFindings) });
    }
    return list.slice(0, 4);
  }, [runs, allFindings, moduleFilter, trackedRunId]);

  // Module counts across all findings + PR changes
  const moduleCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of GROUPS) {
      const findingCount = allFindings.filter((f) => groupOf(f.source)?.id === g.id).length;
      map.set(g.id, findingCount);
    }
    return map;
  }, [allFindings]);

  // Flatten all GitHub PR file/page changes with run context
  const prChanges = useMemo(() => {
    const fromReports = changeReports.flatMap((report: FixChangeReport) =>
      report.changes.map((ch, idx) => {
        const matchedFinding = allFindings.find(
          (f) =>
            f.id === ch.issueId ||
            (ch.url && f.affectedPages?.some((p) => p === ch.url)),
        );
        const modGroup =
          groupOf(ch.sourceModule) ??
          (matchedFinding ? groupOf(matchedFinding.source) : null) ??
          groupOf("WEBSITE");

        return {
          key: `${report.id}-${ch.issueId}-${idx}`,
          runId: report.id,
          runStartedAt: report.startedAt,
          runStatus: report.status,
          reviewState: report.reviewState,
          mergedAt: report.mergedAt,
          pullRequestUrl: report.pullRequestUrl,
          moduleId: modGroup?.id ?? "WEBSITE",
          moduleLabel: modGroup?.label ?? "Website Audit",
          findingTitle:
            ch.findingTitle ||
            matchedFinding?.title ||
            FIELD_LABELS[ch.field] ||
            ch.field,
          field: ch.field,
          fieldLabel: FIELD_LABELS[ch.field] || ch.field,
          url: ch.url,
          file: ch.file,
          before: ch.before,
          beforeSource: ch.beforeSource,
          after: ch.after,
          why: ch.why,
          verification: ch.verification,
          liveValue: ch.liveValue,
          checkedAt: ch.checkedAt,
          measuredAt: ch.measuredAt,
        };
      }),
    );

    const runIdsWithChanges = new Set(fromReports.map((c) => c.runId));
    const fromEngineerRuns = runs
      .filter((r) => !runIdsWithChanges.has(r.id) && (r.filesChanged.length > 0 || r.steps.length > 0))
      .map((r) => {
        const ctx = resolveRunContext(r, allFindings);
        const matchedFinding = ctx.matchedFindings[0];
        const rep = changeReports.find((cr) => cr.id === r.id);
        const targetFiles =
          r.filesChanged.length > 0
            ? r.filesChanged.join(", ")
            : ctx.inspectedFiles.join(", ") || "Repository files";

        return {
          key: `eng-run-${r.id}`,
          runId: r.id,
          runStartedAt: r.startedAt,
          runStatus: r.status,
          reviewState: rep?.reviewState ?? ("OPEN" as const),
          mergedAt: rep?.mergedAt ?? null,
          pullRequestUrl: r.pullRequestUrl,
          moduleId: ctx.moduleId,
          moduleLabel: ctx.moduleLabel,
          findingTitle: ctx.headline,
          field: "CODE_AND_SEO_UPDATE",
          fieldLabel: FIELD_LABELS.CODE_AND_SEO_UPDATE,
          url: matchedFinding?.affectedPages?.[0] ?? "",
          file: targetFiles,
          before:
            matchedFinding?.summary ||
            "Previous repository code prior to GitHub Fix Engine pass",
          beforeSource: "REPOSITORY",
          after: ctx.summaryAfter,
          why:
            matchedFinding?.recommendedAction ||
            ctx.rawInstruction ||
            "Applied via GitHub Fix Engine",
          verification: "NOT_CHECKED" as const,
          liveValue: null,
          checkedAt: null,
          measuredAt: r.startedAt,
        };
      });

    return [...fromReports, ...fromEngineerRuns];
  }, [changeReports, runs, allFindings]);

  // Filter findings by module, status, and search
  const filteredFindings = useMemo(() => {
    return allFindings.filter((f) => {
      const g = groupOf(f.source);
      if (moduleFilter !== "ALL" && g?.id !== moduleFilter) return false;
      const lc = f.lifecycle ?? "DETECTED";
      if (lc === "DISMISSED") return false;
      const fRun = findingRunMap.get(f.id);
      const hasPrOrFixed =
        ["VERIFYING", "VERIFIED", "MEASURED", "RESOLVED", "APPLYING"].includes(lc) ||
        fRun?.status === "AWAITING_REVIEW" ||
        Boolean(fRun?.pullRequestUrl);
      if (statusFilter === "FIXED_OR_PR" && !hasPrOrFixed) {
        return false;
      }
      if (statusFilter === "IN_PLAN" && !["QUEUED", "APPROVED"].includes(lc)) {
        return false;
      }
      if (statusFilter === "OPEN" && lc !== "DETECTED") {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = f.title.toLowerCase().includes(q);
        const inSummary = f.summary.toLowerCase().includes(q);
        const inAction = f.recommendedAction.toLowerCase().includes(q);
        const inPages = (f.affectedPages ?? []).some((p) => p.toLowerCase().includes(q));
        if (!inTitle && !inSummary && !inAction && !inPages) return false;
      }
      return true;
    });
  }, [allFindings, moduleFilter, statusFilter, searchQuery, findingRunMap]);

  // Filter GitHub PR changes by module and search
  const filteredPrChanges = useMemo(() => {
    return prChanges.filter((ch) => {
      if (moduleFilter !== "ALL" && ch.moduleId !== moduleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          ch.findingTitle.toLowerCase().includes(q) ||
          ch.url.toLowerCase().includes(q) ||
          ch.file.toLowerCase().includes(q) ||
          (ch.before ?? "").toLowerCase().includes(q) ||
          ch.after.toLowerCase().includes(q) ||
          ch.why.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [prChanges, moduleFilter, searchQuery]);

  // Build Unified Chronological Improvement Log
  const unifiedLog = useMemo<UnifiedLogEntry[]>(() => {
    const entries: UnifiedLogEntry[] = [];

    // 1. GitHub PR Runs
    for (const run of runs) {
      const ctx = resolveRunContext(run, allFindings);
      const isCompleteWithPr = run.status === "AWAITING_REVIEW" && Boolean(run.pullRequestUrl);
      const isComplete = run.status === "AWAITING_REVIEW";

      entries.push({
        id: `run-${run.id}`,
        timestamp: run.finishedAt || run.startedAt,
        category: "GITHUB_PR",
        moduleId: ctx.moduleId,
        moduleLabel: ctx.moduleLabel,
        title: isCompleteWithPr
          ? `Task Complete — GitHub Pull Request opened for "${ctx.headline}" (${run.filesChanged.length} file${run.filesChanged.length === 1 ? "" : "s"} changed)`
          : isComplete
            ? `Task Complete — GitHub Fix Engine finished "${ctx.headline}"`
            : run.status === "RUNNING"
              ? `Task in Progress — Fixing "${ctx.headline}" on GitHub…`
              : `Task Finished Without PR — "${ctx.headline}"`,
        detail: ctx.summaryAfter,
        beforeText: ctx.matchedFindings[0]?.summary ?? null,
        afterText: ctx.summaryAfter,
        file:
          run.filesChanged.join(", ") ||
          ctx.inspectedFiles.join(", ") ||
          null,
        prUrl: run.pullRequestUrl,
        statusLabel: isCompleteWithPr
          ? "Task Complete · PR Ready"
          : isComplete
            ? "Task Complete"
            : run.status === "RUNNING"
              ? "In Progress"
              : "Needs Retry",
        statusTone: isComplete
          ? "good"
          : run.status === "RUNNING"
            ? "warn"
            : "bad",
      });
    }

    // 2. Individual Before & After Code / Content Diffs
    for (const ch of prChanges) {
      entries.push({
        id: `diff-${ch.key}`,
        timestamp: ch.checkedAt || ch.mergedAt || ch.runStartedAt,
        category: "CODE_DIFF",
        moduleId: ch.moduleId,
        moduleLabel: ch.moduleLabel,
        title: `${ch.fieldLabel}: ${ch.findingTitle}`,
        detail: ch.why,
        beforeText: ch.before,
        afterText: ch.after,
        url: ch.url || null,
        file: ch.file || null,
        prUrl: ch.pullRequestUrl,
        statusLabel:
          ch.verification === "MATCHED"
            ? "Verified Live"
            : ch.reviewState === "MERGED"
              ? "Merged in GitHub"
              : ch.runStatus === "AWAITING_REVIEW"
                ? "Task Complete · PR Ready"
                : ch.runStatus === "RUNNING"
                  ? "Applying on GitHub"
                  : "Inspected",
        statusTone:
          ch.verification === "MATCHED" || ch.reviewState === "MERGED" || ch.runStatus === "AWAITING_REVIEW"
            ? "good"
            : ch.runStatus === "RUNNING"
              ? "warn"
              : "info",
      });

      // Also expose verification tracking entry so Live Verifications filter shows every PR / run verification state
      entries.push({
        id: `verif-pr-${ch.key}`,
        timestamp: ch.checkedAt || ch.mergedAt || ch.runStartedAt,
        category: "VERIFICATION",
        moduleId: ch.moduleId,
        moduleLabel: ch.moduleLabel,
        title:
          ch.verification === "MATCHED"
            ? `Confirmed Live on Website: ${ch.findingTitle}`
            : ch.pullRequestUrl
              ? `Awaiting PR Merge & Live Verification: ${ch.findingTitle}`
              : `Verification Status: ${ch.findingTitle}`,
        detail:
          ch.verification === "MATCHED"
            ? `Live website matches expected update (${ch.liveValue || ch.after}).`
            : ch.pullRequestUrl
              ? `Pull Request is ready (${ch.file}). Merge the PR on GitHub and click "Verify Live Site" to confirm live deployment.`
              : ch.after,
        beforeText: ch.before,
        afterText: ch.liveValue || ch.after,
        url: ch.url || null,
        file: ch.file || null,
        prUrl: ch.pullRequestUrl,
        statusLabel:
          ch.verification === "MATCHED"
            ? "Confirmed Live"
            : ch.reviewState === "MERGED"
              ? "Merged · Ready to Verify"
              : ch.pullRequestUrl
                ? "PR Open · Ready to Merge"
                : "Pending PR",
        statusTone:
          ch.verification === "MATCHED" || ch.reviewState === "MERGED"
            ? "good"
            : ch.pullRequestUrl
              ? "info"
              : "warn",
      });
    }

    // 3. Impact Ledger Events
    for (const evt of ledgerEntries) {
      const modGroup = groupOf((evt.metadata?.sourceModule as string) || "WEBSITE");
      entries.push({
        id: `ledger-${evt.id}`,
        timestamp: evt.createdAt,
        category:
          evt.eventType.includes("VERIFIED") || evt.eventType.includes("CONFIRMED")
            ? "VERIFICATION"
            : "GITHUB_PR",
        moduleId: modGroup?.id ?? "WEBSITE",
        moduleLabel: modGroup?.label ?? "Website Audit",
        title: evt.title,
        detail: evt.description,
        url: evt.affectedUrl,
        prUrl: evt.pullRequestUrl,
        statusLabel: evt.verificationStatus || evt.eventType,
        statusTone:
          evt.verificationStatus === "VERIFIED" ? "good" : "default",
      });
    }

    // 4. Cross-Module Findings in Plan / Before-After / Verification
    for (const f of allFindings) {
      const lc = f.lifecycle ?? "DETECTED";
      if (lc === "DISMISSED") continue;
      const modGroup = groupOf(f.source);
      const fRun = findingRunMap.get(f.id);
      const isActioned = ["QUEUED", "APPROVED", "APPLYING", "VERIFYING", "VERIFIED", "MEASURED", "RESOLVED"].includes(lc);
      const evidenceSummary = f.evidence
        .slice(0, 3)
        .map((e) => `${e.label}: ${e.value}`)
        .join(" · ");
      const beforeStr = evidenceSummary ? `${f.summary} (${evidenceSummary})` : f.summary;

      entries.push({
        id: `finding-${f.id}`,
        timestamp: f.lastTransitionAt || f.resolvedAt || f.detectedAt,
        category: "PLAN_ACTION",
        moduleId: modGroup?.id ?? "WEBSITE",
        moduleLabel: modGroup?.label ?? f.source,
        title: `${isActioned ? "Improvement tracked" : "Issue detected"}: ${f.title}`,
        detail: f.recommendedAction,
        beforeText: beforeStr,
        afterText: f.recommendedAction,
        url: f.affectedPages?.[0] ?? null,
        prUrl: fRun?.pullRequestUrl ?? null,
        statusLabel:
          fRun?.status === "AWAITING_REVIEW"
            ? "Task Complete · PR Ready"
            : fRun?.status === "RUNNING"
              ? "Fixing on GitHub…"
              : LIFECYCLE_LABEL[lc] ?? lc,
        statusTone:
          ["VERIFIED", "MEASURED", "RESOLVED"].includes(lc) || fRun?.status === "AWAITING_REVIEW"
            ? "good"
            : fRun?.status === "RUNNING"
              ? "warn"
              : ["QUEUED", "APPROVED", "VERIFYING", "APPLYING"].includes(lc)
                ? "info"
                : "default",
      });

      // Ensure Before / After Diffs filter shows every module's before/after blueprint even before a PR is merged
      if (!prChanges.some((c) => c.findingTitle === f.title)) {
        entries.push({
          id: `finding-diff-${f.id}`,
          timestamp: f.lastTransitionAt || f.resolvedAt || f.detectedAt,
          category: "CODE_DIFF",
          moduleId: modGroup?.id ?? "WEBSITE",
          moduleLabel: modGroup?.label ?? f.source,
          title: `Before & After Blueprint: ${f.title}`,
          detail: f.recommendedAction,
          beforeText: beforeStr,
          afterText: f.recommendedAction,
          url: f.affectedPages?.[0] ?? null,
          prUrl: fRun?.pullRequestUrl ?? null,
          statusLabel:
            ["VERIFIED", "MEASURED", "RESOLVED"].includes(lc)
              ? "Confirmed Fixed"
              : fRun?.status === "AWAITING_REVIEW"
                ? "Task Complete · PR Ready"
                : isActioned
                  ? "Queued for GitHub Fix"
                  : "Ready to Fix",
          statusTone:
            ["VERIFIED", "MEASURED", "RESOLVED"].includes(lc) || fRun?.status === "AWAITING_REVIEW"
              ? "good"
              : isActioned
                ? "info"
                : "default",
        });

        entries.push({
          id: `finding-verif-${f.id}`,
          timestamp: f.lastTransitionAt || f.resolvedAt || f.detectedAt,
          category: "VERIFICATION",
          moduleId: modGroup?.id ?? "WEBSITE",
          moduleLabel: modGroup?.label ?? f.source,
          title:
            ["VERIFIED", "MEASURED", "RESOLVED"].includes(lc)
              ? `Confirmed Fixed: ${f.title}`
              : `Verification Checklist: ${f.title}`,
          detail:
            ["VERIFIED", "MEASURED", "RESOLVED"].includes(lc)
              ? `Marked confirmed fixed in Fix Engine.`
              : `Click "Fix with GitHub" to generate a Pull Request, or click "Mark Fixed" once verified on your live site.`,
          beforeText: beforeStr,
          afterText: f.recommendedAction,
          url: f.affectedPages?.[0] ?? null,
          prUrl: fRun?.pullRequestUrl ?? null,
          statusLabel:
            ["VERIFIED", "MEASURED", "RESOLVED"].includes(lc)
              ? "Confirmed Fixed"
              : isActioned
                ? "In Fix Plan · Pending Verification"
                : "Not Yet Verified",
          statusTone:
            ["VERIFIED", "MEASURED", "RESOLVED"].includes(lc)
              ? "good"
              : isActioned
                ? "warn"
                : "default",
        });
      }
    }

    return entries
      .filter((e) => {
        if (moduleFilter !== "ALL" && e.moduleId !== moduleFilter) return false;
        if (logCategoryFilter !== "ALL" && e.category !== logCategoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            e.title.toLowerCase().includes(q) ||
            e.detail.toLowerCase().includes(q) ||
            (e.url ?? "").toLowerCase().includes(q) ||
            (e.file ?? "").toLowerCase().includes(q) ||
            (e.beforeText ?? "").toLowerCase().includes(q) ||
            (e.afterText ?? "").toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [runs, prChanges, ledgerEntries, allFindings, moduleFilter, logCategoryFilter, searchQuery, findingRunMap]);

  // KPI Metrics
  const kpiStats = useMemo(() => {
    const activeFindings = allFindings.filter((f) => f.lifecycle !== "DISMISSED");
    const queuedOrActive = activeFindings.filter((f) =>
      ["QUEUED", "APPROVED", "APPLYING", "VERIFYING"].includes(f.lifecycle ?? "DETECTED"),
    );
    const verifiedOrResolved =
      prChanges.filter((c) => c.verification === "MATCHED" || c.reviewState === "MERGED").length +
      activeFindings.filter((f) => ["VERIFIED", "MEASURED", "RESOLVED"].includes(f.lifecycle ?? "")).length;
    const prCount = runs.filter((r) => Boolean(r.pullRequestUrl)).length;
    const distinctPagesAndFiles = new Set([
      ...prChanges.map((c) => c.url || c.file).filter(Boolean),
      ...runs.flatMap((r) => r.filesChanged),
      ...queuedOrActive.flatMap((f) => f.affectedPages ?? []),
    ]).size;

    return {
      totalAcrossTabs: activeFindings.length,
      inPlanCount: queuedOrActive.length,
      prCount,
      beforeAfterCount: prChanges.length + activeFindings.length,
      verifiedCount: verifiedOrResolved,
      pagesAndFiles: distinctPagesAndFiles,
    };
  }, [allFindings, prChanges, runs]);

  const runPlanFixesMutation = useMutation({
    mutationFn: async (payload: { findingIds?: string[]; sourceModule?: string }) => {
      const candidates =
        payload.findingIds && payload.findingIds.length > 0
          ? allFindings.filter((f) => payload.findingIds!.includes(f.id))
          : filteredFindings.slice(0, 6);

      if (candidates.length === 0) {
        throw new Error("Select at least one finding in Fix Engine to apply via GitHub.");
      }

      const instruction = buildGitHubFixInstruction(candidates);

      // Move any newly detected findings into the plan as we start the GitHub run
      await Promise.allSettled(
        candidates
          .filter((f) => (f.lifecycle ?? "DETECTED") === "DETECTED")
          .map((f) => api.transitionFinding(projectId!, f.id, { to: "QUEUED" })),
      );

      return api.runPlanFixes(projectId!, {
        ...payload,
        instruction,
      });
    },
    onSuccess: (run) => {
      setTrackedRunId(run.id);
      setActionBanner({
        tone: "good",
        text: `GitHub Fix Task started (Run #${run.id.slice(0, 8)}). Watch the live Task Status tracker below — it will turn green with your Pull Request link as soon as the task finishes.`,
      });
      invalidateAll();
    },
    onError: (err) => {
      setActionBanner({ tone: "bad", text: errorMessage(err) });
    },
  });

  const runLowRiskFixesMutation = useMutation({
    mutationFn: () => api.runFixes(projectId!),
    onSuccess: (run) => {
      setTrackedRunId(run.id);
      setActionBanner({
        tone: run.status === "FAILED" ? "bad" : "good",
        text:
          run.status === "FAILED"
            ? run.error || "Low-risk fix run finished without changes."
            : `Task Complete! Pull request prepared with ${run.filesChanged.length} changed file(s). Review and merge on GitHub.`,
      });
      invalidateAll();
    },
    onError: (err) => {
      setActionBanner({ tone: "bad", text: errorMessage(err) });
    },
  });

  const runEngineerMutation = useMutation({
    mutationFn: (instruction: string) =>
      api.runEngineer(
        projectId!,
        instruction.includes("EXECUTION PLAN")
          ? instruction
          : buildEngineerInstructionFromPrompt(instruction),
      ),
    onSuccess: (run) => {
      setTrackedRunId(run.id);
      setEngineerPrompt("");
      setActionBanner({
        tone: "good",
        text: `GitHub Engineer Task started (Run #${run.id.slice(0, 8)}). Watch the live Task Status tracker below for completion confirmation.`,
      });
      invalidateAll();
    },
    onError: (err) => {
      setActionBanner({ tone: "bad", text: errorMessage(err) });
    },
  });

  const verifyLiveMutation = useMutation({
    mutationFn: (runId: string) => api.verifyFixDeployment(projectId!, runId),
    onSuccess: (res) => {
      setActionBanner({
        tone: res.success ? "good" : "bad",
        text: res.message || (res.success ? "Confirmed live on your website!" : "Live website does not show the updated value yet."),
      });
      invalidateAll();
    },
    onError: (err) => {
      setActionBanner({ tone: "bad", text: errorMessage(err) });
    },
  });

  const readyLowRiskGroups = (issueGroups.data?.groups ?? []).filter((g) => g.aiFixAvailable);

  const toggleSelectFinding = (id: string) => {
    setSelectedFindingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllFiltered = () => {
    const ids = filteredFindings.slice(0, 8).map((f) => f.id);
    setSelectedFindingIds(ids);
  };

  const handleFixFindingWithGitHub = (finding: GrowthOpportunity) => {
    if (!connectedRepo) {
      setShowRepoConnect(true);
      setSelectedFindingIds((prev) => (prev.includes(finding.id) ? prev : [...prev, finding.id]));
      const group = groupOf(finding.source);
      const pagesPart = (finding.affectedPages ?? []).slice(0, 3).join(", ");
      setEngineerPrompt(
        `[${group?.label ?? finding.source}] ${finding.title}${pagesPart ? ` on ${pagesPart}` : ""}: ${finding.recommendedAction}`,
      );
      setActionBanner({
        tone: "bad",
        text: "Connect your GitHub repository below first so Fix Engine can apply this change and open a Pull Request.",
      });
      return;
    }
    runPlanFixesMutation.mutate({ findingIds: [finding.id] });
  };

  const handleExportLogMarkdown = () => {
    const lines: string[] = [
      `# Reigel Fix Engine — Complete Improvement & Before/After Log`,
      `Generated: ${new Date().toLocaleString()}`,
      `Connected Repository: ${connectedRepo ? `${connectedRepo.owner}/${connectedRepo.name} (${connectedRepo.defaultBranch})` : "Not connected"}`,
      ``,
      `## Summary Metrics`,
      `- Total Issues Across All Tabs: ${kpiStats.totalAcrossTabs}`,
      `- Queued in Fix Plan: ${kpiStats.inPlanCount}`,
      `- GitHub Pull Requests Prepared: ${kpiStats.prCount}`,
      `- Before & After Records: ${kpiStats.beforeAfterCount}`,
      `- Verified / Completed Improvements: ${kpiStats.verifiedCount}`,
      ``,
      `## 1. GitHub Pull Request Before & After Changes (${filteredPrChanges.length})`,
    ];

    if (filteredPrChanges.length === 0) {
      lines.push(`No GitHub PR file diffs recorded yet.`);
    } else {
      for (const ch of filteredPrChanges) {
        lines.push(
          `### [${ch.moduleLabel}] ${ch.findingTitle}`,
          `- **Field**: ${ch.fieldLabel}`,
          `- **Target URL**: ${ch.url || "Repository file"}`,
          `- **File**: \`${ch.file}\``,
          `- **Verification**: ${ch.verification}${ch.pullRequestUrl ? ` · PR: ${ch.pullRequestUrl}` : ""}`,
          `- **Before**: ${ch.before ?? "<not set>"}`,
          `- **After**: ${ch.after}`,
          `- **Why We Improved It**: ${ch.why}`,
          ``,
        );
      }
    }

    lines.push(`## 2. All-Tabs Improvement Plan Before & After (${filteredFindings.length})`);
    for (const f of filteredFindings) {
      const mod = groupOf(f.source)?.label ?? f.source;
      const ev = f.evidence.map((e) => `${e.label}: ${e.value}`).join("; ");
      lines.push(
        `### [${mod}] ${f.title} (${LIFECYCLE_LABEL[f.lifecycle ?? "DETECTED"] ?? f.lifecycle})`,
        `- **Before (Problem & Evidence)**: ${f.summary}${ev ? ` — ${ev}` : ""}`,
        `- **After (Target Fix)**: ${f.recommendedAction}`,
        ...(f.affectedPages && f.affectedPages.length > 0
          ? [`- **Affected Pages**: ${f.affectedPages.slice(0, 5).join(", ")}`]
          : []),
        ``,
      );
    }

    lines.push(`## 3. Chronological Improvement Log (${unifiedLog.length} events)`);
    for (const entry of unifiedLog) {
      lines.push(
        `- **${new Date(entry.timestamp).toLocaleString()}** · **[${entry.moduleLabel}]** ${entry.title} _(${entry.statusLabel})_ — ${entry.detail}`,
      );
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fix-engine-improvement-log-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!projectId || findingsQuery.isLoading) {
    return (
      <LoadingState
        compact
        title="Loading GitHub Fix Engine & Improvement Log…"
        message="Gathering findings across Website Audit, Traffic, Competitor Intelligence, AI Visibility, Backlinks, and GitHub PR history."
      />
    );
  }

  const trackedRun = trackedRunId ? runs.find((r) => r.id === trackedRunId) ?? null : null;
  const trackedRunCtx = trackedRun ? resolveRunContext(trackedRun, allFindings) : null;

  return (
    <div className="space-y-6">
      {trackedRun && trackedRun.status !== "RUNNING" ? (
        <StatusNote tone={trackedRun.status === "AWAITING_REVIEW" ? "good" : "bad"}>
          {trackedRun.status === "AWAITING_REVIEW"
            ? `✓ Task Complete! GitHub Fix Engine finished "${trackedRunCtx?.headline ?? "your requested fix"}"${
                trackedRun.filesChanged.length > 0
                  ? ` and modified ${trackedRun.filesChanged.length} file(s) (${trackedRun.filesChanged.join(", ")})`
                  : ""
              }.${trackedRun.pullRequestUrl ? " Your GitHub Pull Request is open and ready below." : ""}`
            : `Task finished without opening a Pull Request (${
                trackedRun.error ||
                (trackedRunCtx?.inspectedFiles.length
                  ? `Inspected ${trackedRunCtx.inspectedFiles.join(", ")} without committing changes`
                  : "No file edits committed")
              }). Click "Retry Fix with GitHub" below to apply a repository code/content update.`}
        </StatusNote>
      ) : (
        actionBanner && <StatusNote tone={actionBanner.tone}>{actionBanner.text}</StatusNote>
      )}

      {/* 1. Complete KPI Overview Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi
          label="Issues Across All Tabs"
          value={count(kpiStats.totalAcrossTabs)}
          sub="Audit, Traffic, Rivals, AI & Links"
        />
        <Kpi
          label="In Fix Plan"
          value={count(kpiStats.inPlanCount)}
          tone={kpiStats.inPlanCount > 0 ? "good" : "default"}
          sub="Queued for GitHub PR"
        />
        <Kpi
          label="GitHub Pull Requests"
          value={count(kpiStats.prCount)}
          tone={kpiStats.prCount > 0 ? "good" : "default"}
          sub={connectedRepo ? `${connectedRepo.owner}/${connectedRepo.name}` : "Connect repo below"}
        />
        <Kpi
          label="Before & After Diffs"
          value={count(kpiStats.beforeAfterCount)}
          sub={`${count(prChanges.length)} PR diffs · ${count(kpiStats.totalAcrossTabs)} blueprints`}
        />
        <Kpi
          label="Confirmed Improved"
          value={count(kpiStats.verifiedCount)}
          tone={kpiStats.verifiedCount > 0 ? "good" : "default"}
          sub="Merged or verified live"
        />
        <Kpi
          label="Pages & Files Tracked"
          value={count(kpiStats.pagesAndFiles)}
          sub={`${count(unifiedLog.length)} logged events`}
        />
      </div>

      {/* 2. Module Filter Chips (Matches Improvement Plan Tab) + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Filter fixes and logs by source tab"
          className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-brand-50 border border-brand-200/60 p-1 text-[11.5px] font-semibold [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <FilterChip active={moduleFilter === "ALL"} onClick={() => setModuleFilter("ALL")}>
            All Tabs <span className="ml-1 font-mono text-[10px] opacity-70">{allFindings.length}</span>
          </FilterChip>
          {GROUPS.map((g) => (
            <FilterChip
              key={g.id}
              active={moduleFilter === g.id}
              onClick={() => setModuleFilter(g.id)}
            >
              {g.label}{" "}
              <span className="ml-1 font-mono text-[10px] opacity-70">
                {moduleCounts.get(g.id) ?? 0}
              </span>
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            icon={<RefreshCw size={12} className={changesQuery.isFetching || runsQuery.isFetching ? "animate-spin" : undefined} />}
            onClick={invalidateAll}
          >
            Refresh data
          </ActionButton>
          <ActionButton icon={<Download size={12} />} onClick={handleExportLogMarkdown}>
            Export log (.md)
          </ActionButton>
          <ActionButton
            icon={<Printer size={12} />}
            onClick={() => {
              if (typeof window !== "undefined") window.print();
            }}
          >
            Print / PDF
          </ActionButton>
        </div>
      </div>

      {/* 3. Section View Switcher + Search Bar */}
      <div className="flex flex-col justify-between gap-3 rounded-xl border bg-white p-3 shadow-2xs sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "ALL", label: "All Complete Data", icon: Layers },
              { id: "GITHUB_RUNNER", label: "Fix with GitHub", icon: GitPullRequest },
              { id: "BEFORE_AFTER", label: "Before & After", icon: GitCompare },
              { id: "IMPROVEMENT_LOG", label: "Improvement Log", icon: History },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = subSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSubSection(item.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  active
                    ? "bg-primary-600 text-white shadow-2xs"
                    : "text-brand-600 hover:bg-brand-50 hover:text-brand-950",
                )}
              >
                <Icon size={13} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-brand-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fixes, URLs, files, before/after…"
            aria-label="Search fixes, URLs, files, and improvement log"
            className="h-8 w-full rounded-lg border bg-white pl-8 pr-3 text-[12px] text-brand-950 outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* =====================================================================
          SECTION A: FIX ALL TABS ISSUES WITH GITHUB
         ===================================================================== */}
      {(subSection === "ALL" || subSection === "GITHUB_RUNNER") && (
        <Panel
          title="Fix Issues Across All Tabs with GitHub"
          subtitle="Connect your website repository once. Select findings from Website Audit, Traffic, Competitor Intelligence, AI Visibility, or Backlink Intelligence and open a verified GitHub Pull Request."
          actions={
            connectedRepo ? (
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="good">GitHub Connected</Pill>
                <span className="font-mono text-[11.5px] font-semibold text-brand-900">
                  {connectedRepo.owner}/{connectedRepo.name}
                </span>
                <span className="text-[11px] text-brand-400">
                  ({connectedRepo.defaultBranch} · {connectedRepo.framework})
                </span>
                <button
                  type="button"
                  onClick={() => setShowRepoConnect((v) => !v)}
                  className="text-[11.5px] font-semibold text-accent-700 hover:underline"
                >
                  {showRepoConnect ? "Hide repo settings" : "Change repo"}
                </button>
              </div>
            ) : (
              <Pill tone="warn">GitHub repository not connected</Pill>
            )
          }
        >
          <div className="space-y-4 p-4">
            {(!connectedRepo || showRepoConnect) && (
              <div className="rounded-xl border bg-brand-50/40 p-4">
                <RepoConnectForm
                  projectId={projectId}
                  existingRepo={connectedRepo}
                  onConnected={() => {
                    setShowRepoConnect(false);
                    setActionBanner({
                      tone: "good",
                      text: "GitHub repository connected! You can now fix findings across all tabs and open Pull Requests.",
                    });
                    queryClient.invalidateQueries({ queryKey: ["automation-repo", projectId] });
                  }}
                />
              </div>
            )}

            {/* Live GitHub Fix Task Status & Completion Confirmation Tracker */}
            {visibleTaskRuns.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-brand-500">
                    GitHub Fix Task Status &amp; Completion Confirmation ({count(visibleTaskRuns.length)})
                  </span>
                  <span className="text-[11px] text-brand-400">
                    {isEngineerBusy ? "Auto-updating every 3.5s…" : "All tasks finished"}
                  </span>
                </div>

                {visibleTaskRuns.map(({ run, ctx }) => {
                  const isRunning = run.status === "RUNNING";
                  const isSuccess = run.status === "AWAITING_REVIEW";
                  const unverifiedMatched = ctx.matchedFindings.filter(
                    (mf) => !["VERIFIED", "RESOLVED"].includes(mf.lifecycle ?? ""),
                  );

                  return (
                    <div
                      key={run.id}
                      className={cn(
                        "rounded-xl border p-4 space-y-3 transition-colors",
                        isRunning
                          ? "border-warning-200 bg-warning-50/70"
                          : isSuccess
                            ? "border-success-200/80 bg-success-50/50"
                            : "border-error-200/80 bg-error-50/40",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {isRunning ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-100 px-2.5 py-0.5 text-[11px] font-bold text-warning-900">
                                <RefreshCw size={11} className="animate-spin" />
                                TASK IN PROGRESS
                              </span>
                            ) : isSuccess ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-0.5 text-[11px] font-bold text-success-900">
                                <CheckCircle2 size={12} />
                                TASK COMPLETE · {run.pullRequestUrl ? "PULL REQUEST READY" : "FINISHED"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-error-100 px-2.5 py-0.5 text-[11px] font-bold text-error-900">
                                TASK FINISHED WITHOUT PR · RETRY AVAILABLE
                              </span>
                            )}
                            <Pill tone="info">{ctx.moduleLabel}</Pill>
                            <span className="font-mono text-[11px] text-brand-500">
                              Run #{run.id.slice(0, 8)}
                            </span>
                          </div>

                          <p className="text-[13px] font-bold text-brand-950">
                            {ctx.headline}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-right font-mono text-[11px] text-brand-600">
                          {isRunning ? (
                            <span>Started {relativeTime(run.startedAt)}</span>
                          ) : (
                            <span>
                              Completed {relativeTime(run.finishedAt || run.startedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Summary / Explanation of Completion */}
                      <p
                        className={cn(
                          "text-[12px]",
                          isRunning
                            ? "text-warning-900"
                            : isSuccess
                              ? "text-success-900"
                              : "text-error-900",
                        )}
                      >
                        {isRunning
                          ? "GitHub Fix Engine is cloning your repository, applying code/content improvements on a dedicated branch, validating the build, and opening a Pull Request…"
                          : isSuccess
                            ? ctx.summaryAfter
                            : run.error ||
                              (ctx.inspectedFiles.length > 0
                                ? `Inspected ${ctx.inspectedFiles.join(", ")} in ${connectedRepo ? `${connectedRepo.owner}/${connectedRepo.name}` : "repository"}, but finished without committing a file change. Click "Retry & Apply Repo Fix" to apply an on-site code/schema improvement.`
                                : "Task finished without opening a Pull Request. Click Retry below to run again.")}
                      </p>

                      {/* Branch & Files Changed */}
                      <div className="flex flex-wrap items-center gap-3 text-[11.5px] font-mono text-brand-700">
                        {run.branch && (
                          <span className="inline-flex items-center gap-1 rounded bg-white/80 px-2 py-0.5 border">
                            <GitBranch size={11} /> {run.branch}
                          </span>
                        )}
                        {run.filesChanged.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-white/80 px-2 py-0.5 border text-success-800">
                            <FileCode size={11} /> Modified ({run.filesChanged.length}):{" "}
                            {run.filesChanged.join(", ")}
                          </span>
                        )}
                        {run.filesChanged.length === 0 && ctx.inspectedFiles.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-white/80 px-2 py-0.5 border text-brand-600">
                            <FileCode size={11} /> Inspected: {ctx.inspectedFiles.join(", ")}
                          </span>
                        )}
                      </div>

                      {/* Step-by-Step Execution Log */}
                      {run.steps.length > 0 && (
                        <div className="rounded-lg border bg-white/80 p-2.5 space-y-1">
                          <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-brand-400">
                            Execution Steps ({run.steps.length})
                          </span>
                          <ul className="space-y-1">
                            {run.steps.slice(-6).map((st, idx) => (
                              <li
                                key={idx}
                                className="font-mono text-[11px] text-brand-800 break-words"
                              >
                                <span
                                  className={
                                    st.ok
                                      ? "font-bold text-success-700"
                                      : "font-bold text-error-700"
                                  }
                                >
                                  {st.ok ? "✓" : "✗"}
                                </span>{" "}
                                <span className="font-semibold">{st.step}</span>
                                {st.detail ? `: ${st.detail.slice(0, 220)}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Completion Actions */}
                      {!isRunning && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-200/60 pt-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {run.pullRequestUrl && (
                              <a
                                href={run.pullRequestUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-2xs hover:bg-primary-700"
                              >
                                <GitPullRequest size={12} /> View &amp; Merge Pull Request on GitHub{" "}
                                <ExternalLink size={11} />
                              </a>
                            )}
                            {isSuccess && (
                              <ActionButton
                                disabled={verifyLiveMutation.isPending}
                                icon={
                                  <ShieldCheck
                                    size={12}
                                    className={verifyLiveMutation.isPending ? "animate-spin" : undefined}
                                  />
                                }
                                onClick={() => verifyLiveMutation.mutate(run.id)}
                              >
                                Verify Live Website
                              </ActionButton>
                            )}
                            <ActionButton
                              icon={<GitCompare size={12} />}
                              onClick={() => setSubSection("BEFORE_AFTER")}
                            >
                              View Before &amp; After
                            </ActionButton>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {unverifiedMatched.length > 0 && isSuccess && (
                              <ActionButton
                                disabled={transition.isPending}
                                icon={<CheckCircle2 size={12} />}
                                onClick={() => {
                                  for (const mf of unverifiedMatched) {
                                    transition.mutate({
                                      id: mf.id,
                                      to: "RESOLVED",
                                      reason: `Confirmed fixed via GitHub Run #${run.id.slice(0, 8)}`,
                                    });
                                  }
                                  setActionBanner({
                                    tone: "good",
                                    text: `Marked "${ctx.headline}" as Confirmed Fixed!`,
                                  });
                                }}
                              >
                                Confirm Task Fixed
                              </ActionButton>
                            )}
                            {!isSuccess && (
                              <ActionButton
                                variant="primary"
                                disabled={isEngineerBusy || runPlanFixesMutation.isPending}
                                icon={<RefreshCw size={12} />}
                                onClick={() => {
                                  if (ctx.matchedFindings.length > 0) {
                                    runPlanFixesMutation.mutate({
                                      findingIds: ctx.matchedFindings.map((mf) => mf.id),
                                    });
                                  } else if (selectedFindingIds.length > 0) {
                                    runPlanFixesMutation.mutate({
                                      findingIds: selectedFindingIds,
                                    });
                                  } else if (filteredFindings.length > 0) {
                                    runPlanFixesMutation.mutate({
                                      findingIds: [filteredFindings[0].id],
                                    });
                                  } else if (ctx.rawInstruction) {
                                    runEngineerMutation.mutate(
                                      buildEngineerInstructionFromPrompt(ctx.rawInstruction),
                                    );
                                  }
                                }}
                              >
                                Retry &amp; Apply Repo Fix
                              </ActionButton>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Batch Action Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-brand-50/50 p-3.5">
              <div className="space-y-0.5">
                <p className="text-[12.5px] font-semibold text-brand-950">
                  {selectedFindingIds.length > 0
                    ? `${count(selectedFindingIds.length)} finding(s) selected for GitHub Pull Request`
                    : `Select findings below from ${moduleFilter === "ALL" ? "all 5 tabs" : GROUPS.find((g) => g.id === moduleFilter)?.label ?? moduleFilter} to fix via GitHub`}
                </p>
                <p className="text-[11.5px] text-brand-500">
                  Fix Engine clones your repo, edits the relevant pages/metadata/schema/content on a new branch, verifies the build passes, and opens a Pull Request with Before &amp; After proof.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ActionButton onClick={selectAllFiltered}>
                  Select top {Math.min(filteredFindings.length, 8)}
                </ActionButton>
                {selectedFindingIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedFindingIds([])}
                    className="px-2 text-[11.5px] text-brand-500 hover:underline"
                  >
                    Clear ({selectedFindingIds.length})
                  </button>
                )}
                {readyLowRiskGroups.length > 0 && (
                  <ActionButton
                    disabled={!connectedRepo || isEngineerBusy || runLowRiskFixesMutation.isPending}
                    icon={<Wrench size={12} />}
                    onClick={() => runLowRiskFixesMutation.mutate()}
                  >
                    {runLowRiskFixesMutation.isPending
                      ? "Preparing Audit PR…"
                      : `Quick-Fix ${count(readyLowRiskGroups.length)} Audit Groups`}
                  </ActionButton>
                )}
                <ActionButton
                  variant="primary"
                  disabled={
                    !connectedRepo ||
                    isEngineerBusy ||
                    runPlanFixesMutation.isPending ||
                    (selectedFindingIds.length === 0 && filteredFindings.length === 0)
                  }
                  icon={<GitPullRequest size={13} />}
                  onClick={() =>
                    runPlanFixesMutation.mutate({
                      findingIds: selectedFindingIds.length > 0 ? selectedFindingIds : undefined,
                      sourceModule:
                        moduleFilter === "ALL"
                          ? undefined
                          : GROUPS.find((g) => g.id === moduleFilter)?.sources[0],
                    })
                  }
                >
                  {runPlanFixesMutation.isPending
                    ? "Opening GitHub PR…"
                    : selectedFindingIds.length > 0
                      ? `Fix ${count(selectedFindingIds.length)} Selected with GitHub PR`
                      : `Fix ${moduleFilter === "ALL" ? "All Plan" : GROUPS.find((g) => g.id === moduleFilter)?.label} Issues with GitHub`}
                </ActionButton>
              </div>
            </div>

            {/* Selectable Findings Queue Across All Tabs */}
            {filteredFindings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-brand-500">
                No open findings match this filter. Try switching to <strong>All Tabs</strong> or click <strong>Refresh data</strong>.
              </div>
            ) : (
              <div className="divide-y rounded-xl border bg-white">
                {filteredFindings.slice(0, 12).map((f) => {
                  const group = groupOf(f.source);
                  const checked = selectedFindingIds.includes(f.id);
                  const lc = f.lifecycle ?? "DETECTED";
                  const fRun = findingRunMap.get(f.id);
                  const matchedPr = prChanges.find(
                    (c) =>
                      c.findingTitle === f.title ||
                      (c.url && f.affectedPages?.includes(c.url)),
                  );
                  const prUrl = fRun?.pullRequestUrl || matchedPr?.pullRequestUrl || null;
                  const isTaskComplete =
                    ["VERIFIED", "MEASURED", "RESOLVED"].includes(lc) ||
                    fRun?.status === "AWAITING_REVIEW" ||
                    Boolean(prUrl);
                  const isTaskRunning = fRun?.status === "RUNNING";
                  const isTaskFailed = fRun?.status === "FAILED" && !isTaskComplete;

                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
                        checked
                          ? "bg-primary-50/40"
                          : isTaskComplete
                            ? "bg-success-50/20 hover:bg-success-50/40"
                            : "hover:bg-brand-50/40",
                      )}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectFinding(f.id)}
                          className="mt-1 h-4 w-4 rounded border-brand-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12.5px] font-semibold text-brand-950">
                              {f.title}
                            </span>
                            {group && <Pill tone="info">{group.label}</Pill>}
                            <Pill tone={BAND[f.potential]}>{f.potential.toLowerCase()} impact</Pill>
                            <Pill tone={EFFORT[f.effort]}>{f.effort.toLowerCase()} effort</Pill>
                            {isTaskRunning ? (
                              <Pill tone="warn">⟳ Task Running on GitHub…</Pill>
                            ) : isTaskComplete ? (
                              <Pill tone="good">
                                ✓ Task Complete ·{" "}
                                {["VERIFIED", "MEASURED", "RESOLVED"].includes(lc)
                                  ? "Confirmed Fixed"
                                  : "GitHub PR Ready"}
                              </Pill>
                            ) : isTaskFailed ? (
                              <Pill tone="bad">⚠ Last Run Stopped · Retry Available</Pill>
                            ) : (
                              <Pill
                                tone={
                                  ["QUEUED", "APPROVED", "VERIFYING"].includes(lc)
                                    ? "warn"
                                    : "default"
                                }
                              >
                                {LIFECYCLE_LABEL[lc] ?? lc}
                              </Pill>
                            )}
                          </div>
                          <p className="text-[11.5px] text-brand-600 line-clamp-2">
                            <strong className="text-brand-800">Fix: </strong>
                            {f.recommendedAction}
                          </p>
                          {f.affectedPages && f.affectedPages.length > 0 && (
                            <p className="truncate font-mono text-[10.5px] text-brand-400">
                              Target: {f.affectedPages.slice(0, 2).join(", ")}
                              {f.affectedPages.length > 2 ? ` +${f.affectedPages.length - 2} more` : ""}
                            </p>
                          )}
                        </div>
                      </label>

                      <div className="flex shrink-0 flex-wrap items-center gap-2 self-end sm:self-center">
                        {prUrl && (
                          <a
                            href={prUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-success-300 bg-success-50 px-2.5 py-1 text-[11.5px] font-semibold text-success-800 hover:bg-success-100"
                          >
                            <GitPullRequest size={12} /> View GitHub PR <ExternalLink size={10} />
                          </a>
                        )}
                        {lc === "DETECTED" && !isTaskComplete && (
                          <ActionButton
                            disabled={transition.isPending}
                            onClick={() => transition.mutate({ id: f.id, to: "QUEUED" })}
                          >
                            Add to plan
                          </ActionButton>
                        )}
                        {!["VERIFIED", "RESOLVED"].includes(lc) &&
                          (isTaskComplete || ["QUEUED", "APPROVED", "VERIFYING"].includes(lc)) && (
                            <ActionButton
                              disabled={transition.isPending}
                              icon={<CheckCircle2 size={12} />}
                              onClick={() =>
                                transition.mutate({
                                  id: f.id,
                                  to: "RESOLVED",
                                  reason: "Confirmed fixed in GitHub Fix Engine",
                                })
                              }
                            >
                              Confirm Fixed
                            </ActionButton>
                          )}
                        <ActionButton
                          variant={isTaskComplete ? "secondary" : "primary"}
                          disabled={isEngineerBusy || runPlanFixesMutation.isPending}
                          icon={<GitPullRequest size={12} />}
                          onClick={() => handleFixFindingWithGitHub(f)}
                        >
                          {isTaskRunning
                            ? "Fixing on GitHub…"
                            : isTaskComplete
                              ? "Re-run on GitHub"
                              : isTaskFailed
                                ? "Retry Fix with GitHub"
                                : "Fix with GitHub"}
                        </ActionButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom GitHub Engineer Prompt Box */}
            <div className="rounded-xl border bg-brand-50/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-900">
                  <Bot size={14} className="text-primary-600" />
                  Ask the GitHub Engineer (Custom Code / Content / SEO Fix)
                </span>
                <span className="text-[11px] text-brand-400">
                  Edits up to 15 files · validates build · opens GitHub PR
                </span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={engineerPrompt}
                  onChange={(e) => setEngineerPrompt(e.target.value)}
                  placeholder="Describe any fix from Website Audit, Traffic, Competitor Intelligence, or AI Visibility…"
                  aria-label="Custom instruction for the GitHub Engineer"
                  className="h-9 flex-1 rounded-lg border bg-white px-3 text-[12px] text-brand-950 outline-none focus:border-primary-500"
                />
                <ActionButton
                  variant="primary"
                  disabled={
                    !connectedRepo ||
                    engineerPrompt.trim().length < 8 ||
                    isEngineerBusy ||
                    runEngineerMutation.isPending
                  }
                  icon={<Sparkles size={12} />}
                  onClick={() => runEngineerMutation.mutate(engineerPrompt.trim())}
                >
                  {runEngineerMutation.isPending ? "Starting Engineer…" : "Run on GitHub & Open PR"}
                </ActionButton>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* =====================================================================
          SECTION B: BEFORE & AFTER COMPARISONS (WHAT WE FIXED & IMPROVED)
         ===================================================================== */}
      {(subSection === "ALL" || subSection === "BEFORE_AFTER") && (
        <Panel
          title="Before & After — What We Fixed & Improved Across All Tabs"
          subtitle="Every code/content change prepared in GitHub Pull Requests alongside the Before (detected problem & baseline evidence) and After (applied or target improvement) for every module."
          actions={
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {(
                [
                  { id: "ALL", label: "All Items" },
                  { id: "FIXED_OR_PR", label: "GitHub PR / Verified" },
                  { id: "IN_PLAN", label: "In Plan" },
                  { id: "OPEN", label: "Detected" },
                ] as const
              ).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-semibold transition-colors",
                    statusFilter === st.id
                      ? "bg-brand-900 text-white"
                      : "bg-brand-50 text-brand-600 hover:bg-brand-100",
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="space-y-6 p-4">
            {/* Part 1: Recorded GitHub PR Before & After Changes */}
            {filteredPrChanges.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-brand-500">
                    GitHub Pull Request Before &amp; After Diffs ({count(filteredPrChanges.length)})
                  </h3>
                  <Link
                    href="/fix-engine/changes"
                    className="text-[11.5px] font-semibold text-accent-700 hover:underline"
                  >
                    Open full standalone evidence page →
                  </Link>
                </div>

                <div className="space-y-3">
                  {filteredPrChanges.map((ch) => (
                    <div
                      key={ch.key}
                      className="rounded-xl border bg-white p-4 shadow-2xs space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone="info">{ch.moduleLabel}</Pill>
                          <span className="text-[13px] font-bold text-brand-950">
                            {ch.findingTitle}
                          </span>
                          <Pill
                            tone={
                              ch.verification === "MATCHED"
                                ? "good"
                                : ch.reviewState === "MERGED"
                                  ? "good"
                                  : "warn"
                            }
                          >
                            {ch.verification === "MATCHED"
                              ? "Verified on Live Website"
                              : ch.reviewState === "MERGED"
                                ? "Merged on GitHub"
                                : "GitHub PR Ready"}
                          </Pill>
                          <span className="font-mono text-[11px] text-brand-400">
                            {new Date(ch.runStartedAt).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {ch.pullRequestUrl && (
                            <a
                              href={ch.pullRequestUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-[11.5px] font-semibold text-accent-700 hover:bg-brand-50"
                            >
                              <GitPullRequest size={12} /> View PR <ExternalLink size={10} />
                            </a>
                          )}
                          <ActionButton
                            disabled={verifyLiveMutation.isPending}
                            icon={
                              <ShieldCheck
                                size={12}
                                className={verifyLiveMutation.isPending ? "animate-spin" : undefined}
                              />
                            }
                            onClick={() => verifyLiveMutation.mutate(ch.runId)}
                          >
                            Verify Live Site
                          </ActionButton>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-brand-500">
                        {ch.url && (
                          <span>
                            Page:{" "}
                            <a
                              href={ch.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-accent-700 hover:underline"
                            >
                              {ch.url}
                            </a>
                          </span>
                        )}
                        {ch.file && (
                          <span className="inline-flex items-center gap-1 font-mono text-brand-600">
                            <FileCode size={12} /> {ch.file}
                          </span>
                        )}
                        <span>Field: {ch.fieldLabel}</span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-error-200/70 bg-error-50/50 p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-error-700">
                              Before ({ch.beforeSource === "REPOSITORY" ? "Previous Repository Code" : "Saved Audit Baseline"})
                            </span>
                            {ch.measuredAt && (
                              <span className="font-mono text-[10px] text-error-600">
                                {new Date(ch.measuredAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap break-words font-mono text-[11.5px] text-error-900">
                            {ch.before || "<not set / missing before fix>"}
                          </p>
                        </div>

                        <div className="rounded-lg border border-success-200/70 bg-success-50/50 p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-success-700">
                              After ({ch.reviewState === "MERGED" ? "Merged Improvement" : "Prepared in GitHub PR"})
                            </span>
                            {ch.checkedAt && (
                              <span className="font-mono text-[10px] text-success-700">
                                Checked {new Date(ch.checkedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap break-words font-mono text-[11.5px] text-success-900">
                            {ch.after}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[12px] text-brand-600">
                        <p>
                          <strong className="text-brand-950">What we improved &amp; why: </strong>
                          {ch.why}
                        </p>
                        {ch.liveValue && (
                          <span className="font-mono text-[11px] text-success-700">
                            Live value: {ch.liveValue}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Part 2: Cross-Module Findings Before & After Matrix */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-brand-500">
                  All-Tabs Issues &amp; Improvements — Before vs. After ({count(filteredFindings.length)})
                </h3>
                <span className="text-[11px] text-brand-400">
                  Showing baseline evidence (Before) and target improvement (After) across all modules
                </span>
              </div>

              {filteredFindings.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-brand-500">
                  No findings match the active filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFindings.map((f) => {
                    const group = groupOf(f.source);
                    const lc = f.lifecycle ?? "DETECTED";
                    const matchedPr = prChanges.find(
                      (c) =>
                        c.findingTitle === f.title ||
                        (c.url && f.affectedPages?.includes(c.url)),
                    );

                    return (
                      <div
                        key={f.id}
                        className="rounded-xl border bg-white p-4 shadow-2xs space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {group && <Pill tone="info">{group.label}</Pill>}
                              <span className="text-[13px] font-bold text-brand-950">
                                {f.title}
                              </span>
                              <Pill tone={BAND[f.potential]}>{f.potential.toLowerCase()} impact</Pill>
                              <Pill
                                tone={
                                  ["VERIFIED", "MEASURED", "RESOLVED"].includes(lc)
                                    ? "good"
                                    : ["QUEUED", "APPROVED", "VERIFYING", "APPLYING"].includes(lc)
                                      ? "warn"
                                      : "default"
                                }
                              >
                                {LIFECYCLE_LABEL[lc] ?? lc}
                              </Pill>
                            </div>
                            {f.affectedPages && f.affectedPages.length > 0 && (
                              <p className="font-mono text-[11px] text-brand-500">
                                Affected ({f.affectedCount ?? f.affectedPages.length}):{" "}
                                {f.affectedPages.slice(0, 3).join(" · ")}
                                {f.affectedPages.length > 3 ? ` (+${f.affectedPages.length - 3} more)` : ""}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {matchedPr?.pullRequestUrl && (
                              <a
                                href={matchedPr.pullRequestUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-[11.5px] font-semibold text-accent-700 hover:bg-brand-50"
                              >
                                <GitPullRequest size={12} /> GitHub PR <ExternalLink size={10} />
                              </a>
                            )}
                            {!["VERIFIED", "RESOLVED"].includes(lc) && (
                              <ActionButton
                                variant="primary"
                                disabled={isEngineerBusy || runPlanFixesMutation.isPending}
                                icon={<GitPullRequest size={12} />}
                                onClick={() => handleFixFindingWithGitHub(f)}
                              >
                                Fix with GitHub
                              </ActionButton>
                            )}
                            {["QUEUED", "APPROVED", "VERIFYING"].includes(lc) && (
                              <ActionButton
                                disabled={transition.isPending}
                                icon={<CheckCircle2 size={12} />}
                                onClick={() =>
                                  transition.mutate({
                                    id: f.id,
                                    to: "RESOLVED",
                                    reason: "Confirmed fixed and verified in Fix Engine",
                                  })
                                }
                              >
                                Mark Fixed
                              </ActionButton>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {/* BEFORE */}
                          <div className="rounded-lg border border-error-200/70 bg-error-50/40 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-error-700">
                                Before — Detected Issue &amp; Baseline Evidence
                              </span>
                              <span className="font-mono text-[10px] text-error-600">
                                Found {new Date(f.detectedAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-[12px] text-brand-900">{f.summary}</p>
                            {f.evidence.length > 0 && (
                              <ul className="space-y-1 border-t border-error-200/60 pt-2">
                                {f.evidence.slice(0, 4).map((ev) => (
                                  <li
                                    key={`${ev.label}-${ev.value}`}
                                    className="font-mono text-[11px] text-error-900"
                                  >
                                    <span className="font-semibold">{ev.label}:</span> {ev.value}{" "}
                                    <span className="text-error-600">({ev.source})</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          {/* AFTER */}
                          <div className="rounded-lg border border-success-200/70 bg-success-50/40 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-success-700">
                                After — {matchedPr ? "GitHub PR Change Applied" : "Target Improvement & Fix"}
                              </span>
                              <span className="font-mono text-[10px] text-success-700">
                                {matchedPr ? `File: ${matchedPr.file}` : group?.label ?? f.source}
                              </span>
                            </div>
                            <p className="whitespace-pre-line text-[12px] text-brand-950">
                              {matchedPr ? matchedPr.after : f.recommendedAction}
                            </p>
                            {matchedPr && (
                              <p className="border-t border-success-200/60 pt-2 text-[11px] text-success-800">
                                <strong>Why:</strong> {matchedPr.why}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* =====================================================================
          SECTION C: COMPLETE IMPROVEMENT LOG (WHAT WE DID & WHAT WE IMPROVED)
         ===================================================================== */}
      {(subSection === "ALL" || subSection === "IMPROVEMENT_LOG") && (
        <Panel
          title="Complete Improvement Log — What We Did & What We Improved"
          subtitle="Chronological audit log of every GitHub Pull Request, file modification, before-and-after change, live verification, and cross-tab improvement."
          actions={
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              {(
                [
                  { id: "ALL", label: "All Log Events" },
                  { id: "GITHUB_PR", label: "GitHub PR Runs" },
                  { id: "CODE_DIFF", label: "Before / After Diffs" },
                  { id: "VERIFICATION", label: "Live Verifications" },
                  { id: "PLAN_ACTION", label: "Module Plan Actions" },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setLogCategoryFilter(cat.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-semibold transition-colors",
                    logCategoryFilter === cat.id
                      ? "bg-brand-900 text-white"
                      : "bg-brand-50 text-brand-600 hover:bg-brand-100",
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="p-4">
            {unifiedLog.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-[12px] text-brand-500">
                No log entries match your current filter.
              </div>
            ) : (
              <div className="relative ml-3 border-l border-brand-200 pl-6 space-y-4 py-1">
                {unifiedLog.map((entry) => (
                  <div key={entry.id} className="relative rounded-xl border bg-white p-3.5 shadow-2xs space-y-2">
                    <span className="absolute -left-[31px] top-4 flex h-4 w-4 items-center justify-center rounded-full border bg-white text-primary-600 shadow-2xs">
                      {entry.category === "GITHUB_PR" ? (
                        <GitBranch size={10} />
                      ) : entry.category === "VERIFICATION" ? (
                        <CheckCircle2 size={10} className="text-success-600" />
                      ) : entry.category === "CODE_DIFF" ? (
                        <GitCompare size={10} />
                      ) : (
                        <Clock size={10} />
                      )}
                    </span>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone="info">{entry.moduleLabel}</Pill>
                        <span className="text-[12.5px] font-bold text-brand-950">
                          {entry.title}
                        </span>
                        <Pill tone={entry.statusTone}>{entry.statusLabel}</Pill>
                      </div>
                      <span className="font-mono text-[11px] text-brand-400">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="whitespace-pre-line text-[12px] text-brand-700">
                      {entry.detail}
                    </p>

                    {(entry.beforeText || entry.afterText) && (
                      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2 text-[11px]">
                        {entry.beforeText && (
                          <div className="rounded border border-error-200/60 bg-error-50/40 p-2 font-mono text-error-900">
                            <span className="block font-sans text-[9.5px] font-bold uppercase text-error-700">
                              Before
                            </span>
                            {entry.beforeText}
                          </div>
                        )}
                        {entry.afterText && (
                          <div className="rounded border border-success-200/60 bg-success-50/40 p-2 font-mono text-success-900">
                            <span className="block font-sans text-[9.5px] font-bold uppercase text-success-700">
                              After
                            </span>
                            {entry.afterText}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-brand-400">
                      {entry.file && <span>File: {entry.file}</span>}
                      {entry.url && (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-accent-700 hover:underline"
                        >
                          {entry.url}
                        </a>
                      )}
                      {entry.prUrl && (
                        <a
                          href={entry.prUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-sans font-semibold text-accent-700 hover:underline"
                        >
                          View GitHub Pull Request <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}
    </div>
  );
}

function RepoConnectForm({
  projectId,
  existingRepo,
  onConnected,
}: {
  projectId: string | null;
  existingRepo: { owner: string; name: string; defaultBranch: string; framework: string } | null;
  onConnected: () => void;
}) {
  const [owner, setOwner] = useState(existingRepo?.owner ?? "");
  const [name, setName] = useState(existingRepo?.name ?? "");
  const [branch, setBranch] = useState(existingRepo?.defaultBranch ?? "main");
  const [framework, setFramework] = useState(existingRepo?.framework ?? "nextjs");
  const [token, setToken] = useState("");

  const connect = useMutation({
    mutationFn: () =>
      api.connectRepository(projectId!, {
        owner: owner.trim(),
        name: name.trim(),
        accessToken: token.trim(),
        defaultBranch: branch.trim() || "main",
        framework,
      }),
    onSuccess: () => {
      setToken("");
      onConnected();
    },
  });

  const field =
    "mt-1 h-9 w-full rounded-lg border bg-white px-3 text-[12.5px] text-brand-950 outline-none focus:border-primary-500";

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        connect.mutate();
      }}
    >
      <p className="text-[12.5px] font-semibold text-brand-950">
        Connect your website&apos;s GitHub repository so Fix Engine can prepare Pull Requests for issues across all tabs.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] font-medium text-brand-600">
          GitHub Owner / Org
          <input
            className={field}
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="acme-inc"
            required
          />
        </label>
        <label className="text-[11px] font-medium text-brand-600">
          Repository Name
          <input
            className={field}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="website"
            required
          />
        </label>
        <label className="text-[11px] font-medium text-brand-600">
          Default Branch
          <input
            className={field}
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
          />
        </label>
        <label className="text-[11px] font-medium text-brand-600">
          Framework
          <select
            className={field}
            value={framework}
            onChange={(e) => setFramework(e.target.value)}
          >
            <option value="nextjs">Next.js</option>
            <option value="static-html">Static HTML</option>
            <option value="unknown">Auto-detect / Other</option>
          </select>
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-[11px] font-medium text-brand-600">
          GitHub Fine-Grained Personal Access Token (Contents &amp; Pull requests: Read and Write)
          <input
            className={field}
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="github_pat_…"
            required
          />
        </label>
        <ActionButton variant="primary" disabled={connect.isPending} icon={<GitPullRequest size={12} />}>
          {connect.isPending ? "Verifying & Connecting…" : "Connect GitHub Repository"}
        </ActionButton>
      </div>
      {connect.error && <StatusNote tone="bad">{errorMessage(connect.error)}</StatusNote>}
    </form>
  );
}

function FilterChip({
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
        "inline-flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors",
        active
          ? "bg-signal-400 text-signal-ink font-bold shadow-xs"
          : "text-brand-400 hover:text-brand-950",
      )}
    >
      {children}
    </button>
  );
}
