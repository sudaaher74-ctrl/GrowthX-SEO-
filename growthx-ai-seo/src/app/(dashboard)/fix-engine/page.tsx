"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  History,
  GitCompare,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { PageHeader, Tabs, StatusNote } from "@/components/ui/console";
import { FixEngineOverviewView } from "@/components/fix-engine/proof-of-impact/fe-overview";
import { FixEngineHistoryView } from "@/components/fix-engine/proof-of-impact/fe-history";
import { FixEngineBeforeAfterView } from "@/components/fix-engine/proof-of-impact/fe-before-after";
import { FixEngineImpactView } from "@/components/fix-engine/proof-of-impact/fe-impact";
import { FixEngineLedgerView } from "@/components/fix-engine/proof-of-impact/fe-ledger";
import { FixEngineReportsView } from "@/components/fix-engine/proof-of-impact/fe-reports";
import { ShipPanel } from "@/components/fix-engine/ship-panel";
import { EngineerPanel, RunsPanel } from "@/components/fix-engine/engineer-panel";
import { PlanView } from "@/components/fix-engine/plan-view";

const TABS = [
  { id: "overview", label: "Improvement plan", icon: Wrench },
  { id: "history", label: "Fix History", icon: History },
  { id: "before-after", label: "Before & After", icon: GitCompare },
  { id: "impact", label: "Impact Analytics", icon: TrendingUp },
  { id: "ledger", label: "Impact Ledger", icon: FileSpreadsheet },
  { id: "reports", label: "Reports", icon: FileText },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function FixEnginePage() {
  return (
    <Suspense fallback={<div className="p-8 text-[13px] text-brand-400">Loading Fix Engine…</div>}>
      <FixEngineClient />
    </Suspense>
  );
}

function FixEngineClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: TabId = TABS.some((t) => t.id === rawTab) ? (rawTab as TabId) : "overview";
  const [selectedRunId, setSelectedRunId] = useState<string | null>(() => {
    const id = searchParams.get("runId");
    return id && !['undefined', 'null'].includes(id) ? id : null;
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { projectId } = useWorkspace();
  const activeProjectId = projectId ?? "";
  const queryClient = useQueryClient();

  const setTab = (newTab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    if (selectedRunId) params.set("runId", selectedRunId);
    router.replace(`/fix-engine?${params.toString()}`);
  };

  const handleSelectFix = (runId: string) => {
    setSelectedRunId(runId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "before-after");
    params.set("runId", runId);
    router.push(`/fix-engine?${params.toString()}`);
  };

  // Queries
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["proof-of-impact-overview", activeProjectId],
    queryFn: () => api.getProofOfImpactOverview(activeProjectId),
    enabled: Boolean(activeProjectId),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["proof-of-impact-history", activeProjectId],
    queryFn: () => api.getFixImpactHistory(activeProjectId),
    enabled: Boolean(activeProjectId),
  });

  const activeRunId = selectedRunId || (history.length > 0 ? history[0].runId : null);

  const { data: detail = null, isLoading: detailLoading } = useQuery({
    queryKey: ["proof-of-impact-detail", activeProjectId, activeRunId],
    queryFn: () => (activeRunId ? api.getFixImpactDetail(activeProjectId, activeRunId) : Promise.resolve(null)),
    enabled: Boolean(activeProjectId && activeRunId),
  });

  const { data: ledger = [], isLoading: ledgerLoading } = useQuery({
    queryKey: ["proof-of-impact-ledger", activeProjectId],
    queryFn: () => api.getFixImpactLedger(activeProjectId),
    enabled: Boolean(activeProjectId),
  });

  const { data: report = null, isLoading: reportLoading } = useQuery({
    queryKey: ["proof-of-impact-report", activeProjectId, activeRunId],
    queryFn: () => api.getFixImpactReport(activeProjectId, activeRunId || undefined),
    enabled: Boolean(activeProjectId),
  });

  // Verify Deployment Mutation
  const verifyMutation = useMutation({
    mutationFn: (runId: string) => api.verifyFixDeployment(activeProjectId, runId),
    onSuccess: (res) => {
      setStatusMessage(
        res.success
          ? "Live deployment verified! Changes confirmed on the live website."
          : res.message || "Deployment verification completed: live website does not match proposed changes yet."
      );
      queryClient.invalidateQueries({ queryKey: ["proof-of-impact-detail"] });
      queryClient.invalidateQueries({ queryKey: ["proof-of-impact-overview"] });
      queryClient.invalidateQueries({ queryKey: ["proof-of-impact-history"] });
      queryClient.invalidateQueries({ queryKey: ["proof-of-impact-ledger"] });
    },
    onError: (err: unknown) => {
      setStatusMessage(err instanceof Error ? err.message : "Failed to trigger live deployment verification.");
    },
  });

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Fix Engine"
        subtitle="Your complete fix and improvement plan for Website Audit, Google, Competitor Intelligence and AI Visibility."
        actions={
          <div className="flex items-center gap-2">
            <a href="/reports/plan" className="text-[12px] font-semibold text-accent-700 hover:underline">Complete plan report →</a>
          </div>
        }
      />

      {statusMessage && (
        <StatusNote tone={statusMessage.includes("verified") ? "good" : "bad"}>
          {statusMessage}
        </StatusNote>
      )}

      {/* 6 Tabs */}
      <Tabs tabs={TABS as unknown as { id: TabId; label: string; icon?: React.ElementType }[]} active={tab} onChange={setTab} />

      {/* Tab 1: Overview */}
      {tab === "overview" && (
        <>
          <PlanView key={activeProjectId} />
          {overviewLoading ? (
            <div className="p-12 text-center text-xs text-brand-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Loading Fix Engine Overview...
            </div>
          ) : overview ? (
            <FixEngineOverviewView data={overview} onSelectFix={handleSelectFix} />
          ) : null}

          {/* Existing Autonomous Engineer runner controls preserved below overview */}
          <div className="pt-6 border-t space-y-4">
            <ShipPanel />
            <EngineerPanel />
            <RunsPanel />
          </div>
        </>
      )}

      {/* Tab 2: Fix History */}
      {tab === "history" && (
        <>
          {historyLoading ? (
            <div className="p-12 text-center text-xs text-brand-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Loading Fix History...
            </div>
          ) : (
            <FixEngineHistoryView fixes={history} onSelectFix={handleSelectFix} />
          )}
        </>
      )}

      {/* Tab 3: Before & After */}
      {tab === "before-after" && (
        <>
          {detailLoading ? (
            <div className="p-12 text-center text-xs text-brand-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Loading Before &amp; After Comparison...
            </div>
          ) : (
            <FixEngineBeforeAfterView
              detail={detail}
              onVerifyDeployment={(runId) => verifyMutation.mutate(runId)}
              isVerifying={verifyMutation.isPending}
            />
          )}
        </>
      )}

      {/* Tab 4: Impact Analytics */}
      {tab === "impact" && (
        <>
          {detailLoading ? (
            <div className="p-12 text-center text-xs text-brand-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Loading Impact Analytics...
            </div>
          ) : (
            <FixEngineImpactView detail={detail} />
          )}
        </>
      )}

      {/* Tab 5: Impact Ledger */}
      {tab === "ledger" && (
        <>
          {ledgerLoading ? (
            <div className="p-12 text-center text-xs text-brand-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Loading Impact Ledger...
            </div>
          ) : (
            <FixEngineLedgerView events={ledger} />
          )}
        </>
      )}

      {/* Tab 6: Reports */}
      {tab === "reports" && (
        <>
          {reportLoading ? (
            <div className="p-12 text-center text-xs text-brand-400 flex items-center justify-center gap-2">
              <Loader2 className="animate-spin" size={14} /> Generating Audit Report...
            </div>
          ) : (
            <FixEngineReportsView report={report} />
          )}
        </>
      )}
    </div>
  );
}
