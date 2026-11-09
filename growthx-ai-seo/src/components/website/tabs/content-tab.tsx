"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  FileText,
  Heading,
  Layers,
  Search,
  Type,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrawlIssue, CrawlPage } from "@/lib/api-client";
import { DonutChart } from "../donut-chart";

interface ContentTabProps {
  pages: CrawlPage[];
  issues: CrawlIssue[];
}

export function ContentTab({ pages, issues: _issues }: ContentTabProps) {
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
      { label: "Optimal (350–2k)", value: optimalPages.length, color: "var(--color-success-500)" },
      { label: "Deep (> 2k)", value: deepPages.length, color: "var(--color-primary-500)" },
      { label: "Thin (< 350)", value: thinPages.length, color: "var(--color-error-500)" },
    ];
  }, [optimalPages, deepPages, thinPages]);

  // Meta tag coverage
  const missingTitleCount = pages.filter((p) => !p.title || p.title.trim() === "").length;
  const missingMetaDescCount = pages.filter((p) => !p.metaDescription || p.metaDescription.trim() === "").length;
  const missingH1Count = pages.filter((p) => !p.h1 || p.h1.length === 0).length;
  const multipleH1Count = pages.filter((p) => p.h1 && p.h1.length > 1).length;

  const totalMetadataIssues = missingTitleCount + missingMetaDescCount + missingH1Count + multipleH1Count;

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
    <div className="space-y-4">
      {/* Executive Content Health Action Banner */}
      <div className="rounded-2xl border border-brand-200 bg-surface-1 p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100 shadow-2xs">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-brand-950">On-Page Content &amp; Snippet Quality</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[10px] font-semibold text-success-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
                  {pages.length} Pages Audited
                </span>
              </div>
              <p className="text-xs text-brand-500">
                Word depth, title tags, SERP snippets, and heading hierarchy across your crawled pages.
              </p>
            </div>
          </div>
          {totalMetadataIssues > 0 && (
            <Link
              href="/fix-engine"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-bold text-signal-ink hover:bg-signal-500 transition shadow-2xs"
            >
              <Zap size={12} className="text-signal-ink" />
              <span>Optimize Metadata in Fix Engine</span>
              <ArrowRight size={12} />
            </Link>
          )}
        </div>
      </div>

      {/* Top 4 Interactive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Word Depth Distribution */}
        <button
          type="button"
          onClick={() => setSelectedIssueType(selectedIssueType === "THIN" ? "ALL" : "THIN")}
          className={cn(
            "rounded-xl border bg-surface-1 p-4 shadow-2xs flex flex-col justify-between overflow-hidden text-left transition cursor-pointer",
            selectedIssueType === "THIN"
              ? "border-primary-500 ring-1 ring-primary-500"
              : "border-brand-200 hover:border-brand-300"
          )}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">
            <div className="flex items-center gap-1.5">
              <FileText size={14} className="text-primary-600" />
              <span>Word Depth</span>
            </div>
            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", thinPages.length > 0 ? "bg-error-50 text-error-700 border-error-200" : "bg-success-50 text-success-700 border-success-200")}>
              {thinPages.length > 0 ? `${thinPages.length} Thin` : "Balanced"}
            </span>
          </div>
          <div className="flex items-center justify-center py-1">
            <DonutChart
              data={wordDepthDonut}
              centerValue={pages.length}
              centerLabel="Pages"
              size={96}
              thickness={14}
            />
          </div>
        </button>

        {/* 2. Title Tag Health */}
        <button
          type="button"
          onClick={() => setSelectedIssueType(selectedIssueType === "NO_TITLE" ? "ALL" : "NO_TITLE")}
          className={cn(
            "rounded-xl border bg-surface-1 p-4 shadow-2xs flex flex-col justify-between text-left transition cursor-pointer",
            selectedIssueType === "NO_TITLE"
              ? "border-primary-500 ring-1 ring-primary-500"
              : "border-brand-200 hover:border-brand-300"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Type size={14} className="text-primary-600" />
                <span>Title Tags</span>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  missingTitleCount === 0 ? "bg-success-50 text-success-700 border-success-200" : "bg-error-50 text-error-700 border-error-200"
                )}
              >
                {missingTitleCount === 0 ? "100% Valid" : `${missingTitleCount} Missing`}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-brand-950">
                {pages.length > 0 ? `${Math.round(((pages.length - missingTitleCount) / pages.length) * 100)}%` : "—"}
              </span>
            </div>
            <p className="text-xs text-brand-500 mt-1">
              {pages.length - missingTitleCount} with valid title tags
            </p>
          </div>
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full bg-success-500 rounded-full"
                style={{ width: `${pages.length > 0 ? ((pages.length - missingTitleCount) / pages.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </button>

        {/* 3. Meta Descriptions */}
        <button
          type="button"
          onClick={() => setSelectedIssueType(selectedIssueType === "NO_DESC" ? "ALL" : "NO_DESC")}
          className={cn(
            "rounded-xl border bg-surface-1 p-4 shadow-2xs flex flex-col justify-between text-left transition cursor-pointer",
            selectedIssueType === "NO_DESC"
              ? "border-primary-500 ring-1 ring-primary-500"
              : "border-brand-200 hover:border-brand-300"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Layers size={14} className="text-primary-600" />
                <span>Descriptions</span>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  missingMetaDescCount === 0 ? "bg-success-50 text-success-700 border-success-200" : "bg-warning-50 text-warning-700 border-warning-200"
                )}
              >
                {missingMetaDescCount === 0 ? "All Configured" : `${missingMetaDescCount} Missing`}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-bold tracking-tight text-brand-950">
                {pages.length > 0 ? `${Math.round(((pages.length - missingMetaDescCount) / pages.length) * 100)}%` : "—"}
              </span>
            </div>
            <p className="text-xs text-brand-500 mt-1">
              {pages.length - missingMetaDescCount} pages with meta descriptions
            </p>
          </div>
          <div className="mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
              <div
                className="h-full bg-primary-600 rounded-full"
                style={{ width: `${pages.length > 0 ? ((pages.length - missingMetaDescCount) / pages.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        </button>

        {/* 4. Heading Hierarchy */}
        <button
          type="button"
          onClick={() => setSelectedIssueType(selectedIssueType === "H1_ISSUE" ? "ALL" : "H1_ISSUE")}
          className={cn(
            "rounded-xl border bg-surface-1 p-4 shadow-2xs flex flex-col justify-between text-left transition cursor-pointer",
            selectedIssueType === "H1_ISSUE"
              ? "border-primary-500 ring-1 ring-primary-500"
              : "border-brand-200 hover:border-brand-300"
          )}
        >
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-brand-500 uppercase tracking-wider mb-2">
              <div className="flex items-center gap-1.5">
                <Heading size={14} className="text-primary-600" />
                <span>H1 Structure</span>
              </div>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  missingH1Count === 0 && multipleH1Count === 0
                    ? "bg-success-50 text-success-700 border-success-200"
                    : "bg-warning-50 text-warning-700 border-warning-200"
                )}
              >
                {missingH1Count + multipleH1Count === 0 ? "Clean" : `${missingH1Count + multipleH1Count} Issues`}
              </span>
            </div>
            <div className="space-y-1.5 text-xs mt-2">
              <div className="flex justify-between text-brand-500">
                <span>Missing H1</span>
                <span className="font-mono font-bold text-error-700">{missingH1Count}</span>
              </div>
              <div className="flex justify-between text-brand-500">
                <span>Multiple H1s</span>
                <span className="font-mono font-bold text-warning-700">{multipleH1Count}</span>
              </div>
              <div className="flex justify-between text-brand-500">
                <span>Proper single H1</span>
                <span className="font-mono font-bold text-success-700">
                  {pages.length - missingH1Count - multipleH1Count}
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Content & On-Page Table */}
      <div className="rounded-2xl border border-brand-200 bg-surface-1 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-brand-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-brand-950">Page-by-Page Content Audit</h3>
            <p className="text-xs text-brand-500 mt-0.5">
              Review on-page title tags, meta descriptions, word depth, and headings.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-400" />
              <input
                type="text"
                placeholder="Search URL or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-44 sm:w-56 rounded-lg border border-brand-200 bg-surface-1 pl-8 pr-3 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <select
              value={selectedIssueType}
              onChange={(e) => setSelectedIssueType(e.target.value)}
              className="h-8 rounded-lg border border-brand-200 bg-surface-1 px-2.5 text-xs font-medium text-brand-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
              <tr className="border-b border-brand-100 text-[11px] font-semibold uppercase tracking-wider text-brand-400 bg-brand-50/40">
                <th className="p-3 pl-4">PAGE URL</th>
                <th className="p-3">TITLE TAG</th>
                <th className="p-3">META DESCRIPTION</th>
                <th className="p-3">H1 HEADING</th>
                <th className="p-3 text-right">WORD COUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {filteredPages.slice(0, 25).map((page) => {
                const isThin = page.wordCount < 350;
                const hasH1 = page.h1 && page.h1.length === 1;

                return (
                  <tr key={page.id} className="hover:bg-brand-50/30 transition-colors">
                    <td className="p-3 pl-4 max-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-primary-600 truncate">
                          {page.url}
                        </span>
                        <a href={page.url} target="_blank" rel="noreferrer" className="text-brand-400 hover:text-brand-600">
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    </td>

                    <td className="p-3 max-w-[220px]">
                      {page.title ? (
                        <span className="text-brand-900 line-clamp-1">{page.title}</span>
                      ) : (
                        <span className="text-error-700 font-semibold flex items-center gap-1">
                          <AlertTriangle size={12} /> Missing Title
                        </span>
                      )}
                    </td>

                    <td className="p-3 max-w-[240px]">
                      {page.metaDescription ? (
                        <span className="text-brand-600 line-clamp-1">{page.metaDescription}</span>
                      ) : (
                        <span className="text-warning-700 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} /> Missing Description
                        </span>
                      )}
                    </td>

                    <td className="p-3 max-w-[180px]">
                      {hasH1 ? (
                        <span className="text-brand-800 truncate block">{page.h1[0]}</span>
                      ) : (
                        <span className="text-warning-700 text-[11px] font-medium">
                          {!page.h1 || page.h1.length === 0 ? "Missing H1" : `${page.h1.length} H1 tags`}
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      <span className={cn("font-mono font-bold", isThin ? "text-error-700" : "text-brand-950")}>
                        {page.wordCount.toLocaleString()}
                      </span>
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
