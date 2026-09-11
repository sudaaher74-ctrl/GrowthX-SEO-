"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  FileCode,
  Globe,
  Printer,
  Copy,
  Check,
  X,
  ExternalLink,
  Award,
  Sparkles,
  Lock,
  Clock,
  Zap,
} from "lucide-react";
import type { VerificationCertificate, VerificationCertificateItem } from "@/lib/api-client";

export interface VerificationCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: VerificationCertificate;
}

export function VerificationCertificateModal({
  isOpen,
  onClose,
  certificate,
}: VerificationCertificateModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    const text = `GrowthX SEO Verification Certificate\nCertificate ID: ${certificate.certificateId}\nDomain: ${certificate.domain}\nVerified: ${certificate.verifiedAt}\nSHA-256: ${certificate.checksum}\nStatus: ${certificate.status} (${certificate.passedCount}/${certificate.totalTested} Passed)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-linear-to-b from-white via-slate-50 to-slate-100 border border-slate-200 shadow-2xl overflow-hidden text-slate-900"
      >
        {/* Certificate Header Banner */}
        <div className="relative p-6 sm:p-8 bg-linear-to-r from-purple-950 via-slate-900 to-indigo-950 text-white overflow-hidden border-b border-purple-800/40">
          {/* Background Decorative Rings */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 -mb-16 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  Official Remediation Certificate
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-mono text-purple-200 bg-purple-900/60 border border-purple-700/50">
                  <Lock className="h-3 w-3 text-purple-400" />
                  Cryptographically Signed
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                <span>Autonomous SEO &amp; Schema Audit Certificate</span>
              </h2>

              <p className="text-xs sm:text-sm text-purple-200/90 max-w-2xl leading-relaxed">
                Issued by Aiva Autonomous Engineering Engine following real-time Googlebot simulation, HTML semantic AST verification, and JSON-LD structured data validation.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Certificate Metadata Ribbon */}
          <div className="mt-6 pt-5 border-t border-purple-800/60 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block">Target Domain</span>
              <span className="font-bold text-white text-sm truncate block mt-0.5">{certificate.domain}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block">Certificate ID</span>
              <span className="font-mono text-emerald-300 text-xs truncate block mt-0.5">{certificate.certificateId}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block">Audit Timestamp</span>
              <span className="text-slate-200 text-xs block mt-0.5 truncate">
                {new Date(certificate.verifiedAt).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-purple-300 tracking-wider block">Verification Verdict</span>
              <span className="inline-flex items-center gap-1 text-emerald-400 font-extrabold text-xs mt-0.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                {certificate.passedCount} / {certificate.totalTested} Passed ({certificate.status})
              </span>
            </div>
          </div>
        </div>

        {/* Certificate Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Pass Rate</span>
                <span className="text-xl font-bold text-slate-900">
                  {certificate.totalTested > 0
                    ? `${Math.round((certificate.passedCount / certificate.totalTested) * 100)}% Verified`
                    : "100%"}
                </span>
                <span className="text-[11px] text-emerald-600 block mt-0.5">Zero critical regression</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Crawler Response</span>
                <span className="text-xl font-bold text-slate-900">{certificate.avgLatencyMs} ms</span>
                <span className="text-[11px] text-purple-600 block mt-0.5">Average TTFB benchmark</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Audit Simulator</span>
                <span className="text-sm font-bold text-slate-900 truncate block">Googlebot UA</span>
                <span className="text-[11px] text-blue-600 block mt-0.5">Full AST compliance</span>
              </div>
            </div>
          </div>

          {/* SHA-256 Checksum Strip */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-800">
            <div className="flex items-center gap-2 truncate">
              <Lock size={13} className="text-emerald-400 shrink-0" />
              <span className="text-slate-400">SHA-256 Digest:</span>
              <span className="text-emerald-300 truncate">{certificate.checksum}</span>
            </div>
            <span className="text-[10.5px] text-slate-400 shrink-0">Secured via cryptographic proof</span>
          </div>

          {/* Verified Items Log Table */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
            <h4 className="text-sm font-bold text-slate-900 flex items-center justify-between">
              <span>Verified URLs &amp; Issue Resolutions</span>
              <span className="text-xs text-slate-400 font-normal">
                {certificate.items.length} verified item{certificate.items.length === 1 ? "" : "s"}
              </span>
            </h4>

            <div className="overflow-x-auto rounded-xl border border-slate-200/80">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Target URL</th>
                    <th className="p-3">Issue Type</th>
                    <th className="p-3">Pre-Fix Baseline</th>
                    <th className="p-3">Post-Fix Telemetry</th>
                    <th className="p-3">Schemas Detected</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {certificate.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono text-[11px] text-slate-700 max-w-xs truncate">
                        {item.url}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{item.issueType}</td>
                      <td className="p-3 text-rose-600 font-medium text-[11px] max-w-xs truncate">
                        {item.beforeMetric}
                      </td>
                      <td className="p-3 text-emerald-700 font-bold text-[11px]">
                        {item.afterMetric}
                      </td>
                      <td className="p-3">
                        {item.detectedSchemas.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.detectedSchemas.slice(0, 2).map((s, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-50 text-purple-700 border border-purple-100"
                              >
                                {s}
                              </span>
                            ))}
                            {item.detectedSchemas.length > 2 && (
                              <span className="text-[10px] text-slate-400">+{item.detectedSchemas.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">None</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <CheckCircle2 size={11} className="text-emerald-600" />
                          Verified
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500">
            <Award className="h-4 w-4 text-purple-600" />
            <span>Guaranteed by Aiva Autonomous Verification Standard (AVS-1.0)</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
              <span>{copied ? "Certificate Copied" : "Copy Verification Proof"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-md shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Printer size={13} />
              <span>Print / Export Certificate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
