"use client";
import { motion } from "framer-motion";
import { mockTopKeywords, mockTrafficData } from "@/lib/mock-data";
import { formatNumber, formatRelativeTime } from "@/lib/utils";
import { Badge, TrendBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard } from "@/components/ui/metric-card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, LineChart, Line
} from "recharts";
import { MousePointer2, Eye, Percent, Navigation, Download, RefreshCw, Filter } from "lucide-react";

const gscMetrics = { clicks: 24830, impressions: 387500, ctr: 6.41, avgPosition: 14.2 };
const sparklines = {
  clicks: Array.from({ length: 14 }, () => Math.round(700 + Math.random() * 400)),
  impressions: Array.from({ length: 14 }, () => Math.round(10000 + Math.random() * 4000)),
  ctr: Array.from({ length: 14 }, () => parseFloat((5.5 + Math.random() * 2).toFixed(2))),
  avgPosition: Array.from({ length: 14 }, () => parseFloat((12 + Math.random() * 6).toFixed(1))),
};
const gscByDevice = [
  { device: "Mobile", clicks: 14200, impressions: 220000, ctr: 6.5, position: 13.8 },
  { device: "Desktop", clicks: 9100, impressions: 148000, ctr: 6.1, position: 14.9 },
  { device: "Tablet", clicks: 1530, impressions: 19500, ctr: 7.8, position: 12.4 },
];
const gscCountries = [
  { country: "India", clicks: 19800, share: 79.7 },
  { country: "United States", clicks: 1840, share: 7.4 },
  { country: "United Kingdom", clicks: 820, share: 3.3 },
  { country: "Canada", clicks: 560, share: 2.3 },
  { country: "Australia", clicks: 430, share: 1.7 },
];
const slicedData = mockTrafficData.slice(-28);

export default function SearchConsolePage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Google Search Console</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">milquu.com · Last updated 4 minutes ago</p>
        </div>
        <div className="flex items-center gap-2">
          {["7d", "28d", "90d"].map((p) => (
            <button key={p} className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-base ${p === "28d" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : "text-[var(--text-muted)] hover:bg-[var(--surface-3)]"}`}>{p}</button>
          ))}
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13}/>}>Sync</Button>
          <Button variant="secondary" size="sm" icon={<Download size={13}/>}>Export</Button>
        </div>
      </motion.div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard title="Total Clicks" value={gscMetrics.clicks} delta={12.4} icon={<MousePointer2 size={14}/>} sparklineData={sparklines.clicks} delay={0.1}/>
        <MetricCard title="Impressions" value={gscMetrics.impressions} delta={8.7} icon={<Eye size={14}/>} sparklineData={sparklines.impressions} sparklineColor="#8b5cf6" delay={0.15}/>
        <MetricCard title="Average CTR" value={gscMetrics.ctr} delta={0.8} format="percent" icon={<Percent size={14}/>} sparklineData={sparklines.ctr} sparklineColor="#a855f7" delay={0.2}/>
        <MetricCard title="Avg Position" value={gscMetrics.avgPosition} delta={-2.1} format="position" invertDelta icon={<Navigation size={14}/>} sparklineData={sparklines.avgPosition} sparklineColor="#d946ef" delay={0.25}/>
      </div>

      {/* Performance chart */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Performance Over Time</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={slicedData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gscGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35}/>
                  <stop offset="100%" stopColor="#7c3aed" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)"/>
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval={4}/>
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={formatNumber}/>
              <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "12px" }}/>
              <Area type="monotone" dataKey="organic" name="Clicks" stroke="#7c3aed" strokeWidth={2} fill="url(#gscGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid xl:grid-cols-2 gap-4">
        {/* Top Queries */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Queries</h3>
            <Button variant="ghost" size="sm" icon={<Filter size={13}/>}>Filter</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th className="text-right">Clicks</th>
                  <th className="text-right">Impr.</th>
                  <th className="text-right">CTR</th>
                  <th className="text-right">Pos.</th>
                </tr>
              </thead>
              <tbody>
                {mockTopKeywords.map((kw) => (
                  <tr key={kw.keyword}>
                    <td className="max-w-[180px]"><span className="text-xs font-medium text-[var(--text-primary)] truncate block">{kw.keyword}</span></td>
                    <td className="text-right text-sm font-medium">{formatNumber(kw.clicks)}</td>
                    <td className="text-right text-sm">{formatNumber(kw.volume)}</td>
                    <td className="text-right text-sm">{kw.ctr}%</td>
                    <td className="text-right font-bold text-sm">{kw.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Devices + Countries */}
        <div className="space-y-4">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">By Device</h3>
            <div className="space-y-2">
              {gscByDevice.map((d) => (
                <div key={d.device} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">{d.device}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">{formatNumber(d.clicks)}</span>
                    <span className="text-xs text-[var(--text-muted)] w-12 text-right">{d.ctr}% CTR</span>
                    <span className="text-xs text-[var(--text-muted)] w-10 text-right">#{d.position.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="card p-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">By Country</h3>
            <div className="space-y-2">
              {gscCountries.map((c) => (
                <div key={c.country}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-[var(--text-secondary)]">{c.country}</span>
                    <span className="text-sm font-medium">{formatNumber(c.clicks)}</span>
                  </div>
                  <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${c.share}%` }} transition={{ duration: 0.8, delay: 0.5 }}
                      className="h-full rounded-full bg-purple-500"/>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
