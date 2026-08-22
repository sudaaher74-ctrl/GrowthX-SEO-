"use client";
import { Suspense, useState } from "react";
import { Loader2, Search, Zap, CheckCircle2, XCircle, MinusCircle, RefreshCw, Plus, Sparkles } from "lucide-react";
import { PageHeader, Panel, Kpi, Table, Th, Tr, Td, ActionButton, Mono } from "@/components/ui/console";
import { QueryState } from "@/components/ui/upgrade-prompt";
import { useWorkspace, useVisibility, useTrackedPrompts, useRunSweep, useAddPrompts } from "@/hooks/use-growthx";
import { Button } from "@/components/ui/button";

function AiVisibilityClient() {
  const { projectId } = useWorkspace();
  const visibility = useVisibility(projectId, 28);
  const prompts = useTrackedPrompts(projectId);
  const sweep = useRunSweep(projectId);
  const addPrompts = useAddPrompts(projectId);

  const [activeTab, setActiveTab] = useState("ai");
  const [newQuery, setNewQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSweep = async () => {
    setStatusMessage(null);
    try {
      const res = await sweep.mutateAsync();
      await prompts.refetch();
      await visibility.refetch();
      setStatusMessage(`Sweep completed! Ran ${res.checksRun ?? 0} engine checks across active AI models.`);
    } catch (err) {
      console.error("Sweep error:", err);
      setStatusMessage(err instanceof Error ? err.message : "Failed to run sweep");
    }
  };

  const handleAddQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuery.trim() || !projectId) return;
    try {
      await addPrompts.mutateAsync([{ text: newQuery.trim(), cluster: "target buyer query" }]);
      setNewQuery("");
      setShowAddForm(false);
      await prompts.refetch();
      await handleSweep();
    } catch (err) {
      console.error("Add query error:", err);
    }
  };

  const handleAutoSeed = async () => {
    if (!projectId) return;
    try {
      await addPrompts.mutateAsync([
        { text: "best dairy products and fresh milk brand", cluster: "brand intent" },
        { text: "fresh organic farm milk subscription near me", cluster: "local intent" },
        { text: "top alternatives for farm fresh milk", cluster: "commercial" },
        { text: "buy fresh milk online", cluster: "transactional" },
      ]);
      await prompts.refetch();
      await handleSweep();
    } catch (err) {
      console.error("Auto seed error:", err);
    }
  };

  const report = visibility.data;
  const promptList = prompts.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Search & AI Visibility"
        subtitle="Track brand citations and answer-engine presence across ChatGPT, Claude, and Gemini."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs"
            >
              <Plus size={13} className="mr-1" /> Add Query
            </Button>
            <ActionButton
              variant="primary"
              icon={sweep.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              onClick={handleSweep}
              disabled={sweep.isPending || !projectId}
            >
              {sweep.isPending ? "Sweeping Models..." : "Sweep AI Engines"}
            </ActionButton>
          </div>
        }
      />

      {showAddForm && (
        <form onSubmit={handleAddQuery} className="card p-4 space-y-3 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Add Target Buyer Query</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              placeholder="e.g., best fresh A2 milk subscription"
              className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
            />
            <Button type="submit" variant="primary" size="sm" disabled={addPrompts.isPending || !newQuery.trim()}>
              {addPrompts.isPending ? "Adding..." : "Add & Sweep"}
            </Button>
          </div>
        </form>
      )}

      {statusMessage && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
          {statusMessage}
        </div>
      )}

      <div className="flex space-x-1 border-b border-brand-200 overflow-x-auto pb-[-1px]">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "ai"
              ? "border-brand-950 text-brand-950"
              : "border-transparent text-brand-500 hover:text-brand-950 hover:border-brand-300"
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
              value={promptList.length.toString()}
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
                <Search size={48} className="text-brand-200 mb-4" />
                <h3 className="text-lg font-medium text-[var(--text-primary)]">No Prompts Tracked</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-md mt-2">
                  Add target queries to monitor your visibility in ChatGPT, Claude, and Gemini.
                </p>
                <div className="mt-6 flex gap-3">
                  <Button variant="primary" size="sm" onClick={handleAutoSeed} disabled={addPrompts.isPending || sweep.isPending}>
                    <Sparkles size={14} className="mr-1.5" /> Auto-generate & Sweep Target Queries
                  </Button>
                </div>
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
                        <span className="text-[12.5px] font-medium text-brand-950">{row.text}</span>
                        {row.cluster && (
                          <span className="block mt-0.5 text-[11px] text-brand-500">{row.cluster}</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-brand-500">{row.intent || "—"}</span>
                      </Td>
                      <Td>
                        <Mono tone="soft">{row.estimatedVolume?.toLocaleString() || "—"}</Mono>
                      </Td>
                      {(["CHATGPT", "CLAUDE", "GEMINI"] as const).map((assistant) => {
                        const check = row.latestChecks.find((c) => c.assistant === assistant);
                        return (
                          <Td key={assistant}>
                            {check ? (
                              check.cited ? (
                                <div className="flex items-center text-success-500 gap-1" title={check.citedUrl || "Cited"}>
                                  <CheckCircle2 size={14} />
                                  <span className="text-[11px] font-medium">Cited</span>
                                </div>
                              ) : (
                                <div className="flex items-center text-error-500 gap-1" title="Not cited">
                                  <XCircle size={14} />
                                  <span className="text-[11px] font-medium">Miss</span>
                                </div>
                              )
                            ) : (
                              <div className="flex items-center text-brand-400 gap-1">
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
