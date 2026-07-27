"use client";
import { motion } from "framer-motion";
import { useState } from "react";
import { mockRankTracking, mockRankingHistory } from "@/lib/mock-data";
import { TrendBadge, Badge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Plus, Bell, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

export default function RankTrackingPage() {
  const [device, setDevice] = useState<"all" | "mobile" | "desktop">("all");

  const keywords = device === "all" ? mockRankTracking : mockRankTracking.filter(k => k.device === device);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Rank Tracking</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Daily position tracking for {mockRankTracking.length} keywords</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Bell size={13}/>}>Alerts</Button>
          <Button variant="secondary" size="sm" icon={<Download size={13}/>}>Export</Button>
          <Button variant="primary" size="sm" icon={<Plus size={13}/>}>Add Keywords</Button>
        </div>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Tracking", value: "8", sub: "keywords", color: "text-indigo-500" },
          { label: "Top 3", value: "2", sub: "keywords", color: "text-emerald-500" },
          { label: "Top 10", value: "4", sub: "keywords", color: "text-violet-500" },
          { label: "Improved", value: "6", sub: "this week", color: "text-blue-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card p-4 text-center">
            <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
            <div className="text-[10px] text-[var(--text-muted)]">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Ranking History Chart */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Position History (30 days)</h3>
          <div className="flex items-center gap-1">
            {(["all","mobile","desktop"] as const).map((d) => (
              <button key={d} onClick={() => setDevice(d)} className={cn("px-2.5 py-1 text-xs rounded-md font-medium capitalize transition-base",
                device === d ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
              )}>{d}</button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockRankingHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)"/>
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval={5}/>
              <YAxis reversed tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} domain={[1, 30]}/>
              <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "12px" }}/>
              <Legend wrapperStyle={{ fontSize: "12px" }}/>
              <Line type="monotone" dataKey="milk delivery panvel" stroke="#6366f1" strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="fresh milk subscription" stroke="#10b981" strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="organic milk home delivery" stroke="#f59e0b" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Keywords Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Tracked Keywords</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th className="text-right">Current</th>
                <th className="text-right">Previous</th>
                <th className="text-right">Change</th>
                <th className="text-right">Volume</th>
                <th>Device</th>
                <th>URL</th>
              </tr>
            </thead>
            <tbody>
              {keywords.map((kw) => (
                <tr key={kw.keyword}>
                  <td className="font-medium text-sm text-[var(--text-primary)]">{kw.keyword}</td>
                  <td className="text-right">
                    <span className={cn("text-lg font-bold", kw.position <= 3 ? "text-emerald-500" : kw.position <= 10 ? "text-indigo-500" : "text-[var(--text-primary)]")}>
                      #{kw.position}
                    </span>
                  </td>
                  <td className="text-right text-sm text-[var(--text-muted)]">#{kw.prev}</td>
                  <td className="text-right">
                    <TrendBadge value={kw.change} suffix="" invertColor/>
                  </td>
                  <td className="text-right text-sm">{formatNumber(kw.volume)}</td>
                  <td><Badge variant={kw.device === "mobile" ? "info" : "default"}>{kw.device}</Badge></td>
                  <td><code className="text-xs text-indigo-400 font-mono">{kw.url}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
