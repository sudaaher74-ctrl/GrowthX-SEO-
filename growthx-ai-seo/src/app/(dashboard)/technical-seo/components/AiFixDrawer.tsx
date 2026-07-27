"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Code, CheckCircle, ArrowRight, Eye, ShieldAlert, FileWarning, HelpCircle, ArrowLeftRight } from "lucide-react";
import { useState } from "react";

interface AiFixDrawerProps {
  issue: any;
  isOpen: boolean;
  onClose: () => void;
}

export function AiFixDrawer({ issue, isOpen, onClose }: AiFixDrawerProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "explain" | "code">("preview");

  if (!isOpen || !issue) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        />

        {/* Drawer */}
        <motion.div 
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative w-full max-w-xl h-full bg-[var(--bg-base)] shadow-2xl flex flex-col border-l border-[var(--border-color)] overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-[var(--border-color)] flex items-start justify-between bg-[var(--surface-2)]">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                  issue.severity === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  issue.severity === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {issue.severity.toUpperCase()}
                </span>
                <span className="text-xs text-[var(--text-muted)] font-medium">{issue.category}</span>
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">{issue.type}</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 truncate max-w-md">{issue.url}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-[var(--surface-3)] rounded-full transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={20} />
            </button>
          </div>

          {/* AI Confidence Banner */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 p-4 border-b border-indigo-100 dark:border-indigo-900/50 flex items-center gap-3">
            <Sparkles className="text-indigo-600 dark:text-indigo-400" size={20} />
            <div>
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">AI Confidence: {issue.aiConfidence}%</p>
              <p className="text-xs text-indigo-700 dark:text-indigo-400/80">Safe to auto-fix. Rollback available.</p>
            </div>
            <div className="ml-auto">
              <button className="px-4 py-2 bg-gradient-brand text-white text-sm font-semibold rounded-lg shadow-glow-brand hover:opacity-90 transition-opacity flex items-center gap-2">
                <Sparkles size={14} />
                Apply Fix
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border-color)]">
            <button 
              onClick={() => setActiveTab("preview")}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'preview' ? 'border-[var(--color-brand-500)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              <Eye size={16} className="inline mr-2" /> Preview
            </button>
            <button 
              onClick={() => setActiveTab("code")}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'code' ? 'border-[var(--color-brand-500)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              <Code size={16} className="inline mr-2" /> Code Diff
            </button>
            <button 
              onClick={() => setActiveTab("explain")}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'explain' ? 'border-[var(--color-brand-500)] text-[var(--text-primary)]' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              <HelpCircle size={16} className="inline mr-2" /> Explain
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "preview" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <ArrowLeftRight size={16} className="text-[var(--text-muted)]" /> 
                    Expected Improvement
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[var(--surface-2)] p-4 rounded-lg border border-[var(--border-color)]">
                      <p className="text-xs text-[var(--text-muted)] mb-1">SEO Score</p>
                      <p className="text-lg font-semibold text-[var(--color-success-500)]">+2 Points</p>
                    </div>
                    <div className="bg-[var(--surface-2)] p-4 rounded-lg border border-[var(--border-color)]">
                      <p className="text-xs text-[var(--text-muted)] mb-1">Estimated Traffic</p>
                      <p className="text-lg font-semibold text-[var(--color-success-500)]">+1.2% / mo</p>
                    </div>
                  </div>
                </div>
                
                <div>
                   <h3 className="text-sm font-medium text-[var(--text-primary)] mb-3">Resolution Details</h3>
                   <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-900/30 flex gap-3">
                     <CheckCircle className="text-green-600 dark:text-green-400 mt-0.5" size={18} />
                     <p className="text-sm text-green-800 dark:text-green-300">
                       AI has generated a self-referencing canonical tag for this parameterized URL to consolidate link equity and prevent duplicate content penalties.
                     </p>
                   </div>
                </div>
              </div>
            )}

            {activeTab === "code" && (
              <div>
                 <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-[var(--border-color)]">
                   <div className="flex items-center px-4 py-2 bg-[#2d2d2d] text-[#ccc] text-xs font-mono border-b border-[#444]">
                     <span>index.html</span>
                   </div>
                   <pre className="p-4 text-sm font-mono overflow-x-auto">
                     <code className="text-[#d4d4d4]">
                       <span className="text-[#569cd6]">&lt;head&gt;</span>{'\n'}
                       {'  '}<span className="text-[#569cd6]">&lt;title&gt;</span>Products - Red<span className="text-[#569cd6]">&lt;/title&gt;</span>{'\n'}
                       <span className="bg-red-900/30 block px-2 -mx-2"><span className="text-red-400">- </span>{'  '}</span>
                       <span className="bg-green-900/30 block px-2 -mx-2"><span className="text-green-400">+ </span>{'  '}<span className="text-[#569cd6]">&lt;link</span> <span className="text-[#9cdcfe]">rel</span>=<span className="text-[#ce9178]">"canonical"</span> <span className="text-[#9cdcfe]">href</span>=<span className="text-[#ce9178]">"https://milquu.com/products"</span> <span className="text-[#569cd6]">/&gt;</span></span>
                       <span className="text-[#569cd6]">&lt;/head&gt;</span>
                     </code>
                   </pre>
                 </div>
              </div>
            )}

            {activeTab === "explain" && (
              <div className="space-y-6 prose prose-sm dark:prose-invert">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">Why is this an issue?</h3>
                  <p className="text-[var(--text-secondary)] mt-2">
                    Parameterized URLs (like `?color=red`) create multiple distinct URLs pointing to essentially the same content. Search engines view these as duplicate pages, which dilutes your ranking power (link equity) across multiple variations instead of consolidating it on the main page.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">How does the fix work?</h3>
                  <p className="text-[var(--text-secondary)] mt-2">
                    Adding a canonical tag tells Google: <em>"Hey, regardless of what parameters are in the URL, treat `https://milquu.com/products` as the master version."</em> All ranking signals will be routed to the master URL.
                  </p>
                </div>
                <div>
                  <a href="#" className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1">
                    Read Google's Documentation <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-[var(--border-color)] bg-[var(--surface-2)] flex items-center gap-3">
            <button className="flex-1 px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--surface-3)] transition-colors">
              Ignore
            </button>
            <button className="flex-1 px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--surface-3)] transition-colors">
              Assign to Dev
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
