"use client";
import { motion } from "framer-motion";
import { mockBacklinks } from "@/lib/mock-data";
import { Badge, TrendBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Link2, Plus, Download, ExternalLink, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const typeConfig: Record<string, { badge: "success" | "error" | "default"; label: string }> = {
  new: { badge: "success", label: "New" },
  lost: { badge: "error", label: "Lost" },
  existing: { badge: "default", label: "Existing" },
};

export default function BacklinksPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Backlink Monitor</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Track new, lost, and existing backlinks to your domain</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Download size={13}/>}>Export</Button>
          <Button variant="primary" size="sm" icon={<Plus size={13}/>}>Disavow</Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Backlinks", value: "2,840", color: "text-indigo-500", delta: "+5.2%" },
          { label: "New (30d)", value: "3", color: "text-emerald-500", delta: "+3" },
          { label: "Lost (30d)", value: "1", color: "text-red-500", delta: "-1" },
          { label: "Domain Rating", value: "34", color: "text-violet-500", delta: "+2" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card p-4 text-center">
            <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
            <div className="text-xs text-emerald-500 mt-0.5">{s.delta}</div>
          </motion.div>
        ))}
      </div>

      {/* Backlinks Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Backlinks</h3>
          <div className="flex items-center gap-1">
            {["All", "New", "Lost", "High DR"].map(f => (
              <button key={f} className={cn("px-2.5 py-1 text-xs rounded-md font-medium transition-base",
                f === "All" ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
              )}>{f}</button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {mockBacklinks.map((link, i) => {
            const tc = typeConfig[link.type];
            return (
              <motion.div key={link.domain} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 * i }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)] group">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-3)] flex items-center justify-center shrink-0">
                  <Link2 size={14} className="text-[var(--text-muted)]"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{link.domain}</span>
                    <Badge variant={tc.badge}>{tc.label}</Badge>
                    {link.spam > 5 && <Badge variant="error">High Spam</Badge>}
                  </div>
                  <code className="text-xs text-indigo-400 font-mono truncate block">{link.url}</code>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]">
                    <span>Anchor: <span className="text-[var(--text-secondary)]">{link.anchor}</span></span>
                    <span>DA: <span className="font-semibold text-[var(--text-primary)]">{link.da}</span></span>
                    <span>Spam: <span className={cn("font-semibold", link.spam > 5 ? "text-red-500" : "text-emerald-500")}>{link.spam}/10</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[var(--text-muted)]">{link.date}</span>
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-base opacity-0 group-hover:opacity-100">
                    <ExternalLink size={12}/>
                  </a>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
