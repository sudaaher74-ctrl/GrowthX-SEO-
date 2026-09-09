"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Heading,
  Layers,
  Search,
  Sparkles,
  Type,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlIssue, CrawlPage } from "@/lib/api-client";
import { DonutChart } from "../donut-chart";

interface ContentTabProps {
  pages: CrawlPage[];
  issues: CrawlIssue[];
  onOptimizePage?: (page: CrawlPage) => void;
}

export function ContentTab({ pages, issues, onOptimizePage }: ContentTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIssueType, setSelectedIssueType] = useState("ALL");

  // Content analysis from real crawled pages
  const thinPages = useMemo(() => pages.filter((p) => p.wordCount < 350), [pages]);
  const optimalPages = useMemo(
    () => pages.filter((p) => p.wordCount >= 350 && p.wordCount <= 2000),
    [pages]
  );
  const deepPages = useMemo(() => pages.filter((p) => p.wordCount > 2000), [pages]);

  const wordDepthDonut = useMemo(() => {
    return [
      { label: "Optimal (350–2k)", value: optimalPages.length, color: "#10b981" },
      { label: "Deep (> 2k)", value: deepPages.length, color: "#3b82f6" },
      { label: "Thin (< 350)", value: thinPages.length, color: "#f43f5e" },
    ];
  }, [optimalPages, deepPages, thinPages]);

  // Meta tag coverage
  const missingTitleCount = pages.filter((p) => !p.title || p.title.trim() === "").length;
  const missingMetaDescCount = pages.filter((p) => !p.metaDescription || p.metaDescription.trim() === "").length;
  const missingH1Count = pages.filter((p) => !p.h1 || p.h1.length === 0).length;
  const multipleH1Count = pages.filter((p) => p.h1 && p.h1.length > 1).length;

  const filteredPages = useMemo(() => {
    let result = [...pages];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) => p.url.toLowerCase().includes(q) || (p.title || "").toLowerCase().includes(q)
      );
    }
    if (selectedIssueType === "THIN") {
      result = result.filter((p) => p.wordCount < 350);
    } else if (selectedIssueType === "NO_TITLE") {
      result = result.filter((p) => !p.title);
    } else if (selectedIssueType === "NO_DESC") {
      result = result.filter((p) => !p.metaDescription);
    } else if (selectedIssueType === "H1_ISSUE") {
      result = result.filter((p) => !p.h1 || p.h1.length !== 1);
    }
    return result;
  }, [pages, searchQuery, selectedIssueType]);

  return (
    <div className="space-y-5">
      {/* Top 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Word Depth Distribution */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            <FileText size={14} className="text-blue-600" />
            <span>Word Depth Distribution</span>
          </div>
          <div className="flex items-center justify-center py-1">
            <DonutChart
              data={wordDepthDonut}
              centerValue={pages.length}
              centerLabel="Pages"
              size={100}
              thickness={15}
            />
          </div>
        </div>

        {/* 2. Title Tag Health */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Type size={14} className="text-blue-600" />
                <span>Title Tags</span>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  missingTitleCount === 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                )}
              >
                {missingTitleCount === 0 ? "100% Valid" : `${missingTitleCount} Missing`}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {pages.length > 0 ? `${Math.round(((pages.length - missingTitleCount) / pages.length) * 100)}%` : "—"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {pages.length - missingTitleCount} with valid title tags
            </p>
          </div>
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${pages.length > 0 ? ((pages.length - missingTitleCount) / pages.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* 3. Meta Descriptions */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Layers size={14} className="text-blue-600" />
                <span>Meta Descriptions</span>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  missingMetaDescCount === 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {missingMetaDescCount === 0 ? "All Configured" : `${missingMetaDescCount} Missing`}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {pages.length > 0 ? `${Math.round(((pages.length - missingMetaDescCount) / pages.length) * 100)}%` : "—"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {pages.length - missingMetaDescCount} pages with meta descriptions
            </p>
          </div>
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${pages.length > 0 ? ((pages.length - missingMetaDescCount) / pages.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* 4. Heading Hierarchy */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Heading size={14} className="text-blue-600" />
                <span>H1 Hierarchy</span>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  missingH1Count === 0 && multipleH1Count === 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                )}
              >
                {missingH1Count + multipleH1Count === 0 ? "Clean" : `${missingH1Count + multipleH1Count} Issues`}
              </span>
            </div>
            <div className="space-y-1.5 text-xs mt-2">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Missing H1</span>
                <span className="font-mono font-bold text-rose-600">{missingH1Count}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Multiple H1s</span>
                <span className="font-mono font-bold text-amber-600">{multipleH1Count}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Proper single H1</span>
                <span className="font-mono font-bold text-emerald-600">
                  {pages.length - missingH1Count - multipleH1Count}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content & On-Page Table */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Page-by-Page Content Audit</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review on-page title tags, meta descriptions, word depth, and headings.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search URL or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-44 sm:w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <select
              value={selectedIssueType}
              onChange={(e) => setSelectedIssueType(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              <option value="ALL">All Pages</option>
              <option value="THIN">Thin Content (&lt; 350 words)</option>
              <option value="NO_TITLE">Missing Title</option>
              <option value="NO_DESC">Missing Meta Description</option>
              <option value="H1_ISSUE">H1 Hierarchy Issues</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-50/50 dark:bg-slate-900/50">
                <th className="p-3 pl-4">PAGE URL</th>
                <th className="p-3">TITLE TAG</th>
                <th className="p-3">META DESCRIPTION</th>
                <th className="p-3">H1 HEADING</th>
                <th className="p-3 text-right">WORD COUNT</th>
                <th className="p-3 pr-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPages.slice(0, 25).map((page) => {
                const isThin = page.wordCount < 350;
                const hasH1 = page.h1 && page.h1.length === 1;

                return (
                  <tr key={page.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 pl-4 max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-blue-600 dark:text-blue-400 truncate">
                          {page.url}
                        </span>
                        <a href={page.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-slate-600">
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </td>

                    <td className="p-3 max-w-[220px]">
                      {page.title ? (
                        <span className="text-slate-800 dark:text-slate-200 line-clamp-1">{page.title}</span>
                      ) : (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <AlertTriangle size={12} /> Missing Title
                        </span>
                      )}
                    </td>

                    <td className="p-3 max-w-[240px]">
                      {page.metaDescription ? (
                        <span className="text-slate-600 dark:text-slate-400 line-clamp-1">{page.metaDescription}</span>
                      ) : (
                        <span className="text-amber-600 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} /> Missing Description
                        </span>
                      )}
                    </td>

                    <td className="p-3 max-w-[180px]">
                      {hasH1 ? (
                        <span className="text-slate-700 dark:text-slate-300 truncate block">{page.h1[0]}</span>
                      ) : (
                        <span className="text-amber-600 text-[11px] font-medium">
                          {!page.h1 || page.h1.length === 0 ? "Missing H1" : `${page.h1.length} H1 tags`}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      <span className={cn("font-mono font-bold", isThin ? "text-rose-600" : "text-slate-900 dark:text-white")}>
                        {page.wordCount.toLocaleString()}
                      </span>
                    </td>

                    <td className="p-3 pr-4 text-right">
                      <button
                        type="button"
                        onClick={() => onOptimizePage?.(page)}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 hover:bg-blue-100 px-2.5 py-1 text-xs font-semibold transition-colors"
                      >
                        <Sparkles size={11} />
                        <span>Optimize</span>
                      </button>
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
