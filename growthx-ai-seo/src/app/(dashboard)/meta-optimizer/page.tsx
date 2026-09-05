"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Globe, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader, ActionButton } from "@/components/ui/console";
import { useWorkspace } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";

export default function MetaOptimizerPage() {
  const { projectId } = useWorkspace();
  const [url, setUrl] = useState("");

  const analyzeMut = useMutation({
    mutationFn: async () => {
      if (!projectId || !url.trim()) return null;
      return api.analyzeMetaTags(projectId, url);
    },
  });

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-amber-500";
    return "text-red-500";
  };

  const data = analyzeMut.data;

  return (
    <div className="flex-1 overflow-y-auto bg-brand-50">
      <PageHeader 
        title="Meta Tag Optimizer" 
        subtitle="Audit and rewrite your title tags and meta descriptions for maximum CTR." 
      />

      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div className="bg-white rounded-xl border p-6 border-brand-100 shadow-sm">
          <div className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-brand-950">Analyze Webpage</h3>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[11px] font-medium text-brand-500 mb-1.5 block uppercase tracking-wider">Target URL</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Globe size={14} className="text-brand-400" />
                  </div>
                  <input 
                    placeholder="https://example.com/blog-post" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-9 h-10 w-full rounded-md border border-brand-200 bg-white px-3 py-2 text-[13px] text-brand-950 focus:outline-none focus:ring-1 focus:ring-brand-950"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <ActionButton 
                  onClick={() => analyzeMut.mutate()} 
                  disabled={!url.trim() || analyzeMut.isPending}
                  className="h-10 px-5 gap-2"
                >
                  {analyzeMut.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Audit & Optimize
                </ActionButton>
              </div>
            </div>
          </div>
        </div>

        {analyzeMut.isPending && (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full blur-xl bg-purple-500/20 animate-pulse"></div>
              <Sparkles className="relative text-purple-500 animate-bounce" size={32} />
            </div>
            <p className="text-sm font-medium text-brand-950">Analyzing content and rewriting tags...</p>
          </div>
        )}

        {data && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Current State */}
            <div className="md:col-span-1 space-y-6">
              <div className="bg-white rounded-xl border p-5 border-brand-200 flex flex-col items-center text-center">
                <h4 className="text-[11px] font-semibold text-brand-500 uppercase tracking-wider mb-4">Overall Health</h4>
                <div className="flex items-end justify-center gap-1 mb-2">
                  <span className={`text-4xl font-bold ${getScoreColor((data.titleScore + data.descriptionScore) / 2)}`}>
                    {Math.round((data.titleScore + data.descriptionScore) / 2)}
                  </span>
                  <span className="text-sm font-medium text-brand-400 mb-1">/100</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border p-5 border-brand-200 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-semibold text-brand-950">Current Title</h4>
                    <span className={`text-[11px] font-bold ${getScoreColor(data.titleScore)}`}>{data.titleScore}/100</span>
                  </div>
                  <p className="text-[13px] text-brand-700 p-3 bg-brand-100 rounded-md border border-brand-200">
                    {data.currentTitle || <span className="italic text-brand-400">Missing</span>}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[13px] font-semibold text-brand-950">Current Description</h4>
                    <span className={`text-[11px] font-bold ${getScoreColor(data.descriptionScore)}`}>{data.descriptionScore}/100</span>
                  </div>
                  <p className="text-[13px] text-brand-700 p-3 bg-brand-100 rounded-md border border-brand-200">
                    {data.currentDescription || <span className="italic text-brand-400">Missing</span>}
                  </p>
                </div>
                <div className="pt-2">
                  <h4 className="text-[12px] font-semibold text-brand-950 mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={12} className="text-amber-500" />
                    AI Analysis
                  </h4>
                  <p className="text-[12px] text-brand-500 leading-relaxed">
                    {data.analysis}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Variations */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-[14px] font-semibold text-brand-950 flex items-center gap-2">
                <Sparkles size={16} className="text-blue-500" />
                Optimized Variations
              </h3>
              
              {data.proposedVariations.map((v, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  key={i}
                >
                  <div className="bg-white rounded-xl border p-0 border-brand-200 overflow-hidden hover:border-blue-300 transition-colors">
                    {/* Google Search Snippet Preview */}
                    <div className="p-5 bg-white border-b border-brand-100">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
                          <Globe size={14} className="text-brand-400" />
                        </div>
                        <div>
                          <p className="text-[12px] text-[#202124]">{url.split('/')[2]}</p>
                          <p className="text-[11px] text-[#4d5156] truncate">{url}</p>
                        </div>
                      </div>
                      <h3 className="text-[18px] text-[#1a0dab] font-medium leading-snug cursor-pointer hover:underline mb-1">
                        {v.title}
                      </h3>
                      <p className="text-[13px] text-[#4d5156] leading-snug">
                        {v.description}
                      </p>
                    </div>

                    {/* Rationale */}
                    <div className="p-3 bg-brand-50 flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-blue-500 mt-0.5 shrink-0" />
                      <p className="text-[12px] text-brand-700">{v.rationale}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}
