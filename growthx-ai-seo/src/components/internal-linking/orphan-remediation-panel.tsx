"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  GitMerge,
} from "lucide-react";
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
  const router = useRouter();
  // Track which orphan IDs we've opened in the Action Queue (for UI feedback)
  const [remediatedIds, setRemediatedIds] = useState<Set<string>>(new Set());

  const handleRemediateOrphan = (orphan: LinkMeshNode) => {
    setRemediatedIds((prev) => new Set([...prev, orphan.id]));
    // Remediation runs through the Action Queue; the Fix Engine is disabled.
    router.push("/action-queue");
  };

  const handleRemediateAll = () => {
    const ids = orphans.map((o) => o.id);
    setRemediatedIds(new Set(ids));
    router.push("/action-queue");
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
              Orphan pages have <strong>zero inbound internal links</strong> from other pages on your domain. Because search engines discover and evaluate pages via internal link graphs, orphan URLs receive minimal link equity (PageRank) and frequently drop out of Google&rsquo;s primary index. GrowthX&rsquo;s Neural Link Sculptor automatically pairs each orphan with a high-authority donor page and injects a contextual HTML bridge sentence.
            </p>
          </div>
          {orphans.length > 0 && (
            <button
              type="button"
              onClick={handleRemediateAll}
              className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold px-4 py-2 shadow-sm transition active:scale-95"
            >
              <GitMerge size={13} />
              <span>Open All in Action Queue ({orphans.length})</span>
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
              const isRemediated = remediatedIds.has(orphan.id);
              const slug = orphan.url.replace(/^https?:\/\/[^/]+/, "") || "/";

              return (
                <div
                  key={orphan.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:border-indigo-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                        className="text-slate-400 hover:text-slate-900 transition"
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isRemediated ? (
                      <div className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 border border-indigo-200">
                        <Check size={14} className="text-indigo-600" />
                        <span>Opened in Action Queue</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRemediateOrphan(orphan)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold px-4 py-2 shadow-sm transition active:scale-95"
                      >
                        <GitMerge size={13} />
                        <span>Fix with Neural Link Sculptor</span>
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
