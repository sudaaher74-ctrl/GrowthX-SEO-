"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  CircleX,
  Download,
  ExternalLink,
  FileCode,
  GitBranch,
  GitCompare,
  GitPullRequest,
  Globe,
  History,
  Layers,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { ActionButton, Kpi, Panel, Pill, StatusNote, relativeTime } from "@/components/ui/console";
import { LoadingState } from "@/components/ui/truthful-state";
import { CmsApplyModal } from "@/components/fix-engine/cms-apply-modal";
import { GitHubAgentConnectWorkflow } from "@/components/settings/github-agent-connect-workflow";
import { WordPressConnectModal, type CmsConnectPlatform } from "@/components/settings/wordpress-connect-modal";
import { useFindings, useIssueGroups, useProfile, useTransitionFinding, useWorkspace } from "@/hooks/use-growthx";
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
  NEW_FILE_CREATED: "New Page / Component Created",
  CODE_AND_SEO_UPDATE: "Code & On-Page SEO Improvement",
};

const LIFECYCLE_LABEL: Record<string, string> = {
  DETECTED: "Detected",
  QUEUED: "In Improvement Plan",
  APPROVED: "Approved",
  APPLYING: "Applying Change",
  VERIFYING: "Staged / Verifying Live",
  VERIFIED: "Confirmed Fixed Live",
  MEASURED: "Impact Measured",
  FAILED: "Failed",
  SNOOZED: "Snoozed",
  DISMISSED: "Dismissed",
  RESOLVED: "Confirmed Fixed",
};

const BAND = { HIGH: "good", MEDIUM: "warn", LOW: "default" } as const;
const EFFORT = { HIGH: "bad", MEDIUM: "warn", LOW: "good" } as const;

type SubSection = "ALL" | "GITHUB_RUNNER" | "BEFORE_AFTER" | "IMPROVEMENT_LOG" | "FAILED";

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
    const snippet = f.title.toLowerCase().trim();
    if (snippet.length > 5 && rawInstruction.toLowerCase().includes(snippet)) return true;
    const instrLower = rawInstruction.toLowerCase();
    if (
      instrLower.includes("sitemap") &&
      instrLower.includes("domain") &&
      (snippet.includes("sitemap") || f.summary.toLowerCase().includes("sitemap"))
    ) {
      return true;
    }
    return false;
  });

  const matchedFindings = directMatched;

  const errorText = run.error ?? "";
  const repoDomainMatch = errorText.match(
    /uses the (?:domain\s+)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i,
  );
  const detectedRepoDomain = repoDomainMatch?.[1]?.toLowerCase() ?? null;
  const isRepoDomainMismatch =
    /unrelated to this repository|external to this repository/i.test(errorText) ||
    Boolean(detectedRepoDomain);
  const isNoChangesNeeded = /finished without changing any files/i.test(errorText);
  const hasMetadataToolFailure = run.steps.some((s) => s.step === "metadata" && !s.ok);
  const hasEditFailure = run.steps.some(
    (s) =>
      (!s.ok && (s.step === "edit" || s.step === "read")) ||
      (s.step === "stopped" &&
        (s.detail?.toLowerCase().includes("recovery limit") ||
          s.detail?.toLowerCase().includes("turn limit"))),
  );

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
      : ["PENDING", "RUNNING"].includes(run.status)
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
    detectedRepoDomain,
    isRepoDomainMismatch,
    isNoChangesNeeded,
    hasMetadataToolFailure,
    hasEditFailure,
  };
}

function buildDirectEditRetryInstruction(ctx: ReturnType<typeof resolveRunContext>): string {
  const base = (ctx.rawInstruction || ctx.headline || "")
    .split("EXECUTION PLAN")[0]
    .split("RETRY EXECUTION GUIDANCE")[0]
    .split("IMPORTANT:")[0]
    .trim();

  const targetPages = ctx.matchedFindings[0]?.affectedPages?.slice(0, 3).join(", ") || "";
  const pagesHint = targetPages ? ` Focus on primary pages: ${targetPages}.` : "";

  const guidance = `
RETRY EXECUTION GUIDANCE:
1. TARGET FILES: Look for top-level page components in frontend-react/src/pages/*.jsx (such as Cart.jsx, MyAccount.jsx, Policy.jsx, or src/app/**/page.tsx). Do not modify internal screen fragments (e.g. daily/screens/) or route registry files.${pagesHint}
2. SAFE READING: ALWAYS specify BOTH "start" and "end" in every "read" call with a 60-80 line range (e.g. {"tool":"read","path":"...","start":1,"end":80}). Never omit "end" as reading too many lines will exceed output limits.
3. SEARCH FIRST: To find where to insert or update the <title> or <Helmet>, use {"tool":"search","pattern":"return (","path":"..."} first to get the exact line number of the JSX return, then read 60 lines around that line before calling edit.
4. EXACT EDIT: Copy the exact lines from your read output into "old". Never guess indentation or text. Add or update <Helmet><title>Page Title | Brand</title></Helmet> inside the JSX return, and import { Helmet } from 'react-helmet-async' at the top. Keep titles under 60 characters.
5. FINISH CLEANLY: Update 2-3 key routed pages cleanly, verify with read, then call finish with a 1-sentence summary so a Pull Request can be created.`;

  return `${base.slice(0, 1950 - guidance.length)}\n${guidance}`;
}

