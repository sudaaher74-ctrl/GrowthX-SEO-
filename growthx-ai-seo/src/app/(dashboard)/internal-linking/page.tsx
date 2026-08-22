"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Globe,
  RefreshCw,
  Link2,
  ExternalLink,
  ArrowRight,
  Copy,
  Check,
  CheckCircle2,
  Network,
  Compass,
  Zap,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader, ActionButton } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";

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

export default function InternalLinkingPage() {
  const { projectId } = useWorkspace();
  const [url, setUrl] = useState("");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const linkMut = useMutation({
    mutationFn: async (): Promise<InternalLinkingResponse | null> => {
      if (!projectId || !url.trim()) return null;
      return api.suggestInternalLinks(projectId, url.trim());
    },
  });

  const data = linkMut.data;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const highlightAnchorInContext = (context: string, anchor: string) => {
    if (!context || !anchor) return context;
    const parts = context.split(new RegExp(`(${anchor})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === anchor.toLowerCase() ? (
        <span
          key={i}
          className="bg-blue-100 text-blue-900 font-semibold px-1 py-0.5 rounded border border-blue-300 underline decoration-blue-500 decoration-2 underline-offset-2"
        >
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex-1 overflow-y-auto bg-brand-50">
      <PageHeader
        title="AI Internal Linking Engine"
        subtitle="Analyze topical relevance across your domain and generate high-impact internal link recommendations with natural anchor text."
      />

      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Input Card */}
        <div className="bg-white rounded-xl border border-brand-200 p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-brand-950">Analyze Page for Internal Linking</h3>
              <p className="text-[12px] text-brand-500 mt-0.5">
                Provide the URL of a blog post, landing page, or guide. Our AI cross-references your entire site architecture to pinpoint where to add internal links.
              </p>
            </div>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-[11px] font-medium text-brand-500 mb-1.5 block uppercase tracking-wider">
                  Target Page URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Globe size={14} className="text-brand-400" />
                  </div>
                  <input
                    placeholder="https://example.com/blog/how-to-do-seo"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && url.trim() && !linkMut.isPending) {
                        linkMut.mutate();
                      }
                    }}
                    className="pl-9 h-10 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-[13px] text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
              </div>
              <ActionButton
                onClick={() => linkMut.mutate()}
                disabled={!url.trim() || linkMut.isPending}
                className="h-10 px-6 gap-2"
              >
                {linkMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generate Linking Strategy
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {linkMut.isPending && (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-blue-500/20 animate-pulse" />
              <Network className="relative text-blue-600 animate-bounce" size={36} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-brand-950">Analyzing Topical Authority & Page Graph...</p>
              <p className="text-[12px] text-brand-500 mt-1">
                Evaluating semantics, anchor text distribution, and cluster hierarchy across your project pages.
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {data && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">Internal Link Health</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className={`text-3xl font-bold ${
                      data.linkHealthScore >= 80
                        ? "text-emerald-600"
                        : data.linkHealthScore >= 50
                        ? "text-amber-600"
                        : "text-rose-600"
                    }`}
                  >
                    {data.linkHealthScore}
                  </span>
                  <span className="text-[12px] text-brand-500">/ 100</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">Current Internal Links</p>
                <p className="text-3xl font-bold text-brand-950 mt-2">{data.currentInternalLinksCount}</p>
              </div>

              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">New Links Suggested</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">{data.suggestions.length}</p>
              </div>

              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">Strategic Summary</p>
                <p className="text-[12px] text-brand-700 mt-2 line-clamp-2 leading-relaxed">
                  {data.summary}
                </p>
              </div>
            </div>

            {/* Suggestions Header */}
            <div className="flex items-center justify-between border-b border-brand-200 pb-3">
              <div className="flex items-center gap-2">
                <Link2 size={16} className="text-blue-600" />
                <h3 className="text-sm font-semibold text-brand-950">
                  Recommended Internal Link Placements ({data.suggestions.length})
                </h3>
              </div>
              <span className="text-[11px] text-brand-500">Sorted by Topical Relevance</span>
            </div>

            {/* Suggestions Grid / List */}
            <div className="space-y-4">
              {data.suggestions.map((s, idx) => {
                const badge = LINK_TYPE_CONFIG[s.linkType] || LINK_TYPE_CONFIG.TOPICAL_AUTHORITY;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-xl border border-brand-200 p-6 shadow-sm hover:border-brand-400 transition space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-100 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.bg} ${badge.tone}`}>
                          {badge.label}
                        </span>
                        <span className="text-[11px] font-medium text-brand-500">
                          Relevance Score: <strong className="text-brand-950">{s.relevancyScore}/100</strong>
                        </span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(s.targetUrl)}
                        className="text-[11px] text-brand-500 hover:text-brand-950 flex items-center gap-1 self-start sm:self-auto"
                      >
                        {copiedUrl === s.targetUrl ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        {copiedUrl === s.targetUrl ? "Target Copied" : "Copy Target URL"}
                      </button>
                    </div>

                    {/* Context and Anchor */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">
                        Context Placement (In Page Content)
                      </p>
                      <div className="p-3.5 bg-brand-50 rounded-lg border border-line text-[13px] text-brand-800 leading-relaxed">
                        &ldquo;{highlightAnchorInContext(s.sentenceContext, s.recommendedAnchorText)}&rdquo;
                      </div>
                    </div>

                    {/* Target Link & Action */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div className="p-3 bg-brand-50 rounded-lg border border-brand-100 space-y-1">
                        <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">
                          Destination Page
                        </p>
                        <p className="text-[13px] font-semibold text-brand-950 truncate">{s.targetTitle}</p>
                        <a
                          href={s.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-blue-600 hover:underline flex items-center gap-1 truncate"
                        >
                          <span className="truncate">{s.targetUrl}</span>
                          <ExternalLink size={12} className="shrink-0" />
                        </a>
                      </div>

                      <div className="p-3 bg-blue-50/40 rounded-lg border border-blue-100 space-y-1">
                        <p className="text-[11px] font-semibold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                          <Zap size={12} className="text-blue-600" />
                          Strategic Impact
                        </p>
                        <p className="text-[12px] text-slate-700 leading-snug">
                          {s.rationale}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
