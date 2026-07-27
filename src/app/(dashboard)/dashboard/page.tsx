"use client";
import { motion } from "framer-motion";
import { MetricCard } from "@/components/ui/metric-card";
import { ScoreRing } from "@/components/ui/score-ring";
import { Badge, TrendBadge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  mockMetrics, mockTrafficData, mockTopKeywords, mockTopPages,
  mockTechnicalIssues, mockCompetitors, mockGeoVisibility,
  mockRecentActivity, mockAutomations, mockSparklines,
  mockCoreWebVitals, mockIndexStatus, mockTrafficSources
} from "@/lib/mock-data";
import { formatNumber, formatRelativeTime, getDeltaColor } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import {
  MousePointer2, Eye, Percent, Navigation, Users, DollarSign,
  AlertTriangle, CheckCircle2, RefreshCw, Plus, ArrowRight,
  Zap, Clock, TrendingUp, Globe, Bot, Play, Pause
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

const FADE_UP = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: "easeOut" as const },
};

const stagger = (i: number) => ({ ...FADE_UP, transition: { ...FADE_UP.transition, delay: i * 0.07 } });

const cvColors = { good: "#10b981", "needs-improvement": "#f59e0b", poor: "#ef4444" };

function getCVStatus(metric: { value: number; threshold: { good: number; poor: number } }) {
  if (metric.value <= metric.threshold.good) return "good";
  if (metric.value <= metric.threshold.poor) return "needs-improvement";
  return "poor";
}

const SOURCE_COLORS = ["#6366f1", "#8b5cf6", "#a855f7", "#06b6d4", "#10b981"];

