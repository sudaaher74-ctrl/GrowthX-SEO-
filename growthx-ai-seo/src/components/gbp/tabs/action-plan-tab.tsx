"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Loader2,
  Clock,
  X,
} from "lucide-react";
import { GbpStoreIcon } from "../gbp-icons";
import {
  useGbpProposals,
  useAnalyzeGbp,
  useApproveGbpFix,
  useRejectGbpFix,
} from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ActionPlanTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId?: string | null;
}

export function ActionPlanTab({ localSeo, projectId }: ActionPlanTabProps) {
  const { data: proposals = [], isLoading, refetch } = useGbpProposals(projectId ?? null);
  const analyzeMutation = useAnalyzeGbp(projectId ?? null);
  const approveMutation = useApproveGbpFix(projectId ?? null);
  const rejectMutation = useRejectGbpFix(projectId ?? null);
  const [actionError, setActionError] = useState<string | null>(null);

  const pending = proposals.filter((p) => p.status === "PENDING");
  const pushed = proposals.filter((p) => p.status === "APPROVED" || p.status === "PUSHED");
  const rejected = proposals.filter((p) => p.status === "REJECTED");

  const handleRunAnalysis = () => {
    setActionError(null);
    analyzeMutation.mutate(undefined, {
      onSuccess: () => refetch(),
      onError: (err) => setActionError(errorMessage(err)),
    });
  };

  const handleApprove = (id: string) => {
    setActionError(null);
    approveMutation.mutate(id, { onError: (err) => setActionError(errorMessage(err)) });
  };

  const handleReject = (id: string) => {
    setActionError(null);
    rejectMutation.mutate(id, { onError: (err) => setActionError(errorMessage(err)) });
  };

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <GbpStoreIcon className="w-11 h-11 shrink-0" />
          <div>
            <h1 className="text-lg font-bold text-brand-950 tracking-tight">
              Your Google Business Profile Action Plan
            </h1>
            <p className="text-xs text-brand-500 max-w-2xl">
              AI-generated field changes for your profile. Review each proposal and approve it to push the change
              to Google, or reject it. Nothing is changed on your listing without your approval.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={!localSeo || analyzeMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-800 hover:bg-brand-50 shadow-2xs disabled:opacity-50 shrink-0"
        >
          {analyzeMutation.isPending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          <span>{analyzeMutation.isPending ? "Analyzing…" : "Run AI Audit"}</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-error-50 border border-error-200 text-xs text-error-800">
          {actionError}
        </div>
      )}

      {/* ── Summary ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-brand-950">{pending.length}</div>
            <div className="text-xs font-bold text-brand-800">Awaiting your review</div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-brand-950">{pushed.length}</div>
            <div className="text-xs font-bold text-brand-800">Approved & pushed</div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <X size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-brand-950">{rejected.length}</div>
            <div className="text-xs font-bold text-brand-800">Rejected</div>
          </div>
        </div>
      </div>

      {/* ── Pending tasks ────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-4" style={{ borderColor: "var(--border-color)" }}>
        <h2 className="text-sm font-bold text-brand-950">
          {pending.length > 0 ? `${pending.length} task${pending.length === 1 ? "" : "s"} awaiting approval` : "No tasks awaiting approval"}
        </h2>

        {isLoading ? (
          <div className="py-8 text-center">
            <Loader2 size={20} className="mx-auto animate-spin text-brand-300" />
          </div>
        ) : pending.length > 0 ? (
          <div className="space-y-2.5">
            {pending.map((task) => (
              <div key={task.id} className="p-3.5 rounded-xl border border-brand-100 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-brand-950">{task.field}</h4>
                    <p className="text-[11px] text-brand-500">{task.rationale}</p>
                    <p className="text-[11px] text-brand-700 mt-1">
                      <span className="font-semibold">Proposed:</span> {task.proposedValue}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReject(task.id)}
                      disabled={rejectMutation.isPending}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-brand-200 bg-white text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(task.id)}
                      disabled={approveMutation.isPending}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-brand-950 text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                    >
                      {approveMutation.isPending && <Loader2 size={11} className="animate-spin" />}
                      <span>Approve</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-brand-400 py-6 text-center">
            {proposals.length === 0
              ? "Run an AI audit to generate an action plan for your profile."
              : "All AI-generated tasks have been reviewed."}
          </p>
        )}
      </div>

      {/* ── Completed / rejected history ─────────────────────────────── */}
      {(pushed.length > 0 || rejected.length > 0) && (
        <div className="rounded-2xl border bg-white p-5 shadow-xs space-y-3" style={{ borderColor: "var(--border-color)" }}>
          <h2 className="text-sm font-bold text-brand-950">History</h2>
          <div className="space-y-2">
            {[...pushed, ...rejected]
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .map((task) => (
                <div key={task.id} className="flex items-center justify-between p-2.5 rounded-lg border border-brand-50">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-brand-950 truncate">{task.field}</p>
                    <p className="text-[11px] text-brand-400">{new Date(task.updatedAt).toLocaleString()}</p>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0",
                      task.status === "REJECTED"
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}
                  >
                    {task.status}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── AI banner ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-emerald-200/60 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-950">Get more recommendations</h3>
            <p className="text-xs text-brand-600 mt-0.5">
              Run another AI audit any time your profile changes to get fresh suggestions.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={!localSeo || analyzeMutation.isPending}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow-sm hover:bg-emerald-800 transition flex items-center gap-2 disabled:opacity-50"
        >
          <Sparkles size={14} />
          <span>Run AI Audit</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
