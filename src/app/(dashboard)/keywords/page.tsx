"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { mockKeywords } from "@/lib/mock-data";
import { Badge, TrendBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Search, Filter, Download, Plus, TrendingUp, Sparkles } from "lucide-react";

const intentColors: Record<string, "info" | "success" | "warning" | "pending" | "default"> = {
  Informational: "info",
  Commercial: "success",
  Transactional: "warning",
  Navigational: "default",
};

const difficultyColor = (d: number) => d <= 30 ? "text-emerald-500" : d <= 55 ? "text-amber-500" : "text-red-500";
const opportunityColor = (o: number) => o >= 85 ? "text-emerald-500" : o >= 65 ? "text-amber-500" : "text-slate-400";

export default function KeywordsPage() {
  const [query, setQuery] = useState("milk delivery");

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Keyword Research</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Discover keyword opportunities powered by real search data</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Download size={13}/>}>Export</Button>
          <Button variant="primary" size="sm" icon={<Plus size={13}/>}>Add to Tracker</Button>
        </div>
      </motion.div>

      {/* Search bar */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-4">
        <div className="flex gap-3">
          <div className="flex-1 flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2 focus-within:border-indigo-500 transition-base">
            <Search size={15} className="text-[var(--text-muted)] shrink-0"/>
            <input value={query} onChange={e => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
              placeholder="Enter seed keyword..."/>
          </div>
          <Button variant="primary" icon={<Sparkles size={13}/>}>Research</Button>
        </div>
        <div className="flex items-center gap-2 mt-3">
          {["India", "English", "Google", "All intents"].map(tag => (
            <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-[var(--surface-3)] text-[var(--text-secondary)] cursor-pointer hover:border-indigo-400 border border-[var(--border-color)] transition-base">{tag}</span>
          ))}
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Keywords Found", value: mockKeywords.length.toString(), color: "text-indigo-500" },
          { label: "Avg Difficulty", value: "36", suffix: "/100", color: "text-amber-500" },
          { label: "Total Volume", value: formatNumber(mockKeywords.reduce((s, k) => s + k.volume, 0)), color: "text-emerald-500" },
          { label: "Easy Wins", value: mockKeywords.filter(k => k.difficulty <= 30).length.toString(), color: "text-violet-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card p-4 text-center">
            <div className={cn("text-3xl font-bold", s.color)}>{s.value}<span className="text-lg">{s.suffix}</span></div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Keywords ({mockKeywords.length})</h3>
          <div className="flex items-center gap-2">
            {["All", "Informational", "Commercial", "Transactional"].map(f => (
              <button key={f} className={cn("px-2.5 py-1 text-xs rounded-md font-medium transition-base",
                f === "All" ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
              )}>{f}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th className="text-right">Volume</th>
                <th className="text-right">Difficulty</th>
                <th className="text-right">CPC</th>
                <th>Intent</th>
                <th className="text-right">Trend</th>
                <th className="text-right">Opportunity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mockKeywords.map((kw, i) => (
                <motion.tr key={kw.keyword} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 * i }}>
                  <td className="font-medium text-sm text-[var(--text-primary)]">{kw.keyword}</td>
                  <td className="text-right text-sm font-medium">{formatNumber(kw.volume)}</td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <div className="w-12 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${kw.difficulty}%`, background: kw.difficulty <= 30 ? "#10b981" : kw.difficulty <= 55 ? "#f59e0b" : "#ef4444" }}/>
                      </div>
                      <span className={cn("text-sm font-bold w-8 text-right", difficultyColor(kw.difficulty))}>{kw.difficulty}</span>
                    </div>
                  </td>
                  <td className="text-right text-sm">${kw.cpc}</td>
                  <td><Badge variant={intentColors[kw.intent]}>{kw.intent}</Badge></td>
                  <td className="text-right"><TrendBadge value={kw.trend === "up" ? 1 : 0} suffix="" /></td>
                  <td className="text-right">
                    <span className={cn("text-sm font-bold", opportunityColor(kw.opportunity))}>{kw.opportunity}</span>
                    {kw.opportunity >= 90 && <span className="ml-1">⭐</span>}
                  </td>
                  <td>
                    <Button variant="ghost" size="sm" icon={<Plus size={12}/>}>Track</Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
