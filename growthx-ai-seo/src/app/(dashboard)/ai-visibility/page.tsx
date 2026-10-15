"use client";
import { AiVisibilityDisabled } from "@/components/ai-visibility/ai-visibility-disabled";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Play, RefreshCw } from "lucide-react";
import {
  useWorkspace,
  useVisibility,
  useTrackedPrompts,
  useRunSweep,
  useAddPrompts,
  useAddCompetitor,
  useLatestCrawl,
  usePortfolio,
} from "@/hooks/use-growthx";
import { useGoogleOverview } from "@/hooks/use-google";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { ActionButton, PageHeader, StatusNote, Tabs } from "@/components/ui/console";
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
import { type AvPrompt, cycleInfo, pct } from "@/components/ai-visibility/av-shared";

/** Order matches the sidebar's AI Visibility children in `nav-items.tsx`. */
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

const RANGES = [
  { days: 7, label: "Last 7 days" },
  { days: 28, label: "Last 28 days" },
  { days: 90, label: "Last 90 days" },
];

export default function AiVisibilityPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-brand-400">Loading AI Visibility…</div>}>
      <AiVisibilityClient />
    </Suspense>
  );
}

function csvCell(v: string | number) {
  return `"${String(v).replace(/"/g, '""')}"`;
}

function AiVisibilityClient() {
  const { orgId, projectId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const currentProject = projects?.find((p) => p.id === projectId);
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const domain = clientRow?.domain ?? "";
  const brandLabel = currentProject?.name || "Your brand";

  const [days, setDays] = useState(28);
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

  // The sidebar's sub-items link to ?tab=; a click in the page replaces the choice.
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
  // The API's prompt rows have drifted from the declared type; read what is there.
  const promptList = (prompts.data ?? []) as unknown as AvPrompt[];
  const competitors = competitorsQuery.data ?? [];
  const cycle = cycleInfo();
  const refreshing = visibility.isFetching || prompts.isFetching;

  const refresh = () => {
    void visibility.refetch();
    void prompts.refetch();
    void competitorsQuery.refetch();
  };

  const runScan = async () => {
    setNote(null);
    try {
      await sweep.mutateAsync();
      await Promise.all([prompts.refetch(), visibility.refetch()]);
      setNote({ text: "Scan finished. Results below reflect the answers just collected.", ok: true });
    } catch (err) {
      setNote({ text: errorMessage(err), ok: false });
    }
  };

  const exportCsv = () => {
    const f = overviewFigures(report);
    const lines = [
      ["Metric", "Value"],
      ["Overall visibility", pct(f.visibility)],
      ["AI share of voice", pct(f.shareOfVoice)],
      ["Answers checked", f.checked],
      ["Failed requests", f.failed],
      [],
      ["Prompt", "Category"],
      ...promptList.map((p) => [p.text, p.category ?? p.cluster ?? ""]),
    ];
    const csv = lines.map((r) => r.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `ai-visibility-${days}d.csv` });
    a.click();
    URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-4 pb-16">
      <PageHeader
        title="AI Visibility"
        subtitle="Understand how AI models discover, mention, cite, and recommend your brand."
        actions={
          <>
            <label className="sr-only" htmlFor="av-range">Date range</label>
            <select
              id="av-range"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border bg-white px-2.5 py-1.5 text-[12px] font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-primary-600"
            >
              {RANGES.map((r) => (
                <option key={r.days} value={r.days}>{r.label}</option>
              ))}
            </select>
            <span
              className="flex items-center rounded-lg border bg-white px-2.5 py-1.5 text-[12px] text-brand-600"
              title="Scans run once in each cycle: days 1–10, 11–20 and 21 to month end"
            >
              <span className="font-medium text-brand-950">{cycle.label}</span>
              <span className="ml-1.5 text-brand-400">{cycle.range} · next {cycle.nextScan}</span>
            </span>
            <ActionButton
              onClick={refresh}
              disabled={refreshing}
              aria-label="Refresh data"
              icon={<RefreshCw size={13} className={refreshing ? "animate-spin" : undefined} />}
            >
              Refresh
            </ActionButton>
            <ActionButton onClick={exportCsv} disabled={!report} icon={<Download size={13} />}>
              Export
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={runScan}
              disabled={sweep.isPending || !projectId}
              icon={sweep.isPending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            >
              {sweep.isPending ? "Scanning…" : "Run scan"}
            </ActionButton>
          </>
        }
      />

      {sweep.isPending && (
        <div role="status" className="rounded-xl border bg-accent-50 px-4 py-2.5 text-[12px] text-accent-700">
          Asking each AI model your monitored questions. This can take a few minutes; you can leave this page.
        </div>
      )}
      {note && <StatusNote tone={note.ok ? "good" : "bad"}>{note.text}</StatusNote>}
      {visibility.error && !visibility.isLoading && (
        <StatusNote tone="bad">Could not load visibility data: {errorMessage(visibility.error)}</StatusNote>
      )}

      <Tabs tabs={[...TABS]} active={activeTab} onChange={setActiveTab} />

      <div role="tabpanel" aria-label={TABS.find((t) => t.id === activeTab)?.label}>
        {activeTab === "overview" && (
          <AiVisibilityOverview
            report={report}
            prompts={promptList}
            loading={visibility.isLoading || prompts.isLoading}
            brandLabel={brandLabel}
            onNavigate={setActiveTab}
          />
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
        {activeTab === "citations" && <CitationIntelligenceView />}
        {activeTab === "competitors" && (
          <CompetitorComparisonView
            report={report}
            competitors={competitors}
            brandLabel={brandLabel}
            onAddCompetitor={() => setDialog("competitor")}
          />
        )}
        {activeTab === "root-cause" && <RootCauseView />}
        {activeTab === "actions" && <ActionCenterView />}
        {activeTab === "history" && <MonitoringHistoryView report={report} />}
        {activeTab === "settings" && <SettingsView report={report} />}
      </div>

      {dialog && (
        <AddDialog
          title={dialog === "prompt" ? "Add a prompt to monitor" : "Add a competitor"}
          label={dialog === "prompt" ? "Customer question" : "Competitor website"}
          placeholder={dialog === "prompt" ? "e.g. Which companies deliver fresh milk in Mumbai?" : "e.g. competitor.com"}
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

export function AiVisibilityDisabledPage() {
  return <AiVisibilityDisabled />;
}
