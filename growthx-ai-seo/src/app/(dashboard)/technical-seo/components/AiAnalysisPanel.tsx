"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowRight, CheckCircle2, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import { aiSummary } from "@/lib/mock-seo-data";

export function AiAnalysisPanel() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--card-bg)] rounded-[var(--radius-xl)] border border-[var(--border-color)] p-6 shadow-sm overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2 bg-gradient-brand text-white rounded-lg shadow-glow-brand">
          <Sparkles size={20} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">AI SEO Summary</h2>
          <p className="text-sm text-[var(--text-muted)]">Executive Briefing & Strategy</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
        {/* Strengths */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <CheckCircle2 size={16} className="text-[var(--color-success-500)]" />
            Core Strengths
          </h3>
          <ul className="space-y-3">
            {aiSummary.strengths.map((item, i) => (
              <li key={i} className="text-sm text-[var(--text-secondary)] bg-[var(--surface-3)] p-3 rounded-lg border border-[var(--border-color)]">
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Opportunities */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <TrendingUp size={16} className="text-[var(--color-warning-500)]" />
            Top Opportunities
          </h3>
          <ul className="space-y-3">
            {aiSummary.opportunities.map((item, i) => (
              <li key={i} className="text-sm text-[var(--text-secondary)] bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/30">
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Next Actions */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Lightbulb size={16} className="text-[var(--color-accent-500)]" />
            Suggested Actions
          </h3>
          <div className="space-y-3">
            {aiSummary.nextActions.map((action, i) => (
              <button 
                key={i} 
                className="w-full text-left text-sm text-[var(--text-primary)] bg-[var(--surface-3)] hover:bg-[var(--sidebar-item-active)] p-3 rounded-lg border border-[var(--border-color)] transition-colors flex items-center justify-between group"
              >
                <span className="truncate pr-4">{action.text}</span>
                <ArrowRight size={14} className="text-[var(--text-muted)] group-hover:text-[var(--color-brand-600)] transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
          
          <div className="mt-4 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-lg border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-3">
            <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">AI Confidence Score: 96/100</p>
              <p className="text-xs text-indigo-700 dark:text-indigo-400/80 mt-1 leading-relaxed">Executing these actions is highly likely to result in positive SERP movement within 14-21 days.</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
