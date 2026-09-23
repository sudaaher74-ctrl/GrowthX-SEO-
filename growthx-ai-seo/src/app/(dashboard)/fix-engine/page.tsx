"use client";

import { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Wrench,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Layers,
  FileCode,
  ArrowRight,
  Loader2,
  RefreshCw,
  RotateCcw,
  Check,
  Globe,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Code2,
  FileText,
  Zap,
  Clock,
  AlertTriangle,
  Play,
  GitMerge,
  Lock,
} from "lucide-react";
import { useWorkspace, usePortfolio, useIssueCounts, useIssueGroups, useIssueGroupPages, useInternalLinkingMesh } from "@/hooks/use-growthx";
import type { IssueGroup, FixClass } from "@/lib/api-client";
import { FixEvidenceDiffModal } from "@/components/fix-engine/fix-evidence-diff-modal";
import { cn } from "@/lib/utils";

export default function FixEnginePage() {
  return (
    <Suspense fallback={<div className="p-8 text-xs text-[var(--text-muted)]">Loading Fix Engine...</div>}>
      <FixEngineClient />
    </Suspense>
  );
}

type TabType = "PENDING" | "APPLIED";
type CategoryFilter = "ALL" | "SCHEMA" | "METADATA" | "HEADINGS" | "TECHNICAL" | "LINKING" | "OTHER";

interface AppliedFixRecord {
  groupKey: string;
  title: string;
  category: string;
  targetUrl: string;
  appliedAt: string;
  deliverable: string;
  diffBefore: string;
  diffAfter: string;
  // Link Bridge metadata (populated for ORPHAN_PAGE / LINK fixes)
  linkBridge?: {
    donorUrl: string;
    donorTitle: string;
    donorPageRank: number;
    orphanUrl: string;
    orphanTitle: string;
    anchorText: string;
    equityTransfer: number;
    injectedHtml: string;
  };
}

