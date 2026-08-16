"use client";
import { Suspense, useState } from "react";
import { Code, GitBranch, GitPullRequest, Server, Zap, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader, Panel, Table, Th, Tr, Td, Pill, ActionButton } from "@/components/ui/console";
import { OpportunityDetailPanel } from "@/components/ui/opportunity-detail-panel";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { useWorkspace, usePortfolio, useLatestCrawl, useCrawlIssues, useAnalyzeIssue, useAutoFixIssue, useApproveFix } from "@/hooks/use-growthx";
import type { CrawlIssue } from "@/lib/api-client";

function EngineerClient() {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  // No fallback domain: defaulting to some other tenant's site would show this
  // workspace another customer's crawl issues and generated code fixes.
  const activeDomain = client?.domain ?? null;

  const latestCrawl = useLatestCrawl(activeDomain);
  const jobId = latestCrawl.data?.id ?? null;
  const issues = useCrawlIssues(jobId);
  
  const analyzeIssue = useAnalyzeIssue();
  const autoFixIssue = useAutoFixIssue();
  const approveFix = useApproveFix();

  const [activeTab, setActiveTab] = useState("fixes");
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  const tabs = [
    { id: "fixes", label: "Actionable Code Fixes", icon: Code },
    { id: "repo", label: "Repository Intelligence", icon: GitBranch },
    { id: "deployments", label: "Deployments", icon: Server },
  ];

  const issueList = issues.data?.data || [];
  
  // Filter out low severity issues to keep it focused on actionable fixes
  const actionableIssues = issueList.filter(i => i.severity === "CRITICAL" || i.severity === "HIGH");
  const selectedIssue = actionableIssues.find(i => i.id === selectedIssueId);

  const handleAnalyze = async () => {
    if (!selectedIssue) return;
    await analyzeIssue.mutateAsync(selectedIssue.id);
  };

  const handleGenerateFix = async () => {
    if (!selectedIssue) return;
    await autoFixIssue.mutateAsync(selectedIssue.id);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Website Engineer"
        subtitle="Automated repository intelligence, code fixes, and deployments."
        actions={
          <ActionButton variant="secondary" icon={<Zap size={12} />} disabled={!projectId}>
            Trigger Repository Scan
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedIssueId(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-[#2563eb] text-[#2563eb]"
                : "border-transparent text-[#71717a] hover:text-[#09090b] hover:border-[#d4d4d8]"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-2 flex items-start gap-4">
        <div className={`flex-1 space-y-4 ${selectedIssueId ? "lg:max-w-[calc(100%-28rem)]" : "w-full"}`}>
          
          {(activeTab === "fixes" || activeTab === "repo") && (
            <Panel title="Actionable Code Fixes" subtitle="Technical SEO and performance issues ready for automated fixes.">
              <QueryState isLoading={latestCrawl.isLoading || issues.isLoading} error={latestCrawl.error || issues.error} isEmpty={!jobId || actionableIssues.length === 0}>
                <Table minWidth={720}>
                  <thead>
                    <tr>
                      <Th>Issue Description</Th>
                      <Th>Severity</Th>
                      <Th>Category</Th>
                      <Th>Status</Th>
                      <Th align="right">Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionableIssues.map((row) => (
                      <Tr key={row.id} className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setSelectedIssueId(row.id)}>
                        <Td className="font-medium text-[#09090b]">
                          <div className="flex items-center gap-2">
                            <Code size={14} className="text-gray-500" />
                            <span>{row.description || row.issueType}</span>
                          </div>
                        </Td>
                        <Td>
                          <Pill tone={row.severity === "CRITICAL" ? "warn" : "default"}>{row.severity}</Pill>
                        </Td>
                        <Td>
                          <Pill tone="default">{row.issueType}</Pill>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#71717a]">
                            {row.status === "RESOLVED" ? (
                              <><CheckCircle2 size={14} className="text-green-600" /> Resolved</>
                            ) : (
                              <><AlertCircle size={14} /> {row.status}</>
                            )}
                          </div>
                        </Td>
                        <Td align="right">
                          <ActionButton variant="primary" onClick={(e) => { e.stopPropagation(); setSelectedIssueId(row.id); }}>
                            View Details
                          </ActionButton>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </QueryState>
            </Panel>
          )}

          {(activeTab === "deployments") && (
             <Panel title="Recent Deployments" subtitle="Automated fixes deployed to production.">
               <div className="p-8 text-center text-[#71717a] border-t border-[#f4f4f5]">
                  No deployments yet. Generate and merge a PR to see deployment history.
               </div>
             </Panel>
          )}

        </div>

        {selectedIssue && (
          <div className="w-[26rem] flex-shrink-0 animate-in fade-in slide-in-from-right-4 duration-300 hidden lg:block sticky top-4">
            <OpportunityDetailPanel 
              title={selectedIssue.description || selectedIssue.issueType}
              evidence={[
                `Identified during crawl job ${jobId?.slice(0, 8)}...`,
                `Impacts URL: ${selectedIssue.affectedUrl}`,
              ]}
              businessImpact={`Fixing this issue improves user experience and potentially search rankings.`}
              recommendedAction={selectedIssue.recommendation || "Run AI Analyzer to identify the root cause, then generate a code fix."}
              aiRecommendation="Use the AI Website Engineer to automatically patch the source code and open a PR."
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
    </div>
  );
}

// Need to import Search for icons
import { Search } from "lucide-react";

export default function EngineerPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading AI Engineer...</div>}>
      <EngineerClient />
    </Suspense>
  );
}
