"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  GitFork,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Check,
  Code2,
  FileCode,
} from "lucide-react";
import { stagingEngine } from "@/lib/staging-engine";
import type { LinkMeshNode } from "@/lib/api-client";

interface OrphanRemediationPanelProps {
  orphans: LinkMeshNode[];
  domain: string;
  projectId: string;
  onViewSculpting?: () => void;
}

export function OrphanRemediationPanel({
  orphans = [],
  domain,
  projectId,
  onViewSculpting,
}: OrphanRemediationPanelProps) {
  const [stagedOrphanIds, setStagedOrphanIds] = useState<Set<string>>(new Set());

  const handleStageOrphanRemediation = (orphan: LinkMeshNode) => {
    const slug = orphan.url.split("/").filter(Boolean).pop() || "page";
    const cleanAnchor = orphan.title && orphan.title.length < 40 ? orphan.title : slug.replace(/[-_]+/g, " ");

    const deliverableHtml = `<!-- GrowthX Orphan Crawl Bridge Patch -->
<!-- Target Orphan URL: ${orphan.url} -->
<!-- Remediation: Injected into primary pillar/hub content to eliminate crawl isolation -->

<p>
  For specialized architectural guidance, consult our in-depth resource on 
  <a href="${orphan.url}">${cleanAnchor}</a>.
</p>`;

    stagingEngine.stage(projectId, {
      title: `Remediate Orphan Page: Link to "${cleanAnchor}"`,
      category: "INTERNAL_LINKING",
      source: "INTERNAL_LINK",
      priority: "HIGH",
      impact: `Eliminates orphan page status for ${orphan.url} by establishing an internal HTML crawl bridge from high-authority donor pages.`,
      effortHours: 1.5,
      deliverable: deliverableHtml,
      evidence: `Page has 0 inbound internal links (${orphan.inboundCount} links), rendering it isolated from standard Googlebot page traversal paths.`,
      affectedUrl: orphan.url,
    });

    setStagedOrphanIds((prev) => new Set([...prev, orphan.id]));
  };

  const handleStageAllOrphans = () => {
    for (const orphan of orphans) {
      if (!stagedOrphanIds.has(orphan.id)) {
        handleStageOrphanRemediation(orphan);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* ── EXPLANATORY CALLOUT ── */}
      <div className="rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50/70 via-white to-rose-50/30 p-5 shadow-2xs">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 shadow-2xs">
            <ShieldAlert size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-rose-950">
              Why Orphan Pages Harm Organic Indexing &amp; Crawl Budget
            </h3>
            <p className="text-xs text-rose-900/90 leading-relaxed max-w-3xl">
              Orphan pages have <strong>zero inbound internal links</strong> from other pages on your domain. Because search engines discover and evaluate pages via internal link graphs, orphan URLs receive minimal link equity (PageRank) and frequently drop out of Google&rsquo;s primary index. Connecting them with contextual anchor links restores crawl accessibility.
            </p>
          </div>
          {orphans.length > 0 && (
            <button
              type="button"
              onClick={handleStageAllOrphans}
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 shadow-sm transition active:scale-95"
            >
              <Sparkles size={13} />
              <span>Remediate All ({orphans.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── ORPHANS LIST ── */}
      {orphans.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-12 text-center">
          <CheckCircle2 size={36} className="mx-auto mb-3 text-emerald-600" />
          <h4 className="text-base font-bold text-emerald-950">Zero Orphan Pages Detected!</h4>
          <p className="mt-1 text-xs text-emerald-700 max-w-md mx-auto">
            Every crawled page on {domain} receives at least one internal inbound link. Your internal link mesh provides unbroken traversal paths for search crawlers.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Identified Stranded Pages ({orphans.length})
            </h4>
            <span className="text-[11px] text-slate-500">Sorted by PageRank deficit</span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {orphans.map((orphan) => {
              const isStaged = stagedOrphanIds.has(orphan.id);
              const slug = orphan.url.replace(/^https?:\/\/[^/]+/, "") || "/";

              return (
                <div
                  key={orphan.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                        ORPHAN PAGE
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        0 Inbound Links
                      </span>
                      <span className="text-[11px] text-slate-400">·</span>
                      <span className="text-[11px] text-slate-500">
                        PageRank Equity: <strong className="text-rose-600 font-bold">{orphan.pageRankScore}/100</strong>
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{orphan.title}</h4>

                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                      <span>{slug}</span>
                      <a
                        href={orphan.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-purple-600 transition"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isStaged ? (
                      <div className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 border border-emerald-200">
                        <Check size={14} className="text-emerald-600" />
                        <span>Bridge Staged</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStageOrphanRemediation(orphan)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white text-xs font-bold px-4 py-2 shadow-sm transition active:scale-95"
                      >
                        <Sparkles size={13} />
                        <span>Stage Crawl Bridge</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