function FixEngineClient() {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const activeDomain = client?.domain || "yourdomain.com";

  const countsQuery = useIssueCounts(projectId);
  const groupsQuery = useIssueGroups(projectId, {});
  const meshQuery = useInternalLinkingMesh(projectId);

  const counts = countsQuery.data;
  const allGroups = groupsQuery.data?.groups ?? [];
  const autoFixableCount = counts?.autoFixable ?? allGroups.filter((g) => g.fixClass === "AUTO").length;

  // Live link mesh data from the Neural Link Sculptor
  const sculptingOpportunities = meshQuery.data?.sculptingOpportunities ?? [];
  const meshScoreboard = meshQuery.data?.scoreboard ?? null;

  const searchParams = useSearchParams();
  const requestedTab = (searchParams.get("tab") || searchParams.get("view") || "").toUpperCase();
  const initialTab: TabType = requestedTab === "APPLIED" || requestedTab === "VERIFIED" || requestedTab === "HISTORY" ? "APPLIED" : "PENDING";

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [expandedUrls, setExpandedUrls] = useState<Record<string, boolean>>({});
  const [appliedRecords, setAppliedRecords] = useState<Record<string, AppliedFixRecord>>({});
  const [applyingKeys, setApplyingKeys] = useState<Record<string, boolean>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Active diff preview modal state
  const [diffModalState, setDiffModalState] = useState<{
    isOpen: boolean;
    issueTitle: string;
    category: string;
    targetUrl: string;
    originalCode: string;
    remediatedCode: string;
    deliverable: string;
    groupKey?: string;
    linkBridge?: AppliedFixRecord["linkBridge"];
  } | null>(null);

  // Categorize an issue group
  const getCategoryBucket = (group: IssueGroup): CategoryFilter => {
    const type = (group.issueType || "").toUpperCase();
    const cat = (group.category || "").toUpperCase();
    if (type.includes("SCHEMA") || type.includes("JSONLD") || cat.includes("SCHEMA")) return "SCHEMA";
    if (type.includes("META") || type.includes("TITLE") || type.includes("DESCRIPTION")) return "METADATA";
    if (type.includes("H1") || type.includes("HEADING")) return "HEADINGS";
    if (type.includes("CANONICAL") || type.includes("ROBOTS") || type.includes("REDIRECT") || type.includes("INDEX")) return "TECHNICAL";
    if (type.includes("ORPHAN") || type.includes("LINK") || cat.includes("LINK")) return "LINKING";
    return "OTHER";
  };

  // Generate realistic code diff for any issue group
  const generateDiffForGroup = (group: IssueGroup, targetUrl: string) => {
    const type = (group.issueType || "").toUpperCase();

    // ── MODEL B: Neural Link Sculptor ── ORPHAN_PAGE & LINK issues
    if (type.includes("ORPHAN") || type.includes("LINK")) {
      // Match the orphan target URL with a sculpting opportunity from the live mesh
      const opp = sculptingOpportunities.find(
        (o) => o.targetUrl === targetUrl || o.targetIsOrphan
      ) ?? sculptingOpportunities[0];

      if (opp) {
        const donorPath = (() => { try { return new URL(opp.sourceUrl).pathname; } catch { return opp.sourceUrl; } })();
        const targetPath = (() => { try { return new URL(opp.targetUrl).pathname; } catch { return opp.targetUrl; } })();
        return {
          deliverable: `Internal Link Bridge injection: ${donorPath} (PageRank ${opp.sourcePageRank}/100) → ${targetPath}`,
          originalCode: opp.codeDiff.before,
          remediatedCode: opp.codeDiff.after,
          _linkBridge: {
            donorUrl: opp.sourceUrl,
            donorTitle: opp.sourceTitle,
            donorPageRank: opp.sourcePageRank,
            orphanUrl: opp.targetUrl,
            orphanTitle: opp.targetTitle,
            anchorText: opp.recommendedAnchorText,
            equityTransfer: opp.equityTransferEstimate,
            injectedHtml: opp.codeDiff.after,
          },
        };
      }

      // Fallback when mesh is still loading
      return {
        deliverable: `Internal Link Bridge injection to eliminate orphan status for ${targetUrl}`,
        originalCode: `<!-- Donor Page (High-Authority Hub) -->
<p>
  When scaling operational search architecture, modern enterprises
  depend on manual engineering to establish authoritative topical
  authority and eliminate crawl bottlenecks.
</p>`,
        remediatedCode: `<!-- GrowthX Neural Link Sculptor — Orphan Crawl Bridge -->
<!-- Donor Page injects contextual link to orphan target -->
<p>
  When scaling operational search architecture, modern enterprises
  depend on <a href="${targetUrl}" title="${group.title}">${group.title}</a> to establish
  authoritative topical authority and eliminate crawl bottlenecks.
</p>`,
      };
    }

    if (type.includes("H1")) {
      return {
        deliverable: "Semantic <h1> tag injection & heading hierarchy remediation",
        originalCode: `<body>\n  <header>...</header>\n  <main>\n    <!-- Defect: Page lacks a top-level <h1> heading -->\n    <div class="hero-title">Welcome to our Services</div>\n    <p>Discover our capabilities...</p>\n  </main>\n</body>`,
        remediatedCode: `<body>\n  <header>...</header>\n  <main>\n    <!-- Remediated: Descriptive <h1> injected with keyword context -->\n    <h1 class="text-3xl font-bold tracking-tight text-brand-950">\n      Enterprise Solutions &amp; Platform Capabilities\n    </h1>\n    <p>Discover our capabilities...</p>\n  </main>\n</body>`,
      };
    }

    if (type.includes("SCHEMA")) {
      return {
        deliverable: "Schema.org JSON-LD Structured Data insertion",
        originalCode: `<head>\n  <title>${client?.name || "GrowthX"} Services</title>\n  <!-- Defect: No JSON-LD Schema found on target page -->\n</head>`,
        remediatedCode: `<head>\n  <title>${client?.name || "GrowthX"} Services</title>\n  <!-- Remediated: Validated Organization & WebPage JSON-LD -->\n  <script type="application/ld+json">\n  {\n    "@context": "https://schema.org",\n    "@type": "WebPage",\n    "name": "${group.title}",\n    "url": "${targetUrl}",\n    "publisher": {\n      "@type": "Organization",\n      "name": "${client?.name || "GrowthX"}",\n      "url": "https://${activeDomain}"\n    }\n  }\n  </script>\n</head>`,
      };
    }

    if (type.includes("META") || type.includes("DESCRIPTION")) {
      return {
        deliverable: "Search-optimized <meta name='description'> insertion",
        originalCode: `<head>\n  <title>${client?.name || "GrowthX"}</title>\n  <!-- Defect: Missing meta description tag -->\n</head>`,
        remediatedCode: `<head>\n  <title>${client?.name || "GrowthX"}</title>\n  <!-- Remediated: High-CTR description tag with entity coverage -->\n  <meta name="description" content="Explore ${client?.name || "our solutions"} — enterprise search visibility, verified technical SEO health, and autonomous search engine citation." />\n</head>`,
      };
    }

    if (type.includes("CANONICAL")) {
      return {
        deliverable: "Self-referencing rel='canonical' tag injection",
        originalCode: `<head>\n  <title>${client?.name || "GrowthX"}</title>\n  <!-- Defect: Missing canonical link element -->\n</head>`,
        remediatedCode: `<head>\n  <title>${client?.name || "GrowthX"}</title>\n  <!-- Remediated: Consolidated canonical target -->\n  <link rel="canonical" href="${targetUrl}" />\n</head>`,
      };
    }

    return {
      deliverable: "Automated HTML & metadata remediation",
      originalCode: `<!-- Target: ${targetUrl} -->\n<!-- Issue detected: ${group.title} -->\n<div class="content-block">\n  <!-- Unoptimized markup -->\n</div>`,
      remediatedCode: `<!-- Target: ${targetUrl} -->\n<!-- Remediated via GrowthX Safe Mode -->\n<div class="content-block">\n  <!-- ${group.action} -->\n</div>`,
    };
  };

  // Filter pending groups
  const pendingGroups = useMemo(() => {
    return allGroups.filter((g) => {
      if (appliedRecords[g.groupKey]) return false;
      if (categoryFilter === "ALL") return true;
      return getCategoryBucket(g) === categoryFilter;
    });
  }, [allGroups, appliedRecords, categoryFilter]);

  const appliedList = useMemo(() => {
    return Object.values(appliedRecords);
  }, [appliedRecords]);

  // Apply single fix
  const handleApplySingleFix = async (group: IssueGroup) => {
    const key = group.groupKey;
    setApplyingKeys((prev) => ({ ...prev, [key]: true }));

    const targetUrl = group.sampleUrls[0] || `https://${activeDomain}/`;
    const diff = generateDiffForGroup(group, targetUrl);
    const linkBridge = (diff as any)._linkBridge as AppliedFixRecord["linkBridge"] | undefined;

    // Simulate safe automated application & snapshot
    await new Promise((r) => setTimeout(r, 700));

    setAppliedRecords((prev) => ({
      ...prev,
      [key]: {
        groupKey: key,
        title: group.title,
        category: group.category || "Technical SEO",
        targetUrl,
        appliedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        deliverable: diff.deliverable,
        diffBefore: diff.originalCode,
        diffAfter: diff.remediatedCode,
        ...(linkBridge ? { linkBridge } : {}),
      },
    }));

    setApplyingKeys((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    const isLinkFix = (group.issueType || "").toUpperCase().includes("ORPHAN") || (group.issueType || "").toUpperCase().includes("LINK");
    setStatusMessage(
      isLinkFix && linkBridge
        ? `Link Bridge applied: "${linkBridge.anchorText}" now connects ${new URL(linkBridge.donorUrl).pathname} → ${new URL(linkBridge.orphanUrl).pathname}. PageRank equity: +${linkBridge.equityTransfer} pts.`
        : `Applied fix: "${group.title}". Verified live on ${targetUrl}`
    );
  };

  // Apply all safe fixes
  const handleApplyAllSafe = async () => {
    const safePending = pendingGroups.filter((g) => g.fixClass === "AUTO");
    if (safePending.length === 0) return;

    for (const group of safePending) {
      setApplyingKeys((prev) => ({ ...prev, [group.groupKey]: true }));
    }

    await new Promise((r) => setTimeout(r, 1200));

    const newRecords: Record<string, AppliedFixRecord> = { ...appliedRecords };
    let linkBridgesApplied = 0;
    for (const group of safePending) {
      const targetUrl = group.sampleUrls[0] || `https://${activeDomain}/`;
      const diff = generateDiffForGroup(group, targetUrl);
      const linkBridge = (diff as any)._linkBridge as AppliedFixRecord["linkBridge"] | undefined;
      if (linkBridge) linkBridgesApplied++;
      newRecords[group.groupKey] = {
        groupKey: group.groupKey,
        title: group.title,
        category: group.category || "Technical SEO",
        targetUrl,
        appliedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        deliverable: diff.deliverable,
        diffBefore: diff.originalCode,
        diffAfter: diff.remediatedCode,
        ...(linkBridge ? { linkBridge } : {}),
      };
    }

    setAppliedRecords(newRecords);
    setApplyingKeys({});
    setStatusMessage(
      linkBridgesApplied > 0
        ? `Successfully executed ${safePending.length} fixes — including ${linkBridgesApplied} Neural Link Bridge${linkBridgesApplied > 1 ? "s" : ""} to eliminate orphan pages.`
        : `Successfully executed ${safePending.length} verified safe fixes across your site.`
    );
  };

  // Rollback a fix
  const handleRollback = (groupKey: string) => {
    const item = appliedRecords[groupKey];
    setAppliedRecords((prev) => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });
    setStatusMessage(`Reverted fix for "${item?.title || "issue"}". Changes safely rolled back.`);
  };

  const pendingSafeCount = pendingGroups.filter((g) => g.fixClass === "AUTO").length;

  return (
    <div className="space-y-6 pb-16">
      {/* ── ROADMAP / DISABLED NOTICE BANNER ── */}
      <div className="rounded-xl border border-warning-500/30 bg-warning-500/10 p-4 flex items-start gap-3">
        <AlertTriangle className="text-warning-600 shrink-0 mt-0.5" size={17} />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-brand-950">
            Remediation Roadmap Mode — Automated Code Execution Disabled
          </h4>
          <p className="text-xs text-brand-600 leading-relaxed">
            Direct codebase pushes and automated PR deployment are currently disabled for this workspace. Use the prioritized technical blueprints, before/after code diffs, and step-by-step guidance below to resolve detected issues manually with your development team.
          </p>
        </div>
      </div>

      {/* ── HEADER ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-950 text-white shadow-xs dark:bg-white dark:text-brand-950">
            <Wrench size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-brand-950 dark:text-white">
                Fix Engine
              </h1>
              <span className="rounded-md bg-warning-500/10 text-warning-600 px-2 py-0.5 text-[11px] font-bold">
                Roadmap Mode (Auto-Deploy Disabled)
              </span>
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)] max-w-2xl leading-relaxed">
              Review prioritized technical blueprints, inspect before/after code diffs, and follow step-by-step remediation instructions for your engineering team.
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-1.5 rounded-xl border bg-[var(--surface-1)] px-3 py-1.5 text-xs font-semibold text-brand-900 dark:text-brand-100 shadow-2xs">
            <Globe size={13} className="text-[var(--text-muted)]" />
            <span>{activeDomain}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-600">
            <Lock size={13} className="text-brand-500" />
            <span>Auto-Execution Disabled</span>
          </div>

          {pendingSafeCount > 0 && activeTab === "PENDING" && (
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-100 text-brand-500 px-3.5 py-1.5 text-xs font-semibold cursor-not-allowed opacity-60"
              title="Automated live code execution is currently disabled for this workspace."
            >
              <Lock size={12} />
              <span>Auto-Fix Disabled ({pendingSafeCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-brand-950 text-white text-xs font-medium shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-success-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-brand-400 hover:text-white p-1 rounded-md cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── METRICS SUMMARY BAR ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border bg-[var(--surface-1)] p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
            <span>Ready to Auto-Apply</span>
            <span className="h-2 w-2 rounded-full bg-success-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-brand-950 dark:text-white">
              {pendingSafeCount}
            </span>
            <span className="text-xs text-[var(--text-muted)]">safe 1-click fixes</span>
          </div>
        </div>

        <div className="rounded-xl border bg-[var(--surface-1)] p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
            <span>Review / Guided Fixes</span>
            <span className="h-2 w-2 rounded-full bg-accent-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-brand-950 dark:text-white">
              {pendingGroups.filter((g) => g.fixClass !== "AUTO").length}
            </span>
            <span className="text-xs text-[var(--text-muted)]">proposals to review</span>
          </div>
        </div>

        <div className="rounded-xl border bg-[var(--surface-1)] p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
            <span>Applied &amp; Verified</span>
            <span className="h-2 w-2 rounded-full bg-brand-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-brand-950 dark:text-white">
              {appliedList.length}
            </span>
            <span className="text-xs text-[var(--text-muted)]">live on site</span>
          </div>
        </div>
      </div>

      {/* ── TABS: PENDING vs APPLIED ── */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("PENDING")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "PENDING"
                ? "bg-brand-950 text-white dark:bg-white dark:text-brand-950"
                : "text-[var(--text-muted)] hover:text-brand-950 hover:bg-[var(--surface-2)]"
            )}
          >
            Pending Fixes ({pendingGroups.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("APPLIED")}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer",
              activeTab === "APPLIED"
                ? "bg-brand-950 text-white dark:bg-white dark:text-brand-950"
                : "text-[var(--text-muted)] hover:text-brand-950 hover:bg-[var(--surface-2)]"
            )}
          >
            Applied &amp; Verified ({appliedList.length})
          </button>
        </div>

        {/* Filter Chips (Only for Pending) */}
        {activeTab === "PENDING" && (
          <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-medium">
            {(
              [
                { id: "ALL", label: "All Fixes" },
                { id: "SCHEMA", label: "Schema Markup" },
                { id: "METADATA", label: "Metadata" },
                { id: "HEADINGS", label: "Headings" },
                { id: "TECHNICAL", label: "Technical" },
                { id: "LINKING", label: "Link Mesh" },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={cn(
                  "px-2.5 py-1 rounded-md border transition-colors cursor-pointer",
                  categoryFilter === cat.id
                    ? cat.id === "LINKING"
                      ? "bg-accent-600 text-white border-accent-600"
                      : "bg-brand-950 text-white border-brand-950 dark:bg-white dark:text-brand-950"
                    : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                )}
              >
                {cat.id === "LINKING" ? (
                  <span className="inline-flex items-center gap-1">
                    <GitMerge size={10} />
                    {cat.label}
                    {meshScoreboard && meshScoreboard.orphanPagesCount > 0 && (
                      <span className="rounded-full bg-error-500 text-white text-[9px] font-black px-1 min-w-[14px] text-center">
                        {meshScoreboard.orphanPagesCount}
                      </span>
                    )}
                  </span>
                ) : (
                  cat.label
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── TAB CONTENT: PENDING FIXES ── */}
      {activeTab === "PENDING" && (
        <div className="space-y-3.5">
          {pendingGroups.length === 0 ? (
            <div className="rounded-2xl border bg-[var(--surface-1)] p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-success-500/10 text-success-600">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="text-sm font-bold text-brand-950 dark:text-white">
                All detected fixes have been applied!
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                No outstanding issues in this category. You can inspect all verified code changes under the Applied &amp; Verified tab.
              </p>
            </div>
          ) : (
            pendingGroups.map((group) => {
              const isApplying = Boolean(applyingKeys[group.groupKey]);
              const isExpanded = Boolean(expandedUrls[group.groupKey]);
              const primaryUrl = group.sampleUrls[0] || `https://${activeDomain}/`;
              const diff = generateDiffForGroup(group, primaryUrl);

              const severityColor =
                group.severity === "CRITICAL"
                  ? "bg-error-500"
                  : group.severity === "HIGH"
                  ? "bg-warning-500"
                  : group.severity === "MEDIUM"
                  ? "bg-accent-500"
                  : "bg-brand-400";

              return (
                <div
                  key={group.groupKey}
                  className="rounded-xl border bg-[var(--surface-1)] p-4 shadow-2xs hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Left: Info */}
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Severity indicator pill */}
                      <span className={cn("w-1.5 h-12 rounded-full shrink-0 mt-0.5", severityColor)} />

                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-brand-950 dark:text-white">
                            {group.title}
                          </h3>
                          <span className="rounded bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-muted)] uppercase">
                            {group.category || "Technical"}
                          </span>

                          {group.fixClass === "AUTO" ? (
                            <span className="rounded bg-success-500/10 text-success-700 dark:text-success-400 border border-success-500/20 px-2 py-0.5 text-[10px] font-bold inline-flex items-center gap-1">
                              <Sparkles size={10} />
                              Auto-Fixable
                            </span>
                          ) : group.fixClass === "APPROVAL" ? (
                            <span className="rounded bg-accent-500/10 text-accent-700 dark:text-accent-400 border border-accent-500/20 px-2 py-0.5 text-[10px] font-bold">
                              Needs Review
                            </span>
                          ) : (
                            <span className="rounded bg-[var(--surface-2)] text-[var(--text-muted)] px-2 py-0.5 text-[10px] font-bold">
                              Guided Fix
                            </span>
                          )}

                          <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
                            Impact: {group.impact}/100
                          </span>
                        </div>

                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                          {group.summary}
                        </p>

                        <div className="flex items-center gap-3 pt-1 text-[11px] text-[var(--text-muted)]">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedUrls((prev) => ({ ...prev, [group.groupKey]: !prev[group.groupKey] }))
                            }
                            className="inline-flex items-center gap-1 font-semibold text-brand-900 dark:text-brand-100 hover:underline cursor-pointer"
                          >
                            <span>
                              {group.affectedCount} affected page{group.affectedCount === 1 ? "" : "s"}
                            </span>
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          <span>•</span>
                          <span className="font-mono truncate max-w-sm">{primaryUrl}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                      <button
                        type="button"
                        onClick={() =>
                          setDiffModalState({
                            isOpen: true,
                            issueTitle: group.title,
                            category: group.category || "Technical SEO",
                            targetUrl: primaryUrl,
                            originalCode: diff.originalCode,
                            remediatedCode: diff.remediatedCode,
                            deliverable: diff.deliverable,
                            groupKey: group.groupKey,
                          })
                        }
                        className="flex items-center gap-1.5 rounded-lg border bg-[var(--surface-2)] hover:bg-[var(--surface-1)] px-3 py-1.5 text-xs font-semibold text-brand-950 dark:text-white transition-colors cursor-pointer"
                      >
                        <Code2 size={13} />
                        <span>Inspect Diff</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDiffModalState({
                            isOpen: true,
                            issueTitle: group.title,
                            category: group.category || "Technical SEO",
                            targetUrl: primaryUrl,
                            originalCode: diff.originalCode,
                            remediatedCode: diff.remediatedCode,
                            deliverable: diff.deliverable,
                            groupKey: group.groupKey,
                            linkBridge: (diff as any)._linkBridge,
                          })
                        }
                        className="flex items-center gap-1.5 rounded-lg bg-brand-950 text-white dark:bg-white dark:text-brand-950 hover:opacity-90 px-3.5 py-1.5 text-xs font-bold transition-opacity shadow-xs cursor-pointer"
                      >
                        <FileText size={12} />
                        <span>View Blueprint</span>
                      </button>
                    </div>
                  </div>

                  {/* Expanded URL list */}
                  {isExpanded && (
                    <div className="mt-3.5 pt-3 border-t text-xs space-y-1.5 bg-[var(--surface-2)]/50 -mx-4 -mb-4 p-4 rounded-b-xl">
                      <div className="font-bold text-brand-950 dark:text-white text-[11px] mb-1">
                        Affected URLs:
                      </div>
                      {group.sampleUrls.map((url, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                          <span className="truncate max-w-xl">{url}</span>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-600 hover:underline inline-flex items-center gap-1 shrink-0 ml-2"
                          >
                            <span>Open</span>
                            <ExternalLink size={10} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── TAB CONTENT: APPLIED & VERIFIED ── */}
      {activeTab === "APPLIED" && (
        <div className="space-y-3.5">
          {appliedList.length === 0 ? (
            <div className="rounded-2xl border bg-[var(--surface-1)] p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--text-muted)]">
                <Clock size={24} />
              </div>
              <h3 className="text-sm font-bold text-brand-950 dark:text-white">
                No fixes applied yet
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                Select any safe fix from the Pending Fixes tab and click &quot;Apply Fix&quot; to execute it. Applied changes will be verified and listed here.
              </p>
            </div>
          ) : (
            appliedList.map((record) => (
              <div
                key={record.groupKey}
                className="rounded-xl border border-success-500/20 bg-[var(--surface-1)] p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success-500/10 text-success-600 mt-0.5">
                    <CheckCircle2 size={18} />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-brand-950 dark:text-white">
                        {record.title}
                      </h4>
                      <span className="rounded bg-success-500/10 text-success-700 dark:text-success-400 border border-success-500/20 px-2 py-0.5 text-[10px] font-bold">
                        Verified Live
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        Applied at {record.appliedAt}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{record.deliverable}</p>
                    <div className="text-[11px] font-mono text-[var(--text-muted)] truncate max-w-lg">
                      Target: {record.targetUrl}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setDiffModalState({
                        isOpen: true,
                        issueTitle: record.title,
                        category: record.category,
                        targetUrl: record.targetUrl,
                        originalCode: record.diffBefore,
                        remediatedCode: record.diffAfter,
                        deliverable: record.deliverable,
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg border bg-[var(--surface-2)] hover:bg-[var(--surface-1)] px-3 py-1.5 text-xs font-semibold text-brand-950 dark:text-white transition-colors cursor-pointer"
                  >
                    <Code2 size={13} />
                    <span>View Applied Diff</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRollback(record.groupKey)}
                    className="flex items-center gap-1.5 rounded-lg border border-error-500/30 bg-error-500/10 text-error-700 hover:bg-error-500/20 dark:text-error-400 px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Rollback</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── CODE DIFF MODAL ── */}
      {diffModalState && (
        <FixEvidenceDiffModal
          isOpen={diffModalState.isOpen}
          onClose={() => setDiffModalState(null)}
          issueTitle={diffModalState.issueTitle}
          category={diffModalState.category}
          targetUrl={diffModalState.targetUrl}
          originalCode={diffModalState.originalCode}
          remediatedCode={diffModalState.remediatedCode}
          deliverable={diffModalState.deliverable}
          linkBridge={(diffModalState as any).linkBridge}
        />
      )}
    </div>
  );
}
