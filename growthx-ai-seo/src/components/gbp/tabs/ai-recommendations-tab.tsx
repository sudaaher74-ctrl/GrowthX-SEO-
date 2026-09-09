"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  useGbpProposals,
  useAnalyzeGbp,
  useApproveGbpFix,
  useRejectGbpFix,
} from "@/hooks/use-growthx";
import type { GbpFixProposal, LocalSeoData } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";

interface AiRecommendationsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
}

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "PUSHED" | "ALL";

export function AiRecommendationsTab({ localSeo, projectId }: AiRecommendationsTabProps) {
  const { data: proposals = [], isLoading, refetch } = useGbpProposals(projectId);
  const analyzeMutation = useAnalyzeGbp(projectId);
  const approveMutation = useApproveGbpFix(projectId);
  const rejectMutation = useRejectGbpFix(projectId);

  const [activeFilter, setActiveFilter] = useState<StatusFilter>("PENDING");
  const [actionError, setActionError] = useState<string | null>(null);

  const handleRunAnalysis = () => {
    setActionError(null);
    analyzeMutation.mutate(undefined, {
      onSuccess: () => refetch(),
      onError: (err) => setActionError(errorMessage(err)),
    });
  };

  const handleApprove = (id: string) => {
    setActionError(null);
    approveMutation.mutate(id, {
      onError: (err) => setActionError(errorMessage(err)),
    });
  };

  const handleReject = (id: string) => {
    setActionError(null);
    rejectMutation.mutate(id, {
      onError: (err) => setActionError(errorMessage(err)),
    });
  };

  const pending = proposals.filter((p) => p.status === "PENDING");
  const approved = proposals.filter((p) => p.status === "APPROVED" || p.status === "PUSHED");
  const rejected = proposals.filter((p) => p.status === "REJECTED");

  const filteredProposals: GbpFixProposal[] =
    activeFilter === "ALL" ? proposals : proposals.filter((p) => p.status === activeFilter);

  const statusBadge = (status: GbpFixProposal["status"]) => {
    switch (status) {
      case "PENDING":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "APPROVED":
      case "PUSHED":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "REJECTED":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-brand-100 text-brand-600 border-brand-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header: run analysis ─────────────────────────────────────── */}
      <div
        className="rounded-2xl border bg-white p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
        style={{ borderColor: "var(--border-color)" }}
      >
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles size={16} />
            </div>
            <h2 className="text-lg font-bold text-brand-950 tracking-tight">AI Recommendations</h2>
          </div>
          <p className="text-xs text-brand-600 max-w-2xl leading-relaxed">
            {localSeo
              ? "Run an AI audit of your Google Business Profile to get concrete, field-level change proposals — description, categories, services and more — that you can review before anything is pushed to Google."
              : "Connect your Google Business Profile to run an AI audit."}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={!localSeo || analyzeMutation.isPending}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-sm hover:bg-purple-700 transition disabled:opacity-50"
        >
          {analyzeMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          <span>{analyzeMutation.isPending ? "Analyzing…" : "Run AI Audit"}</span>
        </button>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-error-50 border border-error-200 text-xs text-error-800">
          {actionError}
        </div>
      )}

      {/* ── Summary counts (real, from proposal statuses) ────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-brand-950">{pending.length}</div>
            <div className="text-xs font-bold text-brand-800">Pending Review</div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-brand-950">{approved.length}</div>
            <div className="text-xs font-bold text-brand-800">Approved / Pushed</div>
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-xs flex items-center gap-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle size={20} />
          </div>
          <div>
            <div className="text-2xl font-black text-brand-950">{rejected.length}</div>
            <div className="text-xs font-bold text-brand-800">Rejected</div>
          </div>
        </div>
      </div>

      {/* ── Filter pills ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as StatusFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(f)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold transition-all border",
              activeFilter === f
                ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                : "bg-white border-brand-200 text-brand-700 hover:bg-brand-50"
            )}
          >
            {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* ── Proposal list ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <Loader2 size={22} className="mx-auto animate-spin text-brand-300" />
        </div>
      ) : filteredProposals.length > 0 ? (
        <div className="space-y-3">
          {filteredProposals.map((rec) => (
            <div
              key={rec.id}
              className="rounded-2xl border bg-white p-4 shadow-xs space-y-3"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-brand-950">{rec.field}</h3>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border", statusBadge(rec.status))}>
                      {rec.status}
                    </span>
                  </div>
                  <p className="text-xs text-brand-600 leading-relaxed">{rec.rationale}</p>
                  {rec.currentValue && (
                    <p className="text-[11px] text-brand-400">
                      <span className="font-semibold">Current:</span> {rec.currentValue}
                    </p>
                  )}
                  <p className="text-[11px] text-brand-700">
                    <span className="font-semibold">Proposed:</span> {rec.proposedValue}
                  </p>
                </div>

                {rec.status === "PENDING" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReject(rec.id)}
                      disabled={rejectMutation.isPending}
                      className="px-3 py-1.5 rounded-lg border border-brand-200 bg-white text-xs font-semibold text-brand-700 hover:bg-brand-50 transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(rec.id)}
                      disabled={approveMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {approveMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                      <span>Approve & Push</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-10 text-center shadow-xs" style={{ borderColor: "var(--border-color)" }}>
          <Sparkles size={28} className="mx-auto text-brand-300 mb-3" />
          <h3 className="text-sm font-bold text-brand-950">
            {proposals.length === 0 ? "No AI recommendations yet" : "No recommendations match this filter"}
          </h3>
          <p className="text-xs text-brand-500 mt-1 max-w-sm mx-auto">
            {proposals.length === 0
              ? "Run an AI audit above to get field-level suggestions for your profile."
              : "Try a different status filter."}
          </p>
        </div>
      )}
    </div>
  );
}
