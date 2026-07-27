"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { mockContentItems } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sparkles, Plus, CheckCircle2, Clock, FileText, Send,
  Edit3, Eye, Trash2, RefreshCw, ChevronRight
} from "lucide-react";

const typeColors: Record<string, string> = {
  Blog: "info",
  Location: "success",
  Landing: "pending",
  Product: "warning",
};

const statusConfig: Record<string, { label: string; badge: "success" | "pending" | "warning" | "default"; icon: React.ReactNode }> = {
  published: { label: "Published", badge: "success", icon: <CheckCircle2 size={12}/> },
  pending_approval: { label: "Needs Approval", badge: "warning", icon: <Clock size={12}/> },
  draft: { label: "Draft", badge: "default", icon: <Edit3 size={12}/> },
};

const contentTypes = ["All", "Blog", "Location", "Landing", "Product", "FAQ", "Case Study"];
const tones = ["Professional", "Conversational", "Authoritative", "Friendly", "Technical"];

export default function ContentAIPage() {
  const [activeType, setActiveType] = useState("All");
  const [generating, setGenerating] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);

  const filtered = activeType === "All" ? mockContentItems : mockContentItems.filter(c => c.type === activeType);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 2500);
  };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Content AI</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">AI-powered content generation with human approval workflow</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={13}/>} onClick={() => setShowGenerator(!showGenerator)}>
          Generate Content
        </Button>
      </motion.div>

      {/* Content Generator Panel */}
      {showGenerator && (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg gradient-bg-brand flex items-center justify-center">
              <Sparkles size={15} className="text-white"/>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">AI Content Generator</h2>
              <p className="text-xs text-[var(--text-muted)]">Human approval required before publishing • E-E-A-T compliant</p>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Content Type</label>
              <select className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500">
                {contentTypes.slice(1).map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Target Keyword</label>
              <input className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500"
                placeholder="e.g. milk delivery panvel" defaultValue="milk delivery panvel"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Tone</label>
              <select className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500">
                {tones.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Additional Context</label>
            <textarea rows={2} className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 resize-none"
              placeholder="Target audience, key points to cover, competitor URLs to outperform..."/>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" loading={generating} onClick={handleGenerate} icon={<Sparkles size={13}/>}>
              {generating ? "Generating..." : "Generate with AI"}
            </Button>
            <Button variant="ghost" onClick={() => setShowGenerator(false)}>Cancel</Button>
            <p className="text-xs text-[var(--text-muted)] ml-auto">≈ 1,500 words · ~$0.08 cost · requires approval</p>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Content", value: mockContentItems.length, color: "text-indigo-500" },
          { label: "Pending Approval", value: mockContentItems.filter(c => c.status === "pending_approval").length, color: "text-amber-500" },
          { label: "Published", value: mockContentItems.filter(c => c.status === "published").length, color: "text-emerald-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card p-4 text-center">
            <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {contentTypes.map(t => (
          <button key={t} onClick={() => setActiveType(t)} className={cn("px-3 py-1.5 text-xs rounded-lg font-medium whitespace-nowrap transition-base shrink-0",
            activeType === t ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
          )}>{t}</button>
        ))}
      </div>

      {/* Content List */}
      <div className="space-y-2">
        {filtered.map((item, i) => {
          const sc = statusConfig[item.status];
          return (
            <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="card p-4 flex items-center gap-4 hover:shadow-card-hover cursor-pointer group">
              <div className="w-10 h-10 rounded-lg gradient-bg-brand flex items-center justify-center shrink-0">
                <FileText size={16} className="text-white"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{item.title}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Badge variant={typeColors[item.type] as "info" | "success" | "pending" | "warning" | "default"}>{item.type}</Badge>
                  <span>{item.words.toLocaleString()} words</span>
                  <span>·</span>
                  <span>{item.date}</span>
                </div>
              </div>
              {/* SEO Score */}
              <div className="text-center shrink-0">
                <div className={cn("text-xl font-bold", item.seoScore >= 80 ? "text-emerald-500" : item.seoScore >= 60 ? "text-amber-500" : "text-red-500")}>{item.seoScore}</div>
                <div className="text-[10px] text-[var(--text-muted)]">SEO Score</div>
              </div>
              {/* Status */}
              <Badge variant={sc.badge} className="shrink-0">{sc.label}</Badge>
              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-base">
                {item.status === "pending_approval" && (
                  <Button variant="primary" size="sm" icon={<CheckCircle2 size={12}/>}>Approve</Button>
                )}
                <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-base">
                  <Edit3 size={13}/>
                </button>
                <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-base">
                  <Eye size={13}/>
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
