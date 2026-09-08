"use client";

import { Suspense, useState, useMemo } from "react";
import { 
  Code, 
  GitBranch, 
  Server, 
  Zap, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Wrench,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import Link from "next/link";
import {
  ActionButton,
  PageHeader,
  Panel,
  Pill,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { AutoFixModal } from "@/components/website/auto-fix-modal";
import {
  useWorkspace,
  usePortfolio,
  useLatestCrawl,
  useCrawlIssues,
  useAnalyzeIssue,
  useAutoFixIssue,
  useApproveFix,
  useStartCrawl,
} from "@/hooks/use-growthx";
import { useQuery } from "@tanstack/react-query";
import { api, type CrawlIssue, type TrackedCompetitor } from "@/lib/api-client";
import { WebsiteTechnicalFixPanel } from "@/components/fix-engine/website-technical-fix-panel";
import { Autonomous30DayPlanModal } from "@/components/fix-engine/autonomous-30day-plan-modal";

export default function FixEnginePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-48 items-center justify-center text-sm text-[var(--text-muted)]">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-brand-500" />
          Loading AI Fix Engine...
        </div>
      }
    >
      <FixEngineClient />
    </Suspense>
  );
}

function FixEngineClient() {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const activeDomain = client?.domain ?? null;

  const latestCrawl = useLatestCrawl(activeDomain);
  const jobId = latestCrawl.data?.id ?? null;
  const issues = useCrawlIssues(jobId);
  const startCrawl = useStartCrawl();

  const analyzeIssue = useAnalyzeIssue();
  const autoFixIssue = useAutoFixIssue();
  const approveFix = useApproveFix();

  const [activeTab, setActiveTab] = useState("website-technical-fix");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [autoFixTarget, setAutoFixTarget] = useState<CrawlIssue | null>(null);
  const [show30DayPlanModal, setShow30DayPlanModal] = useState(false);

  const competitorsQuery = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => api.listCompetitors(projectId!),
    enabled: Boolean(projectId),
  });
  const competitors = competitorsQuery.data ?? [];

  const tabs = [
    { id: "website-technical-fix", label: "Website Technical SEO Fix", icon: Wrench },
    { id: "ai-visibility-fix", label: "AI Visibility Fix", icon: Sparkles },
    { id: "repo", label: "Repository Intelligence", icon: GitBranch },
    { id: "deployments", label: "Deployments", icon: Server },
  ];

  const rawIssues = (issues.data?.data || []) as CrawlIssue[];

  // Actionable issues: prioritize critical, high, and medium issues
  const actionableIssues = useMemo(() => {
    return rawIssues.filter(
      (i) => i.severity === "CRITICAL" || i.severity === "HIGH" || i.severity === "MEDIUM"
    );
  }, [rawIssues]);

  const selectedIssue = actionableIssues.find((i) => i.id === selectedIssueId) ?? null;

  const criticalCount = rawIssues.filter((i) => i.severity === "CRITICAL").length;
  const highCount = rawIssues.filter((i) => i.severity === "HIGH").length;
  const resolvedCount = rawIssues.filter((i) => i.status === "RESOLVED").length;

  const handleAnalyze = async () => {
    if (!selectedIssue) return;
    await analyzeIssue.mutateAsync(selectedIssue.id);
  };

  const handleGenerateFix = async () => {
    if (!selectedIssue) return;
    await autoFixIssue.mutateAsync(selectedIssue.id);
  };

  const handleTriggerScan = async () => {
    if (!activeDomain) return;
    try {
      await startCrawl.mutateAsync({ domain: activeDomain });
    } catch (e) {
      console.error("Failed to start crawl", e);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Fix Engine"
        subtitle="Automated repository intelligence, 1-click code patches, and continuous crawl remediation."
        actions={
          <ActionButton
            variant="secondary"
            onClick={handleTriggerScan}
            disabled={!projectId || !activeDomain || startCrawl.isPending}
            icon={startCrawl.isPending ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
          >
            {startCrawl.isPending ? "Starting Scan..." : "Scan & Discover Fixes"}
          </ActionButton>
        }
      />

      {/* KPI Overview Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
          <span className="text-[11px] font-medium text-brand-500">Actionable Fixes</span>
          <div className="mt-1 text-2xl font-bold text-brand-950">{actionableIssues.length}</div>
          <p className="mt-1 text-[11px] text-brand-400">Ready for automated remediation</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
          <span className="text-[11px] font-medium text-red-600">Critical Priority</span>
          <div className="mt-1 text-2xl font-bold text-red-600">{criticalCount}</div>
          <p className="mt-1 text-[11px] text-brand-400">Impacting crawlability &amp; rankings</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
          <span className="text-[11px] font-medium text-amber-600">High Priority</span>
          <div className="mt-1 text-2xl font-bold text-amber-600">{highCount}</div>
          <p className="mt-1 text-[11px] text-brand-400">Technical &amp; schema optimizations</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
          <span className="text-[11px] font-medium text-emerald-600">Resolved Patches</span>
          <div className="mt-1 text-2xl font-bold text-emerald-600">{resolvedCount}</div>
          <p className="mt-1 text-[11px] text-brand-400">Auto-fixed or approved</p>
        </div>
      </div>

      <Tabs
        tabs={tabs}
        active={activeTab}
        onChange={(id) => {
          setActiveTab(id);
          setSelectedIssueId(null);
        }}
      />

      {/* Tab Content */}
      <div className="pt-1">
        {activeTab === "website-technical-fix" && (
          <WebsiteTechnicalFixPanel
            projectId={projectId || ""}
            domain={activeDomain ?? undefined}
            businessName={client?.name ?? undefined}
            issues={rawIssues}
            competitors={competitors}
            isLoadingIssues={latestCrawl.isLoading || issues.isLoading}
            onOpenAutoFixModal={(issue) => setAutoFixTarget(issue)}
            onOpen30DayPlan={() => setShow30DayPlanModal(true)}
          />
        )}

        {activeTab === "ai-visibility-fix" && (
          <Panel
            title="AI Visibility Fix Engine (AEO & GEO)"
            subtitle="Automated optimization for LLM Quotable Answer Blocks, Schema Grounding, and Google AI Overviews snippet eligibility."
          >
            <div className="p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <Sparkles size={24} />
              </div>
              <h3 className="text-base font-bold text-brand-950 dark:text-white">
                AI Visibility Fix Engine
              </h3>
              <p className="text-xs text-brand-600 dark:text-brand-400 max-w-md mx-auto leading-relaxed">
                This module analyzes whether ChatGPT, Claude, and Gemini cite your brand when buyers search conversational queries. It prepares 45-word quotable definition blocks, rich comparison matrices, and Knowledge Graph schema to win AI recommendations.
              </p>
              <div className="pt-2">
                <Link
                  href="/ai-visibility"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-950 text-white dark:bg-white dark:text-brand-950 text-xs font-bold hover:opacity-90 transition"
                >
                  <span>Open AI Visibility Council &amp; Superpowers</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          </Panel>
        )}

        {activeTab === "repo" && (
          <Panel
            title="Repository Intelligence &amp; CI/CD"
            subtitle="Connect your GitHub, GitLab, or Next.js repository to automate PR creation."
          >
            <div className="p-6 space-y-6">
              <div className="flex items-start gap-4 rounded-xl border border-brand-100 bg-brand-50/50 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-950 text-white">
                  <GitBranch size={20} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[13.5px] font-semibold text-brand-950">
                    Automated Pull Request Engine
                  </h4>
                  <p className="text-[12px] text-brand-600 leading-relaxed">
                    When enabled, the AI Fix Engine automatically writes production-tested code patches, creates a git branch, and opens a Pull Request with complete test coverage and preview URLs.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/integrations"
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-accent-600 hover:text-accent-700"
                    >
                      Configure Git Integration <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border p-4 bg-white" style={{ borderColor: "var(--border-color)" }}>
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-950">
                    <Code size={14} className="text-accent-600" />
                    Supported Frameworks
                  </div>
                  <ul className="mt-2.5 space-y-1.5 text-[11.5px] text-brand-600">
                    <li>• Next.js (App &amp; Pages router)</li>
                    <li>• Shopify Liquid &amp; Theme OS 2.0</li>
                    <li>• Standard HTML5 &amp; Schema JSON-LD</li>
                    <li>• WordPress / WooCommerce</li>
                  </ul>
                </div>

                <div className="rounded-xl border p-4 bg-white" style={{ borderColor: "var(--border-color)" }}>
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-950">
                    <ShieldCheck size={14} className="text-emerald-600" />
                    Verification Guardrails
                  </div>
                  <ul className="mt-2.5 space-y-1.5 text-[11.5px] text-brand-600">
                    <li>• TypeScript syntax checking</li>
                    <li>• Schema.org Rich Result validation</li>
                    <li>• Zero visual regressions check</li>
                    <li>• Human-in-the-loop review</li>
                  </ul>
                </div>

                <div className="rounded-xl border p-4 bg-white" style={{ borderColor: "var(--border-color)" }}>
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-950">
                    <Cpu size={14} className="text-brand-800" />
                    Autonomous Pipeline
                  </div>
                  <ul className="mt-2.5 space-y-1.5 text-[11.5px] text-brand-600">
                    <li>• Auto-scans on new crawl finish</li>
                    <li>• Priority scoring (Critical first)</li>
                    <li>• Batch patch generation</li>
                    <li>• Instant rollback capability</li>
                  </ul>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {activeTab === "deployments" && (
          <Panel
            title="Recent Deployments &amp; Remediation Log"
            subtitle="History of automated patches merged and deployed to production."
          >
            <div className="p-8 text-center text-brand-500">
              <CheckCircle2 size={32} className="mx-auto text-brand-300 mb-2" />
              <p className="text-[13px] font-medium text-brand-950">All systems in sync</p>
              <p className="text-[11.5px] text-brand-400 mt-1 max-w-sm mx-auto">
                Generate fixes above or link your repository to track live deployment pipelines.
              </p>
            </div>
          </Panel>
        )}
      </div>

      {/* 30-Day Autonomous Plan Modal */}
      {show30DayPlanModal && projectId && (
        <Autonomous30DayPlanModal
          projectId={projectId}
          domain={activeDomain ?? undefined}
          businessName={client?.name ?? undefined}
          technicalIssuesCount={actionableIssues.length}
          competitorOpportunitiesCount={competitors.length > 0 ? competitors.length * 3 : 6}
          onClose={() => setShow30DayPlanModal(false)}
          onTriggerReCrawl={handleTriggerScan}
        />
      )}

      {/* 1-Click AI Auto-Fix Modal */}
      {autoFixTarget && (
        <AutoFixModal issue={autoFixTarget} onClose={() => setAutoFixTarget(null)} />
      )}
    </div>
  );
}
