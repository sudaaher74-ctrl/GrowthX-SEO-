"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { FileBarChart, Download, Mail, Calendar, Plus, CheckCircle2 } from "lucide-react";

const reports = [
  { id: 1, name: "July 2026 SEO Report", client: "MilQuu", date: "2026-07-27", type: "Monthly", format: "PDF", status: "ready" },
  { id: 2, name: "Week 30 Performance", client: "MilQuu", date: "2026-07-26", type: "Weekly", format: "Excel", status: "ready" },
  { id: 3, name: "Q2 2026 Quarterly Review", client: "GrowthX Agency", date: "2026-07-01", type: "Quarterly", format: "PDF", status: "ready" },
  { id: 4, name: "Competitor Analysis Report", client: "MilQuu", date: "2026-07-20", type: "Custom", format: "PDF", status: "ready" },
  { id: 5, name: "Technical SEO Audit Report", client: "Client X", date: "2026-07-15", type: "Custom", format: "CSV", status: "generating" },
];

const reportSections = [
  { label: "Executive Summary", checked: true },
  { label: "GSC Performance", checked: true },
  { label: "Organic Traffic", checked: true },
  { label: "Keyword Rankings", checked: true },
  { label: "Core Web Vitals", checked: true },
  { label: "Technical Issues", checked: true },
  { label: "Content Performance", checked: false },
  { label: "Backlinks", checked: false },
  { label: "Competitor Overview", checked: true },
  { label: "AI Recommendations", checked: true },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Reports</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Generate beautiful PDF, Excel, and CSV SEO reports — white-label ready</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={13}/>}>Generate Report</Button>
      </motion.div>

      <div className="grid xl:grid-cols-3 gap-6">
        {/* Report Builder */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Quick Report Builder</h3>
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Period</label>
              <select className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500">
                <option>This Month (July 2026)</option>
                <option>Last Month (June 2026)</option>
                <option>Last 90 Days</option>
                <option>Q2 2026</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Format</label>
              <div className="flex gap-2">
                {["PDF", "Excel", "CSV"].map(f => (
                  <button key={f} className={cn("flex-1 text-xs py-2 rounded-lg border font-medium transition-base",
                    f === "PDF" ? "border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400" : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-indigo-400"
                  )}>{f}</button>
                ))}
              </div>
            </div>
          </div>
          <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Sections</h4>
          <div className="space-y-1.5 mb-4">
            {reportSections.map(({ label, checked }) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" defaultChecked={checked} className="accent-indigo-500"/>
                <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-base">{label}</span>
              </label>
            ))}
          </div>
          <Button variant="primary" className="w-full" icon={<FileBarChart size={13}/>}>Generate Report</Button>
        </motion.div>

        {/* Existing Reports */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="xl:col-span-2 card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Report History</h3>
          </div>
          <div className="divide-y divide-[var(--border-color)]">
            {reports.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 * i }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)] group">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                  <FileBarChart size={16} className="text-indigo-500"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{r.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)]">
                    <span>{r.client}</span>
                    <span>·</span>
                    <span>{r.date}</span>
                    <Badge variant="default">{r.type}</Badge>
                    <Badge variant="info">{r.format}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={r.status === "ready" ? "success" : "pending"}>
                    {r.status === "ready" ? "Ready" : "Generating..."}
                  </Badge>
                  {r.status === "ready" && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-base">
                      <Button variant="secondary" size="sm" icon={<Download size={12}/>}>Download</Button>
                      <Button variant="ghost" size="sm" icon={<Mail size={12}/>}>Email</Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