export function GitHubFixesLogView({
  initialFindingId,
  initialInstruction,
  initialSection = "ALL",
}: {
  initialSection?: "ALL" | "IMPROVEMENT_LOG";
  initialFindingId?: string | null;
  initialInstruction?: string;
}) {
  const { projectId, projects } = useWorkspace();
  const domain = projects.find((p) => p.id === projectId)?.name ?? null;
  const queryClient = useQueryClient();

  const [moduleFilter, setModuleFilter] = useState<string>("ALL");
  const [subSection, setSubSection] = useState<SubSection>(initialSection);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>(
    initialFindingId ? [initialFindingId] : [],
  );
  const [trackedRunId, setTrackedRunId] = useState<string | null>(null);
  const [engineerPrompt, setEngineerPrompt] = useState(initialInstruction ?? "");
  const [showRepoConnect, setShowRepoConnect] = useState(false);
  const [cmsFinding, setCmsFinding] = useState<GrowthOpportunity | null | undefined>(undefined);
  const [cmsModalPlatform, setCmsModalPlatform] = useState<CmsConnectPlatform | null>(null);
  const [actionBanner, setActionBanner] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const autoVerificationAttempts = useRef(new Map<string, number>());

  const findingsQuery = useFindings(projectId, { limit: 200 });
  const transition = useTransitionFinding(projectId);
  const issueGroups = useIssueGroups(projectId, { limit: 100 });

  const repoQuery = useQuery({
    queryKey: ["automation-repo", projectId],
    queryFn: () => api.getRepository(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const wpQuery = useQuery({
    queryKey: ["wordpress-connection", projectId],
    queryFn: () => api.getWordPressConnection(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const shopifyQuery = useQuery({
    queryKey: ["shopify-connection", projectId],
    queryFn: () => api.getShopifyConnection(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const webflowQuery = useQuery({
    queryKey: ["webflow-connection", projectId],
    queryFn: () => api.getWebflowConnection(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const proofCardsQuery = useQuery({
    queryKey: ["fix-proof-cards", projectId],
    queryFn: () => api.getFixProofCards(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const ledgerQuery = useQuery({
    queryKey: ["fix-impact-ledger", projectId],
    queryFn: () => api.getFixImpactLedger(projectId!),
    enabled: Boolean(projectId),
    retry: false,
  });

  const runsQuery = useQuery({
    queryKey: ["automation-runs", projectId],
    queryFn: () => api.listAutomationRuns(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    refetchInterval: (q) => (q.state.data?.some((r) => ["PENDING", "RUNNING"].includes(r.status)) ? 7500 : false),
  });

  const isPollingRuns = (runsQuery.data ?? []).some((r) => ["PENDING", "RUNNING"].includes(r.status));

  const changesQuery = useQuery({
    queryKey: ["fix-changes", projectId, isPollingRuns],
    queryFn: () => api.listFixChanges(projectId!),
    enabled: Boolean(projectId),
    retry: false,
    refetchInterval: (q) => {
      const reports = q.state.data ?? [];
      const needsMergeRefresh = reports.some((report) => report.reviewState === "OPEN" || report.reviewState === "UNKNOWN");
      const needsLiveRetry = reports.some((report) =>
        report.reviewState === "MERGED" && report.changes.some((change) => change.verification === "NOT_CHECKED" || change.verification === "DIFFERENT"),
      );
      return needsMergeRefresh || needsLiveRetry ? 60_000 : false;
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["automation-repo", projectId] });
    queryClient.invalidateQueries({ queryKey: ["repository", projectId] });
    queryClient.invalidateQueries({ queryKey: ["automation-runs", projectId] });
    queryClient.invalidateQueries({ queryKey: ["fix-changes", projectId, isPollingRuns] });
    queryClient.invalidateQueries({ queryKey: ["findings", projectId] });
    queryClient.invalidateQueries({ queryKey: ["issue-groups", projectId] });
    queryClient.invalidateQueries({ queryKey: ["fix-proof-cards", projectId] });
    queryClient.invalidateQueries({ queryKey: ["fix-impact-ledger", projectId] });
    queryClient.invalidateQueries({ queryKey: ["wordpress-connection", projectId] });
    queryClient.invalidateQueries({ queryKey: ["shopify-connection", projectId] });
    queryClient.invalidateQueries({ queryKey: ["webflow-connection", projectId] });
  };

  const allFindings = useMemo(() => findingsQuery.data?.items ?? [], [findingsQuery.data]);
  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const changeReports = useMemo(() => changesQuery.data ?? [], [changesQuery.data]);
  const proofCards = useMemo(() => proofCardsQuery.data ?? [], [proofCardsQuery.data]);
  const ledgerEvents = useMemo(() => ledgerQuery.data ?? [], [ledgerQuery.data]);
  const connectedRepo = repoQuery.data ?? null;
  const isEngineerBusy = runs.some((r) => ["PENDING", "RUNNING"].includes(r.status));

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

  // Keep completed and failed task history out of the active-fix workspace.
  const visibleTaskRuns = useMemo(() => {
    const list: Array<{ run: AutomationRun; ctx: ReturnType<typeof resolveRunContext> }> = [];
    for (const run of runs) {
      if (!["PENDING", "RUNNING"].includes(run.status)) continue;
      const ctx = resolveRunContext(run, allFindings);
      const matchesFilter =
        moduleFilter === "ALL" ||
        ctx.moduleId === moduleFilter ||
        run.id === trackedRunId;
      if (matchesFilter) list.push({ run, ctx });
    }
    return list.slice(0, 4);
  }, [runs, allFindings, moduleFilter, trackedRunId]);

  const failedTaskRuns = useMemo(
    () =>
      runs
        .filter((run) => run.status === "FAILED")
        .map((run) => ({ run, ctx: resolveRunContext(run, allFindings) }))
        .filter(({ run, ctx }) => {
          if (
            ctx.matchedFindings.length > 0 &&
            ctx.matchedFindings.every((f) =>
              ["VERIFIED", "MEASURED", "RESOLVED", "DISMISSED"].includes(f.lifecycle ?? ""),
            )
          ) {
            return false;
          }
          return (
            (moduleFilter === "ALL" || ctx.moduleId === moduleFilter) &&
            (!searchQuery.trim() ||
              ctx.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (run.error || "").toLowerCase().includes(searchQuery.toLowerCase()))
          );
        }),
    [runs, allFindings, moduleFilter, searchQuery],
  );

  const repoMismatchInfo = useMemo(() => {
    if (!connectedRepo || !domain) return null;
    const normDomain = domain.toLowerCase().replace(/^www\./, "");
    const domainRoot = normDomain.split(".")[0] ?? "";
    const repoSlug = connectedRepo.name.toLowerCase().replace(/[^a-z0-9]/g, "");

    const mismatchFromRun = failedTaskRuns.find(
      ({ ctx }) => ctx.isRepoDomainMismatch && ctx.detectedRepoDomain && ctx.detectedRepoDomain !== normDomain,
    )?.ctx.detectedRepoDomain;

    if (mismatchFromRun) {
      return {
        repoName: `${connectedRepo.owner}/${connectedRepo.name}`,
        repoDomain: mismatchFromRun,
        projectDomain: normDomain,
      };
    }

    const otherMatchingProject = projects.find((p) => {
      if (p.id === projectId) return false;
      const otherRoot = p.name.toLowerCase().replace(/^www\./, "").split(".")[0] ?? "";
      return otherRoot.length >= 4 && repoSlug.includes(otherRoot) && !repoSlug.includes(domainRoot);
    });

    if (otherMatchingProject) {
      return {
        repoName: `${connectedRepo.owner}/${connectedRepo.name}`,
        repoDomain: otherMatchingProject.name,
        projectDomain: normDomain,
      };
    }

    return null;
  }, [connectedRepo, domain, failedTaskRuns, projects, projectId]);

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
    const fromReports = changeReports.filter((report) => Boolean(report.pullRequestUrl)).flatMap((report: FixChangeReport) =>
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
          issueId: ch.issueId || null,
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

    return fromReports;
  }, [changeReports, allFindings]);

  // Filter findings by module and search
  const filteredFindings = useMemo(() => {
    return allFindings.filter((f) => {
      const g = groupOf(f.source);
      if (moduleFilter !== "ALL" && g?.id !== moduleFilter) return false;
      if (f.lifecycle === "DISMISSED") return false;
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
  }, [allFindings, moduleFilter, searchQuery]);

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

  // One record per actual GitHub pull request. Plans and failed runs belong in their own tabs.
  const pullRequestLog = useMemo(() => {
    const reportByUrl = new Map(changeReports.filter((report) => report.pullRequestUrl).map((report) => [report.pullRequestUrl!, report]));
    const runByUrl = new Map(runs.filter((run) => run.pullRequestUrl).map((run) => [run.pullRequestUrl!, run]));
    return [...new Set([...reportByUrl.keys(), ...runByUrl.keys()])].map((prUrl) => {
      const report = reportByUrl.get(prUrl);
      const run = runByUrl.get(prUrl);
      const ctx = run ? resolveRunContext(run, allFindings) : null;
      const firstChange = report?.changes[0];
      const group = firstChange ? groupOf(firstChange.sourceModule) : null;
      const moduleId = ctx?.moduleId ?? group?.id ?? "WEBSITE";
      const moduleLabel = ctx?.moduleLabel ?? group?.label ?? "Website Audit";
      const title = ctx?.headline ?? firstChange?.findingTitle ?? "GitHub pull request";
      const runReviewState = run?.status === "MERGED" ? "MERGED" : run?.status === "AWAITING_REVIEW" ? "OPEN" : "UNKNOWN";
      const reviewState = report?.reviewState && report.reviewState !== "UNKNOWN" ? report.reviewState : runReviewState;
      const timestamp = report?.mergedAt ?? run?.finishedAt ?? report?.startedAt ?? run?.startedAt ?? "";
      const files = [...new Set([...(report?.filesChanged ?? []), ...(run?.filesChanged ?? [])])];
      return { prUrl, report, run, moduleId, moduleLabel, title, reviewState, timestamp, files };
    }).filter((item) => {
      if (item.reviewState === "CLOSED") return false;
      if (moduleFilter !== "ALL" && item.moduleId !== moduleFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      return !q || [item.title, item.moduleLabel, item.prUrl, ...item.files].some((value) => value.toLowerCase().includes(q));
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [changeReports, runs, allFindings, moduleFilter, searchQuery]);

  // KPI Metrics across GitHub + CMS (WordPress / Shopify / Webflow / Manual)
  const kpiStats = useMemo(() => {
    const activeFindings = allFindings.filter((f) => f.lifecycle !== "DISMISSED");
    const queuedOrActive = activeFindings.filter((f) =>
      ["QUEUED", "APPROVED", "APPLYING", "VERIFYING"].includes(f.lifecycle ?? "DETECTED"),
    );
    const verifiedItems = new Set<string>();
    for (const change of prChanges) {
      if (change.verification === "MATCHED") {
        verifiedItems.add(change.issueId || `${change.runId}:${change.url || change.file}:${change.findingTitle}`);
      }
    }
    for (const card of proofCards) {
      if (card.after?.verificationStatus === "VERIFIED") {
        verifiedItems.add(card.runId);
      }
    }
    for (const finding of activeFindings) {
      if (["VERIFIED", "MEASURED", "RESOLVED"].includes(finding.lifecycle ?? "")) verifiedItems.add(finding.id);
    }
    const verifiedOrResolved = verifiedItems.size;
    const prCount = new Set([...runs.map((r) => r.pullRequestUrl), ...changeReports.map((r) => r.pullRequestUrl)].filter(Boolean)).size;
    const cmsRunIds = new Set(
      [
        ...proofCards.filter((c) => !c.after?.pullRequestUrl).map((c) => c.runId),
        ...ledgerEvents.filter((e) => !e.pullRequestUrl && e.automationRunId).map((e) => e.automationRunId!),
      ].filter(Boolean),
    );
    const appliedTotal = prCount + cmsRunIds.size;
    const distinctPagesAndFiles = new Set([
      ...prChanges.map((c) => c.url || c.file).filter(Boolean),
      ...runs.flatMap((r) => r.filesChanged),
      ...proofCards.map((c) => c.url || c.file).filter(Boolean),
      ...ledgerEvents.map((e) => e.affectedUrl).filter(Boolean),
    ]).size;

    const connectedPlatforms: string[] = [];
    if (connectedRepo) connectedPlatforms.push("GitHub");
    if (wpQuery.data?.connected) connectedPlatforms.push("WordPress");
    if (shopifyQuery.data?.connected) connectedPlatforms.push("Shopify");
    if (webflowQuery.data?.connected) connectedPlatforms.push("Webflow");

    return {
      totalAcrossTabs: activeFindings.length,
      inPlanCount: queuedOrActive.length,
      prCount,
      cmsFixCount: cmsRunIds.size,
      appliedTotal,
      connectedPlatformsLabel:
        connectedPlatforms.length > 0
          ? connectedPlatforms.join(" · ")
          : "GitHub, WP, Shopify, Webflow",
      beforeAfterCount: prChanges.length + proofCards.filter((c) => !c.after?.pullRequestUrl).length,
      verifiedCount: verifiedOrResolved,
      pagesAndFiles: distinctPagesAndFiles,
    };
  }, [
    allFindings,
    prChanges,
    runs,
    changeReports,
    proofCards,
    ledgerEvents,
    connectedRepo,
    wpQuery.data?.connected,
    shopifyQuery.data?.connected,
    webflowQuery.data?.connected,
  ]);

  const runPlanFixesMutation = useMutation({
    mutationFn: async (payload: { findingIds?: string[]; sourceModule?: string }) => {
      const candidates =
        payload.findingIds && payload.findingIds.length > 0
          ? allFindings.filter((f) => payload.findingIds!.includes(f.id))
          : filteredFindings.slice(0, 6);

      if (candidates.length === 0) {
        throw new Error("Select at least one finding in Fix Engine to apply via GitHub.");
      }
      // Create the run first. If the request is rejected, findings must remain in
      // their current lifecycle state instead of getting stranded in the Fix Plan.
      const run = await api.runPlanFixes(projectId!, {
        ...payload,
        findingIds: candidates.map((finding) => finding.id),
      });

      // The run now exists; move newly detected findings into the plan.
      await Promise.allSettled(
        candidates
          .filter((f) => (f.lifecycle ?? "DETECTED") === "DETECTED")
          .map((f) => api.transitionFinding(projectId!, f.id, { to: "QUEUED" })),
      );
      return run;
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
            : run.status === "PENDING" ? "Audit fixes are queued. The worker will prepare a draft PR for preview review." : `Draft PR prepared with ${run.filesChanged.length} changed file(s). Preview verification is required.`,
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
        instruction.trim(),
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

  const dismissRunMutation = useMutation({
    mutationFn: (runId: string) => api.dismissAutomationRun(projectId!, runId),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const dismissAllFailedMutation = useMutation({
    mutationFn: (runIds: string[]) => api.dismissFailedAutomationRuns(projectId!, runIds),
    onSuccess: () => {
      setActionBanner({
        tone: "good",
        text: "Cleared failed runs from your Fix Engine history.",
      });
      invalidateAll();
    },
  });

  const disconnectRepoMutation = useMutation({
    mutationFn: () => api.disconnectRepository(projectId!),
    onSuccess: () => {
      setActionBanner({
        tone: "good",
        text: `Disconnected repository from ${domain || "this workspace"} and cleared mismatched task history.`,
      });
      invalidateAll();
    },
    onError: (err) => {
      setActionBanner({ tone: "bad", text: errorMessage(err) });
    },
  });

  useEffect(() => {
    const now = Date.now();
    for (const report of changeReports) {
      if (report.reviewState !== "MERGED" || report.changes.length === 0) continue;
      const needsCheck = report.changes.some((change) =>
        change.verification === "NOT_CHECKED" || change.verification === "DIFFERENT",
      );
      if (!needsCheck || now - (autoVerificationAttempts.current.get(report.id) ?? 0) < 60_000) continue;
      autoVerificationAttempts.current.set(report.id, now);
      verifyLiveMutation.mutate(report.id);
    }
  }, [changeReports, verifyLiveMutation]);

  const readyLowRiskGroups = (issueGroups.data?.groups ?? []).filter((g) => g.aiFixAvailable);

  const toggleSelectFinding = (id: string) => {
    if (!selectedFindingIds.includes(id) && selectedFindingIds.length >= 8) {
      setActionBanner({
        tone: "bad",
        text: "GitHub can process up to 8 findings per run. Remove a selected finding before adding another.",
      });
      return;
    }
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
    // A row action is a single-finding action; replace any prior batch selection.
    setSelectedFindingIds([finding.id]);
    const priorRun = findingRunMap.get(finding.id);
    if (priorRun?.status === "FAILED") {
      const priorCtx = resolveRunContext(priorRun, allFindings);
      dismissRunMutation.mutate(priorRun.id);
      setSubSection("GITHUB_RUNNER");
      runEngineerMutation.mutate(buildDirectEditRetryInstruction(priorCtx));
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
      `- Live Matches / Manually Confirmed Findings: ${kpiStats.verifiedCount}`,
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

    lines.push(`## 2. Pull Request Summary (${pullRequestLog.length})`);
    for (const entry of pullRequestLog) {
      lines.push(
        `- **${entry.reviewState}** ${entry.title} · ${entry.prUrl} · ${entry.files.length} changed files · ${entry.report?.changes.filter((change) => change.verification === "MATCHED").length ?? 0} live checks matched`,
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
  const trackedReport = trackedRun ? changeReports.find((report) => report.id === trackedRun.id) : null;
  const trackedRunMerged = trackedReport?.reviewState === "MERGED" || trackedRun?.status === "MERGED";
  const trackedRunVerified = Boolean(trackedReport?.changes.length) && trackedReport!.changes.every((change) => change.verification === "MATCHED");

  return (
    <div className="space-y-6">
      {runs.some((run) => run.filesChanged.length > 0 && run.filesChanged.every((file) => /(^|\/)seo-fix-[^/]+\.[jt]sx?$/.test(file))) && (
        <StatusNote tone="bad">
          Earlier runs created only audit-message placeholder files. Those pull requests do not implement a website fix. Re-run the affected findings and review the actual page changes before merging or confirming them fixed.
        </StatusNote>
      )}
      {repoMismatchInfo && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning-200 bg-warning-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[12.5px] font-bold text-warning-700">
              Repository mismatch detected for {repoMismatchInfo.projectDomain}
            </p>
            <p className="text-[11.5px] text-warning-700">
              Connected repository <strong>{repoMismatchInfo.repoName}</strong> contains code for{" "}
              <strong>{repoMismatchInfo.repoDomain}</strong>, while you are viewing{" "}
              <strong>{repoMismatchInfo.projectDomain}</strong>. Connect the{" "}
              <strong>{repoMismatchInfo.projectDomain}</strong> repository before running GitHub PR fixes, or apply/verify changes via CMS &amp; Live Site.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <ActionButton
              variant="primary"
              disabled={disconnectRepoMutation.isPending}
              icon={<CircleX size={12} />}
              onClick={() => disconnectRepoMutation.mutate()}
            >
              {disconnectRepoMutation.isPending ? "Disconnecting…" : "Disconnect Repo from this Workspace"}
            </ActionButton>
            <ActionButton
              variant="secondary"
              icon={<GitBranch size={12} />}
              onClick={() => {
                setSubSection("ALL");
                setShowRepoConnect(true);
              }}
            >
              Change GitHub Repo
            </ActionButton>
            {failedTaskRuns.some((r) => r.ctx.isRepoDomainMismatch) && (
              <ActionButton
                variant="secondary"
                disabled={dismissAllFailedMutation.isPending}
                icon={<CircleX size={12} />}
                onClick={() =>
                  dismissAllFailedMutation.mutate(
                    failedTaskRuns.filter((r) => r.ctx.isRepoDomainMismatch).map((r) => r.run.id),
                  )
                }
              >
                Clear Mismatched Runs
              </ActionButton>
            )}
            <ActionButton
              variant="secondary"
              icon={<Globe size={12} />}
              onClick={() => setCmsFinding(filteredFindings[0] ?? null)}
            >
              Apply / Verify via CMS
            </ActionButton>
          </div>
        </div>
      )}
      {trackedRun && trackedRun.status !== "RUNNING" ? (
        <StatusNote tone={trackedRunVerified ? "good" : trackedRunMerged ? "warn" : trackedRun.status === "AWAITING_REVIEW" ? "info" : "bad"}>
          {trackedRunVerified
            ? `✓ Live fix verified for "${trackedRunCtx?.headline ?? "your requested fix"}". The affected page now shows the expected change.`
            : trackedRunMerged
              ? `PR merged for "${trackedRunCtx?.headline ?? "your requested fix"}". Reigel is checking the live page automatically; the fix is not marked complete until that check passes.`
            : trackedRun.status === "AWAITING_REVIEW"
            ? `Change prepared for "${trackedRunCtx?.headline ?? "your requested fix"}"${
                trackedRun.filesChanged.length > 0
                  ? ` across ${trackedRun.filesChanged.length} file(s) (${trackedRun.filesChanged.join(", ")})`
                  : ""
              }. The PR is open; merge it to deploy. Reigel will verify the live page after GitHub confirms the merge.`
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
          label="In Improvement Plan"
          value={count(kpiStats.inPlanCount)}
          tone={kpiStats.inPlanCount > 0 ? "good" : "default"}
          sub="Queued for GitHub or CMS"
        />
        <Kpi
          label="Applied Fixes & PRs"
          value={count(kpiStats.appliedTotal)}
          tone={kpiStats.appliedTotal > 0 ? "good" : "default"}
          sub={kpiStats.connectedPlatformsLabel}
        />
        <Kpi
          label="Before & After Records"
          value={count(kpiStats.beforeAfterCount)}
          sub="GitHub PRs & CMS updates"
        />
        <Kpi
          label="Checks Confirmed"
          value={count(kpiStats.verifiedCount)}
          tone={kpiStats.verifiedCount > 0 ? "good" : "default"}
          sub="Live matches across platforms"
        />
        <Kpi
          label="Pages & Files Tracked"
          value={count(kpiStats.pagesAndFiles)}
          sub="In PRs & CMS updates"
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
            icon={<Globe size={12} />}
            onClick={() => setCmsFinding(null)}
          >
            Apply via CMS / Platform
          </ActionButton>
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
              { id: "ALL", label: "Issues & Fix Plan", icon: Layers },
              { id: "GITHUB_RUNNER", label: "Deployment Runs", icon: GitPullRequest },
              { id: "BEFORE_AFTER", label: "Before & After Proof", icon: GitCompare },
              { id: "IMPROVEMENT_LOG", label: "Improvement Log", icon: History },
              { id: "FAILED", label: "Failed", icon: CircleX },
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
                {item.id === "FAILED" && failedTaskRuns.length > 0 && (
                  <span className="rounded-full bg-error-50 px-1.5 py-0.5 text-[10px] text-error-700">
                    {failedTaskRuns.length}
                  </span>
                )}
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
          SECTION A: FIX ALL TABS ISSUES ACROSS PLATFORMS (CMS + GITHUB)
         ===================================================================== */}
      {(subSection === "ALL" || subSection === "GITHUB_RUNNER") && (
        <Panel
          title={subSection === "ALL" ? "Issues and improvement plan" : "Deployment & automation runs"}
          subtitle={
            subSection === "ALL"
              ? "Select findings from your connected sources and apply them via WordPress, Shopify, Webflow, Manual CMS, or a GitHub Pull Request."
              : "Follow active GitHub PR runs and CMS updates. Review completed changes in the Improvement Log."
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {wpQuery.data?.connected && (
                <Pill tone="good">WordPress · {wpQuery.data.siteUrl}</Pill>
              )}
              {shopifyQuery.data?.connected && (
                <Pill tone="good">Shopify · {shopifyQuery.data.shopDomain}</Pill>
              )}
              {webflowQuery.data?.connected && (
                <Pill tone="good">Webflow · {webflowQuery.data.siteName || webflowQuery.data.siteId}</Pill>
              )}
              <button
                type="button"
                onClick={() => setCmsModalPlatform("wordpress")}
                className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
              >
                {wpQuery.data?.connected || shopifyQuery.data?.connected || webflowQuery.data?.connected
                  ? "Manage CMS"
                  : "+ Connect WP / Shopify / Webflow"}
              </button>
              {connectedRepo ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={repoMismatchInfo ? "warn" : "good"}>GitHub · {connectedRepo.owner}/{connectedRepo.name}</Pill>
                  <button
                    type="button"
                    onClick={() => setShowRepoConnect((v) => !v)}
                    className="text-[11px] font-semibold text-accent-700 hover:underline"
                  >
                    {showRepoConnect ? "Hide GitHub" : "Change repo"}
                  </button>
                  <button
                    type="button"
                    disabled={disconnectRepoMutation.isPending}
                    onClick={() => disconnectRepoMutation.mutate()}
                    className="text-[11px] font-semibold text-error-600 hover:underline disabled:opacity-50"
                  >
                    {disconnectRepoMutation.isPending ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRepoConnect((v) => !v)}
                  className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
                >
                  {showRepoConnect ? "Hide GitHub setup" : "+ Connect GitHub"}
                </button>
              )}
            </div>
          }
        >
          <div className="space-y-4 p-4">
            {showRepoConnect && (
              <div className="rounded-xl border bg-brand-50/40 p-4">
                <RepoConnectForm
                  projectId={projectId}
                  projectDomain={domain}
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
            {subSection === "GITHUB_RUNNER" && visibleTaskRuns.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-brand-500">
                    Active Deployment Tasks ({count(visibleTaskRuns.length)})
                  </span>
                  <span className="text-[11px] text-brand-400">
                    {isEngineerBusy ? "Auto-updating every 7.5s…" : "All tasks finished"}
                  </span>
                </div>

                {visibleTaskRuns.map(({ run, ctx }) => {
                  const isRunning = ["PENDING", "RUNNING"].includes(run.status);
                  const isPlaceholder = run.filesChanged.length > 0 && run.filesChanged.every((file) => /(^|\/)seo-fix-[^/]+\.[jt]sx?$/.test(file));
                  const isSuccess = run.status === "AWAITING_REVIEW" && !isPlaceholder;
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
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-0.5 text-[11px] font-bold text-warning-700">
                                <RefreshCw size={11} className="animate-spin" />
                                {run.status === "PENDING" ? "TASK QUEUED" : "TASK IN PROGRESS"}
                              </span>
                            ) : isSuccess ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-0.5 text-[11px] font-bold text-success-700">
                                <CheckCircle2 size={12} />
                                {run.pullRequestUrl ? "DRAFT PR · PREVIEW REVIEW REQUIRED" : "RUN FINISHED"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-error-50 px-2.5 py-0.5 text-[11px] font-bold text-error-700">
                                {isPlaceholder ? "PLACEHOLDER ONLY · RE-RUN REQUIRED" : "TASK FINISHED WITHOUT PR · RETRY AVAILABLE"}
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
                            ? "text-warning-700"
                            : isSuccess
                              ? "text-success-700"
                              : "text-error-700",
                        )}
                      >
                        {isRunning
                          ? (run.status === "PENDING" ? "Your fix is saved in the queue. It will start when worker capacity is available." : "The engineer is preparing a proposed change. A PR is not evidence that the issue is fixed.")
                          : isPlaceholder
                            ? "This run added an audit message rather than changing the affected website pages. Its completion summary is not evidence of a fix."
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
                          <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 border">
                            <GitBranch size={11} /> {run.branch}
                          </span>
                        )}
                        {run.filesChanged.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 border text-success-700">
                            <FileCode size={11} /> Modified ({run.filesChanged.length}):{" "}
                            {run.filesChanged.join(", ")}
                          </span>
                        )}
                        {run.filesChanged.length === 0 && ctx.inspectedFiles.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 border text-brand-600">
                            <FileCode size={11} /> Inspected: {ctx.inspectedFiles.join(", ")}
                          </span>
                        )}
                      </div>

                      {/* Step-by-Step Execution Log */}
                      {run.steps.length > 0 && (
                        <div className="rounded-lg border bg-surface-2 p-2.5 space-y-1">
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
                                      reason: `Manually confirmed by the site owner for GitHub Run #${run.id.slice(0, 8)}`,
                                    });
                                  }
                                  setActionBanner({
                                    tone: "good",
                                    text: `Marked "${ctx.headline}" as Confirmed Fixed!`,
                                  });
                                }}
                              >
                                Manually Confirm Fixed
                              </ActionButton>
                            )}
                            {!isSuccess && (
                              <ActionButton
                                variant="primary"
                                disabled={
                                  isEngineerBusy ||
                                  runPlanFixesMutation.isPending ||
                                  runEngineerMutation.isPending
                                }
                                icon={<RefreshCw size={12} />}
                                onClick={() => {
                                  dismissRunMutation.mutate(run.id);
                                  setSubSection("GITHUB_RUNNER");
                                  runEngineerMutation.mutate(buildDirectEditRetryInstruction(ctx));
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

            {subSection === "ALL" && <>
            {/* Batch Action Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-brand-50/50 p-3.5">
              <div className="space-y-0.5">
                <p className="text-[12.5px] font-semibold text-brand-950">
                  {selectedFindingIds.length > 8
                    ? "Select up to 8 findings per batch run"
                    : selectedFindingIds.length > 0
                      ? `${count(selectedFindingIds.length)} of 8 findings selected`
                      : `Select findings below from ${moduleFilter === "ALL" ? "all 5 tabs" : GROUPS.find((g) => g.id === moduleFilter)?.label ?? moduleFilter} to apply via CMS or GitHub`}
                </p>
                <p className="text-[11.5px] text-brand-500">
                  Stage or publish changes directly via <strong>WordPress</strong>, <strong>Shopify</strong>, <strong>Webflow</strong>, or <strong>Manual CMS</strong>, or open an automated <strong>GitHub Pull Request</strong> with Before &amp; After proof.
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
                <ActionButton
                  variant="secondary"
                  icon={<Globe size={12} />}
                  onClick={() => {
                    const firstSelected = selectedFindingIds.length > 0
                      ? allFindings.find((f) => f.id === selectedFindingIds[0]) ?? null
                      : filteredFindings[0] ?? null;
                    setCmsFinding(firstSelected);
                  }}
                >
                  Apply via CMS (WP / Shopify / Webflow)
                </ActionButton>
                {readyLowRiskGroups.length > 0 && connectedRepo && (
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
                    Boolean(repoMismatchInfo) ||
                    isEngineerBusy ||
                    runPlanFixesMutation.isPending ||
                    selectedFindingIds.length > 8 ||
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
                    : repoMismatchInfo
                      ? "Resolve Repo Mismatch to Fix"
                      : selectedFindingIds.length > 0
                        ? `Fix ${count(selectedFindingIds.length)} Selected via GitHub PR`
                        : `Queue next 8 ${moduleFilter === "ALL" ? "plan" : GROUPS.find((g) => g.id === moduleFilter)?.label} findings`}
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
                      c.findingTitle === f.title,
                  );
                  const prUrl = fRun?.pullRequestUrl || matchedPr?.pullRequestUrl || null;
                  const isTaskComplete = matchedPr?.verification === "MATCHED";
                  const isConfirmedByWorkflow = ["VERIFIED", "MEASURED", "RESOLVED"].includes(lc);
                  const isPrMerged = matchedPr?.reviewState === "MERGED";
                  const isPrAwaitingMerge = Boolean(prUrl) && !isPrMerged && !isTaskComplete;
                  const isTaskRunning = ["PENDING", "RUNNING"].includes(fRun?.status ?? "");
                  const isTaskFailed = fRun?.status === "FAILED" && !isTaskComplete;

                  return (
                    <div
                      key={f.id}
                        className={cn(
                        "flex flex-col gap-2 px-4 py-3 transition-colors sm:flex-row sm:items-center sm:justify-between",
                        checked
                          ? "bg-primary-50/40"
                            : isTaskComplete || isConfirmedByWorkflow
                            ? "bg-success-50/20 hover:bg-success-50/40"
                            : "hover:bg-brand-50/40",
                      )}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && selectedFindingIds.length >= 8}
                          onChange={() => toggleSelectFinding(f.id)}
                          className="mt-1 h-4 w-4 rounded border-brand-300 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
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
                              <Pill tone="warn">⟳ Task Running…</Pill>
                            ) : isTaskComplete || isConfirmedByWorkflow ? (
                              <Pill tone="good">
                                ✓ {isTaskComplete ? "Verified Live" : "Confirmed Fixed"}
                              </Pill>
                            ) : isPrMerged ? (
                              <Pill tone={matchedPr?.verification === "UNSUPPORTED" ? "warn" : "warn"}>
                                {matchedPr?.verification === "UNSUPPORTED" ? "Merged · Manual Check Needed" : "Merged · Checking Live Site"}
                              </Pill>
                            ) : isPrAwaitingMerge ? (
                              <Pill tone="info">PR Open · Waiting for Merge</Pill>
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
                            className="inline-flex items-center gap-1 rounded-lg border border-success-300 bg-success-50 px-2.5 py-1 text-[11.5px] font-semibold text-success-700 hover:bg-success-100"
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
                                  reason: "Confirmed fixed in Fix Engine",
                                })
                              }
                            >
                              Confirm Fixed
                            </ActionButton>
                          )}
                        <ActionButton
                          variant="secondary"
                          icon={<Globe size={12} />}
                          onClick={() => setCmsFinding(f)}
                        >
                          Apply via CMS
                        </ActionButton>
                        {(!prUrl || isTaskComplete || isConfirmedByWorkflow) && (
                          <ActionButton
                            variant={isTaskComplete || isConfirmedByWorkflow ? "secondary" : "primary"}
                            disabled={isEngineerBusy || runPlanFixesMutation.isPending}
                            icon={<GitPullRequest size={12} />}
                            onClick={() => handleFixFindingWithGitHub(f)}
                          >
                            {isTaskRunning
                              ? "Fixing on GitHub…"
                            : isTaskComplete || isConfirmedByWorkflow
                                ? "Re-run on GitHub"
                                : isTaskFailed
                                  ? "Retry on GitHub"
                                  : "GitHub PR"}
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            </>}

            {subSection === "GITHUB_RUNNER" && visibleTaskRuns.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-brand-500">
                No active deployment task is currently running. Completed GitHub PRs and CMS updates appear in <strong>Before &amp; After Proof</strong> and <strong>Improvement Log</strong>.
              </div>
            )}

            {subSection === "GITHUB_RUNNER" && <>
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
                  icon={<Wrench size={12} />}
                  onClick={() => runEngineerMutation.mutate(engineerPrompt.trim())}
                >
                  {runEngineerMutation.isPending ? "Starting Engineer…" : "Run on GitHub & Open PR"}
                </ActionButton>
              </div>
            </div>
            </>}
          </div>
        </Panel>
      )}

      {/* =====================================================================
          SECTION B: BEFORE & AFTER COMPARISONS (CMS + GITHUB)
         ===================================================================== */}
      {subSection === "BEFORE_AFTER" && (
        <Panel
          title="Before & After Proof"
          subtitle="Recorded before and after changes across WordPress, Shopify, Webflow, Manual CMS, and GitHub Pull Requests. Live verification is confirmed directly on your website."
        >
          <div className="space-y-6 p-4">
            {/* Part 1: CMS & Live HTML Proof Cards */}
            {proofCards.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12px] font-bold uppercase tracking-[0.06em] text-brand-500">
                    CMS &amp; Live Website Before / After Proof ({count(proofCards.length)})
                  </h3>
                  <ActionButton
                    icon={<Globe size={12} />}
                    onClick={() => setCmsFinding(null)}
                  >
                    + Stage or Verify CMS Change
                  </ActionButton>
                </div>

                <div className="space-y-3">
                  {proofCards.map((card) => (
                    <div
                      key={card.runId}
                      className="rounded-xl border bg-white p-4 shadow-2xs space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone="info">{card.file || "CMS Update"}</Pill>
                          <span className="text-[13px] font-bold text-brand-950">
                            {card.title}
                          </span>
                          <Pill
                            tone={
                              card.after?.verificationStatus === "VERIFIED"
                                ? "good"
                                : "warn"
                            }
                          >
                            {card.after?.verificationStatus === "VERIFIED"
                              ? "Verified Live on Website"
                              : "Staged / Pending Live Check"}
                          </Pill>
                        </div>
                        {card.after?.pullRequestUrl && (
                          <a
                            href={card.after.pullRequestUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-[11.5px] font-semibold text-accent-700 hover:bg-brand-50"
                          >
                            Open in Admin / PR <ExternalLink size={10} />
                          </a>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-brand-500">
                        {card.url && (
                          <span>
                            Page:{" "}
                            <a
                              href={card.url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-accent-700 hover:underline"
                            >
                              {card.url}
                            </a>
                          </span>
                        )}
                        <span>Field: {FIELD_LABELS[card.field] || card.field}</span>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-error-200/70 bg-error-50/50 p-3">
                          <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.06em] text-error-700">
                            Before ({card.before?.timeframe || "Baseline"})
                          </span>
                          <p className="whitespace-pre-wrap break-words font-mono text-[11.5px] text-error-700">
                            {card.before?.text || "<not set / baseline before fix>"}
                          </p>
                        </div>

                        <div className="rounded-lg border border-success-200/70 bg-success-50/50 p-3">
                          <span className="mb-1 block text-[10.5px] font-bold uppercase tracking-[0.06em] text-success-700">
                            After ({card.after?.timeframe || "Updated"})
                          </span>
                          <p className="whitespace-pre-wrap break-words font-mono text-[11.5px] text-success-700">
                            {card.after?.text || "<updated value>"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Part 2: Recorded GitHub PR Before & After Changes */}
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
                                : ch.reviewState === "OPEN" ? "Open for review" : "PR status unavailable"}
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
                          <p className="whitespace-pre-wrap break-words font-mono text-[11.5px] text-error-700">
                            {ch.before || "<not set / missing before fix>"}
                          </p>
                        </div>

                        <div className="rounded-lg border border-success-200/70 bg-success-50/50 p-3">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-success-700">
                              After ({ch.reviewState === "MERGED" ? "Merged code" : "Proposed in GitHub PR"})
                            </span>
                            {ch.checkedAt && (
                              <span className="font-mono text-[10px] text-success-700">
                                Checked {new Date(ch.checkedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <p className="whitespace-pre-wrap break-words font-mono text-[11.5px] text-success-700">
                            {ch.after}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2 text-[12px] text-brand-600">
                        <p>
                          <strong className="text-brand-950">Reason for this change: </strong>
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

            {filteredPrChanges.length === 0 && proofCards.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-[12px] text-brand-500">
                No recorded Before &amp; After changes match this filter yet. Apply a finding via <strong>WordPress</strong>, <strong>Shopify</strong>, <strong>Webflow</strong>, <strong>Manual CMS</strong>, or <strong>GitHub PR</strong> to record Before &amp; After proof.
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* =====================================================================
          SECTION C: COMPLETE IMPROVEMENT LOG (CMS + GITHUB)
         ===================================================================== */}
      {subSection === "IMPROVEMENT_LOG" && (
        <Panel
          title="Improvement Log"
          subtitle="Chronological history of updates applied via WordPress, Shopify, Webflow, Manual CMS, and GitHub Pull Requests."
        >
          <div className="space-y-4 p-4">
            {/* CMS & Platform Ledger Entries */}
            {ledgerEvents.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-brand-500">
                  CMS &amp; Website Activity Ledger ({count(ledgerEvents.length)})
                </h3>
                {ledgerEvents.map((ev) => (
                  <article key={ev.id} className="space-y-2 rounded-xl border bg-white p-4 shadow-2xs">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone="info">{ev.actor || "CMS"}</Pill>
                          <Pill tone={ev.verificationStatus === "VERIFIED" ? "good" : "warn"}>
                            {ev.verificationStatus === "VERIFIED" ? "Verified Live" : ev.eventType}
                          </Pill>
                          <span className="font-mono text-[11px] text-brand-400">
                            {new Date(ev.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <h4 className="text-[13px] font-bold text-brand-950">{ev.title}</h4>
                        <p className="text-[12px] text-brand-600">{ev.description}</p>
                        {ev.affectedUrl && (
                          <p className="font-mono text-[11px] text-brand-500">Target URL: {ev.affectedUrl}</p>
                        )}
                      </div>
                      {ev.pullRequestUrl && (
                        <a
                          href={ev.pullRequestUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-[11.5px] font-semibold text-accent-700 hover:bg-brand-50"
                        >
                          Open Link <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* GitHub Pull Requests */}
            {pullRequestLog.length === 0 && ledgerEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-[12px] text-brand-500">
                No applied improvements recorded yet. Apply a finding under <strong>Issues &amp; Fix Plan</strong> via CMS (WordPress / Shopify / Webflow / Manual) or GitHub PR.
              </div>
            ) : pullRequestLog.map((item) => {
              const changes = item.report?.changes ?? [];
              const verifiedCount = changes.filter((change) => change.verification === "MATCHED").length;
              const isMerged = item.reviewState === "MERGED";
              return (
                <article key={item.prUrl} className="space-y-3 rounded-xl border bg-white p-4 shadow-2xs">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone="info">{item.moduleLabel}</Pill>
                        <Pill tone={isMerged ? "good" : item.reviewState === "OPEN" ? "warn" : "default"}>
                          {isMerged ? "Merged" : item.reviewState === "OPEN" ? "Review needed" : "Status unavailable"}
                        </Pill>
                        {isMerged && verifiedCount > 0 && <Pill tone="good">{verifiedCount} live checked</Pill>}
                      </div>
                      <h3 className="text-[13px] font-bold text-brand-950">{item.title}</h3>
                      <p className="text-[11px] text-brand-500">
                        {isMerged
                          ? `Merged ${item.report?.mergedAt ? new Date(item.report.mergedAt).toLocaleString() : "on GitHub"} · ${item.files.length} file(s) recorded`
                          : item.reviewState === "OPEN"
                            ? `Pull request ready for review · ${item.files.length} file(s) recorded`
                            : "Check GitHub for the current pull request status"}
                      </p>
                    </div>
                    <a href={item.prUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-[11.5px] font-semibold text-accent-700 hover:bg-brand-50">
                      <GitPullRequest size={13} /> {item.reviewState === "OPEN" ? "Review & merge on GitHub" : "View pull request"} <ExternalLink size={11} />
                    </a>
                  </div>
                  {item.files.length > 0 && <p className="break-all font-mono text-[10.5px] text-brand-500">{item.files.join(" · ")}</p>}
                  {changes.length > 0 ? (
                    <details className="rounded-lg border bg-brand-50/40 px-3 py-2 text-[11.5px] text-brand-700">
                      <summary className="cursor-pointer font-semibold">View {changes.length} recorded change{changes.length === 1 ? "" : "s"} and proof</summary>
                      <div className="mt-3 space-y-3">
                        {changes.map((change, index) => (
                          <div key={`${change.file}-${change.field}-${index}`} className="rounded-lg border bg-white p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-brand-900">{change.findingTitle || FIELD_LABELS[change.field] || change.field}</span>
                              <Pill tone={isMerged && change.verification === "MATCHED" ? "good" : "default"}>
                                {isMerged && change.verification === "MATCHED" ? "Matched on live page" : change.verification === "UNSUPPORTED" ? "Live check unavailable" : "Live result unverified"}
                              </Pill>
                            </div>
                            <p className="mt-1 break-all font-mono text-[10px] text-brand-500">{change.file}{change.url ? ` · ${change.url}` : ""}</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <div className="rounded border border-error-200/60 bg-error-50/40 p-2"><span className="block font-bold text-error-700">Before</span><span className="break-words font-mono">{change.before ?? "No saved baseline"}</span></div>
                              <div className="rounded border border-success-200/60 bg-success-50/40 p-2"><span className="block font-bold text-success-700">{isMerged ? "Merged change" : "Proposed change"}</span><span className="break-words font-mono">{change.after}</span></div>
                            </div>
                            {isMerged && change.verification === "MATCHED" && change.checkedAt && <p className="mt-2 text-success-700">Live page matched on {new Date(change.checkedAt).toLocaleString()}{change.liveValue ? ` · ${change.liveValue}` : ""}</p>}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : (
                    <p className="text-[11px] text-brand-500">Detailed change evidence is unavailable here. Open the pull request to review its files and checks.</p>
                  )}
                </article>
              );
            })}
          </div>
        </Panel>
      )}
      {/* =====================================================================
          SECTION D: FAILED TASKS
         ===================================================================== */}
      {subSection === "FAILED" && (
        <Panel
          title={`Failed tasks (${failedTaskRuns.length})`}
          subtitle="Only unsuccessful runs appear here. Their findings remain open until a change is prepared, reviewed, and confirmed."
          actions={
            failedTaskRuns.length > 0 ? (
              <ActionButton
                disabled={dismissAllFailedMutation.isPending}
                icon={<CircleX size={12} />}
                onClick={() =>
                  dismissAllFailedMutation.mutate(failedTaskRuns.map(({ run }) => run.id))
                }
              >
                Clear all failed ({failedTaskRuns.length})
              </ActionButton>
            ) : undefined
          }
        >
          {failedTaskRuns.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <CircleX size={22} className="mx-auto text-brand-400" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-brand-800">No failed tasks</p>
              <p className="mt-1 text-xs text-brand-500">Failed runs will be collected here for review and retry.</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {failedTaskRuns.map(({ run, ctx }) => {
                const targetUrlForRun =
                  ctx.matchedFindings[0]?.affectedPages?.[0] ||
                  (ctx.headline.toLowerCase().includes("sitemap") && domain
                    ? `https://${domain}/sitemap.xml`
                    : domain
                      ? `https://${domain}`
                      : "");
                const synthesizedFinding: GrowthOpportunity = ctx.matchedFindings[0] ?? {
                  id: `run-${run.id}`,
                  source: ctx.moduleId,
                  title: ctx.headline,
                  summary: run.error || ctx.headline,
                  recommendedAction:
                    ctx.rawInstruction ||
                    `Ensure ${targetUrlForRun || "the target page"} uses the canonical domain ${domain ?? ""}.`,
                  affectedPages: targetUrlForRun ? [targetUrlForRun] : [],
                  potential: "HIGH",
                  effort: "LOW",
                  priority: 90,
                  status: "OPEN",
                  lifecycle: "DETECTED",
                };

                return (
                <article key={run.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone="bad">Failed</Pill>
                        <Pill tone="info">{ctx.moduleLabel}</Pill>
                        {ctx.isRepoDomainMismatch && (
                          <Pill tone="warn">Repository / Domain Mismatch</Pill>
                        )}
                        <span className="font-mono text-[11px] text-brand-500">Run #{run.id.slice(0, 8)}</span>
                      </div>
                      <h3 className="text-sm font-semibold text-brand-950">{ctx.headline}</h3>
                    </div>
                    <span className="font-mono text-[11px] text-brand-500">
                      {run.finishedAt ? relativeTime(run.finishedAt) : relativeTime(run.startedAt)}
                    </span>
                  </div>

                  <p className="rounded-lg border border-error-200/70 bg-error-50/50 px-3 py-2 text-sm leading-5 text-error-700">
                    {run.error || "This run ended before it created a reviewable pull request."}
                  </p>

                  {(ctx.isRepoDomainMismatch || ctx.isNoChangesNeeded || ctx.hasMetadataToolFailure) && (
                    <div className="rounded-lg border border-warning-200 bg-warning-50/60 px-3.5 py-2.5 text-xs leading-5 text-warning-700">
                      <strong className="font-bold">Why this happened &amp; how to fix it: </strong>
                      {ctx.isRepoDomainMismatch ? (
                        <>
                          The connected GitHub repository{" "}
                          {connectedRepo ? (
                            <strong>
                              ({connectedRepo.owner}/{connectedRepo.name})
                            </strong>
                          ) : null}{" "}
                          uses the domain{" "}
                          <strong>{ctx.detectedRepoDomain || "another project"}</strong>, while this
                          workspace is <strong>{domain || "a different domain"}</strong>. Click{" "}
                          <strong>Change GitHub Repo</strong> below to connect the repository for{" "}
                          <strong>{domain || "this site"}</strong>, or click{" "}
                          <strong>Verify / Apply via CMS</strong> to verify the live site directly.
                        </>
                      ) : ctx.hasMetadataToolFailure ? (
                        <>
                          The automated <code>metadata</code> route patcher encountered a sub-screen or{" "}
                          <code>export default function</code> component. Click{" "}
                          <strong>Retry with GitHub</strong> below to automatically switch the engineer
                          to direct JSX component editing (<code>edit</code> mode) and open your Pull
                          Request, or click <strong>Verify / Apply via CMS</strong>.
                        </>
                      ) : (
                        <>
                          The engineer inspected the repository and found that the files already match
                          the repository&apos;s domain configuration. You can verify the live website directly
                          or confirm this finding as fixed below.
                        </>
                      )}
                    </div>
                  )}

                  {run.steps.length > 0 && (
                    <details className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-semibold text-brand-700">
                        View execution details ({run.steps.length})
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {run.steps.slice(-8).map((step, index) => (
                          <li key={index} className="break-words font-mono text-[11px] leading-5 text-brand-700">
                            <span className={step.ok ? "font-bold text-success-700" : "font-bold text-error-700"}>
                              {step.ok ? "✓" : "✗"}
                            </span>{" "}
                            <span className="font-semibold">{step.step}</span>
                            {step.detail ? `: ${step.detail.slice(0, 220)}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {ctx.isRepoDomainMismatch && (
                        <>
                          <ActionButton
                            variant="primary"
                            disabled={disconnectRepoMutation.isPending}
                            icon={<CircleX size={12} />}
                            onClick={() => {
                              disconnectRepoMutation.mutate();
                              dismissRunMutation.mutate(run.id);
                            }}
                          >
                            Disconnect Repo &amp; Clear
                          </ActionButton>
                          <ActionButton
                            variant="secondary"
                            icon={<GitBranch size={12} />}
                            onClick={() => {
                              setSubSection("ALL");
                              setShowRepoConnect(true);
                            }}
                          >
                            Change GitHub Repo
                          </ActionButton>
                        </>
                      )}
                      <ActionButton
                        variant="secondary"
                        icon={<Globe size={12} />}
                        onClick={() => setCmsFinding(synthesizedFinding)}
                      >
                        Verify / Apply via CMS
                      </ActionButton>
                      <ActionButton
                        variant={ctx.isRepoDomainMismatch ? "secondary" : "primary"}
                        disabled={
                          isEngineerBusy ||
                          runPlanFixesMutation.isPending ||
                          runEngineerMutation.isPending ||
                          (!ctx.matchedFindings.length && !ctx.rawInstruction.trim())
                        }
                        icon={<RefreshCw size={12} />}
                        onClick={() => {
                          dismissRunMutation.mutate(run.id);
                          setSubSection("GITHUB_RUNNER");
                          runEngineerMutation.mutate(buildDirectEditRetryInstruction(ctx));
                        }}
                      >
                        Retry with GitHub
                      </ActionButton>
                      <ActionButton
                        icon={<CheckCircle2 size={12} />}
                        onClick={() => {
                          for (const mf of ctx.matchedFindings) {
                            transition.mutate({
                              id: mf.id,
                              to: "RESOLVED",
                              reason: `Confirmed resolved in Fix Engine (cleared Run #${run.id.slice(0, 8)})`,
                            });
                          }
                          dismissRunMutation.mutate(run.id);
                          setActionBanner({
                            tone: "good",
                            text: `Marked "${ctx.headline}" as Confirmed Fixed and cleared the failed run.`,
                          });
                        }}
                      >
                        Confirm Fixed &amp; Clear
                      </ActionButton>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <ActionButton
                        icon={<CircleX size={12} />}
                        disabled={dismissRunMutation.isPending}
                        onClick={() => dismissRunMutation.mutate(run.id)}
                      >
                        Dismiss
                      </ActionButton>
                      <ActionButton onClick={() => setSubSection("IMPROVEMENT_LOG")}>
                        Open improvement log
                      </ActionButton>
                    </div>
                  </div>
                </article>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {cmsFinding !== undefined && (
        <CmsApplyModal
          projectId={projectId}
          domain={domain}
          finding={cmsFinding}
          onClose={() => {
            setCmsFinding(undefined);
            invalidateAll();
          }}
        />
      )}

      {cmsModalPlatform && (
        <WordPressConnectModal
          projectId={projectId}
          initialPlatform={cmsModalPlatform}
          defaultSiteUrl={domain ? `https://${domain}` : undefined}
          existingSiteUrl={wpQuery.data?.siteUrl}
          existingUsername={wpQuery.data?.username}
          onClose={() => setCmsModalPlatform(null)}
          onConnected={(info) => {
            setCmsModalPlatform(null);
            invalidateAll();
            setActionBanner({
              tone: "good",
              text: `${(info.platform || "wordpress").toUpperCase()} connected (${info.siteUrl}). You can now stage or apply fixes directly from any finding below.`,
            });
          }}
        />
      )}
    </div>
  );
}

function RepoConnectForm({
  projectId,
  projectDomain,
  existingRepo,
  onConnected,
}: {
  projectId: string | null;
  projectDomain?: string | null;
  existingRepo: { owner: string; name: string; defaultBranch: string; framework: string } | null;
  onConnected: () => void;
}) {
  const profile = useProfile();

  return (
    <GitHubAgentConnectWorkflow
      projectId={projectId}
      projectDomain={projectDomain}
      userEmail={profile.data?.email}
      existingRepo={existingRepo}
      mode="inline"
      onConnected={() => onConnected()}
    />
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
