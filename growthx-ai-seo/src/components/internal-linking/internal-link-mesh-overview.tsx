"use client";

import React, { useState, useMemo } from "react";
import {
  Network,
  GitFork,
  AlertTriangle,
  Zap,
  TrendingUp,
  Search,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Filter,
  CheckCircle2,
  ChevronDown,
  Layers,
  Sparkles,
} from "lucide-react";
import type { LinkMeshScoreboard, LinkMeshNode } from "@/lib/api-client";

interface InternalLinkMeshOverviewProps {
  scoreboard?: LinkMeshScoreboard;
  nodes: LinkMeshNode[];
  domain: string;
  onViewOrphans?: () => void;
  onViewSculpting?: () => void;
}

export function InternalLinkMeshOverview({
  scoreboard,
  nodes = [],
  domain,
  onViewOrphans,
  onViewSculpting,
}: InternalLinkMeshOverviewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"pr-desc" | "in-desc" | "out-desc">("pr-desc");

  const filteredNodes = useMemo(() => {
    return nodes
      .filter((n) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!n.url.toLowerCase().includes(q) && !n.title.toLowerCase().includes(q)) {
            return false;
          }
        }
        if (selectedTier !== "ALL" && n.equityTier !== selectedTier) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "pr-desc") return b.pageRankScore - a.pageRankScore;
        if (sortBy === "in-desc") return b.inboundCount - a.inboundCount;
        if (sortBy === "out-desc") return b.outboundCount - a.outboundCount;
        return 0;
      });
  }, [nodes, searchQuery, selectedTier, sortBy]);

  return (
    <div className="space-y-6">
      {/* ── SCOREBOARD STATS ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Crawled Mesh Pages</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{scoreboard?.totalUrls || nodes.length}</span>
            <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">
              Nodes
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Total crawled URLs in domain graph</p>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Internal Link Mesh</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{scoreboard?.totalInternalLinks || 0}</span>
            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              Edges
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Internal HTML crawl paths passing PageRank</p>
        </div>

        {/* Metric 3 */}
        <div
          onClick={onViewOrphans}
          className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/50 to-white p-4 shadow-2xs cursor-pointer hover:border-rose-300 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Orphan Pages</span>
            <ArrowRight size={13} className="text-rose-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-950">{scoreboard?.orphanPagesCount || 0}</span>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
              0 Inbound Links
            </span>
          </div>
          <p className="mt-1 text-[11px] text-rose-700/80 font-medium">Click to generate 1-click crawl bridges</p>
        </div>

        {/* Metric 4 */}
        <div
          onClick={onViewSculpting}
          className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/50 to-white p-4 shadow-2xs cursor-pointer hover:border-amber-300 transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Starved Money Pages</span>
            <ArrowRight size={13} className="text-amber-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-950">{scoreboard?.starvedPagesCount || 0}</span>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
              Low Equity
            </span>
          </div>
          <p className="mt-1 text-[11px] text-amber-800/80 font-medium">Conversion pages with &lt; 3 inbound links</p>
        </div>

        {/* Metric 5 */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg PageRank Score</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{scoreboard?.averagePageRank || 0}</span>
            <span className="text-[11px] font-bold text-slate-500">/ 100</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Iterative mathematical damping (d = 0.85)</p>
        </div>
      </div>

      {/* ── EQUITY TIER DISTRIBUTION CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Tier 1 */}
        <div
          onClick={() => setSelectedTier(selectedTier === "PILLAR_HUB" ? "ALL" : "PILLAR_HUB")}
          className={`rounded-xl border p-3.5 transition cursor-pointer ${
            selectedTier === "PILLAR_HUB"
              ? "border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-900">Pillar Authority Hubs</span>
            <span className="text-xs font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
              {nodes.filter((n) => n.equityTier === "PILLAR_HUB").length}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Top 10% link equity holders. Prime candidates to act as donor pages for starved conversion targets.
          </p>
        </div>

        {/* Tier 2 */}
        <div
          onClick={() => setSelectedTier(selectedTier === "HEALTHY" ? "ALL" : "HEALTHY")}
          className={`rounded-xl border p-3.5 transition cursor-pointer ${
            selectedTier === "HEALTHY"
              ? "border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">Healthy Connected Pages</span>
            <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              {nodes.filter((n) => n.equityTier === "HEALTHY").length}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            Well-balanced pages with 3+ inbound internal links and steady crawl traversal paths.
          </p>
        </div>

        {/* Tier 3 */}
        <div
          onClick={() => setSelectedTier(selectedTier === "STARVED" ? "ALL" : "STARVED")}
          className={`rounded-xl border p-3.5 transition cursor-pointer ${
            selectedTier === "STARVED"
              ? "border-amber-500 bg-amber-50/60 ring-2 ring-amber-500/20"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">Starved Strategic Pages</span>
            <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              {nodes.filter((n) => n.equityTier === "STARVED").length}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            High-value solution or pricing pages that receive inadequate link equity from the domain mesh.
          </p>
        </div>

        {/* Tier 4 */}
        <div
          onClick={() => setSelectedTier(selectedTier === "ORPHAN" ? "ALL" : "ORPHAN")}
          className={`rounded-xl border p-3.5 transition cursor-pointer ${
            selectedTier === "ORPHAN"
              ? "border-rose-500 bg-rose-50/60 ring-2 ring-rose-500/20"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900">Stranded Orphan Pages</span>
            <span className="text-xs font-black text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
              {nodes.filter((n) => n.equityTier === "ORPHAN").length}
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500">
            0 inbound links. Invisible to Googlebot discovery without direct XML sitemap manual discovery.
          </p>
        </div>
      </div>

      {/* ── SEARCH & TABLE CONTROLS ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search page URL or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedTier !== "ALL" && (
            <button
              type="button"
              onClick={() => setSelectedTier("ALL")}
              className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1.5 rounded-xl border border-purple-200 hover:bg-purple-100"
            >
              Reset Tier Filter ({selectedTier})
            </button>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs focus:border-purple-500 focus:outline-none"
          >
            <option value="pr-desc">Highest PageRank First</option>
            <option value="in-desc">Most Inbound Links</option>
            <option value="out-desc">Most Outbound Links</option>
          </select>
        </div>
      </div>

      {/* ── NODE EQUITY TABLE ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Page URL &amp; Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-center">Inbound Links</th>
                <th className="px-4 py-3 text-center">Outbound Links</th>
                <th className="px-4 py-3 text-center">PageRank Equity</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Sculpting</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredNodes.map((node) => {
                return (
                  <tr key={node.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* URL & Title */}
                    <td className="px-4 py-3 max-w-sm">
                      <div className="font-bold text-slate-900 truncate" title={node.title}>
                        {node.title}
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400 font-mono truncate" title={node.url}>
                        {node.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                      </div>
                    </td>

                    {/* Page Type */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {node.pageType}
                      </span>
                    </td>

                    {/* Inbound Count */}
                    <td className="px-4 py-3 text-center font-semibold">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          node.inboundCount === 0
                            ? "bg-rose-100 text-rose-700"
                            : node.inboundCount < 3
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {node.inboundCount}
                      </span>
                    </td>

                    {/* Outbound Count */}
                    <td className="px-4 py-3 text-center font-semibold text-slate-600">
                      {node.outboundCount}
                    </td>

                    {/* PageRank Score */}
                    <td className="px-4 py-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="text-xs font-black text-slate-800">{node.pageRankScore}/100</span>
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              node.pageRankScore >= 70
                                ? "bg-purple-600"
                                : node.pageRankScore >= 40
                                ? "bg-blue-500"
                                : node.isOrphan
                                ? "bg-rose-500"
                                : "bg-amber-500"
                            }`}
                            style={{ width: `${node.pageRankScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Equity Tier */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                          node.equityTier === "PILLAR_HUB"
                            ? "bg-purple-100 text-purple-700"
                            : node.equityTier === "HEALTHY"
                            ? "bg-emerald-100 text-emerald-700"
                            : node.equityTier === "STARVED"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {node.equityTier === "PILLAR_HUB" && "Pillar Hub"}
                        {node.equityTier === "HEALTHY" && "Healthy"}
                        {node.equityTier === "STARVED" && "Starved"}
                        {node.equityTier === "ORPHAN" && "Orphan"}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      {node.isOrphan ? (
                        <button
                          type="button"
                          onClick={onViewOrphans}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 px-2.5 py-1 text-[11px] font-bold transition shadow-2xs"
                        >
                          <span>Bridge Orphan</span>
                          <ArrowRight size={11} />
                        </button>
                      ) : node.equityTier === "STARVED" ? (
                        <button
                          type="button"
                          onClick={onViewSculpting}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1 text-[11px] font-bold transition shadow-2xs"
                        >
                          <span>Sculpt Equity</span>
                          <ArrowRight size={11} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onViewSculpting}
                          className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                        >
                          Use as Donor
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
