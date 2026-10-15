"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
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
import { AiVisibilityDashboard } from "@/components/ai-visibility/ai-visibility-dashboard";
import { CitationIntelligenceDashboard } from "@/components/ai-visibility/citation-intelligence-dashboard";
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

/** Sub-tabs linked from sidebar or internal cards */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "unified", label: "Unified Intelligence" },
  { id: "models", label: "AI Model Visibility" },
  { id: "prompts", label: "Prompt Intelligence" },
  { id: "citations", label: "Citation Intelligence" },
  { id: "competitors", label: "Competitor Comparison" },
  { id: "root-cause", label: "Root Cause Analysis" },
  { id: "actions", label: "Action Center" },
  { id: "history", label: "Monitoring History" },
  { id: "settings", label: "Settings" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AiVisibilityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-brand-400">Loading AI Visibility…</div>}>
      <AiVisibilityClient />
    </Suspense>
  );
}

function AiVisibilityClient() {
  const { orgId, projectId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const currentProject = projects?.find((p) => p.id === projectId);
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const domain = clientRow?.domain ?? "";
  const brandLabel = currentProject?.name || "Your Brand";

  const [days, setDays] = useState(30);
  const visibility = useVisibility(projectId, days);
  const prompts = useTrackedPrompts(projectId);
  const sweep = useRunSweep(projectId);
  const addPrompts = useAddPrompts(projectId);
  const addCompetitor = useAddCompetitor(projectId);
  const crawl = useLatestCrawl(domain || null);
  const google = useGoogleOverview(projectId);

  const competitorsQuery = useQuery({
    queryKey: ["competitors", projectId],
    queryFn: () => (projectId ? api.listCompetitors(projectId) : Promise.resolve([])),
    enabled: !!projectId,
  });
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
  const fromUrl = (TABS.find((t) => t.id === tabParam)?.id ?? "overview") as TabId;
  const [tabState, setTabState] = useState({ param: tabParam, tab: fromUrl });
  if (tabState.param !== tabParam) setTabState({ param: tabParam, tab: fromUrl });
  const activeTab = tabState.tab;
  const setActiveTab = (tab: string) => setTabState({ param: tabParam, tab: tab as TabId });

  const [dialog, setDialog] = useState<"prompt" | "competitor" | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState<{ text: string; ok: boolean } | null>(null);

  const report = visibility.data;
  const promptList = (prompts.data ?? []) as unknown as AvPrompt[];
  const competitors = competitorsQuery.data ?? [];

  const runScan = async () => {
    setNote(null);
    try {
      await sweep.mutateAsync();
      await Promise.all([prompts.refetch(), visibility.refetch()]);
      setNote({ text: "Scan finished. AI responses have been updated.", ok: true });
    } catch (err) {
      setNote({ text: errorMessage(err), ok: false });
    }
  };

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

  return (
    <div className="space-y-4">
      {note && <StatusNote tone={note.ok ? "good" : "bad"}>{note.text}</StatusNote>}
      {visibility.error && !visibility.isLoading && (
        <StatusNote tone="bad">Could not load visibility data: {errorMessage(visibility.error)}</StatusNote>
      )}

      {/* ── Sub-tab Navigation Banner if away from Overview ──────── */}
      {activeTab !== "overview" && (
        <div className="flex items-center justify-between border-b pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to AI Visibility Overview</span>
          </button>
          <span className="text-xs font-medium text-brand-500">
            Viewing {TABS.find((t) => t.id === activeTab)?.label}
          </span>
        </div>
      )}

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
            projects={projects}
            currentProjectId={projectId ?? undefined}
            onSelectProject={(id) => setActiveProject(id)}
            days={days}
            onDaysChange={setDays}
            onRunScan={runScan}
            isScanning={sweep.isPending}
            onNavigateTab={setActiveTab}
          />
        )
      )}

      {activeTab === "citations" && (
        viewParam === "classic" ? (
          <CitationIntelligenceView citations={null} />
        ) : (
          <CitationIntelligenceDashboard
            domain={domain}
            brandLabel={brandLabel}
            projects={projects}
            currentProjectId={projectId ?? undefined}
            onSelectProject={(id) => setActiveProject(id)}
            days={days}
            onDaysChange={setDays}
            onRunScan={runScan}
            isScanning={sweep.isPending}
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
        <CompetitorComparisonView
          report={report}
          competitors={competitors}
          brandLabel={brandLabel}
          onAddCompetitor={() => setDialog("competitor")}
        />
      )}

      {activeTab === "root-cause" && <RootCauseView rootCause={rootCauseQuery.data} />}
      {activeTab === "actions" && <ActionCenterView actions={actionsQuery.data} />}
      {activeTab === "history" && <MonitoringHistoryView report={report} />}
      {activeTab === "settings" && <SettingsView report={report} />}

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
