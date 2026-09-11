"use client";

import React from "react";
import { Globe, CheckCircle2, ArrowRight, MessageSquare, Bot, Sparkles, FileText, Check, Target, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AiPipelineBannerProps {
  mode?: "overview" | "competitors" | "recommendations";
  domain?: string;
  crawledPages?: number | null;
  competitorsCount?: number;
  onViewDiscussion?: () => void;
  onViewCrawlDetails?: () => void;
  onViewSummary?: () => void;
  isAnalyzing?: boolean;
}

export function AiPipelineBanner({
  mode = "overview",
  domain = "aivaenterprises.com",
  crawledPages = 1248,
  competitorsCount = 5,
  onViewDiscussion,
  onViewCrawlDetails,
  onViewSummary,
  isAnalyzing = false,
}: AiPipelineBannerProps) {
  if (mode === "recommendations") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: AI-Powered Recommendations */}
          <div className="lg:col-span-4 flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <Target size={22} className="text-purple-600" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 leading-tight">
                AI-Powered Recommendations
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                Based on insights from ChatGPT, Claude and Gemini, here are the most impactful actions to improve your AI visibility.
              </p>
            </div>
          </div>

          {/* Middle: 3 Model Cards */}
          <div className="lg:col-span-5 flex items-center justify-center py-2 px-2">
            <div className="flex flex-wrap items-center justify-center gap-5">
              {/* ChatGPT */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-2xs">
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2">
                    <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 5a5 5 0 0 0-5 5c0 2.76 2.24 5 5 5s5-2.24 5-5a5 5 0 0 0-5-5" />
                  </svg>
                </div>
                <span className="mt-1 text-[11px] font-bold text-slate-800">ChatGPT</span>
                <span className="text-[10px] text-slate-400">Analyzed 1,248 insights</span>
              </div>

              {/* Claude */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-700 border border-amber-200/60 shadow-2xs">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
                <span className="mt-1 text-[11px] font-bold text-slate-800">Claude</span>
                <span className="text-[10px] text-slate-400">Evaluated competitors</span>
              </div>

              {/* Gemini */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-50 text-sky-600 border border-sky-200/60 shadow-2xs">
                  <Sparkles size={18} />
                </div>
                <span className="mt-1 text-[11px] font-bold text-slate-800">Gemini</span>
                <span className="text-[10px] text-slate-400">Scanned Knowledge Graph</span>
              </div>
            </div>
          </div>

          {/* Right: Expected Impact Card */}
          <div className="lg:col-span-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-white">
                <TrendingUp size={14} />
              </div>
              <span className="text-[12px] font-bold text-slate-900">Expected Impact</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Implementing top recommendations could increase your AI visibility by
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[26px] font-extrabold text-emerald-600 leading-none">
                +42%
              </span>
              {/* Mini sparkline */}
              <svg width="70" height="26" viewBox="0 0 70 26" className="overflow-visible">
                <path
                  d="M0,20 Q15,18 30,12 T50,8 T70,4"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "competitors") {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Competitor Analysis Heading */}
          <div className="lg:col-span-4 flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
              <FileText size={22} className="text-purple-600" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900 leading-tight">
                AI is analyzing your competitors
              </h3>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
                Comparing your brand with top competitors to find gaps in AI visibility, content, authority and brand perception.
              </p>
            </div>
          </div>

          {/* Middle: Waveform and Model Nodes */}
          <div className="lg:col-span-5 flex items-center justify-center py-2 px-4">
            <div className="flex items-center gap-3">
              {/* ChatGPT icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-xs">
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 5a5 5 0 0 0-5 5c0 2.76 2.24 5 5 5s5-2.24 5-5a5 5 0 0 0-5-5" />
                </svg>
              </div>

              {/* Waveform segment 1 */}
              <div className="flex items-center gap-0.5 px-2">
                <div className="h-2 w-1 rounded-full bg-indigo-200 animate-pulse" />
                <div className="h-4 w-1 rounded-full bg-indigo-400" />
                <div className="h-6 w-1 rounded-full bg-indigo-500 animate-pulse" />
                <div className="h-3 w-1 rounded-full bg-indigo-300" />
                <div className="h-5 w-1 rounded-full bg-indigo-400" />
              </div>

              {/* Claude icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d97706]/10 border border-[#d97706]/30 text-[#d97706] shadow-xs">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>

              {/* Waveform segment 2 */}
              <div className="flex items-center gap-0.5 px-2">
                <div className="h-3 w-1 rounded-full bg-blue-300" />
                <div className="h-6 w-1 rounded-full bg-blue-500 animate-pulse" />
                <div className="h-4 w-1 rounded-full bg-blue-400" />
                <div className="h-2 w-1 rounded-full bg-blue-200 animate-pulse" />
              </div>

              {/* Gemini icon */}
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xs">
                <Sparkles size={18} />
              </div>
            </div>
          </div>

          {/* Right: Status card */}
          <div className="lg:col-span-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check size={14} strokeWidth={3} />
              </div>
              <span className="text-[13px] font-bold text-slate-900">
                {competitorsCount} Competitors Analyzed
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Latest data from ChatGPT, Claude and Gemini
            </p>
            {/* Progress line */}
            <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full w-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-600" />
            </div>
            <button
              type="button"
              onClick={onViewSummary}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <span>View AI Summary</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default: Overview pipeline banner
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Domain & Crawl Details */}
        <div className="lg:col-span-3 flex items-start gap-3.5 border-b lg:border-b-0 lg:border-r border-slate-100 pb-4 lg:pb-0 lg:pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Globe size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-bold text-slate-900 truncate">
                {domain}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 border border-emerald-200/50">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Analysis Complete
              </span>
            </div>
            <p className="mt-1 text-[11.5px] text-slate-500">
              Crawled {crawledPages != null ? crawledPages.toLocaleString() : "1,248"} pages
            </p>
            <button
              type="button"
              onClick={onViewCrawlDetails}
              className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <span>View crawl details</span>
              <ArrowRight size={12} />
            </button>
          </div>
        </div>

        {/* Center: AI Discussion & Model Connected Flow */}
        <div className="lg:col-span-5 flex items-center justify-center px-2">
          <div className="flex items-center gap-3 relative w-full justify-between max-w-md">
            {/* ChatGPT Node */}
            <div className="flex flex-col items-center text-center z-10">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white border-2 border-slate-200 shadow-2xs">
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-900">
                  <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m0 5a5 5 0 0 0-5 5c0 2.76 2.24 5 5 5s5-2.24 5-5a5 5 0 0 0-5-5" />
                </svg>
              </div>
              <span className="mt-1.5 text-[11.5px] font-bold text-slate-800">ChatGPT</span>
              <span className="text-[10px] text-slate-400">Analyzing...</span>
            </div>

            {/* Connecting curve 1 */}
            <div className="flex-1 h-0.5 border-t-2 border-dashed border-indigo-200 relative -mt-4 mx-1" />

            {/* AI Discussion Node (Centerpiece) */}
            <div className="flex flex-col items-center text-center z-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-sm ring-4 ring-indigo-50">
                <MessageSquare size={20} className="fill-white/20" />
              </div>
              <span className="mt-1.5 text-[11.5px] font-bold text-indigo-950">AI Discussion</span>
              <span className="text-[9.5px] text-slate-400 max-w-[110px] leading-tight">
                Models are sharing insights about your business
              </span>
            </div>

            {/* Connecting curve 2 */}
            <div className="flex-1 h-0.5 border-t-2 border-dashed border-indigo-200 relative -mt-4 mx-1" />

            {/* Claude Node */}
            <div className="flex flex-col items-center text-center z-10">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fef3c7] border-2 border-amber-200/80 shadow-2xs">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" className="text-[#d97706]">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="mt-1.5 text-[11.5px] font-bold text-slate-800">Claude</span>
              <span className="text-[10px] text-slate-400">Analyzing...</span>
            </div>

            {/* Connecting curve 3 */}
            <div className="flex-1 h-0.5 border-t-2 border-dashed border-indigo-200 relative -mt-4 mx-1" />

            {/* Gemini Node */}
            <div className="flex flex-col items-center text-center z-10">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-50 border-2 border-sky-200/80 shadow-2xs">
                <Sparkles size={20} className="text-sky-600" />
              </div>
              <span className="mt-1.5 text-[11.5px] font-bold text-slate-800">Gemini</span>
              <span className="text-[10px] text-slate-400">Analyzing...</span>
            </div>
          </div>
        </div>

        {/* Right: AI Analysis Complete Box */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200/70 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check size={14} strokeWidth={3} />
            </div>
            <span className="text-[13px] font-bold text-slate-900">
              AI Analysis Complete!
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-slate-500">
            All models have analyzed your website, business, and competitors.
          </p>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-600" />
          </div>
          <button
            type="button"
            onClick={onViewDiscussion}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-[12px] font-semibold text-slate-800 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <span>View AI Discussion</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
