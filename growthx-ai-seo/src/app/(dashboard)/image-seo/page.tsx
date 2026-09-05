"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Globe, RefreshCw, AlertTriangle, Image as ImageIcon, Copy, Check, FileText, ExternalLink } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader, ActionButton } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";

interface OptimizedImage {
  src: string;
  currentAlt: string;
  suggestedAlt: string;
  seoScore: number;
  issues: string[];
  recommendedFileName: string;
  rationale: string;
}

interface ImageOptimizerResponse {
  pageTitle: string;
  summary: string;
  overallScore: number;
  images: OptimizedImage[];
  model?: string;
}

export default function ImageSeoPage() {
  const { projectId } = useWorkspace();
  const [url, setUrl] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState<"ALL" | "MISSING" | "NEEDS_IMPROVEMENT" | "GOOD">("ALL");

  const optimizeMut = useMutation({
    mutationFn: async (): Promise<ImageOptimizerResponse | null> => {
      if (!projectId || !url.trim()) return null;
      return api.optimizeImages(projectId, url.trim());
    },
  });

  const data = optimizeMut.data;

  const copyAlt = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 50) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-rose-600 bg-rose-50 border-rose-200";
  };

  const filteredImages = (data?.images || []).filter((img) => {
    if (filter === "MISSING") return !img.currentAlt || img.currentAlt.trim() === "";
    if (filter === "NEEDS_IMPROVEMENT") return img.seoScore < 80;
    if (filter === "GOOD") return img.seoScore >= 80;
    return true;
  });

  const missingAltCount = (data?.images || []).filter((i) => !i.currentAlt || i.currentAlt.trim() === "").length;

  return (
    <div className="flex-1 overflow-y-auto bg-brand-50">
      <PageHeader
        title="Image SEO & Alt Text Optimizer"
        subtitle="Audit on-page images, fix missing alt tags, and optimize file names with AI for Google Images rankings."
      />

      <div className="p-8 max-w-6xl mx-auto space-y-8">
        {/* Input Bar */}
        <div className="bg-white rounded-xl border border-brand-200 p-6 shadow-sm">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-semibold text-brand-950">Analyze Webpage Images</h3>
              <p className="text-[12px] text-brand-500 mt-0.5">
                Enter any public webpage URL. We will extract all image assets, evaluate their SEO compliance, and generate rich contextual alt text.
              </p>
            </div>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-[11px] font-medium text-brand-500 mb-1.5 block uppercase tracking-wider">
                  Target Webpage URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Globe size={14} className="text-brand-400" />
                  </div>
                  <input
                    placeholder="https://example.com/products/summer-jacket"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && url.trim() && !optimizeMut.isPending) {
                        optimizeMut.mutate();
                      }
                    }}
                    className="pl-9 h-10 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-[13px] text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
              </div>
              <ActionButton
                onClick={() => optimizeMut.mutate()}
                disabled={!url.trim() || optimizeMut.isPending}
                className="h-10 px-6 gap-2"
              >
                {optimizeMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Scan & Optimize Images
              </ActionButton>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {optimizeMut.isPending && (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-indigo-500/20 animate-pulse" />
              <ImageIcon className="relative text-indigo-600 animate-bounce" size={36} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-brand-950">Extracting & Auditing Images...</p>
              <p className="text-[12px] text-brand-500 mt-1">
                Scanning DOM, checking image dimensions, and reasoning about image context with AI.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {optimizeMut.isError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-800 text-[13px] flex items-center gap-2">
            <AlertTriangle size={16} />
            <span>Could not analyze this URL. Please verify the link is publicly accessible and try again.</span>
          </div>
        )}

        {/* Results */}
        {data && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">Image SEO Score</p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${data.overallScore >= 80 ? "text-emerald-600" : data.overallScore >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                    {data.overallScore}
                  </span>
                  <span className="text-[12px] text-brand-500">/ 100</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">Total Images Found</p>
                <p className="text-3xl font-bold text-brand-950 mt-2">{data.images.length}</p>
              </div>

              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">Missing Alt Text</p>
                <p className={`text-3xl font-bold mt-2 ${missingAltCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  {missingAltCount}
                </p>
              </div>

              <div className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm">
                <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider">Audit Result</p>
                <p className="text-[12px] text-brand-700 mt-2 line-clamp-2 leading-relaxed">
                  {data.summary}
                </p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between border-b border-brand-200 pb-3">
              <div className="flex gap-2">
                {([
                  { id: "ALL", label: `All (${data.images.length})` },
                  { id: "MISSING", label: `Missing Alt (${missingAltCount})` },
                  { id: "NEEDS_IMPROVEMENT", label: "Needs Improvement" },
                  { id: "GOOD", label: "Optimized" },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${
                      filter === tab.id
                        ? "bg-brand-950 text-white"
                        : "bg-white text-brand-500 hover:text-brand-950 border border-brand-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-brand-400">Powered by GrowthX Multi-AI Router</span>
            </div>

            {/* Image Cards List */}
            {filteredImages.length === 0 ? (
              <div className="bg-white rounded-xl border border-brand-200 p-12 text-center text-brand-500 text-[13px]">
                No images matching this filter.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredImages.map((img, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="bg-white rounded-xl border border-brand-200 p-5 shadow-sm flex flex-col md:flex-row gap-5 items-start hover:border-brand-400 transition"
                  >
                    {/* Thumbnail */}
                    <div className="w-full md:w-44 h-32 bg-brand-100 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center border border-brand-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.src}
                        alt={img.currentAlt || "Webpage image"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold border backdrop-blur bg-white/90">
                        <span className={getScoreColor(img.seoScore).split(" ")[0]}>{img.seoScore}/100</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-3 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <a
                          href={img.src}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-brand-500 hover:text-brand-950 flex items-center gap-1 truncate max-w-lg"
                        >
                          <span className="truncate">{img.src}</span>
                          <ExternalLink size={12} className="shrink-0" />
                        </a>
                        {img.issues.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {img.issues.map((issue, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-medium"
                              >
                                {issue}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Current vs Suggested Alt */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-brand-50 border border-brand-100">
                          <p className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider mb-1">
                            Current Alt Tag
                          </p>
                          <p className="text-[12px] text-brand-700">
                            {img.currentAlt ? (
                              `"${img.currentAlt}"`
                            ) : (
                              <span className="italic text-rose-500 font-medium">[Missing Alt Attribute]</span>
                            )}
                          </p>
                        </div>

                        <div className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-semibold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                              <Sparkles size={12} className="text-indigo-600" />
                              AI Recommended Alt Tag
                            </p>
                            <button
                              onClick={() => copyAlt(img.suggestedAlt, idx)}
                              className="text-[11px] font-medium text-indigo-700 hover:text-indigo-900 flex items-center gap-1"
                            >
                              {copiedIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                              {copiedIndex === idx ? "Copied" : "Copy"}
                            </button>
                          </div>
                          <p className="text-[12px] text-indigo-950 font-medium leading-snug">
                            &quot;{img.suggestedAlt}&quot;
                          </p>
                        </div>
                      </div>

                      {/* Recommended File Name & Rationale */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[11px] text-brand-500">
                        <div className="flex items-center gap-1.5">
                          <FileText size={12} className="text-brand-400" />
                          <span>SEO File Name:</span>
                          <code className="font-mono text-brand-950 bg-brand-100 px-1.5 py-0.5 rounded">
                            {img.recommendedFileName}
                          </code>
                        </div>
                        <p className="text-[11px] text-brand-500 italic truncate max-w-md">
                          {img.rationale}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
