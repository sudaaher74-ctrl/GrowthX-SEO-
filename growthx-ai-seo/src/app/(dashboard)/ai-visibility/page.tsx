"use client";

import { QueryState } from "@/components/ui/query-state";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bot, ChevronDown, Crosshair, Layers, Link2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useWorkspace,
  useVisibility,
  useTrackedPrompts,
  useRunSweep,
  useAddPrompts,
  useAddCompetitor,
  useLatestCrawl,
  usePortfolio,
  setActiveProject,
} from "@/hooks/use-growthx";
import { useGoogleOverview } from "@/hooks/use-google";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { ActionButton, StatusNote } from "@/components/ui/console";
import { AiVisibilityDashboard } from "@/components/ai-visibility/ai-visibility-dashboard";
import { CitationIntelligenceDashboard } from "@/components/ai-visibility/citation-intelligence-dashboard";
import { CompetitorIntelligenceDashboard } from "@/components/ai-visibility/competitor-intelligence-dashboard";
import { RootCauseAnalysisDashboard } from "@/components/ai-visibility/root-cause-analysis-dashboard";
import { AiVisibilityOverview, overviewFigures } from "@/components/ai-visibility/av-overview";
import {
  ActionCenterView,
  CitationIntelligenceView,
  CompetitorComparisonView,
  ModelVisibilityView,
  MonitoringHistoryView,
  PromptIntelligenceView,
  RootCauseView,
  SettingsView,
  UnifiedIntelligenceView,
} from "@/components/ai-visibility/av-views";
import { type AvPrompt } from "@/components/ai-visibility/av-shared";

/** Sister tabs and sub-tabs linked from sidebar or internal controls */
const TABS = [
  { id: "overview", label: "AI Visibility", icon: Bot },
  { id: "citations", label: "Citation Intelligence", icon: Link2 },
  { id: "competitors", label: "Competitor Intelligence", icon: Crosshair },
  { id: "root-cause", label: "Root Cause Analysis", icon: Layers },
  { id: "unified", label: "Unified Intelligence", icon: Sparkles },
  { id: "models", label: "AI Model Visibility", icon: Bot },
  { id: "prompts", label: "Prompt Intelligence", icon: Sparkles },
  { id: "actions", label: "Action Center", icon: Sparkles },
  { id: "history", label: "Monitoring History", icon: Sparkles },
  { id: "settings", label: "Settings", icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_ALIASES: Record<string, TabId> = {
  "citation-intelligence": "citations",
  "citation": "citations",
  "competitor-intelligence": "competitors",
  "competitors": "competitors",
  "competitor": "competitors",
  "competitor-comparison": "competitors",
  "root-cause-analysis": "root-cause",
  "root-cause": "root-cause",
};

export default function AiVisibilityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-brand-400">Loading AI Visibility…</div>}>
      <AiVisibilityClient />
    </Suspense>
  );
}

