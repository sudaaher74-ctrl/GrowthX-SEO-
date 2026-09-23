"use client";

import React, { useEffect } from "react";
import {
  Printer,
  X,
  FileText,
  Sparkles,
} from "lucide-react";
import { SeoAuditReportDocument } from "./seo-audit-report-document";
import type { CrawlIssue, CrawlPage, IssueCounts, IssueGroup } from "@/lib/api-client";
import "./audit-report-print.css";

export interface SeoAuditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientName?: string | null;
  domain?: string | null;
  crawledAt?: string | null;
  crawlDuration?: string | null;
  healthScore?: number | null;
  counts?: IssueCounts | null;
  groups?: IssueGroup[] | null;
  issues: CrawlIssue[];
  pages: CrawlPage[];
  qualityDiagnostics?: {
    pagesCrawled?: number;
    durationSeconds?: number;
    issuesFound?: number;
  } | null;
}

export function SeoAuditReportModal({
  isOpen,
  onClose,
  clientName,
  domain,
  crawledAt,
  crawlDuration,
  healthScore,
  counts,
  groups,
  issues,
  pages,
  qualityDiagnostics,
}: SeoAuditReportModalProps) {
  // Prevent background body scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const displayDomain = domain || "your website";

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200"
    >
      {/* Top Action & Navigation Bar (Hidden during print) */}
      <div className="no-print h-14 border-b border-slate-800 bg-slate-900/95 px-4 sm:px-6 flex items-center justify-between gap-4 text-white shrink-0 z-10 shadow-lg">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
            <FileText size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold truncate">
                Website SEO Audit Report — {displayDomain}
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                <Sparkles size={10} /> A4
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              Ready for client presentation &amp; PDF download
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition cursor-pointer"
          >
            <Printer size={13} />
            <span>Save as PDF / Print</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            title="Close Preview"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Printable / Preview Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-900/50">
        <SeoAuditReportDocument
          clientName={clientName}
          domain={domain}
          crawledAt={crawledAt}
          crawlDuration={crawlDuration}
          healthScore={healthScore}
          counts={counts}
          groups={groups}
          issues={issues}
          pages={pages}
          qualityDiagnostics={qualityDiagnostics}
        />
      </div>
    </div>
  );
}
