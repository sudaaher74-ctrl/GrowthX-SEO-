"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Zap,
  TrendingUp,
  Link2,
  ExternalLink,
  Copy,
  Check,
  Code2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Layers,
  FileCode,
} from "lucide-react";
import { stagingEngine } from "@/lib/staging-engine";
import type { LinkSculptingOpportunity } from "@/lib/api-client";

interface LinkSculptingQueueProps {
  opportunities: LinkSculptingOpportunity[];
  projectId: string;
  domain: string;
  onAddToFixPlan?: (count: number, label?: string) => void;
}

export function LinkSculptingQueue({
  opportunities = [],
  projectId,
  domain,
  onAddToFixPlan,
}: LinkSculptingQueueProps) {
  const [stagedIds, setStagedIds] = useState<Set<string>>(new Set());
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const handleStageLink = (opp: LinkSculptingOpportunity) => {
    stagingEngine.stage(projectId, {
      title: `PageRank Sculpting: Link from "${opp.sourceTitle.slice(0, 30)}" to "${opp.targetTitle.slice(0, 30)}"`,
      category: "INTERNAL_LINKING",
      source: "INTERNAL_LINK",
      priority: opp.targetIsOrphan ? "CRITICAL" : "HIGH",
      impact: `Transfers ~${opp.equityTransferEstimate} pts of internal link equity from donor hub (${opp.sourcePageRank}/100) to strategic target page, using anchor "${opp.recommendedAnchorText}".`,
      effortHours: 1.0,
      deliverable: opp.codeDiff.after,
      evidence: opp.rationale,
      affectedUrl: opp.sourceUrl,
    });

    setStagedIds((prev) => new Set([...prev, opp.id]));
    if (onAddToFixPlan) {
      onAddToFixPlan(1, `Link Sculpting: ${opp.recommendedAnchorText}`);
    }
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* ── HEADER BANNER ── */}
      <div className="rounded-2xl border border-purple-200/80 bg-gradient-to-br from-purple-950 via-indigo-950 to-slate-950 p-6 text-white shadow-md">
        <div className="space-y-2 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/20 px-3 py-1 text-[11px] font-bold tracking-wide text-purple-200 backdrop-blur-md">
            <Zap size={12} className="text-purple-300" />
            <span>PAGERANK LINK EQUITY SCULPTING</span>
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Channel Internal Authority to High-Intent Money Pages
          </h2>
          <p className="text-[13px] leading-relaxed text-purple-200/90">
            Internal PageRank sculpting optimizes the flow of link equity across your domain. High-authority donor pages pass surplus juice to under-linked conversion and solution pages through natural in-content anchors, boosting rankings without acquiring new external backlinks.
          </p>
        </div>
      </div>

      {/* ── OPPORTUNITIES QUEUE ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-purple-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              High-ROI Internal Link Insertion Queue ({opportunities.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-500">Sorted by estimated link equity transfer</span>
        </div>

        {opportunities.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-2xs">
            <ShieldCheck size={36} className="mx-auto mb-3 text-emerald-500" />
            <h4 className="text-sm font-bold text-slate-800">Link Equity Distribution is Balanced</h4>
            <p className="mt-1 text-xs text-slate-400 max-w-md mx-auto">
              No starved or orphan pages currently require immediate link sculpting. Run a fresh re-crawl to evaluate new pages.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {opportunities.map((opp) => {
              const isStaged = stagedIds.has(opp.id);

              return (
                <div
                  key={opp.id}
                  className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xs hover:border-purple-300 transition space-y-4"
                >
                  {/* Top Row: Source Hub -> Target */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                      {/* Donor Hub */}
                      <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-purple-800 flex items-center gap-1">
                            <Layers size={12} className="text-purple-600" />
                            <span>Source Donor Page</span>
                          </span>
                          <span className="text-[10px] font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                            {opp.sourcePageRank}/100 PageRank
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate" title={opp.sourceTitle}>
                          {opp.sourceTitle}
                        </h4>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {opp.sourceUrl.replace(/^https?:\/\/[^/]+/, "")}
                        </div>
                      </div>

                      {/* Destination Page */}
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                            <TrendingUp size={12} className="text-emerald-600" />
                            <span>Target Destination</span>
                          </span>
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            {opp.targetIsOrphan ? "Orphan" : `${opp.targetPageRank}/100 PageRank`}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 truncate" title={opp.targetTitle}>
                          {opp.targetTitle}
                        </h4>
                        <div className="text-[11px] font-mono text-slate-400 truncate">
                          {opp.targetUrl.replace(/^https?:\/\/[^/]+/, "")}
                        </div>
                      </div>
                    </div>

                    {/* Equity Boost Badge */}
                    <div className="flex items-center gap-3 self-end lg:self-center shrink-0">
                      <div className="text-right">
                        <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Transfer</span>
                        <span className="text-sm font-black text-emerald-600">+{opp.equityTransferEstimate} PageRank pts</span>
                      </div>

                      {isStaged ? (
                        <div className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 border border-emerald-200">
                          <Check size={14} className="text-emerald-600" />
                          <span>Staged to Fix</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStageLink(opp)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold px-4 py-2 shadow-sm transition active:scale-95"
                        >
                          <Sparkles size={13} />
                          <span>Stage to Fix Engine</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Context Placement Preview */}
                  <div className="space-y-1.5">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
                      Recommended Context &amp; Natural Anchor Text
                    </span>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-700 leading-relaxed">
                      &ldquo;
                      {opp.sentenceContext.split(opp.recommendedAnchorText).map((part, i, arr) => (
                        <React.Fragment key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <span className="font-bold text-purple-700 bg-purple-100/90 px-1.5 py-0.5 rounded border border-purple-200 underline decoration-purple-500 decoration-2 underline-offset-2">
                              {opp.recommendedAnchorText}
                            </span>
                          )}
                        </React.Fragment>
                      ))}
                      &rdquo;
                    </div>
                  </div>

                  {/* Code Diff Preview */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Code2 size={12} className="text-slate-400" />
                        <span>HTML Insertion Patch</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(opp.id, opp.codeDiff.after)}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition inline-flex items-center gap-1"
                      >
                        {copiedCodeId === opp.id ? (
                          <>
                            <Check size={12} className="text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            <span>Copy HTML Patch</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      <code>{opp.codeDiff.after}</code>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