function AiVisibilityClient() {
  const { orgId, projectId, projects, isLoading: workspaceLoading, error: workspaceError } = useWorkspace();
  const router = useRouter();
  const portfolio = usePortfolio(orgId);
  const currentProject = projects?.find((p) => p.id === projectId);
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const domain = clientRow?.domain ?? "";
  const brandLabel = currentProject?.name || "Your Brand";

  const [days, setDays] = useState(30);
  const visibility = useVisibility(projectId, days);
  const prompts = useTrackedPrompts(projectId);

  const addPrompts = useAddPrompts(projectId);
  const addCompetitor = useAddCompetitor(projectId);
  const crawl = useLatestCrawl(domain || null);
  const google = useGoogleOverview(projectId);

  const competitorsQuery = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => (projectId ? api.listCompetitors(projectId) : Promise.resolve([])),
    enabled: !!projectId,
  });
  const citationsQuery = useQuery({ queryKey:['ai-visibility-citations',projectId],queryFn:()=>api.getAiVisibilityCitations(projectId!),enabled:!!projectId });
  const rootCauseQuery = useQuery({
    queryKey: ["ai-visibility-root-cause", projectId],
    queryFn: () => (projectId ? api.getAiVisibilityRootCause(projectId) : Promise.resolve(null)),
    enabled: !!projectId,
  });
  const actionsQuery = useQuery({
    queryKey: ["ai-visibility-actions", projectId],
    queryFn: () => (projectId ? api.getAiVisibilityActions(projectId) : Promise.resolve([])),
    enabled: !!projectId,
  });

  const tabParam = useSearchParams().get("tab");
  const resolvedTab = (tabParam && TAB_ALIASES[tabParam]) || (TABS.find((t) => t.id === tabParam)?.id ?? "overview") as TabId;
  const [tabState, setTabState] = useState({ param: tabParam, tab: resolvedTab });
  if (tabState.param !== tabParam) setTabState({ param: tabParam, tab: resolvedTab });
  const activeTab = tabState.tab;

  const setActiveTab = (tab: string) => {
    const resolved = (TAB_ALIASES[tab] || TABS.find((t) => t.id === tab)?.id || "overview") as TabId;
    setTabState({ param: resolved, tab: resolved });
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", resolved);
      window.history.replaceState(null, "", url.toString());
    }
  };

  const [dialog, setDialog] = useState<"prompt" | "competitor" | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  const report = visibility.data;
  const promptList = (prompts.data ?? []) as unknown as AvPrompt[];
  const competitors = competitorsQuery.data ?? [];

  const runScan = async () => { router.push('/ai-visibility/journey'); };

  const submitDialog = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !projectId) return;
    try {
      if (dialog === "prompt") {
        await addPrompts.mutateAsync([{ text: value, cluster: "custom" }]);
        await prompts.refetch();
      } else {
        await addCompetitor.mutateAsync({ domain: value });
        await competitorsQuery.refetch();
      }
      setText("");
      setDialog(null);
    } catch (err) {
      setNote({ text: errorMessage(err), ok: false });
      setDialog(null);
    }
  };

  const busy = addPrompts.isPending || addCompetitor.isPending;

  const viewParam = useSearchParams().get("view");
  const _figures = overviewFigures(report);
  const dependentQueries = activeTab === 'unified' ? [portfolio, crawl, google.query, competitorsQuery] : activeTab === 'competitors' ? [competitorsQuery] : activeTab === 'overview' ? [citationsQuery, actionsQuery] : [];

  return (
    <div className="space-y-4">
      {note && <StatusNote tone={note.ok ? "good" : "bad"}>{note.text}</StatusNote>}
      {visibility.error && !visibility.isLoading && (
        <StatusNote tone="bad">Could not load visibility data: {errorMessage(visibility.error)}</StatusNote>
      )}

      {/* ── Sister Tabs Navigation Bar ─────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-2 shadow-xs"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
              activeTab === "overview"
                ? "bg-primary-600 text-white shadow-xs"
                : "text-brand-600 hover:text-brand-950 hover:bg-brand-50"
            )}
          >
            <Bot className="h-4 w-4" />
            <span>AI Visibility</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("citations")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
              activeTab === "citations"
                ? "bg-primary-600 text-white shadow-xs"
                : "text-brand-600 hover:text-brand-950 hover:bg-brand-50"
            )}
          >
            <Link2 className="h-4 w-4" />
            <span>Citation Intelligence</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("competitors")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
              activeTab === "competitors"
                ? "bg-primary-600 text-white shadow-xs"
                : "text-brand-600 hover:text-brand-950 hover:bg-brand-50"
            )}
          >
            <Crosshair className="h-4 w-4" />
            <span>Competitor Intelligence</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("root-cause")}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
              activeTab === "root-cause"
                ? "bg-primary-600 text-white shadow-xs"
                : "text-brand-600 hover:text-brand-950 hover:bg-brand-50"
            )}
          >
            <Layers className="h-4 w-4" />
            <span>Root Cause Analysis</span>
          </button>
        </div>

        {/* Secondary Sub-Views Dropdown / Quick Links */}
        <div className="flex items-center gap-2">
          {["unified", "models", "prompts", "actions", "history", "settings"].includes(activeTab) && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                {TABS.find((t) => t.id === activeTab)?.label}
              </span>
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            </div>
          )}

          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-xl border bg-brand-50/50 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-100/60 hover:text-brand-950 transition"
              style={{ borderColor: "var(--border-color)" }}
            >
              <span>More Views</span>
              <ChevronDown className="h-3.5 w-3.5 text-brand-400" />
            </button>
            <div
              className="absolute right-0 top-full z-20 mt-1 hidden w-48 rounded-xl border bg-white p-1 shadow-lg group-hover:block"
              style={{ borderColor: "var(--border-color)" }}
            >
              {[
                { id: "unified", label: "Unified Intelligence" },
                { id: "models", label: "AI Model Visibility" },
                { id: "prompts", label: "Prompt Intelligence" },
                { id: "actions", label: "Action Center" },
                { id: "history", label: "Monitoring History" },
                { id: "settings", label: "Settings" },
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setActiveTab(sub.id)}
                  className={cn(
                    "flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-xs transition",
                    activeTab === sub.id
                      ? "bg-primary-50 font-semibold text-primary-700"
                      : "text-brand-600 hover:bg-brand-50 hover:text-brand-950"
                  )}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <QueryState isLoading={workspaceLoading} error={workspaceError} isEmpty={!projectId} emptyTitle="Choose a project to view real measurements" emptyBody="Add your website to begin monitoring.">
      <QueryState isLoading={visibility.isLoading || prompts.isLoading || dependentQueries.some(q=>q.isLoading) || (activeTab === 'citations' && citationsQuery.isLoading) || (activeTab === 'root-cause' && rootCauseQuery.isLoading)} error={visibility.error || prompts.error || dependentQueries.find(q=>q.error)?.error || (activeTab === 'citations' ? citationsQuery.error : activeTab === 'root-cause' ? rootCauseQuery.error : activeTab === 'actions' ? actionsQuery.error : null)}>
      {/* ── Main Views ────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        viewParam === "table" ? (
          <AiVisibilityOverview
            report={report}
            prompts={promptList}
            loading={visibility.isLoading || prompts.isLoading}
            brandLabel={brandLabel}
            onNavigate={setActiveTab}
          />
        ) : (
          <AiVisibilityDashboard
            report={report}
            prompts={promptList}
            domain={domain}
            brandLabel={brandLabel}
            citations={citationsQuery.data}
            rootCause={rootCauseQuery.data}
            actions={actionsQuery.data}
            competitors={competitors}
            projects={projects}
            currentProjectId={projectId ?? undefined}
            onSelectProject={(id) => setActiveProject(id)}
            days={days}
            onDaysChange={setDays}
            onRunScan={runScan}
            isScanning={false}
            onNavigateTab={setActiveTab}
          />
        )
      )}

      {activeTab === "citations" && (
        viewParam === "classic" ? (
          <CitationIntelligenceView citations={citationsQuery.data} />
        ) : (
          <CitationIntelligenceDashboard
            domain={domain}
            brandLabel={brandLabel}
            report={report}
            prompts={promptList}
            citations={citationsQuery.data}
            rootCause={rootCauseQuery.data}
            actions={actionsQuery.data}
            competitors={competitors}
            projects={projects}
            currentProjectId={projectId ?? undefined}
            onSelectProject={(id) => setActiveProject(id)}
            days={days}
            onDaysChange={setDays}
            onRunScan={runScan}
            isScanning={false}
          />
        )
      )}

      {activeTab === "unified" && (
        <UnifiedIntelligenceView
          businessName={brandLabel}
          domain={domain}
          crawl={crawl.data}
          google={google.query.data}
          googleLoading={google.query.isLoading}
          competitors={competitors}
        />
      )}

      {activeTab === "models" && <ModelVisibilityView report={report} />}

      {activeTab === "prompts" && (
        <PromptIntelligenceView prompts={promptList} onAddPrompt={() => setDialog("prompt")} />
      )}

      {activeTab === "competitors" && (
        viewParam === "classic" ? (
          <CompetitorComparisonView
            report={report}
            competitors={competitors}
            brandLabel={brandLabel}
            onAddCompetitor={() => setDialog("competitor")}
          />
        ) : (
          <CompetitorIntelligenceDashboard
            domain={domain}
            brandLabel={brandLabel}
            report={report}
            prompts={promptList}
            citations={citationsQuery.data}
            rootCause={rootCauseQuery.data}
            actions={actionsQuery.data}
            competitors={competitors}
            projects={projects}
            currentProjectId={projectId ?? undefined}
            onSelectProject={(id) => setActiveProject(id)}
            days={days}
            onDaysChange={setDays}
            onRunScan={runScan}
            isScanning={false}
          />
        )
      )}

      {activeTab === "root-cause" && (
        viewParam === "classic" ? (
          <RootCauseView rootCause={rootCauseQuery.data} />
        ) : (
          <RootCauseAnalysisDashboard
            domain={domain}
            brandLabel={brandLabel}
            report={report}
            prompts={promptList}
            citations={citationsQuery.data}
            rootCause={rootCauseQuery.data}
            actions={actionsQuery.data}
            competitors={competitors}
            projects={projects}
            currentProjectId={projectId ?? undefined}
            onSelectProject={(id) => setActiveProject(id)}
            days={days}
            onDaysChange={setDays}
            onRunScan={runScan}
            isScanning={false}
          />
        )
      )}
      {activeTab === "actions" && <ActionCenterView actions={actionsQuery.data} />}
      {activeTab === "history" && <MonitoringHistoryView report={report} />}
      {activeTab === "settings" && <SettingsView report={report} />}

      </QueryState></QueryState>
      {dialog && (
        <AddDialog
          title={dialog === "prompt" ? "Add a prompt to monitor" : "Add a competitor"}
          label={dialog === "prompt" ? "Customer question" : "Competitor website"}
          placeholder={dialog === "prompt" ? "e.g. Which companies provide fresh delivery?" : "e.g. competitor.com"}
          hint={
            dialog === "prompt"
              ? "Keep it neutral — do not include your brand name, or results will be biased."
              : "We compare how often each competitor is named next to your brand."
          }
          value={text}
          onChange={setText}
          onSubmit={submitDialog}
          onClose={() => setDialog(null)}
          busy={busy}
        />
      )}
    </div>
  );
}

function AddDialog(props: {
  title: string;
  label: string;
  placeholder: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 p-4" onClick={props.onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="av-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={props.onSubmit}
        className="w-full max-w-md rounded-xl border bg-white p-5 shadow-card-hover"
      >
        <h2 id="av-dialog-title" className="text-[14px] font-semibold text-brand-950">{props.title}</h2>
        <label htmlFor="av-dialog-input" className="mt-4 block text-[12px] font-medium text-brand-700">
          {props.label}
        </label>
        <input
          id="av-dialog-input"
          ref={ref}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className="mt-1.5 w-full rounded-lg border px-3 py-2 text-[13px] text-brand-950 placeholder:text-brand-300 focus-visible:outline-2 focus-visible:outline-primary-600"
        />
        <p className="mt-1.5 text-[11.5px] text-brand-500">{props.hint}</p>
        <div className="mt-4 flex justify-end gap-2">
          <ActionButton type="button" onClick={props.onClose}>Cancel</ActionButton>
          <ActionButton type="submit" variant="primary" disabled={props.busy || !props.value.trim()}>
            {props.busy ? "Adding…" : "Add"}
          </ActionButton>
        </div>
      </form>
    </div>
  );
}
