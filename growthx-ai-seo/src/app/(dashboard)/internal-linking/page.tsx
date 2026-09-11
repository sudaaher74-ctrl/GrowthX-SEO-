"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Globe,
  RefreshCw,
  Link2,
  ExternalLink,
  Copy,
  Check,
  Network,
  Zap,
  ShieldAlert,
  GitFork,
  ArrowRight,
  Loader2,
  Layers,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader, ActionButton } from "@/components/ui/console";
import { useWorkspace, usePortfolio, useInternalLinkingMesh } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import { stagingEngine } from "@/lib/staging-engine";

// Internal Linking Components
import { InternalLinkMeshOverview } from "@/components/internal-linking/internal-link-mesh-overview";
import { OrphanRemediationPanel } from "@/components/internal-linking/orphan-remediation-panel";
import { LinkSculptingQueue } from "@/components/internal-linking/link-sculpting-queue";

interface InternalLinkSuggestion {
  targetUrl: string;
  targetTitle: string;
  recommendedAnchorText: string;
  sentenceContext: string;
  linkType: "TOPICAL_AUTHORITY" | "PRODUCT_CONVERSION" | "PILLAR_PAGE" | "RELATED_GUIDE" | "FOUNDATIONAL_CONTENT";
  relevancyScore: number;
  rationale: string;
}

interface InternalLinkingResponse {
  pageTitle: string;
  summary: string;
  linkHealthScore: number;
  currentInternalLinksCount: number;
  suggestions: InternalLinkSuggestion[];
  model?: string;
}

