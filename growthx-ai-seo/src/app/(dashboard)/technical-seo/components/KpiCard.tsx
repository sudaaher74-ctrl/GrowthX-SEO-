"use client";

import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, Activity, AlertCircle, AlertTriangle, CheckCircle2, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  id: string;
  label: string;
  value: string;
  trend: string;
  sparkline: number[];
  index: number;
}

const iconMap: Record<string, any> = {
  health: { icon: Activity, color: "text-[var(--color-success-500)]", bg: "bg-green-50 dark:bg-green-900/10" },
  crawled: { icon: Search, color: "text-[var(--color-brand-500)]", bg: "bg-blue-50 dark:bg-blue-900/10" },
  critical: { icon: AlertCircle, color: "text-[var(--color-error-500)]", bg: "bg-red-50 dark:bg-red-900/10" },
  warnings: { icon: AlertTriangle, color: "text-[var(--color-warning-500)]", bg: "bg-amber-50 dark:bg-amber-900/10" },
  lcp: { icon: Zap, color: "text-[var(--color-success-500)]", bg: "bg-green-50 dark:bg-green-900/10" },
  cwv: { icon: Activity, color: "text-[var(--color-success-500)]", bg: "bg-green-50 dark:bg-green-900/10" },
  indexed: { icon: CheckCircle2, color: "text-[var(--color-brand-500)]", bg: "bg-blue-50 dark:bg-blue-900/10" },
  aifix: { icon: Zap, color: "text-[var(--color-accent-500)]", bg: "bg-indigo-50 dark:bg-indigo-900/10" },
};

export function KpiCard({ id, label, value, trend, sparkline, index }: KpiCardProps) {
  const isPositive = trend.startsWith('+') || trend === '0';
  const isErrorKpi = id === 'critical' || id === 'warnings';
  
  // For error KPIs, a negative trend (less errors) is actually good.
  const isGoodTrend = isErrorKpi ? !isPositive : isPositive;
  
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;
  const config = iconMap[id] || iconMap.health;
  const Icon = config.icon;

  const data = sparkline.map((val, i) => ({ value: val, index: i }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-[var(--card-bg)] rounded-[var(--radius-lg)] border border-[var(--border-color)] p-4 shadow-sm hover:shadow-card-hover transition-shadow duration-300 group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-2 rounded-md", config.bg, config.color)}>
          <Icon size={18} />
        </div>
        <div className={cn("flex items-center text-xs font-medium px-2 py-1 rounded-full", 
          isGoodTrend ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" 
                      : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
        )}>
          <TrendIcon size={12} className="mr-1" />
          {trend}
        </div>
      </div>
      
      <div>
        <h3 className="text-[var(--text-muted)] text-sm font-medium mb-1">{label}</h3>
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          <div className="w-16 h-8 opacity-60 group-hover:opacity-100 transition-opacity">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={isGoodTrend ? "var(--color-success-500)" : "var(--color-error-500)"} 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