export default function DashboardPage() {
  const trafficSlice = mockTrafficData.slice(-30);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <motion.div {...stagger(0)} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">
            Welcome back, <span className="gradient-text-brand">Sudarshan</span> 👋
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            milquu.com · Last synced 4 minutes ago
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={13} />}>
            Sync Now
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={13} />}>
            Run Audit
          </Button>
        </div>
      </motion.div>

      {/* ── Score Rings ── */}
      <motion.div {...stagger(1)} className="card p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-h3 text-[var(--text-primary)]">SEO Health Overview</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">milquu.com — July 2026</p>
          </div>
          <div className="flex items-center gap-8 flex-wrap justify-center">
            <ScoreRing score={mockMetrics.seoHealthScore} label="SEO Health Score" sublabel="/100" delay={0.5} size={110} />
            <ScoreRing score={mockMetrics.aiSeoScore} label="AI SEO Score" sublabel="/100" delay={0.7} size={110} color="#8b5cf6" />
            <ScoreRing score={mockMetrics.websiteScore} label="Website Score" sublabel="/100" delay={0.9} size={110} color="#06b6d4" />
          </div>
          <div className="flex flex-col gap-2 text-sm min-w-36">
            {[
              { label: "Indexed Pages", value: mockMetrics.indexedPages.toLocaleString(), color: "text-emerald-400" },
              { label: "Total Keywords", value: "847", color: "text-indigo-400" },
              { label: "Active Issues", value: mockTechnicalIssues.total.toString(), color: "text-amber-400" },
              { label: "Backlinks", value: formatNumber(mockMetrics.backlinks), color: "text-violet-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between gap-4">
                <span className="text-[var(--text-muted)]">{label}</span>
                <span className={cn("font-bold", color)}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Metric Cards Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { title: "Clicks", value: mockMetrics.clicks, delta: mockMetrics.clicksDelta, icon: <MousePointer2 size={14}/>, spark: mockSparklines.clicks, color: "#6366f1" },
          { title: "Impressions", value: mockMetrics.impressions, delta: mockMetrics.impressionsDelta, icon: <Eye size={14}/>, spark: mockSparklines.impressions, color: "#8b5cf6" },
          { title: "CTR", value: mockMetrics.ctr, delta: mockMetrics.ctrDelta, icon: <Percent size={14}/>, spark: mockSparklines.ctr, format: "percent" as const, color: "#a855f7" },
          { title: "Avg Position", value: mockMetrics.avgPosition, delta: mockMetrics.avgPositionDelta, icon: <Navigation size={14}/>, spark: mockSparklines.avgPosition, format: "position" as const, color: "#06b6d4", invertDelta: true },
          { title: "Organic Traffic", value: mockMetrics.organicTraffic, delta: mockMetrics.organicTrafficDelta, icon: <Users size={14}/>, spark: mockSparklines.organicTraffic, color: "#10b981" },
          { title: "Conversions", value: mockMetrics.conversions, delta: mockMetrics.conversionsDelta, icon: <DollarSign size={14}/>, spark: mockSparklines.conversions, color: "#f59e0b" },
        ].map((m, i) => (
          <MetricCard
            key={m.title}
            title={m.title}
            value={m.value}
            delta={m.delta}
            format={m.format ?? "number"}
            sparklineData={m.spark}
            sparklineColor={m.color}
            icon={m.icon}
            delay={i * 0.06}
            invertDelta={m.invertDelta}
          />
        ))}
      </div>

      {/* ── Traffic Chart + Index Status ── */}
      <div className="grid xl:grid-cols-3 gap-4">
        {/* Traffic Over Time */}
        <motion.div {...stagger(3)} className="xl:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Organic Traffic</h3>
              <p className="text-xs text-[var(--text-muted)]">Last 30 days</p>
            </div>
            <div className="flex items-center gap-1">
              {["7d", "30d", "90d"].map((p) => (
                <button key={p} className={cn(
                  "px-2 py-1 text-xs rounded font-medium transition-base",
                  p === "30d" ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                )}>{p}</button>
              ))}
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficSlice} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradOrganic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradDirect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => v.slice(5)} interval={6}/>
                <YAxis tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={formatNumber}/>
                <Tooltip
                  contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "var(--text-primary)", fontWeight: 600 }}
                  itemStyle={{ color: "var(--text-secondary)" }}
                />
                <Area type="monotone" dataKey="organic" name="Organic" stroke="#6366f1" strokeWidth={2} fill="url(#gradOrganic)" dot={false}/>
                <Area type="monotone" dataKey="direct" name="Direct" stroke="#10b981" strokeWidth={1.5} fill="url(#gradDirect)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Traffic Sources */}
        <motion.div {...stagger(4)} className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Traffic Sources</h3>
          <div className="flex justify-center mb-4">
            <PieChart width={140} height={140}>
              <Pie data={mockTrafficSources} cx={65} cy={65} innerRadius={42} outerRadius={62} paddingAngle={3} dataKey="sessions">
                {mockTrafficSources.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }}
              />
            </PieChart>
          </div>
          <div className="space-y-2.5">
            {mockTrafficSources.map((s) => (
              <div key={s.source} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }}/>
                  <span className="text-xs text-[var(--text-secondary)]">{s.source}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{formatNumber(s.sessions)}</span>
                  <span className="text-xs text-[var(--text-muted)] w-10 text-right">{s.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Core Web Vitals + Technical Issues ── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Core Web Vitals */}
        <motion.div {...stagger(5)} className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Core Web Vitals</h3>
            <Badge variant="success">All Good</Badge>
          </div>
          <div className="space-y-3">
            {Object.entries(mockCoreWebVitals).map(([key, metric]) => {
              const status = getCVStatus(metric as typeof mockCoreWebVitals.lcp);
              const pct = Math.min(100, ((metric.value) / (metric as typeof mockCoreWebVitals.lcp).threshold.poor) * 100);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{key.toUpperCase()}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-[var(--text-primary)]">{metric.value}{metric.unit}</span>
                      <Badge variant={status === "good" ? "success" : status === "needs-improvement" ? "warning" : "error"}>
                        {status === "good" ? "Good" : status === "needs-improvement" ? "Needs Work" : "Poor"}
                      </Badge>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, delay: 0.3 }}
                      className="h-full rounded-full"
                      style={{ background: cvColors[status as keyof typeof cvColors] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Technical Issues */}
        <motion.div {...stagger(6)} className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Technical Issues</h3>
            <Button variant="ghost" size="sm" iconRight={<ArrowRight size={12}/>}>View All</Button>
          </div>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "Critical", count: mockTechnicalIssues.critical, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/10" },
              { label: "High", count: mockTechnicalIssues.high, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/10" },
              { label: "Medium", count: mockTechnicalIssues.medium, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/10" },
              { label: "Low", count: mockTechnicalIssues.low, color: "text-slate-400", bg: "bg-slate-50 dark:bg-slate-800/30" },
            ].map(({ label, count, color, bg }) => (
              <div key={label} className={cn("rounded-lg p-3 text-center", bg)}>
                <div className={cn("text-2xl font-bold", color)}>{count}</div>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {mockTechnicalIssues.byCategory.slice(0, 5).map((issue) => (
              <div key={issue.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} className={cn(
                    issue.severity === "critical" ? "text-red-500" :
                    issue.severity === "high" ? "text-amber-500" : "text-yellow-400"
                  )}/>
                  <span className="text-xs text-[var(--text-secondary)]">{issue.name}</span>
                </div>
                <Badge variant={issue.severity === "critical" ? "error" : issue.severity === "high" ? "warning" : "default"}>
                  {issue.count}
                </Badge>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Top Keywords + Top Pages ── */}
      <div className="grid xl:grid-cols-2 gap-4">
        {/* Top Keywords */}
        <motion.div {...stagger(7)} className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Keywords</h3>
            <Button variant="ghost" size="sm" iconRight={<ArrowRight size={12}/>}>View All</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th className="text-right">Position</th>
                  <th className="text-right">Change</th>
                  <th className="text-right">Clicks</th>
                  <th className="text-right">CTR</th>
                </tr>
              </thead>
              <tbody>
                {mockTopKeywords.slice(0, 8).map((kw) => (
                  <tr key={kw.keyword}>
                    <td className="max-w-[180px]">
                      <span className="text-[var(--text-primary)] font-medium text-xs truncate block">{kw.keyword}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">Vol: {formatNumber(kw.volume)}/mo</span>
                    </td>
                    <td className="text-right font-bold text-sm">#{kw.position}</td>
                    <td className="text-right">
                      <TrendBadge value={kw.change} suffix="" invertColor />
                    </td>
                    <td className="text-right text-sm font-medium">{formatNumber(kw.clicks)}</td>
                    <td className="text-right text-sm">{kw.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Top Pages */}
        <motion.div {...stagger(8)} className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Pages</h3>
            <Button variant="ghost" size="sm" iconRight={<ArrowRight size={12}/>}>View All</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th className="text-right">Clicks</th>
                  <th className="text-right">CTR</th>
                  <th className="text-right">Position</th>
                </tr>
              </thead>
              <tbody>
                {mockTopPages.map((page) => (
                  <tr key={page.url}>
                    <td className="max-w-[200px]">
                      <span className="text-[var(--text-primary)] font-medium text-xs block truncate">{page.title}</span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{page.url}</span>
                    </td>
                    <td className="text-right font-medium text-sm">{formatNumber(page.clicks)}</td>
                    <td className="text-right text-sm">{page.ctr}%</td>
                    <td className="text-right font-bold text-sm">#{page.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* ── GEO / AI Search Visibility ── */}
      <motion.div {...stagger(9)} className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI Search Visibility (GEO)</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Brand visibility across AI-powered search platforms</p>
          </div>
          <Badge variant="info">
            {mockGeoVisibility.totalMentions} mentions <TrendBadge value={mockGeoVisibility.mentionsTrend} className="ml-1 inline-flex"/>
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {mockGeoVisibility.platforms.map((platform) => (
            <div key={platform.name} className="card p-3 text-center hover:shadow-card-hover cursor-pointer">
              <div className="text-2xl font-bold mb-1" style={{ color: platform.color }}>{platform.score}</div>
              <div className="text-xs text-[var(--text-muted)] mb-1.5 leading-tight">{platform.name}</div>
              <div className="flex items-center justify-center gap-1">
                <Globe size={10} className="text-[var(--text-muted)]"/>
                <span className="text-[10px] text-[var(--text-muted)]">{platform.mentions} mentions</span>
              </div>
              <TrendBadge value={platform.trend} className="mt-1 text-[10px]"/>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Competitor Overview ── */}
      <motion.div {...stagger(10)} className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Competitor Overview</h3>
          <Button variant="ghost" size="sm" iconRight={<ArrowRight size={12}/>}>Full Analysis</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Domain</th>
                <th className="text-right">Est. Traffic</th>
                <th className="text-right">Keywords</th>
                <th className="text-right">Backlinks</th>
                <th className="text-right">DA</th>
                <th className="text-right">Traffic Trend</th>
              </tr>
            </thead>
            <tbody>
              {/* Your site first */}
              <tr className="bg-indigo-50/50 dark:bg-indigo-900/10">
                <td><span className="text-indigo-600 dark:text-indigo-400 font-semibold text-sm">milquu.com</span> <Badge variant="info" className="ml-1">You</Badge></td>
                <td className="text-right font-medium text-sm">{formatNumber(mockMetrics.organicTraffic)}</td>
                <td className="text-right text-sm">847</td>
                <td className="text-right text-sm">{formatNumber(mockMetrics.backlinks)}</td>
                <td className="text-right font-bold text-sm">34</td>
                <td className="text-right"><TrendBadge value={15.3} /></td>
              </tr>
              {mockCompetitors.map((comp) => (
                <tr key={comp.domain}>
                  <td className="font-medium text-sm text-[var(--text-primary)]">{comp.domain}</td>
                  <td className="text-right text-sm">{formatNumber(comp.traffic)}</td>
                  <td className="text-right text-sm">{formatNumber(comp.keywords)}</td>
                  <td className="text-right text-sm">{formatNumber(comp.backlinks)}</td>
                  <td className="text-right font-bold text-sm">{comp.da}</td>
                  <td className="text-right"><TrendBadge value={comp.change} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Automations + Recent Activity ── */}
      <div className="grid xl:grid-cols-2 gap-4">
        {/* Automation Status */}
        <motion.div {...stagger(11)} className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-indigo-500"/>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Automation Status</h3>
            </div>
            <Button variant="primary" size="sm" icon={<Plus size={13}/>}>New</Button>
          </div>
          <div className="divide-y divide-[var(--border-color)]">
            {mockAutomations.map((auto) => (
              <div key={auto.id} className="flex items-center gap-3 px-5 py-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  auto.status === "active" ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-slate-100 dark:bg-slate-800"
                )}>
                  {auto.status === "active" ? <Play size={12} className="text-emerald-500"/> : <Pause size={12} className="text-slate-400"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)] truncate">{auto.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Clock size={10} className="text-[var(--text-muted)]"/>
                    <span className="text-xs text-[var(--text-muted)]">{auto.trigger}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <StatusDot status={auto.status === "active" ? "success" : "warning"} pulse={auto.status === "active"} />
                  <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Next: {auto.nextRun}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div {...stagger(12)} className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Activity</h3>
            <span className="text-xs text-[var(--text-muted)]">Real-time</span>
          </div>
          <div className="divide-y divide-[var(--border-color)]">
            {mockRecentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[var(--surface-2)] cursor-pointer transition-base">
                <StatusDot status={
                  item.status === "success" ? "success" :
                  item.status === "pending" ? "pending" :
                  item.status === "warning" ? "warning" : "error"
                } className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">{item.message}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{formatRelativeTime(item.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
