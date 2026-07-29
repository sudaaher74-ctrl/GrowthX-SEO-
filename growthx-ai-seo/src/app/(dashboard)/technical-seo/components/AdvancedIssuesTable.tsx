"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronDown, ChevronRight, AlertCircle, AlertTriangle, Info, 
  CheckCircle2, Bot, Code2, ArrowRight, Play, Sparkles, Filter 
} from "lucide-react";

export function AdvancedIssuesTable({ issues }: { issues: any[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'HIGH': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'MEDIUM': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'LOW': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toUpperCase()) {
      case 'CRITICAL': return <AlertCircle size={14} />;
      case 'HIGH': return <AlertTriangle size={14} />;
      case 'MEDIUM': return <Info size={14} />;
      case 'LOW': return <CheckCircle2 size={14} />;
      default: return <Info size={14} />;
    }
  };

  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl shadow-sm overflow-hidden flex flex-col">
      
      {/* Toolbar Header */}
      <div className="p-4 border-b border-[var(--border-color)] bg-[var(--surface-2)]/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Issue Pipeline</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface-3)] text-xs font-semibold text-[var(--text-secondary)]">
            {issues.length} total
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-md text-sm font-medium hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2">
            <Filter size={14} /> Filter
          </button>
          <button className="px-4 py-1.5 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-md text-sm font-semibold hover:opacity-90 transition-opacity">
            Bulk Actions
          </button>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--border-color)] text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--surface-1)]">
        <div className="col-span-1 text-center">Action</div>
        <div className="col-span-1">Severity</div>
        <div className="col-span-3">Issue Type</div>
        <div className="col-span-5">Affected URL</div>
        <div className="col-span-2 text-right">AI Confidence</div>
      </div>

      {/* Empty State */}
      {(!issues || issues.length === 0) && (
        <div className="p-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center">
          <CheckCircle2 size={48} className="mb-4 text-[var(--color-brand-400)] opacity-20" />
          <p className="text-lg font-semibold text-[var(--text-primary)]">No issues detected!</p>
          <p className="text-sm">Your site is perfectly optimized, or you need to run a crawl.</p>
        </div>
      )}

      {/* Table Body */}
      <div className="divide-y divide-[var(--border-color)] max-h-[800px] overflow-y-auto">
        {issues.map((issue) => {
          const isExpanded = expandedId === issue.id;

          return (
            <div key={issue.id} className={`transition-colors ${isExpanded ? 'bg-[var(--color-brand-500)]/[0.02]' : 'hover:bg-[var(--surface-2)]/50'}`}>
              
              {/* Main Row */}
              <div 
                className="grid grid-cols-12 gap-4 p-4 items-center cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : issue.id)}
              >
                <div className="col-span-1 flex justify-center">
                  <button className="p-1 rounded-md hover:bg-[var(--surface-3)] text-[var(--text-secondary)] transition-colors">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </button>
                </div>
                
                <div className="col-span-1">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold border ${getSeverityColor(issue.severity)}`}>
                    {getSeverityIcon(issue.severity)}
                    {issue.severity}
                  </span>
                </div>
                
                <div className="col-span-3 font-semibold text-[var(--text-primary)] truncate text-sm">
                  {issue.issueType}
                </div>
                
                <div className="col-span-5 text-sm text-[var(--text-secondary)] truncate font-mono text-xs" title={issue.affectedUrl}>
                  {issue.affectedUrl}
                </div>
                
                <div className="col-span-2 text-right flex items-center justify-end gap-2">
                  <div className="w-16 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '92%' }} />
                  </div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">92%</span>
                </div>
              </div>

              {/* Expanded Details Panel (AI Explanation & Diffs) */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-[var(--border-color)]/50"
                  >
                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gradient-to-b from-[var(--color-brand-500)]/[0.02] to-transparent">
                      
                      {/* Left: AI Diagnosis */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[var(--color-brand-600)] dark:text-[var(--color-brand-400)] font-bold text-sm">
                          <Bot size={16} /> AI Diagnosis
                        </div>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                          {issue.details ? (typeof issue.details === 'string' ? issue.details : JSON.stringify(issue.details)) : "No further details provided by the crawler."}
                        </p>
                        
                        <div className="p-4 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-xl mt-4">
                          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">Recommended Action</h4>
                          <p className="text-sm text-[var(--text-primary)]">
                            The AI engine can automatically deploy a patch to resolve this issue by injecting the missing elements into the document head or correcting the canonical reference.
                          </p>
                          <button className="mt-4 px-4 py-2 bg-gradient-brand text-white rounded-lg text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity flex items-center gap-2">
                            <Sparkles size={16} /> Auto-Fix Issue
                          </button>
                        </div>
                      </div>

                      {/* Right: Code Diff Preview */}
                      <div className="border border-[var(--border-color)] rounded-xl overflow-hidden bg-[#1e1e1e] font-mono text-xs flex flex-col">
                        <div className="flex items-center gap-2 p-2 border-b border-gray-700 bg-[#2d2d2d] text-gray-300">
                          <Code2 size={14} /> <span>Proposed Code Change</span>
                        </div>
                        <div className="p-4 overflow-x-auto space-y-1">
                          <div className="text-gray-400">  &lt;head&gt;</div>
                          <div className="text-gray-400">    &lt;title&gt;Existing Title&lt;/title&gt;</div>
                          <div className="text-red-400 bg-red-500/10 px-2 rounded -mx-2 flex gap-4">
                            <span>-</span><span>&lt;!-- Missing Meta Tag --&gt;</span>
                          </div>
                          <div className="text-emerald-400 bg-emerald-500/10 px-2 rounded -mx-2 flex gap-4">
                            <span>+</span><span>&lt;meta name="description" content="AI generated dynamic description for this specific route." /&gt;</span>
                          </div>
                          <div className="text-gray-400">  &lt;/head&gt;</div>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
