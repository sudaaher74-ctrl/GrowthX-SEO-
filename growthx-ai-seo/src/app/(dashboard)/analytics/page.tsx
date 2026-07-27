"use client";
import { motion } from "framer-motion";
import { mockTrafficSources, mockTrafficData } from "@/lib/mock-data";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Users, Activity, TrendingDown, DollarSign, RefreshCw, Sparkles } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar
} from "recharts";

const sparklines = {
  sessions: Array.from({ length: 14 }, () => Math.round(600 + Math.random() * 300)),
  users: Array.from({ length: 14 }, () => Math.round(400 + Math.random() * 200)),
  bounce: Array.from({ length: 14 }, () => parseFloat((35 + Math.random() * 15).toFixed(1))),
  conversions: Array.from({ length: 14 }, () => Math.round(8 + Math.random() * 8)),
};

const topLandingPages = [
  { url: "/milk-delivery-panvel", sessions: 2840, bounce: 28.4, convRate: 8.2, revenue: 12400 },
  { url: "/", sessions: 4280, bounce: 42.1, convRate: 4.8, revenue: 8200 },
  { url: "/products/a2-cow-milk", sessions: 1540, bounce: 31.2, convRate: 7.1, revenue: 6800 },
  { url: "/blog/benefits-a2-milk", sessions: 1180, bounce: 68.4, convRate: 1.2, revenue: 840 },
  { url: "/milk-delivery-kharghar", sessions: 1980, bounce: 29.8, convRate: 7.8, revenue: 9600 },
];

const slicedData = mockTrafficData.slice(-28);

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Google Analytics</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">milquu.com · GA4 · Last 28 days</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Sparkles size={13}/>}>AI Insights</Button>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13}/>}>Sync</Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard title="Sessions" value={31600} delta={18.4} icon={<Activity size={14}/>} sparklineData={sparklines.sessions} delay={0.1}/>
        <MetricCard title="Users" value={24200} delta={14.2} icon={<Users size={14}/>} sparklineData={sparklines.users} sparklineColor="#8b5cf6" delay={0.15}/>
        <MetricCard title="Bounce Rate" value={38.4} delta={-4.2} format="percent" icon={<TrendingDown size={14}/>} sparklineData={sparklines.bounce} sparklineColor="#f59e0b" delay={0.2} invertDelta/>
        <MetricCard title="Conversions" value={342} delta={22.1} icon={<DollarSign size={14}/>} sparklineData={sparklines.conversions} sparklineColor="#10b981" delay={0.25}/>
      </div>

      {/* Sessions Chart */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Sessions Over Time</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={slicedData} margin={{ left: -20 }}>
              <defs>
                <linearGradient id="ga4Grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35}/>
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)"/>
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} interval={4}/>
              <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={formatNumber}/>
              <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "12px" }}/>
              <Area type="monotone" dataKey="organic" name="Sessions" stroke="#8b5cf6" strokeWidth={2} fill="url(#ga4Grad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid xl:grid-cols-3 gap-4">
        {/* Traffic Sources */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Traffic Sources</h3>
          <div className="flex justify-center mb-3">
            <PieChart width={120} height={120}>
              <Pie data={mockTrafficSources} cx={55} cy={55} innerRadius={35} outerRadius={52} paddingAngle={3} dataKey="sessions">
                {mockTrafficSources.map((e, i) => <Cell key={i} fill={e.color}/>)}
              </Pie>
            </PieChart>
          </div>
          <div className="space-y-2">
            {mockTrafficSources.map(s => (
              <div key={s.source} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.color }}/>
                  <span className="text-xs text-[var(--text-secondary)]">{s.source}</span>
                </div>
                <span className="text-xs font-semibold">{s.percentage}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Top Landing Pages */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="xl:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Landing Pages</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th className="text-right">Sessions</th>
                  <th className="text-right">Bounce</th>
                  <th className="text-right">Conv. Rate</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topLandingPages.map(page => (
                  <tr key={page.url}>
                    <td><code className="text-xs text-purple-400 font-mono">{page.url}</code></td>
                    <td className="text-right text-sm font-medium">{formatNumber(page.sessions)}</td>
                    <td className="text-right">
                      <span className={cn("text-sm font-medium", page.bounce > 60 ? "text-red-500" : page.bounce > 40 ? "text-amber-500" : "text-emerald-500")}>{page.bounce}%</span>
                    </td>
                    <td className="text-right text-sm font-medium">{page.convRate}%</td>
                    <td className="text-right text-sm font-bold text-emerald-500">₹{formatNumber(page.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
