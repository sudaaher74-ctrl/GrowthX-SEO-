"use client";
import { motion } from "framer-motion";
import { mockAutomations } from "@/lib/mock-data";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Play, Pause, Trash2, Edit3, Zap, Clock, Calendar, Bell, FileBarChart, Mail, CheckCircle2, ChevronRight } from "lucide-react";

const templates = [
  { id: "weekly-audit", name: "Weekly Technical Audit", description: "Every Monday — crawl site, generate issue report, email client", trigger: "Schedule", icon: <Calendar size={16}/>, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/10" },
  { id: "new-product", name: "New Product SEO", description: "On new product — generate meta, schema, OG, alt text automatically", trigger: "Event", icon: <Zap size={16}/>, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-900/10" },
  { id: "rank-drop", name: "Rank Drop Alert", description: "Position drops >5 spots — notify owner and generate fix suggestions", trigger: "Alert", icon: <Bell size={16}/>, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/10" },
  { id: "monthly-report", name: "Monthly Client Report", description: "1st of month — generate PDF/Excel report and email to client", trigger: "Schedule", icon: <FileBarChart size={16}/>, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/10" },
  { id: "content-refresh", name: "Content Refresh", description: "Page traffic drops 20% — AI suggests content improvements", trigger: "Alert", icon: <CheckCircle2 size={16}/>, color: "text-fuchsia-500", bg: "bg-fuchsia-50 dark:bg-fuchsia-900/10" },
];

export default function AutomationsPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Automation Engine</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Create workflows that do SEO work automatically — you just approve</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={13}/>}>New Automation</Button>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active", value: mockAutomations.filter(a => a.status === "active").length, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-900/10" },
          { label: "Paused", value: mockAutomations.filter(a => a.status === "paused").length, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/10" },
          { label: "Runs This Month", value: 47, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-900/10" },
          { label: "Tasks Automated", value: 312, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-900/10" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={cn("card p-4 text-center", s.bg)}>
            <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Active Automations */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your Automations</h3>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {mockAutomations.map((auto, i) => (
            <motion.div key={auto.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 * i }}
              className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)] group">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                auto.status === "active" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-slate-100 dark:bg-slate-800")}>
                <Zap size={16} className={auto.status === "active" ? "text-emerald-500" : "text-slate-400"}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{auto.name}</span>
                  <StatusDot status={auto.status === "active" ? "success" : "warning"} pulse={auto.status === "active"}/>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--text-muted)]">
                  <span className="flex items-center gap-1"><Clock size={10}/>{auto.trigger}</span>
                  <span>Last: {auto.lastRun}</span>
                  <span>Next: {auto.nextRun}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="ghost" size="sm" icon={auto.status === "active" ? <Pause size={12}/> : <Play size={12}/>}>
                  {auto.status === "active" ? "Pause" : "Resume"}
                </Button>
                <button className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-base opacity-0 group-hover:opacity-100">
                  <Edit3 size={12}/>
                </button>
                <button className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-base opacity-0 group-hover:opacity-100">
                  <Trash2 size={12}/>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Templates */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Quick Templates</h3>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {templates.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}
              className="card p-4 hover:shadow-card-hover cursor-pointer group">
              <div className="flex items-start gap-3 mb-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", t.bg)}>
                  <span className={t.color}>{t.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{t.name}</div>
                  <Badge variant="default" className="mt-0.5">{t.trigger}</Badge>
                </div>
              </div>
              <p className="text-xs text-[var(--text-muted)] mb-3 leading-relaxed">{t.description}</p>
              <Button variant="secondary" size="sm" className="w-full" iconRight={<ChevronRight size={12}/>}>Use Template</Button>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
