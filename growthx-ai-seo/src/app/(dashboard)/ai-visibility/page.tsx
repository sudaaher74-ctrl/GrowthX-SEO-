"use client";

import { Suspense, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles,
  Plus,
  RefreshCw,
  Loader2,
  Calendar,
  ChevronDown,
  ArrowRight,
  X,
  Bot,
  MessageSquare,
  Building2,
  Globe,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  useWorkspace,
  useVisibility,
  useTrackedPrompts,
  useRunSweep,
  useAddPrompts,
  useAddCompetitor,
  useLatestCrawl,
} from "@/hooks/use-growthx";
import { api, type TrackedCompetitor } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

// New AI Visibility Components
import { AiPipelineBanner } from "@/components/ai-visibility/ai-pipeline-banner";
import { AiVisibilityOverviewTab } from "@/components/ai-visibility/ai-visibility-overview-tab";
import { AiVisibilityCompetitorsTab } from "@/components/ai-visibility/ai-visibility-competitors-tab";
import { AiVisibilityRecommendationsTab } from "@/components/ai-visibility/ai-visibility-recommendations-tab";
import { AiInsightsTab } from "@/components/ai-visibility/ai-visibility-insights-tab";
import { GeoSimulationSandbox } from "@/components/ai-visibility/geo-simulation-sandbox";
import {
  CitationsTabContent,
  ContentGapsTabContent,
} from "@/components/ai-visibility/ai-visibility-other-tabs";
import { assistantList } from "@/lib/ai-assistants";

export default function AiVisibilityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading AI Visibility...</div>}>
      <AiVisibilityClient />
    </Suspense>
  );
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "sandbox", label: "GEO Sandbox & Simulation" },
  { id: "insights", label: "AI Insights" },
  { id: "citations", label: "Citations" },
  { id: "competitors", label: "Competitors" },
  { id: "gaps", label: "Content Gaps" },
  { id: "recommendations", label: "Recommendations" },
];

