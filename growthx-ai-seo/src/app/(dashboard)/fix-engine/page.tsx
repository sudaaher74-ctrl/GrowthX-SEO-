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
import type { CrawlIssue } from "@/lib/api-client";

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

  const [activeTab, setActiveTab] = useState("fixes");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [autoFixTarget, setAutoFixTarget] = useState<CrawlIssue | null>(null);

  const tabs = [
    { id: "fixes", label: "Actionable Code Fixes", icon: Wrench },
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
          <p className="mt-1 text-[11px] text-brand-400">Impacting crawlability & rankings</p>
        </div>

        <div className="rounded-xl border bg-white p-4 shadow-2xs" style={{ borderColor: "var(--border-color)" }}>
          <span className="text-[11px] font-medium text-amber-600">High Priority</span>
          <div className="mt-1 text-2xl font-bold text-amber-600">{highCount}</div>
          <p className="mt-1 text-[11px] text-brand-400">Technical & schema optimizations</p>
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
      <div className="pt-1 flex items-start gap-5">
        <div className={`flex-1 space-y-4 ${selectedIssue ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          {activeTab === "fixes" && (
            <Panel
              title="Actionable Code Fixes"
              subtitle="Technical SEO, schema, and markup issues ready for automated code remediation."
            >
              <QueryState
                isLoading={latestCrawl.isLoading || issues.isLoading}
                error={latestCrawl.error || issues.error}
                isEmpty={!jobId || actionableIssues.length === 0}
              >
                <Table minWidth={720}>
                  <thead>
                    <tr>
                      <Th>Issue Description &amp; Target URL</Th>
                      <Th>Severity</Th>
                      <Th>Category</Th>
                      <Th>Status</Th>
                      <Th align="right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionableIssues.map((row) => {
                      const isSelected = selectedIssueId === row.id;
                      return (
                        <Tr
                          key={row.id}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-brand-50/80" : "hover:bg-brand-50/40"
                          }`}
                          onClick={() => setSelectedIssueId(row.id)}
                        >
                          <Td className="font-medium text-brand-950">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <Code size={13} className="text-brand-400 shrink-0" />
                                <span className="font-semibold text-brand-950">
                                  {row.description || row.issueType}
                                </span>
                              </div>
                              <div className="text-[11px] text-brand-400 truncate max-w-md pl-5 font-mono">
                                {row.affectedUrl}
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <Pill
                              tone={
                                row.severity === "CRITICAL"
                                  ? "bad"
                                  : row.severity === "HIGH"
                                  ? "warn"
                                  : "default"
                              }
                            >
                              {row.severity}
                            </Pill>
                          </Td>
                          <Td>
                            <span className="text-[11.5px] font-mono text-brand-600">
                              {row.issueType}
                            </span>
                          </Td>
                          <Td>
                            <div className="flex items-center gap-1.5 text-[12px] font-medium text-brand-600">
                              {row.status === "RESOLVED" ? (
                                <>
                                  <CheckCircle2 size={13} className="text-emerald-600" />
                                  <span className="text-emerald-700 font-semibold">Resolved</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle size={13} className="text-amber-500" />
                                  <span>{row.status || "Pending"}</span>
                                </>
                              )}
                            </div>
                          </Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setAutoFixTarget(row)}
                                className="inline-flex items-center gap-1.5 rounded-md bg-accent-50 px-2.5 py-1 text-[11.5px] font-semibold text-accent-700 hover:bg-accent-100 transition"
                              >
                                <Sparkles size={12} />
                                1-Click Fix
                              </button>
                              <ActionButton
                                variant={isSelected ? "primary" : "secondary"}
                                onClick={() => setSelectedIssueId(row.id)}
                              >
                                Details
                              </ActionButton>
                            </div>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </QueryState>
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

        {/* Opportunity / Fix Detail Panel */}
        {selectedIssue && (
          <div className="w-[26rem] shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel
              title={selectedIssue.description || selectedIssue.issueType}
              evidence={[
                `Identified during crawl job ${jobId?.slice(0, 8)}...`,
                `Target URL: ${selectedIssue.affectedUrl}`,
                `Current status: ${selectedIssue.status || "OPEN"}`,
              ]}
              businessImpact="Fixing this issue removes crawl barriers, prevents SERP ranking drops, and unlocks AI search quotation."
              recommendedAction={
                selectedIssue.recommendation ||
                "Run the AI Fix Engine to generate a drop-in code snippet or automated pull request."
              }
              aiRecommendation="Use 1-Click Code Auto-Fix to apply verified Next.js, Shopify, or HTML patches."
              affectedPagesCount={1}
              estimatedImpact={selectedIssue.severity === "CRITICAL" ? "High" : "Medium"}
              onAnalyze={handleAnalyze}
              onGenerateFix={handleGenerateFix}
              isAnalyzing={analyzeIssue.isPending}
              isGenerating={autoFixIssue.isPending}
              analysisData={analyzeIssue.data}
              patchData={autoFixIssue.data}
            />
          </div>
        )}
      </div>

      {/* 1-Click AI Auto-Fix Modal */}
      {autoFixTarget && (
        <AutoFixModal issue={autoFixTarget} onClose={() => setAutoFixTarget(null)} />
      )}
    </div>
  );
}
