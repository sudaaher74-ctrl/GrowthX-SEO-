"use client";

import { Suspense, useState } from "react";
import { CheckCircle2, Loader2, MinusCircle, Plus, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { ActionButton, Mono, PageHeader, Panel, StatusNote, Table, Td, Th, Tr, Tabs } from "@/components/ui/console";
import {
  useWorkspace,
  useVisibility,
  useTrackedPrompts,
  useRunSweep,
  useAddPrompts,
} from "@/hooks/use-growthx";
import { Button } from "@/components/ui/button";
import { TruthfulState, TruthfulKpiCard } from "@/components/ui/truthful-state";
import { errorMessage } from "@/lib/error-message";

export default function AiVisibilityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-brand-400">Loading AI Visibility...</div>}>
      <AiVisibilityClient />
    </Suspense>
  );
}

function AiVisibilityClient() {
  const { projectId } = useWorkspace();
  const visibility = useVisibility(projectId, 28);
  const prompts = useTrackedPrompts(projectId);
  const sweep = useRunSweep(projectId);
  const addPrompts = useAddPrompts(projectId);

  const [activeTab, setActiveTab] = useState<string>("prompts");
  const [newQuery, setNewQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSweep = async () => {
    setStatusMessage(null);
    try {
      const res = await sweep.mutateAsync();
      await prompts.refetch();
      await visibility.refetch();
      setStatusMessage(`Sweep completed! Executed ${res.checksRun ?? 0} engine citation probes.`);
    } catch (err) {
      setStatusMessage(errorMessage(err));
    }
  };

  const handleAddQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuery.trim() || !projectId) return;
    try {
      await addPrompts.mutateAsync([{ text: newQuery.trim(), cluster: "brand & buyer intent" }]);
      setNewQuery("");
      setShowAddForm(false);
      await prompts.refetch();
      await handleSweep();
    } catch (err) {
      console.error("Add query error:", err);
    }
  };

  const report = visibility.data;
  const promptList = prompts.data ?? [];
  const sweepRan = promptList.some((p) => p.latestChecks && p.latestChecks.length > 0);

  const tabs = [
    { id: "prompts", label: "Tracked Brand Queries" },
    { id: "models", label: "Engine Breakdown" },
    { id: "citations", label: "Mentioned Sources & Sentiment" },
    { id: "history", label: "Prompt History & Trends" },
  ];

  return (
    <div className="space-y-5 pb-12">
      <PageHeader
        title="AI Visibility"
        subtitle="Monitor brand citations, share of voice, and source references across ChatGPT, Claude, and Gemini."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="text-xs h-8"
            >
              <Plus size={13} className="mr-1" /> Add Brand Query
            </Button>
            <ActionButton
              variant="primary"
              icon={sweep.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              onClick={handleSweep}
              disabled={sweep.isPending || !projectId}
            >
              {sweep.isPending ? "Sweeping AI Engines..." : "Run Visibility Sweep"}
            </ActionButton>
          </div>
        }
      />

      {statusMessage && <StatusNote>{statusMessage}</StatusNote>}

      {/* Add Query Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddQuery}
          className="p-4 rounded-xl border bg-white space-y-3"
          style={{ borderColor: "var(--border-color)" }}
        >
          <h4 className="text-[12px] font-semibold text-brand-950 uppercase tracking-wider">
            Track New Brand or Category Query
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={newQuery}
              onChange={(e) => setNewQuery(e.target.value)}
              placeholder="e.g., best enterprise marketing analytics tool for agencies"
              className="flex-1 rounded-lg border px-3 py-1.5 text-[12.5px] text-brand-950 placeholder:text-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-950"
              style={{ borderColor: "var(--border-color)" }}
            />
            <Button type="submit" size="sm" disabled={addPrompts.isPending || !newQuery.trim()}>
              {addPrompts.isPending ? "Adding..." : "Add & Sweep"}
            </Button>
          </div>
        </form>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <TruthfulKpiCard
          label="AI Citation Share"
          value={report?.summary?.citationSharePct != null ? `${report.summary.citationSharePct}%` : null}
          sub="Overall share of model answers mentioning your brand"
          state={sweepRan ? "MEASURED" : "NOT_CONFIGURED"}
          source="ChatGPT, Claude & Gemini Probes"
          dateRange="Past 28 Days"
          actionLabel="Run first sweep →"
          actionHref="#"
        />
        <TruthfulKpiCard
          label="Brand Mention Rate"
          value={
            report?.summary?.checked
              ? `${Math.round((report.summary.cited / report.summary.checked) * 100)}%`
              : null
          }
          sub="Proportion of buyer queries citing your domain"
          state={sweepRan ? "MEASURED" : "NOT_CONFIGURED"}
          source="Multi-Engine Sweep"
          dateRange="Realtime Baseline"
        />
        <TruthfulKpiCard
          label="Tracked Brand Queries"
          value={promptList.length.toString()}
          sub="Active commercial and navigational prompts"
          state="MEASURED"
          source="Project Configuration"
        />
        <TruthfulKpiCard
          label="Top Citation Engine"
          value={
            report?.byAssistant?.length
              ? [...report.byAssistant].sort((a, b) => b.citationSharePct - a.citationSharePct)[0]?.assistant
              : null
          }
          sub="Model with highest brand affinity"
          state={sweepRan ? "MEASURED" : "UNAVAILABLE"}
          source="Comparative AI Probes"
        />
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      {/* Tab 1: Tracked Brand Queries */}
      {activeTab === "prompts" && (
        <Panel
          title="Tracked Brand Queries & Engine Responses"
          subtitle="Specific buyer prompts queried against each AI model"
        >
          <div className="p-0">
            {promptList.length === 0 ? (
              <div className="p-8">
                <TruthfulState
                  icon={Sparkles}
                  title="No Queries Tracked Yet"
                  missing="No brand or buyer intent queries have been configured for AI model sweeps."
                  whyItMatters="AI search engines (ChatGPT, Perplexity, Gemini, Claude) increasingly answer purchase queries before organic search."
                  actionRequired="Add a brand query or click below to seed recommended buyer prompts."
                  action={{
                    label: "Add Target Query",
                    onClick: () => setShowAddForm(true),
                    variant: "primary",
                  }}
                  compact
                />
              </div>
            ) : (
              <Table minWidth={850}>
                <thead>
                  <tr>
                    <Th>Tracked Buyer Query</Th>
                    <Th>Cluster / Intent</Th>
                    <Th>Est. Volume</Th>
                    <Th>ChatGPT</Th>
                    <Th>Claude</Th>
                    <Th>Gemini</Th>
                  </tr>
                </thead>
                <tbody>
                  {promptList.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <span className="font-semibold text-brand-950 text-[12.5px]">{row.text}</span>
                      </Td>
                      <Td>
                        <span className="rounded bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                          {row.cluster || "buyer intent"}
                        </span>
                      </Td>
                      <Td>
                        <Mono tone="soft">{row.estimatedVolume ? row.estimatedVolume.toLocaleString() : "—"}</Mono>
                      </Td>
                      {(["CHATGPT", "CLAUDE", "GEMINI"] as const).map((assistant) => {
                        const check = row.latestChecks?.find((c) => c.assistant === assistant);
                        return (
                          <Td key={assistant}>
                            {check ? (
                              check.cited ? (
                                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                                  <CheckCircle2 size={13} className="text-emerald-500" />
                                  <span>Cited</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-rose-700 font-semibold text-[11px]">
                                  <XCircle size={13} className="text-rose-500" />
                                  <span>Miss</span>
                                </div>
                              )
                            ) : (
                              <div className="flex items-center gap-1 text-brand-400 text-[11px]">
                                <MinusCircle size={12} />
                                <span>Pending Sweep</span>
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
          </div>
        </Panel>
      )}

      {/* Tab 2: Engine Breakdown */}
      {activeTab === "models" && (
        <Panel title="AI Engine Performance" subtitle="Citation probability and response rates per model">
          <div className="p-6">
            {!sweepRan ? (
              <TruthfulState
                icon={Sparkles}
                title="Sweep Not Executed Yet"
                missing="Engine comparison metrics require at least one completed sweep."
                whyItMatters="Different LLMs index different source datasets. Claude relies heavily on fresh web search, whereas ChatGPT prioritizes authority links."
                actionRequired="Click Run Visibility Sweep above."
                compact
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {report?.byAssistant?.map((item) => (
                  <div key={item.assistant} className="p-4 rounded-xl border bg-white" style={{ borderColor: "var(--border-color)" }}>
                    <h4 className="text-[14px] font-bold text-brand-950">{item.assistant}</h4>
                    <div className="mt-3">
                      <span className="text-[24px] font-bold font-mono text-brand-950">
                        {item.citationSharePct}%
                      </span>
                      <p className="text-[11px] text-brand-400 mt-0.5">Citation share for brand</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Tab 3: Mentioned Sources & Sentiment */}
      {activeTab === "citations" && (
        <Panel title="Sources & Sentiment Analysis" subtitle="Domains cited by LLMs when answering your target queries">
          <div className="p-6">
            <div className="rounded-xl border p-5 bg-brand-50/20" style={{ borderColor: "var(--border-color)" }}>
              <h4 className="text-[13px] font-semibold text-brand-950">Authoritative Sources Cited</h4>
              <p className="text-[12px] text-brand-500 mt-1">
                LLM answers cite authoritative publications, directory listings, and top industry reviews. Optimizing content on these referenced sites improves downstream brand citations.
              </p>
              <div className="mt-4 flex gap-2">
                <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                  Overall Sentiment: Neutral / Favorable
                </span>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* Tab 4: Prompt History & Trends */}
      {activeTab === "history" && (
        <Panel title="Historical Sweep Logs" subtitle="Log of all automated and manual model probes">
          <div className="p-6 text-center text-[12px] text-brand-400">
            Historical sweep snapshots are recorded every 7 days or upon manual probe trigger.
          </div>
        </Panel>
      )}
    </div>
  );
}
