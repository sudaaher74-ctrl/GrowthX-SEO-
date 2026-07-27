"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { newTechnicalIssues } from "@/lib/mock-seo-data";
import { AiFixDrawer } from "./AiFixDrawer";
import { Sparkles, ShieldAlert, FileWarning, Search, Filter, ArrowUpDown, ChevronDown } from "lucide-react";

export function IssuesDataTable() {
  const [selectedIssue, setSelectedIssue] = useState<any>(null);

  const getSeverityBadge = (severity: string) => {
    switch(severity) {
      case 'critical':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30"><ShieldAlert size={12}/> Critical</span>;
      case 'high':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/30"><FileWarning size={12}/> High</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/30"><Search size={12}/> Medium</span>;
    }
  };

  return (
    <div className="mt-8">
      {/* Sticky Filter Bar */}
      <div className="sticky top-0 z-20 bg-[var(--bg-overlay)] backdrop-blur-md border-b border-[var(--border-color)] p-4 flex flex-wrap items-center gap-4 mb-4 rounded-t-xl">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={16} />
          <input 
            type="text" 
            placeholder="Search issues, URLs..." 
            className="w-full pl-9 pr-4 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]/20"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--surface-3)] transition-colors flex items-center gap-2">
            <Filter size={14} /> Severity <ChevronDown size={14} />
          </button>
          <button className="px-3 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--surface-3)] transition-colors flex items-center gap-2">
            Issue Type <ChevronDown size={14} />
          </button>
          <button className="px-3 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--surface-3)] transition-colors flex items-center gap-2">
            <ArrowUpDown size={14} /> Sort
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-[var(--card-bg)] rounded-b-xl border border-[var(--border-color)] border-t-0 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--surface-2)] border-b border-[var(--border-color)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold w-10"><input type="checkbox" className="rounded border-[var(--border-strong)]" /></th>
                <th className="p-4 font-semibold">Priority</th>
                <th className="p-4 font-semibold">Issue Name & URL</th>
                <th className="p-4 font-semibold">Difficulty</th>
                <th className="p-4 font-semibold">Est. Fix Time</th>
                <th className="p-4 font-semibold">AI Confidence</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">
              {newTechnicalIssues.map((issue, idx) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={issue.id} 
                  className="hover:bg-[var(--surface-2)] transition-colors group"
                >
                  <td className="p-4"><input type="checkbox" className="rounded border-[var(--border-strong)]" /></td>
                  <td className="p-4">{getSeverityBadge(issue.severity)}</td>
                  <td className="p-4">
                    <p className="font-semibold text-[var(--text-primary)] text-sm">{issue.type}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1 truncate max-w-[250px]" title={issue.url}>{issue.url}</p>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-[var(--text-secondary)]">{issue.difficulty}</span>
                  </td>
                  <td className="p-4 text-sm text-[var(--text-secondary)]">{issue.fixTime}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-[var(--surface-3)] rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-brand rounded-full" 
                          style={{ width: `${issue.aiConfidence}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{issue.aiConfidence}%</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => setSelectedIssue(issue)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-brand text-white text-xs font-semibold rounded-lg shadow-glow-brand opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 hover:opacity-90"
                    >
                      <Sparkles size={12} />
                      AI Fix
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AiFixDrawer 
        issue={selectedIssue} 
        isOpen={!!selectedIssue} 
        onClose={() => setSelectedIssue(null)} 
      />
    </div>
  );
}
