"use client";
import { Suspense, useState } from "react";
import { Loader2, Search, Layout, Zap, Hash, BarChart3, TrendingUp, CheckCircle2, XCircle, MinusCircle, RefreshCw } from "lucide-react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, ActionButton, Mono } from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { useWorkspace, useVisibility, useTrackedPrompts, useRunSweep } from "@/hooks/use-growthx";

function AiVisibilityClient() {
  const { projectId } = useWorkspace();
  const visibility = useVisibility(projectId, 28);
  const prompts = useTrackedPrompts(projectId);
  const sweep = useRunSweep(projectId);

  const [activeTab, setActiveTab] = useState("ai");

  const handleSweep = async () => {
    await sweep.mutateAsync();
  };

  const report = visibility.data;
  const promptList = prompts.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Search & AI Visibility"
        subtitle="Track brand citations and answer-engine presence across AI models."
        actions={
          <ActionButton
            variant="primary"
            icon={sweep.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            onClick={handleSweep}
            disabled={sweep.isPending || !projectId}
          >
            {sweep.isPending ? "Sweeping Models..." : "Sweep AI Engines"}
          </ActionButton>
        }
      />

      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "ai"
              ? "border-[#09090b] text-[#09090b]"
              : "border-transparent text-[#71717a] hover:text-[#09090b] hover:border-[#d4d4d8]"
          }`}
        >
          <Zap size={14} />
          AI Visibility
        </button>
      </div>

      <div className="pt-2">
        <QueryState
          isLoading={visibility.isLoading || prompts.isLoading}
          error={visibility.error || prompts.error}
          isEmpty={!projectId}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Kpi
              label="Citation Share"
              value={report?.summary?.citationSharePct != null ? `${report.summary.citationSharePct}%` : "—"}
              sub="Overall brand presence in AI answers"
            />
            <Kpi
              label="Tracked Prompts"
              value={report?.summary?.checked?.toString() || "—"}
              sub="Active buyer queries monitored"
            />
            <Kpi
              label="Top Model"
              value={
                report?.byAssistant?.length
                  ? report.byAssistant.sort((a, b) => b.citationSharePct - a.citationSharePct)[0]?.assistant
                  : "—"
              }
              sub="Highest citation probability"
            />
          </div>

          <Panel title="Tracked Prompts" subtitle="Citation status per AI model">
            {promptList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search size={48} className="text-[#e4e4e7] mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">No Prompts Tracked</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  Add target queries to monitor your visibility in ChatGPT, Claude, and Gemini.
                </p>
              </div>
            ) : (
              <Table minWidth={900}>
                <thead>
                  <tr>
                    <Th>Buyer Query</Th>
                    <Th>Intent</Th>
                    <Th>Volume</Th>
                    <Th>ChatGPT</Th>
                    <Th>Claude</Th>
                    <Th>Gemini</Th>
                  </tr>
                </thead>
                <tbody>
                  {promptList.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <span className="text-[12.5px] font-medium text-[#09090b]">{row.text}</span>
                        {row.cluster && (
                          <span className="block mt-0.5 text-[11px] text-[#71717a]">{row.cluster}</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-[#71717a]">{row.intent || "—"}</span>
                      </Td>
                      <Td>
                        <Mono tone="soft">{row.estimatedVolume?.toLocaleString() || "—"}</Mono>
                      </Td>
                      {(["CHATGPT", "CLAUDE", "GEMINI"] as const).map((assistant) => {
                        const check = row.latestChecks.find(c => c.assistant === assistant);
                        return (
                          <Td key={assistant}>
                            {check ? (
                              check.cited ? (
                                <div className="flex items-center text-[#16a34a] gap-1" title={check.citedUrl || "Cited"}>
                                  <CheckCircle2 size={14} />
                                  <span className="text-[11px] font-medium">Cited</span>
                                </div>
                              ) : (
                                <div className="flex items-center text-[#dc2626] gap-1" title="Not cited">
                                  <XCircle size={14} />
                                  <span className="text-[11px] font-medium">Miss</span>
                                </div>
                              )
                            ) : (
                              <div className="flex items-center text-[#a1a1aa] gap-1">
                                <MinusCircle size={14} />
                                <span className="text-[11px] font-medium">Pending</span>
                              </div>
                            )}
                          </Td>
                        );
                      })}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </QueryState>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex h-32 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading AI visibility...</div>}>
      <AiVisibilityClient />
    </Suspense>
  );
}