function AiVisibilityClient() {
  const { orgId, projectId, projects } = useWorkspace();
  const qc = useQueryClient();
  
  const currentProject = projects?.find(p => p.id === projectId);
  // Empty until a project is selected; never another business's domain.
  const domain = currentProject?.name ?? "";
  const businessName = domain.split('.')[0] || "your business";

  const visibility = useVisibility(projectId, 28);
  const prompts = useTrackedPrompts(projectId);
  const sweep = useRunSweep(projectId);
  const addPrompts = useAddPrompts(projectId);
  const addCompetitor = useAddCompetitor(projectId);
  const crawlQuery = useLatestCrawl(domain);

  // Competitor list query
  const competitorsQuery = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => (projectId ? api.listCompetitors(projectId) : Promise.resolve([])),
    enabled: !!projectId,
  });

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [showAddQueryModal, setShowAddQueryModal] = useState(false);
  const [showAddCompModal, setShowAddCompModal] = useState(false);
  const [newQueryText, setNewQueryText] = useState("");
  const [newCompDomain, setNewCompDomain] = useState("");
  const [statusMessage, setStatusMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Pages crawled count
  const pagesCrawled = crawlQuery.data?.pagesCrawled;

  // Run AI Visibility probe / sweep
  const handleRunSweep = async () => {
    setStatusMessage(null);
    try {
      const res = await sweep.mutateAsync();
      await prompts.refetch();
      await visibility.refetch();
      // Report exactly what ran — never "completed" for a sweep where every
      // check failed.
      const parts = [
        `${res.checksRun} answer${res.checksRun === 1 ? "" : "s"} checked`,
        `cited in ${res.citations}`,
      ];
      if (res.checksFailed > 0) parts.push(`${res.checksFailed} could not run`);
      if (res.skippedAssistants.length > 0) parts.push(`${assistantList(res.skippedAssistants)} not enabled`);
      setStatusMessage({
        text: res.checksRun > 0 ? `Sweep finished: ${parts.join(", ")}.` : `No answers were measured: ${parts.join(", ")}.`,
        ok: res.checksRun > 0,
      });
    } catch (err) {
      setStatusMessage({ text: errorMessage(err), ok: false });
    }
  };

  // Add brand query handler
  const handleAddQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueryText.trim() || !projectId) return;
    try {
      await addPrompts.mutateAsync([{ text: newQueryText.trim(), cluster: "brand & buyer intent" }]);
      setNewQueryText("");
      setShowAddQueryModal(false);
      await prompts.refetch();
      await handleRunSweep();
    } catch (err) {
      console.error("Add query error:", err);
    }
  };

  // Add competitor handler
  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompDomain.trim() || !projectId) return;
    try {
      await addCompetitor.mutateAsync({ domain: newCompDomain.trim() });
      setNewCompDomain("");
      setShowAddCompModal(false);
      await competitorsQuery.refetch();
    } catch (err) {
      console.error("Add competitor error:", err);
    }
  };

  const report = visibility.data;
  const promptList = prompts.data ?? [];
  const competitorsList = competitorsQuery.data ?? [];
  const assistantsAsked = assistantList(report?.measurableAssistants);

  return (
    <div className="space-y-6 pb-16">
      {/* ── HEADER SECTION ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100/70 text-slate-900 border border-slate-200 shadow-2xs">
            <Sparkles size={20} className="text-slate-900" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900 leading-none">
              AI Visibility
            </h1>
            <p className="mt-1.5 text-[12.5px] text-slate-500 max-w-2xl leading-relaxed">
              {activeTab === "sandbox"
                ? `Ask ${assistantsAsked} any search question live, see whether your brand is cited, and get a draft section to answer it.`
                : activeTab === "competitors"
                ? `See how often ${assistantsAsked} names your brand versus your tracked competitors.`
                : activeTab === "recommendations"
                ? `Recommendations drawn from what ${assistantsAsked} actually said about your market.`
                : `Track whether ${assistantsAsked} cites your brand when buyers ask your questions.`}
            </p>
          </div>
        </div>

        {/* Action buttons on the right */}
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab !== "sandbox" && (
            <button
              type="button"
              onClick={() => setActiveTab("sandbox")}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-[12px] font-bold text-slate-800 shadow-2xs hover:bg-slate-100 transition-colors"
            >
              <Bot size={14} className="text-slate-900" />
              <span>Launch GEO Sandbox</span>
            </button>
          )}

          {activeTab === "competitors" || activeTab === "recommendations" ? (
            <>
              {/* Domain dropdown button */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-2xs">
                <Globe size={13} className="text-slate-400" />
                <span>{domain}</span>
                <ChevronDown size={12} className="text-slate-400 ml-1" />
              </div>

              {/* Date range dropdown */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-2xs">
                <Calendar size={13} className="text-slate-400" />
                <span>Last 28 days</span>
                <ChevronDown size={12} className="text-slate-400 ml-1" />
              </div>

              <button
                type="button"
                onClick={handleRunSweep}
                disabled={sweep.isPending || !projectId}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-slate-950 to-indigo-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-black hover:to-slate-900 transition-all disabled:opacity-60 active:scale-[0.98]"
              >
                {sweep.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>Run AI Analysis</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setShowAddQueryModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <Plus size={14} className="text-slate-900" />
                <span>Add Brand Query</span>
              </button>

              <button
                type="button"
                onClick={handleRunSweep}
                disabled={sweep.isPending || !projectId}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-slate-950 to-indigo-600 px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:from-black hover:to-slate-900 transition-all disabled:opacity-60 active:scale-[0.98]"
              >
                {sweep.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Sweeping Models...</span>
                  </>
                ) : (
                  <>
                    <span>Run AI Visibility</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status banner if sweep finished */}
      {statusMessage && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12.5px] font-medium ${
            statusMessage.ok ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"
          }`}
        >
          {statusMessage.ok ? (
            <CheckCircle2 size={15} className="text-success-600 shrink-0" />
          ) : (
            <AlertTriangle size={15} className="text-warning-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="ml-auto opacity-70 hover:opacity-100"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── TOP PIPELINE STATUS BANNER ── */}
      <AiPipelineBanner
        mode={
          activeTab === "competitors"
            ? "competitors"
            : activeTab === "recommendations"
            ? "recommendations"
            : "overview"
        }
        domain={domain}
        crawledPages={pagesCrawled}
        competitorsCount={competitorsList.length}
        report={report}
        onViewInsights={() => setActiveTab("insights")}
        onViewCrawlDetails={() => window.location.assign("/website")}
        isAnalyzing={sweep.isPending}
      />

      {/* ── SUB-NAVIGATION TABS ── */}
      <div className="flex items-center justify-between border-b border-slate-200/90">
        <div className="flex items-center gap-6">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative pb-3 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "font-bold text-slate-800"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-slate-950" />
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "competitors" && (
          <button
            type="button"
            onClick={() => setShowAddCompModal(true)}
            className="mb-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <Plus size={12} className="text-slate-900" />
            <span>Add Competitor</span>
          </button>
        )}
      </div>

      {/* ── TAB CONTENT RENDERING ── */}
      {activeTab === "overview" && (
        <AiVisibilityOverviewTab
          report={report}
          trackedPromptsCount={promptList.length}
          domain={domain}
          businessName={businessName}
          onViewCompetitorsTab={() => setActiveTab("competitors")}
          onViewInsightsTab={() => setActiveTab("insights")}
          onViewRecommendationsTab={() => setActiveTab("recommendations")}
          onGenerateRecommendations={() => setActiveTab("recommendations")}
        />
      )}

      {activeTab === "sandbox" && (
        <GeoSimulationSandbox
          projectId={projectId}
          availableEngines={report?.measurableAssistants}
          suggestions={promptList.map((p) => p.text)}
        />
      )}

      {activeTab === "competitors" && (
        <AiVisibilityCompetitorsTab
          report={report}
          competitors={competitorsList}
          domain={domain}
          onAddCompetitor={() => setShowAddCompModal(true)}
          onViewAllGaps={() => setActiveTab("gaps")}
        />
      )}

      {activeTab === "insights" && (
        <AiInsightsTab projectId={projectId} onRunSweep={handleRunSweep} />
      )}

      {activeTab === "citations" && (
        <CitationsTabContent
          promptList={promptList}
          report={report}
          onAddQuery={() => setShowAddQueryModal(true)}
        />
      )}

      {activeTab === "gaps" && (
        <ContentGapsTabContent promptList={promptList} onAddQuery={() => setShowAddQueryModal(true)} />
      )}

      {activeTab === "recommendations" && (
        <AiVisibilityRecommendationsTab projectId={projectId} onRunSweep={handleRunSweep} />
      )}

      {/* ── MODAL: ADD BRAND QUERY ── */}
      {showAddQueryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-slate-900" />
                <h3 className="text-[15px] font-bold text-slate-900">Add Brand Query to Monitor</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddQueryModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddQuery} className="mt-4 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-slate-700">
                  Target Search Query or Buyer Intent Prompt
                </label>
                <input
                  type="text"
                  value={newQueryText}
                  onChange={(e) => setNewQueryText(e.target.value)}
                  placeholder="e.g., best AI SEO software for agencies"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
                  autoFocus
                />
                <p className="mt-1.5 text-[11px] text-slate-500 leading-normal">
                  We will ask {assistantsAsked} this question on every sweep and record whether your brand is cited.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddQueryModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addPrompts.isPending || !newQueryText.trim()}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-black transition-colors disabled:opacity-50"
                >
                  {addPrompts.isPending ? "Adding..." : "Add & Monitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: ADD COMPETITOR ── */}
      {showAddCompModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-slate-900" />
                <h3 className="text-[15px] font-bold text-slate-900">Add Competitor Domain</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCompModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddCompetitor} className="mt-4 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-slate-700">
                  Competitor Website Domain
                </label>
                <input
                  type="text"
                  value={newCompDomain}
                  onChange={(e) => setNewCompDomain(e.target.value)}
                  placeholder="e.g., semrush.com or ahrefs.com"
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900"
                  autoFocus
                />
                <p className="mt-1.5 text-[11px] text-slate-500 leading-normal">
                  We will compare AI mention frequency and citation share for this competitor against your brand.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCompModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addCompetitor.isPending || !newCompDomain.trim()}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-[12px] font-bold text-white shadow-xs hover:bg-black transition-colors disabled:opacity-50"
                >
                  {addCompetitor.isPending ? "Adding..." : "Add Competitor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
