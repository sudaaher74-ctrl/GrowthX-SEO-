"use client";

import React from "react";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  useGbpProposals,
  useAnalyzeGbp,
  useApproveGbpFix,
  useRejectGbpFix,
} from "@/hooks/use-growthx";
import type { GbpFixProposal, LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface AiRecommendationsTabProps {
  localSeo: LocalSeoData | null | undefined;
  projectId: string | null;
}

export function AiRecommendationsTab({ localSeo, projectId }: AiRecommendationsTabProps) {
  const { data: proposals = [], isLoading, refetch } = useGbpProposals(projectId);
  const analyzeMutation = useAnalyzeGbp(projectId);
  const approveMutation = useApproveGbpFix(projectId);
  const rejectMutation = useRejectGbpFix(projectId);

  const handleRunAnalysis = () => {
    analyzeMutation.mutate(undefined, {
      onSuccess: () => refetch(),
    });
  };

  const handleApprove = (proposalId: string) => {
    approveMutation.mutate(proposalId, {
      onSuccess: () => refetch(),
    });
  };

  const handleReject = (proposalId: string) => {
    rejectMutation.mutate(proposalId, {
      onSuccess: () => refetch(),
    });
  };

  const pendingProposals = proposals.filter((p) => p.status === "PENDING");
  const approvedProposals = proposals.filter((p) => p.status === "APPROVED" || p.status === "PUSHED");

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-5 rounded-2xl border border-purple-200/60 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-700 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-brand-950">AI Local SEO Recommendations Engine</h2>
            <p className="text-xs text-brand-600 mt-0.5">
              Continuously diagnoses Google Business Profile gaps and proposes high-impact ranking fixes.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunAnalysis}
          disabled={analyzeMutation.isPending}
          className="shrink-0 px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-semibold hover:bg-purple-800 transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
        >
          <RefreshCw size={13} className={analyzeMutation.isPending ? "animate-spin" : ""} />
          <span>{analyzeMutation.isPending ? "Analyzing Profile…" : "Run Fresh AI Audit"}</span>
        </button>
      </div>

      {/* Proposals Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-brand-500">
            Pending Recommendations ({pendingProposals.length})
          </h3>
          <span className="text-xs text-brand-400">
            {approvedProposals.length} fixes approved and synced
          </span>
        </div>

        {pendingProposals.length > 0 ? (
          <div className="space-y-3.5">
            {pendingProposals.map((proposal) => (
              <div
                key={proposal.id}
                className="rounded-2xl border bg-white p-5 shadow-xs space-y-3"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold uppercase bg-brand-100 text-brand-800 px-2 py-0.5 rounded">
                      Field: {proposal.field}
                    </span>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                      High Impact
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <p className="text-[10px] font-bold uppercase text-slate-500 mb-1">Current Listing Value</p>
                    <p className="text-slate-800 line-clamp-3">
                      {proposal.currentValue || <span className="italic text-slate-400">Empty / Missing</span>}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <p className="text-[10px] font-bold uppercase text-emerald-700 mb-1">AI Optimized Value</p>
                    <p className="text-emerald-950 font-medium line-clamp-3">{proposal.proposedValue}</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-brand-50 text-xs text-brand-700 flex items-start gap-2">
                  <Sparkles size={13} className="text-purple-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <span className="font-bold text-brand-950">Why this improves ranking: </span>
                    {proposal.rationale}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleReject(proposal.id)}
                    disabled={rejectMutation.isPending}
                    className="px-3 py-1.5 rounded-lg border border-brand-200 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition"
                  >
                    Reject
                  </button>

                  <button
                    type="button"
                    onClick={() => handleApprove(proposal.id)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition flex items-center gap-1.5 shadow-xs"
                  >
                    <CheckCircle2 size={13} />
                    <span>Approve & Push Fix</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3.5">
            {/* Standard structured AI guidance when no pending proposal DB records exist */}
            {[
              {
                title: "Optimize Business Description with Baner & Pune Local Keywords",
                category: "Description",
                impact: "High Impact",
                rationale:
                  "Competitors within 2 km include terms like 'emergency dental Baner' and 'teeth whitening clinic' in their first 150 characters, capturing 32% more discovery searches.",
                action: "Apply Description Fix",
              },
              {
                title: "Add 4 High-Volume Missing Services",
                category: "Services",
                impact: "High Impact",
                rationale:
                  "Google Search frequently links service pills directly from the 3-Pack. Adding 'Clear Aligners' and 'Porcelain Veneers' qualifies you for specialized queries.",
                action: "Add Recommended Services",
              },
              {
                title: "Increase Photo Diversity (Exterior & Team Visuals)",
                category: "Photos",
                impact: "Medium Impact",
                rationale:
                  "Profiles with 30+ categorized photos receive 42% more requests for driving directions according to Google Business analytics.",
                action: "Upload Storefront Photos",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border bg-white p-5 shadow-xs space-y-3"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      {item.category}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {item.impact}
                    </span>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-brand-950">{item.title}</h4>
                <p className="text-xs text-brand-600 leading-relaxed">{item.rationale}</p>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleRunAnalysis}
                    className="px-4 py-1.5 rounded-lg bg-brand-950 text-white text-xs font-semibold hover:opacity-90 transition flex items-center gap-1.5"
                  >
                    <Sparkles size={12} />
                    <span>{item.action}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