const LINK_TYPE_CONFIG: Record<string, { label: string; tone: string; bg: string }> = {
  TOPICAL_AUTHORITY: { label: "Topical Authority", tone: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  PILLAR_PAGE: { label: "Pillar Cluster Link", tone: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  PRODUCT_CONVERSION: { label: "High-Intent Conversion", tone: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  RELATED_GUIDE: { label: "Related Guide", tone: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  FOUNDATIONAL_CONTENT: { label: "Foundational Page", tone: "text-slate-700", bg: "bg-slate-50 border-slate-200" },
};

const TABS = [
  { id: "mesh", label: "Link Equity Mesh & Graph" },
  { id: "orphans", label: "Orphan Page Remediation" },
  { id: "sculpting", label: "PageRank Sculpting Queue" },
  { id: "single-page", label: "Single Page Analyzer" },
];

export default function InternalLinkingPage() {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? null;
  const domain = client?.domain || "aivaenterprises.com";

  const [activeTab, setActiveTab] = useState<string>("mesh");

  // Domain link mesh query
  const meshQuery = useInternalLinkingMesh(projectId);
  const meshData = meshQuery.data;

  // Single page analyzer state
  const [url, setUrl] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [stagedSingleLinkIndices, setStagedSingleLinkIndices] = useState<Set<number>>(new Set());

  const linkMut = useMutation({
    mutationFn: async (): Promise<InternalLinkingResponse | null> => {
      if (!projectId || !url.trim()) return null;
      return api.suggestInternalLinks(projectId, url.trim());
    },
  });

  const singlePageData = linkMut.data;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleStageSingleLink = (suggestion: InternalLinkSuggestion, idx: number) => {
    stagingEngine.stage(projectId, {
      title: `Internal Link: Anchor "${suggestion.recommendedAnchorText}" to ${suggestion.targetTitle.slice(0, 30)}`,
      category: "INTERNAL_LINKING",
      source: "INTERNAL_LINK",
      priority: suggestion.linkType === "PRODUCT_CONVERSION" ? "HIGH" : "MEDIUM",
      impact: `Topical link injection (${suggestion.linkType}) targeting ${suggestion.targetUrl}.`,
      effortHours: 0.5,
      deliverable: `<p>${suggestion.sentenceContext.replace(
        suggestion.recommendedAnchorText,
        `<a href="${suggestion.targetUrl}">${suggestion.recommendedAnchorText}</a>`,
      )}</p>`,
      evidence: suggestion.rationale,
      affectedUrl: url.trim(),
    });

    setStagedSingleLinkIndices((prev) => new Set([...prev, idx]));
  };

  const highlightAnchorInContext = (context: string, anchor: string) => {
    if (!context || !anchor) return context;
    const parts = context.split(new RegExp(`(${anchor})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === anchor.toLowerCase() ? (
        <span
          key={i}
          className="bg-purple-100 text-purple-900 font-semibold px-1 py-0.5 rounded border border-purple-300 underline decoration-purple-500 decoration-2 underline-offset-2"
        >
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 pb-16">
      <PageHeader
        title="Internal Linking Mesh & PageRank Sculpting"
        subtitle="Graph-based internal PageRank equity distribution, orphan page remediation, and automated anchor link insertion."
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* ── SUB-NAVIGATION TABS ── */}
        <div className="flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center gap-6">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const isOrphanTab = tab.id === "orphans";
              const orphanCount = meshData?.scoreboard.orphanPagesCount || 0;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative pb-3 text-[13px] font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? "font-bold text-purple-700"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span>{tab.label}</span>
                  {isOrphanTab && orphanCount > 0 && (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.2 text-[10px] font-bold text-rose-700">
                      {orphanCount}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-purple-600" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mb-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => meshQuery.refetch()}
              disabled={meshQuery.isFetching}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
            >
              <RefreshCw size={12} className={meshQuery.isFetching ? "animate-spin" : ""} />
              <span>Refresh Graph</span>
            </button>
          </div>
        </div>

        {/* ── TAB 1: LINK EQUITY MESH OVERVIEW ── */}
        {activeTab === "mesh" && (
          <InternalLinkMeshOverview
            scoreboard={meshData?.scoreboard}
            nodes={meshData?.nodes || []}
            domain={domain}
            onViewOrphans={() => setActiveTab("orphans")}
            onViewSculpting={() => setActiveTab("sculpting")}
          />
        )}

        {/* ── TAB 2: ORPHAN REMEDIATION PANEL ── */}
        {activeTab === "orphans" && (
          <OrphanRemediationPanel
            orphans={meshData?.orphans || []}
            domain={domain}
            projectId={projectId || ""}
            onViewSculpting={() => setActiveTab("sculpting")}
          />
        )}

        {/* ── TAB 3: PAGERANK SCULPTING QUEUE ── */}
        {activeTab === "sculpting" && (
          <LinkSculptingQueue
            opportunities={meshData?.sculptingOpportunities || []}
            projectId={projectId || ""}
            domain={domain}
          />
        )}

        {/* ── TAB 4: SINGLE PAGE ANALYZER ── */}
        {activeTab === "single-page" && (
          <div className="space-y-6">
            {/* Input Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs">
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Ad-Hoc Single Page Internal Link Analyzer</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    Provide the URL of a blog post, landing page, or guide. Our AI cross-references your entire site architecture to pinpoint where to add internal links.
                  </p>
                </div>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
                      Target Page URL
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Globe size={14} className="text-slate-400" />
                      </div>
                      <input
                        placeholder={`https://${domain}/solutions/ai-automation`}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && url.trim() && !linkMut.isPending) {
                            linkMut.mutate();
                          }
                        }}
                        className="pl-9 h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => linkMut.mutate()}
                    disabled={!url.trim() || linkMut.isPending}
                    className="h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    {linkMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    <span>Generate Linking Strategy</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Loading State */}
            {linkMut.isPending && (
              <div className="py-24 flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-xl bg-purple-500/20 animate-pulse" />
                  <Network className="relative text-purple-600 animate-bounce" size={36} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-900">Analyzing Topical Authority &amp; Page Graph...</p>
                  <p className="text-[12px] text-slate-500 mt-1">
                    Evaluating semantics, anchor text distribution, and cluster hierarchy across your project pages.
                  </p>
                </div>
              </div>
            )}

            {/* Results */}
            {singlePageData && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Internal Link Health</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span
                        className={`text-2xl font-black ${
                          singlePageData.linkHealthScore >= 80
                            ? "text-emerald-600"
                            : singlePageData.linkHealthScore >= 50
                            ? "text-amber-600"
                            : "text-rose-600"
                        }`}
                      >
                        {singlePageData.linkHealthScore}
                      </span>
                      <span className="text-[12px] text-slate-400">/ 100</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Current Internal Links</p>
                    <p className="text-2xl font-black text-slate-900 mt-2">{singlePageData.currentInternalLinksCount}</p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">New Links Suggested</p>
                    <p className="text-2xl font-black text-purple-600 mt-2">{singlePageData.suggestions.length}</p>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Strategic Summary</p>
                    <p className="text-xs text-slate-700 mt-2 line-clamp-2 leading-relaxed">
                      {singlePageData.summary}
                    </p>
                  </div>
                </div>

                {/* Suggestions List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <Link2 size={16} className="text-purple-600" />
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Recommended Internal Link Placements ({singlePageData.suggestions.length})
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-500">Sorted by Topical Relevance</span>
                  </div>

                  <div className="space-y-3">
                    {singlePageData.suggestions.map((s, idx) => {
                      const badge = LINK_TYPE_CONFIG[s.linkType] || LINK_TYPE_CONFIG.TOPICAL_AUTHORITY;
                      const isStaged = stagedSingleLinkIndices.has(idx);

                      return (
                        <div
                          key={idx}
                          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:border-purple-300 transition space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${badge.bg} ${badge.tone}`}>
                                {badge.label}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500">
                                Relevance: <strong className="text-slate-900">{s.relevancyScore}/100</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {isStaged ? (
                                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                                  <Check size={12} /> Staged to Fix
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleStageSingleLink(s, idx)}
                                  className="text-xs font-bold text-purple-600 hover:text-purple-800 transition flex items-center gap-1"
                                >
                                  <Sparkles size={12} />
                                  <span>Stage to Fix Engine</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => copyToClipboard(s.targetUrl)}
                                className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1"
                              >
                                {copiedUrl === s.targetUrl ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                <span>{copiedUrl === s.targetUrl ? "Copied" : "Copy URL"}</span>
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                              Context Placement (In Page Content)
                            </span>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800 leading-relaxed">
                              &ldquo;{highlightAnchorInContext(s.sentenceContext, s.recommendedAnchorText)}&rdquo;
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
                              <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                                Destination Page
                              </span>
                              <p className="text-xs font-bold text-slate-900 truncate">{s.targetTitle}</p>
                              <a
                                href={s.targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[11px] text-purple-600 hover:underline flex items-center gap-1 truncate"
                              >
                                <span className="truncate">{s.targetUrl}</span>
                                <ExternalLink size={11} className="shrink-0" />
                              </a>
                            </div>

                            <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-100 space-y-1">
                              <span className="text-[10.5px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                                <Zap size={11} className="text-purple-600" />
                                <span>Strategic Impact</span>
                              </span>
                              <p className="text-xs text-slate-700 leading-snug">
                                {s.rationale}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
