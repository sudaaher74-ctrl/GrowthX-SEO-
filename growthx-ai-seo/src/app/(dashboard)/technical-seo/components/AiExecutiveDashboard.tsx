"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ArrowUpRight, Activity, DollarSign, Users, Globe, Zap, Search, ShieldCheck, Clock, FileCode2, BarChart2, Bot } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

const sparklineData = Array.from({ length: 14 }).map(() => ({ value: 0 }));

export function AiExecutiveDashboard({ crawlData, issues, progress }: { crawlData: any, issues: any[], progress: any }) {
  const kpis = [
    { title: "SEO Health Score", value: crawlData ? "84/100" : "N/A", trend: "0%", good: true, icon: Activity, sparkline: sparklineData },
    { title: "AI Confidence", value: "N/A", trend: "0%", good: true, icon: Bot, sparkline: sparklineData },
    { title: "Est. Organic Gain", value: "Pending GA4", trend: "0%", good: true, icon: TrendingUp, sparkline: sparklineData },
    { title: "Est. Revenue Gain", value: "Pending GA4", trend: "$0", good: true, icon: DollarSign, sparkline: sparklineData },
    { title: "Keywords Recov.", value: "N/A", trend: "0", good: true, icon: BarChart2, sparkline: sparklineData },
    { title: "Pages Crawled", value: progress ? progress.pagesCrawled : (crawlData?.pagesCrawled || "0"), trend: "0", good: true, icon: FileCode2, sparkline: sparklineData },
    { title: "Critical Issues", value: issues?.filter(i => i.severity === 'CRITICAL').length || "0", trend: "0", good: true, icon: TrendingDown, sparkline: sparklineData },
    { title: "Warnings", value: issues?.filter(i => i.severity === 'HIGH').length || "0", trend: "0", good: true, icon: TrendingDown, sparkline: sparklineData },
    { title: "Passed Checks", value: "N/A", trend: "0", good: true, icon: ShieldCheck, sparkline: sparklineData },
    { title: "Est. Fix Time", value: "N/A", trend: "0", good: true, icon: Clock, sparkline: sparklineData },
    { title: "Score After AI", value: "N/A", trend: "0", good: true, icon: ArrowUpRight, sparkline: sparklineData },
    { title: "Google Coverage", value: "Pending GSC", trend: "0%", good: true, icon: Search, sparkline: sparklineData },
    { title: "Core Web Vitals", value: "Pending API", trend: "0%", good: true, icon: Zap, sparkline: sparklineData },
    { title: "Auto-Fix Success", value: "N/A", trend: "0%", good: true, icon: Globe, sparkline: sparklineData }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {kpis.map((kpi, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.03 }}
          className="group relative bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl p-4 overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:border-[var(--color-brand-400)] dark:hover:border-[var(--color-brand-600)] transition-all duration-300 flex flex-col justify-between h-[130px]"
        >
          {/* Subtle Glow Background */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-brand-500)]/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-[var(--color-brand-500)]/10 transition-colors" />

          <div className="flex items-start justify-between relative z-10">
            <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide">{kpi.title}</span>
            <div className={`p-1.5 rounded-lg ${kpi.good ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
              <kpi.icon size={14} />
            </div>
          </div>

          <div className="relative z-10 mt-2">
            <div className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{kpi.value}</div>
            <div className={`text-xs font-medium mt-1 flex items-center gap-1 ${kpi.good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {kpi.good ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {kpi.trend}
            </div>
          </div>

          {/* Sparkline Background */}
          <div className="absolute bottom-0 left-0 right-0 h-12 opacity-20 group-hover:opacity-40 transition-opacity pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kpi.sparkline}>
                <defs>
                  <linearGradient id={`color-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={kpi.good ? '#10b981' : '#ef4444'} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={kpi.good ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={kpi.good ? '#10b981' : '#ef4444'} strokeWidth={2} fillOpacity={1} fill={`url(#color-${idx})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
