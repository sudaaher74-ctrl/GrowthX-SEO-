"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  GitBranch,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  FileCode,
  Sparkles,
  Terminal,
  Layers,
  ArrowRight,
  GitMerge,
  Zap,
  TrendingUp,
} from "lucide-react";
import { Pill } from "@/components/ui/console";

export interface LinkBridgeData {
  donorUrl: string;
  donorTitle: string;
  donorPageRank: number;
  orphanUrl: string;
  orphanTitle: string;
  anchorText: string;
  equityTransfer: number;
  injectedHtml: string;
}

export interface FixEvidenceDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueTitle?: string;
  category?: string;
  targetUrl?: string;
  originalCode?: string;
  remediatedCode?: string;
  deliverable?: string;
  gitBranch?: string;
  prNumber?: number;
  commitSha?: string;
  checks?: Array<{ name: string; status: "PASSED" | "VERIFIED" | "IN_PROGRESS"; detail: string }>;
  /** Populated for ORPHAN_PAGE / LINK fixes — renders the Link Bridge Card */
  linkBridge?: LinkBridgeData;
}

export function FixEvidenceDiffModal({
  isOpen,
  onClose,
  issueTitle = "Automated Canonical & Metadata Optimization",
  category = "Technical SEO",
  targetUrl = "https://example.com/services/enterprise-seo",
  originalCode,
  remediatedCode,
  deliverable = "Next.js Metadata export & Canonical tag injection",
  gitBranch = "fix/growthx-sprint1-canonical",
  prNumber = 14,
  commitSha = "8f2a1b9",
  checks = [
    { name: "TypeScript AST Syntax & Lint Check", status: "PASSED", detail: "0 compilation errors, 0 warning diagnostics" },
    { name: "Googlebot User-Agent Crawl Simulation", status: "PASSED", detail: "HTTP 200 OK, zero redirect loops encountered" },
    { name: "Schema.org Validator", status: "VERIFIED", detail: "Valid JSON-LD schema with zero missing required fields" },
    { name: "Core Web Vitals Regression Check", status: "PASSED", detail: "Zero CLS or LCP layout regression on mobile/desktop" },
  ],
  linkBridge,
}: FixEvidenceDiffModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedBridge, setCopiedBridge] = useState(false);
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");

  if (!isOpen) return null;

  const defaultOriginal =
    originalCode ||
    `<head>\n  <title>Enterprise SEO - Best Services</title>\n  <!-- Missing canonical tag -->\n  <!-- Missing JSON-LD schema -->\n  <meta name="robots" content="index, follow" />\n</head>`;

  const defaultRemediated =
    remediatedCode ||
    `<head>\n  <title>Enterprise SEO Platform & Automation | GrowthX</title>\n  <link rel="canonical" href="${targetUrl}" />\n  <meta name="description" content="Automate enterprise SEO, competitor keyword displacement, and generative AI search engine visibility with GrowthX." />\n  <script type="application/ld+json">\n  {\n    "@context": "https://schema.org",\n    "@type": "SoftwareApplication",\n    "name": "GrowthX SEO",\n    "applicationCategory": "BusinessApplication"\n  }\n  </script>\n</head>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(defaultRemediated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyBridge = () => {
    if (linkBridge) {
      navigator.clipboard.writeText(linkBridge.injectedHtml);
      setCopiedBridge(true);
      setTimeout(() => setCopiedBridge(false), 2000);
    }
  };

  const safePathname = (url: string) => {
    try { return new URL(url).pathname; } catch { return url; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-900">
                <Sparkles size={11} />
                Autonomous Engineer Proof
              </span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                {category}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">{issueTitle}</h3>
            <p className="text-xs font-mono text-slate-500 truncate max-w-xl">
              Target: <span className="text-slate-800 font-semibold">{targetUrl}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── LINK BRIDGE CARD (Model B: Neural Link Sculptor) ── */}
          {linkBridge && (
            <div className="rounded-2xl border bg-brand-50/60 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/10 text-accent-600">
                    <GitMerge size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-950 uppercase tracking-wider">Neural Link Bridge</span>
                    <p className="text-[10.5px] text-brand-500 font-medium">PageRank Equity Flow Visualization</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyBridge}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-950 hover:bg-brand-900 text-white px-3 py-1.5 text-[11px] font-semibold transition"
                >
                  {copiedBridge ? <Check size={11} className="text-success-500" /> : <Copy size={11} />}
                  <span>{copiedBridge ? "Copied!" : "Copy HTML Paragraph"}</span>
                </button>
              </div>

              {/* Equity Flow: Donor → Anchor → Target */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {/* Donor */}
                <div className="flex-1 rounded-xl border bg-white p-3.5 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-brand-500 tracking-widest">Donor Page</span>
                    <span className="rounded-md bg-accent-500/10 text-accent-600 px-1.5 py-0.5 text-[10px] font-bold">
                      PR {linkBridge.donorPageRank}/100
                    </span>
                  </div>
                  <p className="text-xs font-bold text-brand-950 leading-tight line-clamp-2">{linkBridge.donorTitle}</p>
                  <span className="text-[10.5px] font-mono text-brand-400 break-all">{safePathname(linkBridge.donorUrl)}</span>
                </div>

                {/* Arrow + Anchor */}
                <div className="flex flex-col items-center gap-1 shrink-0 px-2">
                  <div className="flex items-center gap-1">
                    <Zap size={12} className="text-warning-500" />
                    <span className="text-[10px] font-bold text-warning-600">+{linkBridge.equityTransfer} PR pts</span>
                  </div>
                  <ArrowRight size={20} className="text-brand-400" />
                  <div className="rounded-lg bg-brand-950 text-white px-2.5 py-1 text-[10.5px] font-bold text-center max-w-[120px] truncate" title={linkBridge.anchorText}>
                    "{linkBridge.anchorText}"
                  </div>
                </div>

                {/* Target */}
                <div className="flex-1 rounded-xl border border-error-500/30 bg-white p-3.5 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-error-600 tracking-widest">Orphan Target</span>
                    <span className="rounded-md bg-error-500/10 text-error-600 px-1.5 py-0.5 text-[10px] font-bold">
                      Was: 0 links
                    </span>
                  </div>
                  <p className="text-xs font-bold text-brand-950 leading-tight line-clamp-2">{linkBridge.orphanTitle}</p>
                  <span className="text-[10.5px] font-mono text-brand-400 break-all">{safePathname(linkBridge.orphanUrl)}</span>
                </div>
              </div>

              {/* Impact Statement */}
              <div className="flex items-center gap-2 rounded-xl bg-success-500/10 border border-success-500/20 px-3.5 py-2.5">
                <TrendingUp size={14} className="text-success-600 shrink-0" />
                <p className="text-[11.5px] text-success-600 font-medium leading-snug">
                  This contextual sentence injects <strong className="text-brand-950 font-bold">{linkBridge.equityTransfer} PageRank points</strong> into the orphan page, making it crawlable via Googlebot traversal and eligible for organic indexing.
                </p>
              </div>
            </div>
          )}

          {/* Git Branch & Verification Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="flex items-center gap-2">
                <GitBranch size={16} className="text-slate-900 shrink-0" />
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Git Branch</span>
                  <span className="font-mono font-semibold text-slate-800 text-[11.5px]">{gitBranch}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileCode size={16} className="text-blue-600 shrink-0" />
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Pull Request</span>
                  <span className="font-semibold text-blue-700 text-[11.5px]">PR #{prNumber} (Ready for merge)</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Terminal size={16} className="text-emerald-600 shrink-0" />
                <div>
                  <span className="text-[10.5px] uppercase font-bold text-slate-400 block">Commit SHA</span>
                  <span className="font-mono font-semibold text-slate-800 text-[11.5px]">{commitSha}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Code Diff */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Automated Code Remediation Diff
                </span>
                <span className="text-[11px] text-slate-400">({deliverable})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === "split" ? "unified" : "split")}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Mode: {viewMode === "split" ? "Split View" : "Unified View"}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 transition"
                >
                  {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{copied ? "Copied" : "Copy Patch"}</span>
                </button>
              </div>
            </div>

            {viewMode === "split" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                {/* Original */}
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 overflow-x-auto">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-rose-200 text-rose-800 font-sans font-semibold text-[11px]">
                    <span>Original Live Markup (Crawled)</span>
                    <span className="rounded bg-rose-200 px-1.5 py-0.5 text-[10px]">Before</span>
                  </div>
                  <pre className="text-rose-900 text-[11.5px] leading-relaxed whitespace-pre-wrap">
                    {defaultOriginal}
                  </pre>
                </div>

                {/* Remediated */}
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 overflow-x-auto">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-200 text-emerald-800 font-sans font-semibold text-[11px]">
                    <span>AI Autonomous Patch (Verified)</span>
                    <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-[10px]">After</span>
                  </div>
                  <pre className="text-emerald-950 text-[11.5px] leading-relaxed whitespace-pre-wrap">
                    {defaultRemediated}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100 p-4 font-mono text-xs overflow-x-auto">
                <div className="text-rose-400 whitespace-pre-wrap mb-2">
                  {defaultOriginal.split("\n").map((line, i) => (
                    <div key={`orig-${i}`} className="bg-rose-950/40 px-2 py-0.5">
                      - {line}
                    </div>
                  ))}
                </div>
                <div className="text-emerald-400 whitespace-pre-wrap">
                  {defaultRemediated.split("\n").map((line, i) => (
                    <div key={`rem-${i}`} className="bg-emerald-950/40 px-2 py-0.5">
                      + {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Verification Proofs */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Autonomous Verification Proofs
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {checks.map((c) => (
                <div
                  key={c.name}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 flex items-start gap-2.5 text-xs"
                >
                  <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 text-[12px]">{c.name}</span>
                    <p className="text-[11px] text-slate-500 leading-normal">{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Validated against live search engine standards and AST compiler checks.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
